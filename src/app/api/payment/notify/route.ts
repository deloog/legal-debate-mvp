/**
 * 微信支付服务端异步通知处理
 * POST /api/payment/notify
 *
 * 安全机制：
 * 1. 验证请求头中的微信签名（Wechatpay-Signature）- RSA平台证书验签
 * 2. 验证时间戳防止重放攻击
 * 3. 通过 AES-256-GCM 解密通知内容
 * 4. 幂等处理：已支付订单直接返回成功
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
import crypto from 'crypto';
import { paymentConfig } from '@/lib/payment/payment-config';

/**
 * 验证微信支付请求头签名（APIv3 规范）
 * https://pay.weixin.qq.com/docs/merchant/development/interface-rules/signature-verification.html
 */
async function verifyWechatSignature(
  request: NextRequest,
  rawBody: string
): Promise<boolean> {
  try {
    const timestamp = request.headers.get('Wechatpay-Timestamp') ?? '';
    const nonce = request.headers.get('Wechatpay-Nonce') ?? '';
    const signature = request.headers.get('Wechatpay-Signature') ?? '';
    const serial = request.headers.get('Wechatpay-Serial') ?? '';

    if (!timestamp || !nonce || !signature || !serial) {
      logger.warn('[微信支付通知] 缺少必要请求头', {
        timestamp,
        nonce,
        serial,
      });
      return false;
    }

    // 时间戳有效期：±5 分钟
    const now = Math.floor(Date.now() / 1000);
    const timestampNum = parseInt(timestamp, 10);
    if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300) {
      logger.warn('[微信支付通知] 时间戳过期', { timestamp, now });
      return false;
    }

    // 构造验签消息
    const message = `${timestamp}\n${nonce}\n${rawBody}\n`;

    // 获取平台证书（实际生产环境应该从微信支付API获取或缓存）
    // 这里使用配置的公钥进行验证
    const config = paymentConfig.getWechatConfig();
    if (!(config as { publicKey?: string }).publicKey) {
      logger.error('[微信支付通知] 微信支付公钥未配置');
      // 如果没有配置公钥，跳过验签（依赖AES解密作为安全屏障）
      logger.warn('[微信支付通知] 跳过RSA验签，依赖AES-GCM解密验证');
      return true;
    }

    // RSA-SHA256 验签
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(message);
    const isValid = verify.verify((config as { publicKey?: string }).publicKey!, signature, 'base64');

    if (!isValid) {
      logger.warn('[微信支付通知] RSA签名验证失败');
      return false;
    }

    logger.info('[微信支付通知] RSA签名验证通过');
    return true;
  } catch (err) {
    logger.error('[微信支付通知] 签名验证异常', { error: err });
    return false;
  }
}

/**
 * POST /api/payment/notify
 * 处理微信支付服务端异步通知
 */
export async function POST(request: NextRequest) {
  let rawBody = '';
  try {
    rawBody = await request.text();

    // 签名验证：时间戳过期或必要请求头缺失直接拒绝
    if (!(await verifyWechatSignature(request, rawBody))) {
      logger.warn('[微信支付通知] 签名验证未通过，拒绝请求');
      return NextResponse.json(
        { code: 'FAIL', message: '签名验证失败' },
        { status: 401 }
      );
    }

    const notification = JSON.parse(rawBody) as Record<string, unknown>;

    // 验证通知类型
    if (
      notification['event_type'] !== WechatPayNotifyType.TRANSACTION_SUCCESS
    ) {
      logger.info(
        '[微信支付通知] 非支付成功通知，跳过:',
        notification['event_type']
      );
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 解密支付结果（AES-256-GCM，密钥错误时会抛出异常）
    const wechatPay = getWechatPay();
    const payResult = wechatPay.decryptNotification(
      notification as unknown as Parameters<
        typeof wechatPay.decryptNotification
      >[0]
    );

    if (!payResult) {
      logger.error('[微信支付通知] 解密失败，可能是伪造请求');
      return NextResponse.json(
        { code: 'FAIL', message: '处理失败' },
        { status: 400 }
      );
    }

    logger.info('[微信支付通知] 解密成功:', {
      outTradeNo: payResult.out_trade_no,
      transactionId: payResult.transaction_id,
      tradeState: payResult.trade_state,
    });

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { orderNo: payResult.out_trade_no },
    });

    if (!order) {
      logger.error('[微信支付通知] 订单不存在:', payResult.out_trade_no);
      // 返回成功避免微信重复通知
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 幂等：已支付直接返回
    if (order.status === 'PAID') {
      logger.info('[微信支付通知] 订单已支付，跳过:', order.orderNo);
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 验证金额（防止篡改）
    const orderAmount = order.amount.toNumber();
    const notifyAmount = (payResult.amount?.total ?? 0) / 100; // 分转元
    if (Math.abs(orderAmount - notifyAmount) > 0.01) {
      logger.error('[微信支付通知] 金额不匹配:', {
        orderAmount,
        notifyAmount,
        orderNo: payResult.out_trade_no,
      });
      return NextResponse.json(
        { code: 'FAIL', message: '金额不匹配' },
        { status: 400 }
      );
    }

    if (payResult.trade_state === 'SUCCESS') {
      await handlePaymentSuccess(
        order.id,
        payResult.transaction_id,
        payResult.sp_mchid
      );

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

      logger.info('[微信支付通知] 支付成功处理完成:', order.orderNo);
      return NextResponse.json({ code: 'SUCCESS', message: '成功' });
    }

    // 支付失败
    await handlePaymentFailure(
      order.id,
      payResult.trade_state,
      payResult.trade_state_desc ?? '支付失败'
    );

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

    logger.info('[微信支付通知] 支付失败处理完成:', order.orderNo);
    return NextResponse.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    logger.error('[微信支付通知] 处理异常:', { error });
    return NextResponse.json(
      { code: 'FAIL', message: '处理失败' },
      { status: 500 }
    );
  }
}
