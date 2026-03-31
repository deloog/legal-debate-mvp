/**
 * 退款申请API
 * POST /api/refunds/apply
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAlipayRefund } from '@/lib/payment/alipay-refund';
import { paymentConfig } from '@/lib/payment/payment-config';
import { getWechatRefund } from '@/lib/payment/wechat-refund';
import { PaymentMethod, RefundReason, RefundStatus } from '@/types/payment';
import { getAuthUser } from '@/lib/middleware/auth';
import { createAuditLog } from '@/lib/audit/logger';
import { NextRequest, NextResponse } from 'next/server';

// 退款请求幂等锁（内存级，生产环境建议使用Redis）
const refundLocks = new Set<string>();

/**
 * POST /api/refunds/apply
 * 申请退款（支持微信和支付宝）
 */
export async function POST(request: NextRequest) {
  try {
    // 获取认证用户
    const authUser = await getAuthUser(request);
    if (!authUser) {
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

    // 幂等锁检查
    const lockKey = `${orderId}_${authUser.userId}`;
    if (refundLocks.has(lockKey)) {
      return NextResponse.json(
        {
          success: false,
          message: '退款申请处理中，请勿重复提交',
          error: 'REFUND_IN_PROGRESS',
        },
        { status: 429 }
      );
    }

    // 获取锁
    refundLocks.add(lockKey);

    try {
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
      if (order.userId !== authUser.userId) {
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

      // 检查是否已退款（数据库级幂等）
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

      // 先创建退款记录（PENDING状态）作为幂等凭证
      const pendingRefund = await prisma.refundRecord.create({
        data: {
          orderId: order.id,
          paymentRecordId: paymentRecord.id,
          userId: order.userId,
          paymentMethod: order.paymentMethod,
          status: RefundStatus.PENDING,
          reason,
          amount: Number(order.amount),
          refundAmount: 0, // 待确定
          currency: order.currency,
          metadata: {
            description,
            appliedAt: new Date().toISOString(),
          },
          appliedAt: new Date(),
        },
      });

      // 根据支付方式调用相应的退款API
      try {
        let refundResult: {
          transactionId?: string;
          thirdPartyRefundNo?: string;
          refundAmount: number;
          successTime?: string;
        } = {
          refundAmount: 0,
        };

        if (order.paymentMethod === PaymentMethod.WECHAT) {
          // 微信退款
          const wechatRefund = getWechatRefund();
          const refundNo = `REFUND_${order.orderNo}_${Date.now()}`;

          const wechatResponse = await wechatRefund.refund({
            out_trade_no: order.orderNo,
            out_refund_no: refundNo,
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
            logger.error('[API] 支付宝退款失败:', alipayResponse);

            // 更新退款记录为失败
            await prisma.refundRecord.update({
              where: { id: pendingRefund.id },
              data: {
                status: RefundStatus.FAILED,
                rejectedReason: alipayResponse.msg || '申请退款失败',
                processedAt: new Date(),
              },
            });

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

        // 在事务中同时更新退款记录和订单状态（保证原子性）
        const refund = await prisma.$transaction(async tx => {
          const updatedRefund = await tx.refundRecord.update({
            where: { id: pendingRefund.id },
            data: {
              status: RefundStatus.SUCCESS,
              refundAmount: refundResult.refundAmount,
              transactionId: refundResult.transactionId,
              thirdPartyRefundNo: refundResult.thirdPartyRefundNo,
              metadata: {
                description,
                successTime: refundResult.successTime,
                processedAt: new Date().toISOString(),
              },
              processedAt: new Date(),
            },
          });
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'REFUNDED' },
          });
          return updatedRefund;
        });

        logger.info('[API] 退款成功:', {
          orderId,
          refundId: refund.id,
          refundAmount: refund.refundAmount,
          paymentMethod: order.paymentMethod,
        });

        // 记录退款审计日志（异步）
        createAuditLog({
          userId: authUser.userId,
          actionType: 'UNKNOWN',
          actionCategory: 'OTHER',
          description: `退款申请成功：orderId=${orderId}，金额=${Number(refund.refundAmount)}`,
          resourceType: 'Order',
          resourceId: order.id,
          metadata: {
            orderId,
            refundId: refund.id,
            reason,
            paymentMethod: order.paymentMethod,
          },
        }).catch(auditErr => {
          logger.error('退款审计日志记录失败:', auditErr);
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
        logger.error('[API] 退款失败:', error);

        // 更新退款记录为失败
        await prisma.refundRecord.update({
          where: { id: pendingRefund.id },
          data: {
            status: RefundStatus.FAILED,
            rejectedReason: '退款处理失败',
            processedAt: new Date(),
            metadata: {
              description,
            },
          },
        });

        return NextResponse.json(
          {
            success: false,
            message: '申请退款失败',
            error: 'REFUND_ERROR',
          },
          { status: 500 }
        );
      }
    } finally {
      // 释放锁
      refundLocks.delete(lockKey);
    }
  } catch (error) {
    logger.error('[API] 申请退款失败:', error);
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
 * 金额转换：分转元（先取整保证输入为整数，避免浮点精度误差）
 */
function convertFenToYuan(amount: number): number {
  return Math.round(amount) / 100;
}
