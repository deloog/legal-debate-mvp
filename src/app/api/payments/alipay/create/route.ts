/**
 * 支付宝创建支付订单API
 * POST /api/payments/alipay/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { PaymentMethod } from '@/types/payment';
import { createOrder } from '@/lib/order/order-service';
import { alipay } from '@/lib/payment/alipay';
import { AlipayProductCode } from '@/types/payment';

/**
 * POST /api/payments/alipay/create
 * 创建支付宝支付订单
 */
export async function POST(request: NextRequest) {
  try {
    // 获取用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const {
      membershipTierId,
      productCode = 'FAST_INSTANT_TRADE_PAY', // 默认为当面付（扫码支付）
      description,
    } = body;

    // 验证必填字段
    if (!membershipTierId) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级ID不能为空',
          error: 'MISSING_TIER_ID',
        },
        { status: 400 }
      );
    }

    // 验证支付产品码
    const validProductCodes = Object.values(AlipayProductCode);
    if (!validProductCodes.includes(productCode as AlipayProductCode)) {
      return NextResponse.json(
        {
          success: false,
          message: '支付产品码无效',
          error: 'INVALID_PRODUCT_CODE',
        },
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
        },
        { status: 404 }
      );
    }

    if (!tier.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级暂不可用',
          error: 'TIER_INACTIVE',
        },
        { status: 400 }
      );
    }

    // 创建订单
    const order = await createOrder({
      userId: session.user.id,
      membershipTierId,
      paymentMethod: PaymentMethod.ALIPAY,
      description: description || `开通${tier.displayName}会员`,
      metadata: {},
    });

    // 调用支付宝API创建支付
    try {
      const alipayResponse = await alipay.createOrder({
        outTradeNo: order.orderNo,
        totalAmount: Number(order.amount),
        subject: order.description,
        body: order.description,
        productCode: productCode as AlipayProductCode,
        timeExpire: 120, // 订单2小时过期
        goodsType: '1', // 虚拟商品
      });

      // 判断响应是否成功
      if (alipayResponse.code !== '10000') {
        console.error('[API] 支付宝创建订单失败:', alipayResponse);
        return NextResponse.json(
          {
            success: false,
            message: alipayResponse.msg || '创建支付宝支付订单失败',
            error: 'ALIPAY_ERROR',
          },
          { status: 500 }
        );
      }

      // 返回支付二维码链接
      return NextResponse.json({
        success: true,
        message: '订单创建成功',
        data: {
          orderId: order.id,
          orderNo: order.orderNo,
          amount: Number(order.amount),
          currency: order.currency,
          status: order.status,
          expiredAt: order.expiredAt,
          qrCode: alipayResponse.qrCode,
          tradeNo: alipayResponse.tradeNo,
        },
      });
    } catch (error) {
      console.error('[API] 调用支付宝支付失败:', error);
      return NextResponse.json(
        {
          success: false,
          message: '创建支付宝支付订单失败',
          error: 'ALIPAY_ERROR',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] 创建支付宝订单失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '创建订单失败',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
