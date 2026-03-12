/**
 * 支付宝退款API
 * POST /api/payments/alipay/refund
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { getAlipayRefund } from '@/lib/payment/alipay-refund';
import { RefundReason } from '@/types/payment';
import { logger } from '@/lib/logger';

/**
 * POST /api/payments/alipay/refund
 * 申请支付宝退款
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
    const { orderId, reason = RefundReason.USER_REQUEST, description } = body;

    // 验证必填字段
    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          message: '订单ID不能为空',
          error: 'MISSING_ORDER_ID',
        },
        { status: 400 }
      );
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: '订单不存在',
          error: 'ORDER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 验证订单所有权
    if (order.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: '无权操作此订单',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // 验证订单状态
    if (order.status !== 'PAID') {
      return NextResponse.json(
        {
          success: false,
          message: '订单未支付，无法退款',
          error: 'INVALID_ORDER_STATUS',
        },
        { status: 400 }
      );
    }

    // 检查是否已退款
    const existingRefund = await prisma.refundRecord.findFirst({
      where: {
        orderId,
        status: { in: ['PENDING', 'PROCESSING', 'SUCCESS'] },
      },
    });

    if (existingRefund) {
      return NextResponse.json(
        {
          success: false,
          message: '订单已存在退款记录',
          error: 'REFUND_EXISTS',
        },
        { status: 400 }
      );
    }

    // 查询关联的支付记录
    const paymentRecord = await prisma.paymentRecord.findFirst({
      where: {
        orderId: order.id,
        status: 'SUCCESS',
        paymentMethod: 'ALIPAY',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!paymentRecord) {
      return NextResponse.json(
        {
          success: false,
          message: '未找到支付宝支付记录，无法发起退款',
          error: 'PAYMENT_RECORD_NOT_FOUND',
        },
        { status: 400 }
      );
    }

    // 调用支付宝API申请退款
    try {
      const alipayRefund = getAlipayRefund();
      const alipayResponse = await alipayRefund.refund({
        outTradeNo: order.orderNo,
        refundAmount: Number(order.amount),
        refundReason: description || '用户申请退款',
      });

      // 判断响应是否成功
      if (alipayResponse.code !== '10000') {
        logger.error('[API] 支付宝退款失败:', alipayResponse);
        return NextResponse.json(
          {
            success: false,
            message: alipayResponse.msg || '申请退款失败',
            error: 'ALIPAY_ERROR',
          },
          { status: 500 }
        );
      }

      // 创建退款记录
      const refund = await prisma.refundRecord.create({
        data: {
          orderId: order.id,
          paymentRecordId: paymentRecord.id,
          userId: order.userId,
          paymentMethod: order.paymentMethod,
          status: 'SUCCESS',
          reason,
          amount: Number(order.amount),
          refundAmount: parseFloat(alipayResponse.refundFee),
          currency: order.currency,
          transactionId: alipayResponse.tradeNo,
          thirdPartyRefundNo: alipayResponse.outRequestNo,
          metadata: {
            description,
            gmtRefundPay: alipayResponse.gmtRefundPay,
          },
        },
      });

      logger.info('[API] 支付宝退款成功:', {
        orderId,
        refundId: refund.id,
        refundAmount: refund.refundAmount,
      });

      return NextResponse.json({
        success: true,
        message: '退款申请成功',
        data: {
          refundId: refund.id,
          orderId: order.id,
          orderNo: order.orderNo,
          amount: Number(order.amount),
          refundAmount: Number(refund.refundAmount),
          currency: order.currency,
          status: refund.status,
          gmtRefundPay: alipayResponse.gmtRefundPay,
        },
      });
    } catch (error) {
      logger.error('[API] 调用支付宝退款失败:', error);
      return NextResponse.json(
        {
          success: false,
          message: '申请退款失败',
          error: 'ALIPAY_ERROR',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('[API] 申请支付宝退款失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '申请退款失败',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
