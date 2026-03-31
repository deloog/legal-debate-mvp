/**
 * 创建支付订单API
 * POST /api/payment/create-order
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import {
  PaymentMethod,
  CreateOrderResponse,
  OrderStatus,
} from '@/types/payment';
import { createOrder } from '@/lib/order/order-service';
import { getWechatPay } from '@/lib/payment/wechat-pay';
import { convertYuanToFen } from '@/lib/payment/wechat-utils';
import { getAlipay } from '@/lib/payment/alipay';
import { AlipayProductCode } from '@/types/payment';
import { logger } from '@/lib/logger';

/**
 * POST /api/payment/create-order
 * 创建支付订单
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: 'UNAUTHORIZED',
        } as CreateOrderResponse,
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const {
      membershipTierId,
      paymentMethod,
      billingCycle,
      autoRenew,
      description,
    } = body;

    // 验证必填字段
    if (!membershipTierId) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级ID不能为空',
          error: 'MISSING_TIER_ID',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    if (
      !paymentMethod ||
      !Object.values(PaymentMethod).includes(paymentMethod)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: '支付方式无效',
          error: 'INVALID_PAYMENT_METHOD',
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
      userId: authUser.userId,
      membershipTierId,
      paymentMethod,
      billingCycle,
      autoRenew,
      description: description || `开通${tier.displayName}会员`,
      metadata: {
        billingCycle: billingCycle || 'MONTHLY',
        autoRenew: autoRenew || false,
      },
    });

    // 如果是微信支付，调用微信API创建支付
    if (paymentMethod === PaymentMethod.WECHAT) {
      try {
        const wechatPay = getWechatPay();

        const wechatResponse = await wechatPay.createOrder({
          outTradeNo: order.orderNo,
          description: order.description,
          amount: {
            total: convertYuanToFen(Number(order.amount)),
            currency: order.currency,
          },
          attach: JSON.stringify({ orderId: order.id }),
          time_expire: Math.floor(order.expiredAt.getTime() / 1000),
        });

        // 返回支付二维码链接
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
            codeUrl: wechatResponse.code_url,
          },
        } as CreateOrderResponse);
      } catch (error) {
        logger.error('[API] 调用微信支付失败:', error);
        return NextResponse.json(
          {
            success: false,
            message: '创建微信支付订单失败',
            error: 'WECHAT_PAY_ERROR',
          } as CreateOrderResponse,
          { status: 500 }
        );
      }
    }

    // 支付宝扫码支付
    if (paymentMethod === PaymentMethod.ALIPAY) {
      try {
        const alipayClient = getAlipay();

        const alipayResponse = await alipayClient.createOrder({
          outTradeNo: order.orderNo,
          subject: order.description,
          totalAmount: Number(order.amount),
          productCode: AlipayProductCode.FAST_INSTANT_TRADE_PAY,
          timeExpire: 120, // 分钟
        });

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
            qrCode: alipayResponse.qrCode,
          },
        } as CreateOrderResponse);
      } catch (error) {
        logger.error('[API] 调用支付宝失败:', error);
        return NextResponse.json(
          {
            success: false,
            message: '创建支付宝订单失败',
            error: 'ALIPAY_ERROR',
          } as CreateOrderResponse,
          { status: 500 }
        );
      }
    }

    // 其他支付方式暂不支持
    return NextResponse.json(
      {
        success: false,
        message: '暂不支持该支付方式',
        error: 'PAYMENT_METHOD_NOT_SUPPORTED',
      } as CreateOrderResponse,
      { status: 501 }
    );
  } catch (error) {
    logger.error('[API] 创建订单失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '创建订单失败',
        error: 'INTERNAL_ERROR',
      } as CreateOrderResponse,
      { status: 500 }
    );
  }
}
