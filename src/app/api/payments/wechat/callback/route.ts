/**
 * POST /api/payments/wechat/callback
 * 处理微信支付前端跳转回调（客户端页面将 URL 参数转发至此接口）
 * 注意：微信服务端异步通知使用 XML，此处处理的是前端同步跳回的 JSON 参数
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { handlePaymentSuccess } from '@/lib/order/order-service';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const params = (await request.json()) as Record<string, string>;

    // 微信支付 APP/JSAPI 跳转回时携带 out_trade_no（商户订单号）
    // H5 支付跳转回时通常无签名，仅做状态查询
    const outTradeNo = params['out_trade_no'] ?? params['outTradeNo'] ?? '';
    const transactionId =
      params['transaction_id'] ?? params['transactionId'] ?? '';

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, message: '缺少订单号参数' },
        { status: 400 }
      );
    }

    // 根据商户订单号查询订单
    const order = await prisma.order.findFirst({
      where: { orderNo: outTradeNo },
      select: { id: true, status: true, userId: true },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: '订单不存在',
          redirectUrl: '/payment/failed?reason=order_not_found',
        },
        { status: 404 }
      );
    }

    // 已支付则直接跳转成功页
    if (order.status === 'PAID') {
      return NextResponse.json({
        success: true,
        message: '支付已完成',
        redirectUrl: `/payment/success?orderId=${order.id}`,
        delay: 0,
      });
    }

    // 尝试处理支付成功（依赖 transactionId；若无则使用 outTradeNo 兜底）
    if (transactionId || outTradeNo) {
      await handlePaymentSuccess(
        order.id,
        transactionId || outTradeNo,
        outTradeNo
      );
    }

    return NextResponse.json({
      success: true,
      message: '支付成功',
      redirectUrl: `/payment/success?orderId=${order.id}`,
      delay: 2000,
    });
  } catch (error) {
    logger.error('[微信支付回调] 处理失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '支付回调处理失败，请联系客服',
        redirectUrl: '/payment/failed?reason=callback_error',
      },
      { status: 500 }
    );
  }
}
