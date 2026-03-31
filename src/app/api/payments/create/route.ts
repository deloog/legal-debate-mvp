/**
 * 统一支付创建接口
 * POST /api/payments/create
 * 支持微信支付和支付宝支付
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import {
  PaymentMethod,
  CreateOrderResponse,
  OrderStatus,
  AlipayProductCode,
  WechatCreateOrderResponse,
  AlipayCreateOrderResponse,
} from '@/types/payment';
import { createOrder } from '@/lib/order/order-service';
import { paymentService } from '@/lib/payment/payment-service';
import {
  convertYuanToFen,
  calculateOrderExpireTime,
} from '@/lib/payment/wechat-utils';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit/logger';

/**
 * POST /api/payments/create
 * 创建支付订单（支持微信支付和支付宝）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        } as CreateOrderResponse,
        { status: 401 }
      );
    }
    const userId = authUser.userId;

    // 解析请求体
    const body = await request.json();
    const {
      membershipTierId,
      paymentMethod,
      billingCycle = 'MONTHLY',
      autoRenew = false,
      description,
      metadata = {},
    } = body;

    // 验证必填字段
    if (!membershipTierId || typeof membershipTierId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级ID不能为空',
          error: 'MISSING_TIER_ID',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 验证支付方式
    if (
      !paymentMethod ||
      !Object.values(PaymentMethod).includes(paymentMethod)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: '支付方式无效，请选择微信支付或支付宝',
          error: 'INVALID_PAYMENT_METHOD',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 验证计费周期
    const validBillingCycles = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME'];
    if (!validBillingCycles.includes(billingCycle)) {
      return NextResponse.json(
        {
          success: false,
          message: '计费周期无效',
          error: 'INVALID_BILLING_CYCLE',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 查询会员等级信息
    const tier = await prisma.membershipTier.findUnique({
      where: { id: membershipTierId },
    });

    if (!tier) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级不存在',
          error: 'TIER_NOT_FOUND',
        } as CreateOrderResponse,
        { status: 404 }
      );
    }

    if (!tier.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级暂不可用',
          error: 'TIER_INACTIVE',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 创建订单
    const order = await createOrder({
      userId,
      membershipTierId,
      paymentMethod,
      billingCycle,
      autoRenew,
      description: description || `开通${tier.displayName}会员`,
      metadata: {
        ...metadata,
        billingCycle,
        autoRenew,
      },
    });

    // 记录支付创建审计日志（异步）
    createAuditLog({
      userId,
      actionType: 'UNKNOWN',
      actionCategory: 'OTHER',
      description: `创建支付订单：${paymentMethod}，金额=${Number(order.amount)}`,
      resourceType: 'Order',
      resourceId: order.id,
      metadata: {
        paymentMethod,
        amount: Number(order.amount),
        orderNo: order.orderNo,
      },
    }).catch(auditErr => {
      logger.error('支付创建审计日志记录失败:', auditErr);
    });

    // 根据支付方式调用相应的支付服务
    try {
      const isMockMode = process.env.PAYMENT_MOCK_MODE === 'true';

      if (paymentMethod === PaymentMethod.WECHAT) {
        // 微信支付
        let codeUrl: string | undefined;
        let prepayId: string | undefined;

        if (isMockMode) {
          codeUrl = `weixin://wxpay/mock?orderNo=${order.orderNo}`;
          prepayId = `mock_prepay_${order.orderNo}`;
        } else {
          const expiredAt = calculateOrderExpireTime(120);
          const wechatResponse = (await paymentService.createOrder(
            PaymentMethod.WECHAT,
            {
              outTradeNo: order.orderNo,
              description: order.description,
              amount: {
                total: convertYuanToFen(Number(order.amount)),
                currency: order.currency,
              },
              attach: JSON.stringify({ orderId: order.id }),
              time_expire: Math.floor(expiredAt.getTime() / 1000),
            }
          )) as WechatCreateOrderResponse;
          codeUrl = wechatResponse.code_url;
          prepayId = wechatResponse.prepay_id;
        }

        return NextResponse.json({
          success: true,
          message: '订单创建成功',
          data: {
            orderId: order.id,
            orderNo: order.orderNo,
            amount: Number(order.amount),
            currency: order.currency,
            status: order.status as OrderStatus,
            expiredAt: order.expiredAt,
            paymentMethod: paymentMethod,
            codeUrl,
            prepayId,
          },
        } as CreateOrderResponse);
      } else if (paymentMethod === PaymentMethod.ALIPAY) {
        // 支付宝支付
        let qrCode: string | undefined;
        let tradeNo: string | undefined;

        if (isMockMode) {
          qrCode = `https://qr.alipay.com/mock?orderNo=${order.orderNo}`;
          tradeNo = `mock_trade_${order.orderNo}`;
        } else {
          const productCode =
            (metadata.productCode as AlipayProductCode) ||
            AlipayProductCode.FAST_INSTANT_TRADE_PAY;

          const alipayResponse = (await paymentService.createOrder(
            PaymentMethod.ALIPAY,
            {
              outTradeNo: order.orderNo,
              totalAmount: Number(order.amount),
              subject: order.description,
              body: order.description,
              productCode,
              timeExpire: 120,
              goodsType: '1',
            }
          )) as AlipayCreateOrderResponse;

          if (alipayResponse.code !== '10000') {
            throw new Error(alipayResponse.msg || '支付宝创建订单失败');
          }
          qrCode = alipayResponse.qrCode;
          tradeNo = alipayResponse.tradeNo;
        }

        return NextResponse.json({
          success: true,
          message: '订单创建成功',
          data: {
            orderId: order.id,
            orderNo: order.orderNo,
            amount: Number(order.amount),
            currency: order.currency,
            status: order.status as OrderStatus,
            expiredAt: order.expiredAt,
            paymentMethod: paymentMethod,
            qrCode,
            tradeNo,
          },
        } as CreateOrderResponse);
      } else {
        // 其他支付方式（余额支付等，暂不支持）
        return NextResponse.json(
          {
            success: false,
            message: '暂不支持该支付方式',
            error: 'PAYMENT_METHOD_NOT_SUPPORTED',
          } as CreateOrderResponse,
          { status: 501 }
        );
      }
    } catch (error) {
      // 调用支付服务失败
      logger.error('[API] 调用支付服务失败:', {
        orderId: order.id,
        orderNo: order.orderNo,
        paymentMethod,
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json(
        {
          success: false,
          message:
            paymentMethod === PaymentMethod.WECHAT
              ? '创建微信支付订单失败'
              : '创建支付宝支付订单失败',
          error: 'PAYMENT_SERVICE_ERROR',
        } as CreateOrderResponse,
        { status: 500 }
      );
    }
  } catch (error) {
    // 捕获所有未处理的错误
    logger.error('[API] 创建支付订单失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '创建订单失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      } as CreateOrderResponse,
      { status: 500 }
    );
  }
}
