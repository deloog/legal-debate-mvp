/**
 * 统一支付查询接口
 * GET /api/payments/query
 * 支持查询订单和支付状态（微信支付和支付宝）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import {
  QueryPaymentResponse,
  PaymentStatus,
  Order,
  PaymentRecord,
  PaymentMethod,
  WechatQueryOrderResponse,
  WechatPayTradeState,
  AlipayQueryOrderResponse,
  AlipayTradeStatus,
} from '@/types/payment';
import { paymentService } from '@/lib/payment/payment-service';
import { logger } from '@/lib/logger';

/**
 * 将 Prisma Decimal 转换为 number
 */
function toNumber(value: { toNumber: () => number }): number {
  return value.toNumber();
}

/**
 * 转换订单对象
 */
function transformOrder(prismaOrder: Record<string, unknown>): Order {
  return {
    ...prismaOrder,
    amount: toNumber(prismaOrder.amount as { toNumber: () => number }),
  } as Order;
}

/**
 * 转换支付记录对象
 */
function transformPaymentRecord(
  prismaRecord: Record<string, unknown>
): PaymentRecord {
  return {
    ...prismaRecord,
    amount: toNumber(prismaRecord.amount as { toNumber: () => number }),
  } as PaymentRecord;
}

/**
 * GET /api/payments/query
 * 查询订单和支付状态（支持微信支付和支付宝）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        } as QueryPaymentResponse,
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const orderNo = searchParams.get('orderNo');
    const syncFromPayment = searchParams.get('syncFromPayment') === 'true';

    // 验证参数
    if (!orderId && !orderNo) {
      return NextResponse.json(
        {
          success: false,
          message: '必须提供orderId或orderNo参数',
          error: 'MISSING_PARAMETER',
        } as QueryPaymentResponse,
        { status: 400 }
      );
    }

    // 查询订单
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          ...(orderId ? [{ id: orderId }] : []),
          ...(orderNo ? [{ orderNo: orderNo }] : []),
        ],
        userId: session.user.id,
      },
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
        } as QueryPaymentResponse,
        { status: 404 }
      );
    }

    // 获取最新的支付记录
    const paymentRecord =
      order.paymentRecords.length > 0 ? order.paymentRecords[0] : null;

    let paymentStatus = paymentRecord?.status as PaymentStatus;
    let updatedPaymentRecord = paymentRecord;

    // 如果需要从支付平台同步状态
    if (
      syncFromPayment &&
      order.paymentMethod === PaymentMethod.WECHAT &&
      paymentRecord?.thirdPartyOrderNo
    ) {
      try {
        // 调用微信支付查询接口
        const wechatResponse = (await paymentService.queryOrder(
          PaymentMethod.WECHAT,
          {
            out_trade_no: order.orderNo,
            mchid: '',
          }
        )) as WechatQueryOrderResponse;

        // 根据微信支付状态更新订单状态
        const wechatTradeState = wechatResponse.trade_state;
        if (
          wechatTradeState === WechatPayTradeState.SUCCESS &&
          order.status !== 'PAID'
        ) {
          // 支付成功，更新订单和支付记录状态
          updatedPaymentRecord = await prisma.$transaction(async tx => {
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'PAID', paidAt: new Date() },
            });

            return tx.paymentRecord.update({
              where: { id: paymentRecord.id },
              data: {
                status: PaymentStatus.SUCCESS,
                transactionId: wechatResponse.transaction_id,
              },
            });
          });

          // 重新查询订单获取完整信息
          const freshOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
              user: true,
              membershipTier: true,
              paymentRecords: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });

          if (freshOrder) {
            return NextResponse.json({
              success: true,
              message: '查询成功',
              data: {
                order: transformOrder(freshOrder),
                paymentRecord: freshOrder.paymentRecords[0]
                  ? transformPaymentRecord(freshOrder.paymentRecords[0])
                  : undefined,
                paymentStatus:
                  freshOrder.paymentRecords[0]?.status ||
                  ('PENDING' as PaymentStatus),
              },
            } as QueryPaymentResponse);
          }
        } else if (wechatTradeState === WechatPayTradeState.CLOSED) {
          // 订单已关闭，更新状态
          updatedPaymentRecord = await prisma.paymentRecord.update({
            where: { id: paymentRecord.id },
            data: { status: PaymentStatus.CANCELLED },
          });
          paymentStatus = PaymentStatus.CANCELLED;
        } else if (wechatTradeState === WechatPayTradeState.PAYERROR) {
          // 支付失败，更新状态
          updatedPaymentRecord = await prisma.paymentRecord.update({
            where: { id: paymentRecord.id },
            data: { status: PaymentStatus.FAILED },
          });
          paymentStatus = PaymentStatus.FAILED;
        }
      } catch (error) {
        // 同步失败，但不影响本地数据的返回
        logger.error('[API] 同步微信支付状态失败:', {
          orderId: order.id,
          orderNo: order.orderNo,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else if (
      syncFromPayment &&
      order.paymentMethod === PaymentMethod.ALIPAY &&
      paymentRecord?.thirdPartyOrderNo
    ) {
      try {
        // 调用支付宝查询接口
        const alipayResponse = (await paymentService.queryOrder(
          PaymentMethod.ALIPAY,
          {
            outTradeNo: order.orderNo,
          }
        )) as AlipayQueryOrderResponse;

        // 根据支付宝状态更新订单状态
        const alipayTradeStatus = alipayResponse.tradeStatus;
        if (
          alipayTradeStatus === AlipayTradeStatus.TRADE_SUCCESS &&
          order.status !== 'PAID'
        ) {
          // 支付成功，更新订单和支付记录状态
          updatedPaymentRecord = await prisma.$transaction(async tx => {
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'PAID', paidAt: new Date() },
            });

            return tx.paymentRecord.update({
              where: { id: paymentRecord.id },
              data: {
                status: PaymentStatus.SUCCESS,
                transactionId: alipayResponse.tradeNo,
              },
            });
          });

          // 重新查询订单获取完整信息
          const freshOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: {
              user: true,
              membershipTier: true,
              paymentRecords: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          });

          if (freshOrder) {
            return NextResponse.json({
              success: true,
              message: '查询成功',
              data: {
                order: transformOrder(freshOrder),
                paymentRecord: freshOrder.paymentRecords[0]
                  ? transformPaymentRecord(freshOrder.paymentRecords[0])
                  : undefined,
                paymentStatus:
                  freshOrder.paymentRecords[0]?.status ||
                  ('PENDING' as PaymentStatus),
              },
            } as QueryPaymentResponse);
          }
        } else if (alipayTradeStatus === AlipayTradeStatus.TRADE_CLOSED) {
          // 订单已关闭，更新状态
          updatedPaymentRecord = await prisma.paymentRecord.update({
            where: { id: paymentRecord.id },
            data: { status: PaymentStatus.CANCELLED },
          });
          paymentStatus = PaymentStatus.CANCELLED;
        } else if (alipayTradeStatus === AlipayTradeStatus.TRADE_FINISHED) {
          // 交易结束，通常已支付
          updatedPaymentRecord = await prisma.paymentRecord.update({
            where: { id: paymentRecord.id },
            data: { status: PaymentStatus.SUCCESS },
          });
          paymentStatus = PaymentStatus.SUCCESS;
        }
      } catch (error) {
        // 同步失败，但不影响本地数据的返回
        logger.error('[API] 同步支付宝支付状态失败:', {
          orderId: order.id,
          orderNo: order.orderNo,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: {
        order: transformOrder(order),
        paymentRecord: updatedPaymentRecord
          ? transformPaymentRecord(updatedPaymentRecord)
          : undefined,
        paymentStatus: paymentStatus || ('PENDING' as PaymentStatus),
      },
    } as QueryPaymentResponse);
  } catch (error) {
    logger.error('[API] 查询订单失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '查询订单失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      } as QueryPaymentResponse,
      { status: 500 }
    );
  }
}
