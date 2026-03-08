/**
 * POST /api/payments/wechat/callback
 * 处理微信支付前端跳转回调（H5/JSAPI 支付完成后浏览器跳回商户页面时调用）
 *
 * ⚠️  安全说明：
 *   此接口为"前端跳转回调"，微信不附带服务端可验签的参数，
 *   因此 **不能** 在此处直接标记订单为已支付（否则攻击者只需知道订单号即可伪造）。
 *
 *   真正的支付成功处理由微信服务端"异步通知"完成，见：
 *     POST /api/payment/notify
 *
 *   本接口职责：仅查询订单当前状态并告知前端跳转目标，不修改支付状态。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const params = (await request.json()) as Record<string, string>;

    const outTradeNo = params['out_trade_no'] ?? params['outTradeNo'] ?? '';

    if (!outTradeNo) {
      return NextResponse.json(
        { success: false, message: '缺少订单号参数' },
        { status: 400 }
      );
    }

    // 仅查询订单当前状态，不修改
    const order = await prisma.order.findFirst({
      where: { orderNo: outTradeNo },
      select: { id: true, status: true },
    });

    if (!order) {
      logger.warn('[微信支付跳转回调] 订单不存在:', outTradeNo);
      return NextResponse.json(
        {
          success: false,
          message: '订单不存在',
          redirectUrl: '/payment/failed?reason=order_not_found',
        },
        { status: 404 }
      );
    }

    // 已由异步通知更新为已支付
    if (order.status === 'PAID') {
      return NextResponse.json({
        success: true,
        message: '支付已完成',
        redirectUrl: `/payment/success?orderId=${order.id}`,
        delay: 0,
      });
    }

    // 订单尚未被异步通知更新（通知可能延迟），引导前端轮询状态
    logger.info('[微信支付跳转回调] 订单尚未更新，等待异步通知:', outTradeNo);
    return NextResponse.json({
      success: true,
      pending: true,
      message: '支付处理中，请稍候…',
      redirectUrl: `/payment/pending?orderId=${order.id}&orderNo=${outTradeNo}`,
      pollUrl: `/api/v1/orders/${order.id}/status`,
      delay: 2000,
    });
  } catch (error) {
    logger.error('[微信支付跳转回调] 处理失败:', { error });
    return NextResponse.json(
      {
        success: false,
        message: '查询支付状态失败，请联系客服',
        redirectUrl: '/payment/failed?reason=callback_error',
      },
      { status: 500 }
    );
  }
}
