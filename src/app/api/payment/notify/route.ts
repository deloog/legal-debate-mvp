/**
 * 微信支付回调处理API
 * POST /api/payment/notify
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getWechatPay } from '@/lib/payment/wechat-pay';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
} from '@/lib/order/order-service';
import { WechatPayNotifyType } from '@/types/payment';
import { logger } from '@/lib/logger';

/**
 * POST /api/payment/notify
 * 处理微信支付回调通知
 */
export async function POST(request: NextRequest) {
  try {
    // 获取请求体
    const notification = await request.json();

    // 验证通知类型
    if (notification.event_type !== WechatPayNotifyType.TRANSACTION_SUCCESS) {
      logger.info('[API] 非支付成功通知，跳过处理:', notification.event_type);
      return NextResponse.json(
        { code: 'SUCCESS', message: '成功' },
        { status: 200 }
      );
    }

    // 解密支付结果
    const wechatPay = getWechatPay();
    const payResult = wechatPay.decryptNotification(notification);

    if (!payResult) {
      logger.error('[API] 解密支付结果失败');
      return NextResponse.json(
        { code: 'FAIL', message: '处理失败' },
        { status: 500 }
      );
    }

    logger.info('[API] 收到支付成功通知:', {
      outTradeNo: payResult.out_trade_no,
      transactionId: payResult.transaction_id,
      tradeState: payResult.trade_state,
    });

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { orderNo: payResult.out_trade_no },
    });

    if (!order) {
      logger.error('[API] 订单不存在:', payResult.out_trade_no);
      return NextResponse.json(
        { code: 'FAIL', message: '订单不存在' },
        { status: 404 }
      );
    }

    // 如果订单已处理，直接返回成功
    if (order.status === 'PAID') {
      logger.info('[API] 订单已支付，跳过处理:', order.orderNo);
      return NextResponse.json(
        { code: 'SUCCESS', message: '成功' },
        { status: 200 }
      );
    }

    // 根据交易状态处理
    if (payResult.trade_state === 'SUCCESS') {
      // 支付成功
      await handlePaymentSuccess(
        order.id,
        payResult.transaction_id,
        payResult.sp_mchid
      );

      // 创建支付记录
      await prisma.paymentRecord.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          paymentMethod: 'WECHAT' as const,
          status: 'SUCCESS' as const,
          amount: order.amount,
          currency: order.currency,
          transactionId: payResult.transaction_id,
          thirdPartyOrderNo: payResult.out_trade_no,
        },
      });

      logger.info('[API] 支付成功处理完成:', order.orderNo);
      return NextResponse.json(
        { code: 'SUCCESS', message: '成功' },
        { status: 200 }
      );
    }

    // 支付失败
    await handlePaymentFailure(
      order.id,
      payResult.trade_state,
      payResult.trade_state_desc || '支付失败'
    );

    // 创建支付记录
    await prisma.paymentRecord.create({
      data: {
        orderId: order.id,
        userId: order.userId,
        paymentMethod: 'WECHAT' as const,
        status: 'FAILED' as const,
        amount: order.amount,
        currency: order.currency,
        errorCode: payResult.trade_state,
        errorMessage: payResult.trade_state_desc,
      },
    });

    logger.info('[API] 支付失败处理完成:', order.orderNo);
    return NextResponse.json(
      { code: 'SUCCESS', message: '成功' },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[API] 处理支付回调失败:', error);
    return NextResponse.json(
      { code: 'FAIL', message: '处理失败' },
      { status: 500 }
    );
  }
}
