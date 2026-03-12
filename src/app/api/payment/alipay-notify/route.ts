/**
 * 支付宝支付异步通知处理
 * POST /api/payment/alipay-notify
 *
 * 安全机制：
 * 1. 验证支付宝签名（RSA-SHA256）
 * 2. 验证通知状态
 * 3. 幂等处理：已支付订单直接返回成功
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
} from '@/lib/order/order-service';
import { alipaySignVerify } from '@/lib/payment/alipay-utils';
import { paymentConfig } from '@/lib/payment/payment-config';

/**
 * POST /api/payment/alipay-notify
 * 处理支付宝异步通知
 */
export async function POST(request: NextRequest) {
  try {
    // 获取表单数据
    const formData = await request.formData();
    const params: Record<string, string> = {};

    formData.forEach((value, key) => {
      if (typeof value === 'string') {
        params[key] = value;
      }
    });

    logger.info('[支付宝通知] 收到通知:', { params });

    // 验证签名
    const sign = params.sign;
    const signType = params.sign_type || 'RSA2';

    if (!sign) {
      logger.warn('[支付宝通知] 缺少签名');
      return NextResponse.json(
        { code: 'FAIL', message: '缺少签名' },
        { status: 400 }
      );
    }

    // 获取支付宝公钥
    const alipayPublicKey = paymentConfig.getAlipayPublicKey();
    if (!alipayPublicKey) {
      logger.error('[支付宝通知] 支付宝公钥未配置');
      return NextResponse.json(
        { code: 'FAIL', message: '配置错误' },
        { status: 500 }
      );
    }

    // 验证签名
    const isValid = alipaySignVerify(params, sign, alipayPublicKey, signType);
    if (!isValid) {
      logger.warn('[支付宝通知] 签名验证失败');
      return NextResponse.json(
        { code: 'FAIL', message: '签名验证失败' },
        { status: 400 }
      );
    }

    logger.info('[支付宝通知] 签名验证通过');

    // 验证通知类型
    const tradeStatus = params.trade_status;
    if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
      logger.info(`[支付宝通知] 非成功状态: ${tradeStatus}`);
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 获取订单信息
    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const totalAmount = params.total_amount;

    if (!outTradeNo || !tradeNo) {
      logger.error('[支付宝通知] 缺少必要参数');
      return NextResponse.json(
        { code: 'FAIL', message: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { orderNo: outTradeNo },
    });

    if (!order) {
      logger.error('[支付宝通知] 订单不存在:', outTradeNo);
      // 返回成功避免重复通知
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 验证金额（防止篡改）
    const orderAmount = order.amount.toNumber();
    const notifyAmount = parseFloat(totalAmount);
    if (Math.abs(orderAmount - notifyAmount) > 0.01) {
      logger.error('[支付宝通知] 金额不匹配:', {
        orderAmount,
        notifyAmount,
        orderNo: outTradeNo,
      });
      return NextResponse.json(
        { code: 'FAIL', message: '金额不匹配' },
        { status: 400 }
      );
    }

    // 幂等：已支付直接返回
    if (order.status === 'PAID') {
      logger.info('[支付宝通知] 订单已支付，跳过:', order.orderNo);
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 处理支付成功
    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      await handlePaymentSuccess(order.id, tradeNo, tradeNo);

      await prisma.paymentRecord.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          paymentMethod: 'ALIPAY' as const,
          status: 'SUCCESS' as const,
          amount: order.amount,
          currency: order.currency,
          transactionId: tradeNo,
          thirdPartyOrderNo: outTradeNo,
          metadata: {
            buyerId: params.buyer_id,
            buyerLogonId: params.buyer_logon_id,
            gmtPayment: params.gmt_payment,
          },
        },
      });

      logger.info('[支付宝通知] 支付成功处理完成:', order.orderNo);
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 其他状态处理
    logger.info('[支付宝通知] 其他状态:', { tradeStatus, outTradeNo });
    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    logger.error('[支付宝通知] 处理异常:', { error });
    return NextResponse.json(
      { code: 'FAIL', message: '处理失败' },
      { status: 500 }
    );
  }
}
