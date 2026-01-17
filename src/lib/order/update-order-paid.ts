/**
 * 订单支付完成更新模块
 * 提供订单支付完成后的状态更新和会员激活功能
 */

import { prisma } from '@/lib/db/prisma';
import { Order, OrderStatus, PaymentMethod } from '@/types/payment';
import type { MembershipTierType } from '@prisma/client';

/**
 * 将 Prisma Decimal 转换为 number
 */
function toNumber(value: { toNumber: () => number }): number {
  return value.toNumber();
}

/**
 * 创建订单对象辅助函数
 */
function createOrderObject(prismaOrder: Record<string, unknown>): Order {
  return {
    ...prismaOrder,
    amount: toNumber(prismaOrder.amount as { toNumber: () => number }),
  } as Order;
}

/**
 * 订单状态转换规则
 * 定义允许的状态转换
 */
const ORDER_STATE_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.PAID,
    OrderStatus.FAILED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [OrderStatus.REFUNDED],
  [OrderStatus.FAILED]: [], // 失败订单不能转换
  [OrderStatus.CANCELLED]: [], // 已取消订单不能转换
  [OrderStatus.REFUNDED]: [], // 已退款订单不能转换
  [OrderStatus.EXPIRED]: [], // 已过期订单不能转换
};

/**
 * 验证订单状态转换是否合法
 */
export function isValidOrderStatusTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus
): boolean {
  const allowedStatuses = ORDER_STATE_TRANSITIONS[fromStatus] || [];
  return allowedStatuses.includes(toStatus);
}

/**
 * 更新订单状态为已支付
 */
export async function updateOrderPaid(
  orderId: string,
  transactionId: string,
  thirdPartyOrderNo?: string
): Promise<Order> {
  try {
    console.log('[UpdateOrderPaid] 开始更新订单为已支付:', {
      orderId,
      transactionId,
      thirdPartyOrderNo,
    });

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    // 检查订单状态，允许 PENDING 或 PROCESSING 转为 PAID
    if (!['PENDING', 'PROCESSING', 'PAID'].includes(order.status)) {
      throw new Error(`订单状态不允许更新为已支付，当前状态: ${order.status}`);
    }

    // 如果订单已经是 PAID 状态，直接返回
    if (order.status === 'PAID') {
      console.log('[UpdateOrderPaid] 订单已支付，直接返回:', {
        orderId,
        status: order.status,
      });
      return createOrderObject(order);
    }

    // 验证状态转换
    if (
      !isValidOrderStatusTransition(
        order.status as OrderStatus,
        OrderStatus.PAID
      )
    ) {
      throw new Error(`不允许的状态转换: ${order.status} -> PAID`);
    }

    // 使用事务处理订单支付完成
    const updatedOrder = await prisma.$transaction(async tx => {
      // 1. 更新订单状态为已支付
      const orderResult = await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
        include: {
          user: true,
          membershipTier: true,
        },
      });

      console.log('[UpdateOrderPaid] 订单状态已更新:', {
        orderId,
        orderNo: orderResult.orderNo,
        status: orderResult.status,
        paidAt: orderResult.paidAt,
      });

      // 2. 创建或更新支付记录
      const paymentRecord = await tx.paymentRecord.create({
        data: {
          orderId: orderResult.id,
          userId: orderResult.userId,
          paymentMethod: orderResult.paymentMethod as PaymentMethod,
          status: 'SUCCESS',
          amount: orderResult.amount,
          currency: orderResult.currency,
          transactionId,
          thirdPartyOrderNo,
        },
      });

      console.log('[UpdateOrderPaid] 支付记录已创建:', {
        paymentRecordId: paymentRecord.id,
        orderId,
        transactionId,
      });

      // 3. 计算会员到期时间
      const now = new Date();
      let endDate = new Date(now);

      const metadata = orderResult.metadata as Record<string, unknown>;
      const billingCycle = (metadata.billingCycle as string) || 'MONTHLY';

      switch (billingCycle) {
        case 'MONTHLY':
          endDate.setMonth(endDate.getMonth() + 1);
          break;
        case 'QUARTERLY':
          endDate.setMonth(endDate.getMonth() + 3);
          break;
        case 'YEARLY':
          endDate.setFullYear(endDate.getFullYear() + 1);
          break;
        case 'LIFETIME':
          endDate.setFullYear(endDate.getFullYear() + 100);
          break;
      }

      // 4. 查询当前有效的会员
      const currentMembership = await tx.userMembership.findFirst({
        where: {
          userId: orderResult.userId,
          status: 'ACTIVE',
        },
        orderBy: {
          endDate: 'desc',
        },
        include: {
          tier: true,
        },
      });

      // 5. 如果当前会员未到期，则延长到期时间
      if (currentMembership && new Date(currentMembership.endDate) > now) {
        const currentEndDate = new Date(currentMembership.endDate);
        endDate = new Date(
          Math.max(endDate.getTime(), currentEndDate.getTime())
        );
        console.log('[UpdateOrderPaid] 延长会员到期时间:', {
          currentEndDate,
          newEndDate: endDate,
        });
      }

      // 6. 创建新的会员记录
      const membershipResult = await tx.userMembership.create({
        data: {
          userId: orderResult.userId,
          tierId: orderResult.membershipTierId,
          status: 'ACTIVE',
          startDate: now,
          endDate,
          autoRenew: (metadata.autoRenew as boolean) || false,
          notes: `通过订单${orderResult.orderNo}开通会员`,
        },
        include: {
          tier: true,
        },
      });

      console.log('[UpdateOrderPaid] 会员记录已创建:', {
        membershipId: membershipResult.id,
        tier: membershipResult.tier?.tier,
        startDate: membershipResult.startDate,
        endDate: membershipResult.endDate,
      });

      // 7. 记录会员变更历史
      await tx.membershipHistory.create({
        data: {
          userId: orderResult.userId,
          membershipId: membershipResult.id,
          changeType: 'UPGRADE',
          fromTier:
            (currentMembership?.tier?.tier as MembershipTierType) || 'FREE',
          toTier:
            (membershipResult.tier?.tier as MembershipTierType) || 'BASIC',
          fromStatus: currentMembership?.status || 'EXPIRED',
          toStatus: 'ACTIVE',
          reason: `通过订单${orderResult.orderNo}开通会员`,
          performedBy: orderResult.userId,
          metadata: {
            orderId: orderResult.id,
            orderNo: orderResult.orderNo,
            amount: toNumber(orderResult.amount),
            transactionId,
          },
        },
      });

      console.log('[UpdateOrderPaid] 会员历史记录已创建');

      return orderResult;
    });

    console.log('[UpdateOrderPaid] 订单支付完成处理成功:', {
      orderId,
      orderNo: updatedOrder.orderNo,
      userId: updatedOrder.userId,
    });

    return createOrderObject(updatedOrder);
  } catch (error) {
    console.error('[UpdateOrderPaid] 更新订单支付状态失败:', error);
    throw error;
  }
}

/**
 * 批量更新订单为已支付
 * 用于处理支付回调的批量更新场景
 */
export async function batchUpdateOrdersPaid(
  orders: Array<{
    orderId: string;
    transactionId: string;
    thirdPartyOrderNo?: string;
  }>
): Promise<{
  success: string[];
  failed: Array<{ orderId: string; error: string }>;
}> {
  const results = {
    success: [] as string[],
    failed: [] as Array<{ orderId: string; error: string }>,
  };

  for (const orderInfo of orders) {
    try {
      await updateOrderPaid(
        orderInfo.orderId,
        orderInfo.transactionId,
        orderInfo.thirdPartyOrderNo
      );
      results.success.push(orderInfo.orderId);
    } catch (error) {
      results.failed.push({
        orderId: orderInfo.orderId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log('[UpdateOrderPaid] 批量更新订单支付状态完成:', results);

  return results;
}

/**
 * 查询订单支付状态
 */
export async function getOrderPaymentStatus(orderId: string): Promise<{
  order: Order | null;
  isPaid: boolean;
  canPay: boolean;
}> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        membershipTier: true,
        paymentRecords: true,
      },
    });

    if (!order) {
      return {
        order: null,
        isPaid: false,
        canPay: false,
      };
    }

    const isPaid = order.status === 'PAID';
    const canPay = ['PENDING', 'PROCESSING'].includes(order.status as string);
    const isExpired = new Date() > order.expiredAt;

    return {
      order: createOrderObject(order),
      isPaid,
      canPay: canPay && !isExpired,
    };
  } catch (error) {
    console.error('[UpdateOrderPaid] 查询订单支付状态失败:', error);
    throw error;
  }
}
