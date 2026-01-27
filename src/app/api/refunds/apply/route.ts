/**
 * 退款申请API
 * POST /api/refunds/apply
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { getAlipayRefund } from '@/lib/payment/alipay-refund';
import { getWechatRefund } from '@/lib/payment/wechat-refund';
import { PaymentMethod, RefundReason, RefundStatus } from '@/types/payment';
import { paymentConfig } from '@/lib/payment/payment-config';

/**
 * POST /api/refunds/apply
 * 申请退款（支持微信和支付宝）
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

    // 验证退款原因
    if (!Object.values(RefundReason).includes(reason)) {
      return NextResponse.json(
        {
          success: false,
          message: '无效的退款原因',
          error: 'INVALID_REFUND_REASON',
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
        paymentRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
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

    // 检查支付配置
    if (order.paymentMethod === PaymentMethod.WECHAT) {
      if (!paymentConfig.validateWechatConfig()) {
        return NextResponse.json(
          {
            success: false,
            message: '微信支付配置无效',
            error: 'INVALID_CONFIG',
          },
          { status: 500 }
        );
      }
    } else if (order.paymentMethod === PaymentMethod.ALIPAY) {
      if (!paymentConfig.validateAlipayConfig()) {
        return NextResponse.json(
          {
            success: false,
            message: '支付宝配置无效',
            error: 'INVALID_CONFIG',
          },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json(
        {
          success: false,
          message: '不支持的支付方式',
          error: 'UNSUPPORTED_PAYMENT_METHOD',
        },
        { status: 400 }
      );
    }

    // 获取支付记录
    const paymentRecord = order.paymentRecords[0];
    if (!paymentRecord) {
      return NextResponse.json(
        {
          success: false,
          message: '支付记录不存在',
          error: 'PAYMENT_RECORD_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 根据支付方式调用相应的退款API
    try {
      let refundResult: {
        transactionId?: string;
        thirdPartyRefundNo?: string;
        refundAmount: number;
        successTime?: string;
      };

      if (order.paymentMethod === PaymentMethod.WECHAT) {
        // 微信退款
        const wechatRefund = getWechatRefund();
        const wechatResponse = await wechatRefund.refund({
          out_trade_no: order.orderNo,
          out_refund_no: undefined, // 自动生成
          reason: description || '用户申请退款',
          amount: {
            refund: convertYuanToFen(Number(order.amount)),
            total: convertYuanToFen(Number(order.amount)),
            currency: order.currency,
          },
          notify_url: paymentConfig.getWechatConfig().refundNotifyUrl,
        });

        refundResult = {
          transactionId: wechatResponse.refund_id,
          thirdPartyRefundNo: wechatResponse.out_refund_no,
          refundAmount: convertFenToYuan(wechatResponse.amount.refund),
          successTime: wechatResponse.success_time,
        };
      } else if (order.paymentMethod === PaymentMethod.ALIPAY) {
        // 支付宝退款
        const alipayRefund = getAlipayRefund();
        const alipayResponse = await alipayRefund.refund({
          outTradeNo: order.orderNo,
          refundAmount: Number(order.amount),
          refundReason: description || '用户申请退款',
          outRequestNo: undefined, // 自动生成
        });

        if (alipayResponse.code !== '10000') {
          console.error('[API] 支付宝退款失败:', alipayResponse);
          return NextResponse.json(
            {
              success: false,
              message: alipayResponse.msg || '申请退款失败',
              error: 'ALIPAY_ERROR',
            },
            { status: 500 }
          );
        }

        refundResult = {
          transactionId: alipayResponse.tradeNo,
          thirdPartyRefundNo: alipayResponse.outRequestNo,
          refundAmount: parseFloat(alipayResponse.refundFee),
          successTime: alipayResponse.gmtRefundPay,
        };
      }

      // 创建退款记录
      const refund = await prisma.refundRecord.create({
        data: {
          orderId: order.id,
          paymentRecordId: paymentRecord.id,
          userId: order.userId,
          paymentMethod: order.paymentMethod,
          status: RefundStatus.SUCCESS,
          reason,
          amount: Number(order.amount),
          refundAmount: refundResult.refundAmount,
          currency: order.currency,
          transactionId: refundResult.transactionId,
          thirdPartyRefundNo: refundResult.thirdPartyRefundNo,
          metadata: {
            description,
            successTime: refundResult.successTime,
          },
          appliedAt: new Date(),
          processedAt: new Date(),
        },
      });

      console.log('[API] 退款成功:', {
        orderId,
        refundId: refund.id,
        refundAmount: refund.refundAmount,
        paymentMethod: order.paymentMethod,
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
          paymentMethod: order.paymentMethod,
        },
      });
    } catch (error) {
      console.error('[API] 退款失败:', error);

      // 创建退款失败记录
      try {
        await prisma.refundRecord.create({
          data: {
            orderId: order.id,
            paymentRecordId: paymentRecord.id,
            userId: order.userId,
            paymentMethod: order.paymentMethod,
            status: RefundStatus.FAILED,
            reason,
            amount: Number(order.amount),
            refundAmount: 0,
            currency: order.currency,
            rejectedReason: error instanceof Error ? error.message : '退款失败',
            metadata: {
              description,
              error: error instanceof Error ? error.stack : String(error),
            },
            appliedAt: new Date(),
          },
        });
      } catch (recordError) {
        console.error('[API] 创建退款失败记录失败:', recordError);
      }

      return NextResponse.json(
        {
          success: false,
          message: '申请退款失败',
          error: 'REFUND_ERROR',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[API] 申请退款失败:', error);
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

/**
 * 金额转换：元转分
 */
function convertYuanToFen(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * 金额转换：分转元
 */
function convertFenToYuan(amount: number): number {
  return amount / 100;
}
