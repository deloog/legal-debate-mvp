/**
 * 支付宝支付回调处理API
 * POST /api/payments/alipay/callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { paymentConfig } from '@/lib/payment/payment-config';
import {
  verifyAlipayNotify,
  isPaymentSuccess,
} from '@/lib/payment/alipay-utils';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
} from '@/lib/order/order-service';
import { AlipayNotifyRequest } from '@/types/payment';

/**
 * POST /api/payments/alipay/callback
 * 处理支付宝支付回调
 */
export async function POST(request: NextRequest) {
  try {
    // 获取回调参数（支持form-data格式）
    const formData = await request.formData();
    const params: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      params[key] = value as string;
    }

    console.log('[API] 支付宝回调参数:', params);

    // 验证必填参数
    const requiredParams = [
      'trade_status',
      'trade_no',
      'out_trade_no',
      'total_amount',
      'app_id',
    ];

    for (const param of requiredParams) {
      if (!params[param]) {
        console.error('[API] 支付宝回调缺少必填参数:', param);
        return NextResponse.json(
          {
            success: false,
            message: '缺少必填参数',
          },
          { status: 400 }
        );
      }
    }

    // 验证应用ID
    const config = paymentConfig.getAlipayConfig();
    if (params.app_id !== config.appId) {
      console.error('[API] 支付宝回调应用ID不匹配');
      return NextResponse.json(
        {
          success: false,
          message: '应用ID不匹配',
        },
        { status: 400 }
      );
    }

    // 验签
    const publicKey = paymentConfig.getAlipayPublicKey();
    const isValid = verifyAlipayNotify(
      params as unknown as AlipayNotifyRequest,
      publicKey
    );

    if (!isValid) {
      console.error('[API] 支付宝回调验签失败');
      return NextResponse.json(
        {
          success: false,
          message: '验签失败',
        },
        { status: 400 }
      );
    }

    // 查询订单
    const orderNo = params.out_trade_no;
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    if (!order) {
      console.error('[API] 支付宝回调订单不存在:', orderNo);
      return NextResponse.json(
        {
          success: false,
          message: '订单不存在',
        },
        { status: 404 }
      );
    }

    // 幂等性处理：如果订单已支付，直接返回成功
    if (order.status === 'PAID') {
      console.log('[API] 订单已支付，忽略重复回调:', orderNo);
      return new NextResponse('success', { status: 200 });
    }

    // 处理支付结果
    const tradeStatus = params.trade_status;

    if (isPaymentSuccess(tradeStatus)) {
      // 支付成功
      try {
        await handlePaymentSuccess(order.id, params.trade_no, params.trade_no);
        console.log('[API] 支付宝支付成功处理完成:', orderNo);
      } catch (error) {
        console.error('[API] 处理支付宝支付成功失败:', error);
        // 即使处理失败也返回成功，避免重复通知
        return new NextResponse('success', { status: 200 });
      }
    } else if (tradeStatus === 'TRADE_CLOSED') {
      // 交易关闭（支付失败）
      try {
        await handlePaymentFailure(order.id, 'TRADE_CLOSED', '交易已关闭');
        console.log('[API] 支付宝支付失败处理完成:', orderNo);
      } catch (error) {
        console.error('[API] 处理支付宝支付失败错误:', error);
      }
    } else if (tradeStatus === 'WAIT_BUYER_PAY') {
      // 等待买家付款
      console.log('[API] 支付宝支付等待付款:', orderNo);
      // 不做处理，等待下次通知
    } else {
      console.log('[API] 支付宝未知交易状态:', tradeStatus);
    }

    // 返回success给支付宝
    return new NextResponse('success', { status: 200 });
  } catch (error) {
    console.error('[API] 处理支付宝回调失败:', error);
    // 即使出错也返回success，避免支付宝重复通知
    return new NextResponse('success', { status: 200 });
  }
}
