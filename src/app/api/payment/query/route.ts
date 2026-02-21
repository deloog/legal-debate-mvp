/**
 * 查询订单状态API
 * GET /api/payment/query
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { QueryPaymentResponse, Order, PaymentRecord } from '@/types/payment';
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
 * GET /api/payment/query
 * 查询订单状态
 */
export async function GET(request: NextRequest) {
  try {
    // 获取用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: 'UNAUTHORIZED',
        } as QueryPaymentResponse,
        { status: 401 }
      );
    }

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const orderNo = searchParams.get('orderNo');

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
        OR: orderId ? [{ id: orderId }] : [{ orderNo: orderNo }],
        userId: session.user.id,
      },
      include: {
        user: true,
        membershipTier: true,
        paymentRecords: true,
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

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: {
        order: transformOrder(order),
        paymentRecord: paymentRecord
          ? transformPaymentRecord(paymentRecord)
          : undefined,
        paymentStatus: paymentRecord?.status || 'PENDING',
      },
    } as QueryPaymentResponse);
  } catch (error) {
    logger.error('[API] 查询订单失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '查询订单失败',
        error: 'INTERNAL_ERROR',
      } as QueryPaymentResponse,
      { status: 500 }
    );
  }
}
