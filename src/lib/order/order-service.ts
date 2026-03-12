/**
 * 订单服务
 * 提供订单创建、查询、更新等功能
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  calculateOrderExpireTime,
  generateOrderNo,
} from '@/lib/payment/wechat-utils';
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
 * 创建订单请求
 */
export interface CreateOrderRequest {
  userId: string;
  membershipTierId: string;
  paymentMethod: PaymentMethod;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';
  autoRenew?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 创建订单
 * 
 * 幂等性保证：
 * 1. 使用数据库唯一约束防止重复订单号
 * 2. 检查用户未完成订单避免重复创建
 * 3. 使用事务确保原子性
 */
export async function createOrder(request: CreateOrderRequest): Promise<Order> {
  try {
    const {
      userId,
      membershipTierId,
      paymentMethod,
      billingCycle = 'MONTHLY',
      autoRenew = false,
      description = '会员订阅',
      metadata = {},
    } = request;

    // 查询会员等级信息
    const tier = await prisma.membershipTier.findUnique({
      where: { id: membershipTierId },
    });

    if (!tier) {
      throw new Error('会员等级不存在');
    }

    if (!tier.isActive) {
      throw new Error('会员等级暂不可用');
    }

    // 计算订单过期时间（2小时）
    const expiredAt = calculateOrderExpireTime(120);
    const orderNo = generateOrderNo();

    // 使用事务确保原子性
    try {
      const order = await prisma.$transaction(async (tx) => {
        // 检查用户是否已有未完成的订单（数据库级锁定）
        const existingOrder = await tx.order.findFirst({
          where: {
            userId,
            membershipTierId,
            status: { in: ['PENDING'] },
            expiredAt: { gt: new Date() },
          },
        });

        if (existingOrder) {
          logger.info('[OrderService] 返回已存在的未完成订单:', {
            orderId: existingOrder.id,
            orderNo: existingOrder.orderNo,
          });
          return existingOrder;
        }

        // 创建订单
        const newOrder = await tx.order.create({
          data: {
            orderNo,
            userId,
            membershipTierId,
            paymentMethod,
            status: 'PENDING',
            amount: tier.price,
            currency: tier.currency,
            description,
            expiredAt,
            metadata: {
              ...metadata,
              billingCycle,
              autoRenew,
            },
          },
          include: {
            user: true,
            membershipTier: true,
          },
        });

        return newOrder;
      }, {
        // 设置事务隔离级别和超时
        isolationLevel: 'Serializable',
        maxWait: 5000,
        timeout: 10000,
      });

      logger.info('[OrderService] 创建订单成功:', {
        orderId: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        amount: toNumber(order.amount),
      });

      return createOrderObject(order);
    } catch (error) {
      // 处理唯一约束冲突（订单号重复）
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        logger.warn('[OrderService] 订单号冲突，尝试获取现有订单');
        
        // 尝试查找最近创建的订单
        const recentOrder = await prisma.order.findFirst({
          where: {
            userId,
            membershipTierId,
            status: { in: ['PENDING', 'PAID'] },
            createdAt: {
              gte: new Date(Date.now() - 5 * 60 * 1000), // 5分钟内
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (recentOrder) {
          return createOrderObject(recentOrder);
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('[OrderService] 创建订单失败:', error);
    throw error;
  }
}

/**
 * 查询订单
 */
export async function getOrder(orderId: string): Promise<Order | null> {
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
      return null;
    }

    return createOrderObject(order);
  } catch (error) {
    logger.error('[OrderService] 查询订单失败:', error);
    throw error;
  }
}

/**
 * 根据订单号查询订单
 */
export async function getOrderByOrderNo(
  orderNo: string
): Promise<Order | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        user: true,
        membershipTier: true,
        paymentRecords: true,
      },
    });

    if (!order) {
      return null;
    }

    return createOrderObject(order);
  } catch (error) {
    logger.error('[OrderService] 查询订单失败:', error);
    throw error;
  }
}

/**
 * 查询用户订单列表
 */
export async function getUserOrders(
  userId: string,
  params: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ orders: Order[]; total: number }> {
  try {
    const { status, page = 1, limit = 20 } = params;

    const where: Record<string, unknown> = { userId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          membershipTier: true,
          paymentRecords: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return {
      orders: orders.map(createOrderObject),
      total,
    };
  } catch (error) {
    logger.error('[OrderService] 查询用户订单失败:', error);
    throw error;
  }
}

/**
 * 更新订单状态
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  data?: {
    paidAt?: Date;
    failedReason?: string;
  }
): Promise<Order> {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: status as unknown as Record<string, unknown>,
        ...data,
      },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    logger.info('[OrderService] 更新订单状态:', {
      orderId,
      status,
    });

    return createOrderObject(order);
  } catch (error) {
    logger.error('[OrderService] 更新订单状态失败:', error);
    throw error;
  }
}

/**
 * 取消订单
 */
export async function cancelOrder(
  orderId: string,
  reason?: string
): Promise<Order> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new Error('订单不存在');
    }

    if (order.status !== 'PENDING') {
      throw new Error('订单状态不允许取消');
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        failedReason: reason || '用户取消',
      },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    logger.info('[OrderService] 取消订单:', {
      orderId,
      reason,
    });

    return createOrderObject(updatedOrder);
  } catch (error) {
    logger.error('[OrderService] 取消订单失败:', error);
    throw error;
  }
}

/**
 * 检查订单是否过期
 */
export function isOrderExpired(expiredAt: Date): boolean {
  return new Date() > expiredAt;
}

/**
 * 处理支付成功
 */
export async function handlePaymentSuccess(
  orderId: string,
  transactionId: string,
  _thirdPartyOrderNo: string
): Promise<Order> {
  logger.info('[OrderService] 第三方订单号（未使用）:', _thirdPartyOrderNo);
  try {
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

    if (order.status === 'PAID') {
      return createOrderObject(order); // 已支付，直接返回
    }

    // 更新订单状态为已支付
    const updatedOrder = await prisma.$transaction(async tx => {
      // 更新订单状态
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

      // 创建或更新会员记录
      const now = new Date();
      let endDate = new Date(now);

      // 计算会员到期时间
      const metadata = order.metadata as Record<string, unknown>;
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

      // 查询当前会员
      const currentMembership = await tx.userMembership.findFirst({
        where: {
          userId: order.userId,
          status: 'ACTIVE',
        },
        orderBy: {
          endDate: 'desc',
        },
        include: {
          tier: true,
        },
      });

      // 如果当前会员未到期，则延长到期时间
      if (currentMembership && new Date(currentMembership.endDate) > now) {
        const currentEndDate = new Date(currentMembership.endDate);
        endDate = new Date(
          Math.max(endDate.getTime(), currentEndDate.getTime())
        );
      }

      // 创建新的会员记录
      const membershipResult = await tx.userMembership.create({
        data: {
          userId: order.userId,
          tierId: order.membershipTierId,
          status: 'ACTIVE',
          startDate: now,
          endDate,
          autoRenew: (metadata.autoRenew as boolean) || false,
          notes: `通过订单${order.orderNo}开通会员`,
        },
        include: {
          tier: true,
        },
      });

      // 记录变更历史
      await tx.membershipHistory.create({
        data: {
          userId: order.userId,
          membershipId: membershipResult.id,
          changeType: 'UPGRADE',
          fromTier:
            (currentMembership?.tier?.tier as MembershipTierType) || 'FREE',
          toTier:
            (membershipResult.tier?.tier as MembershipTierType) || 'BASIC',
          fromStatus: currentMembership?.status || 'EXPIRED',
          toStatus: 'ACTIVE',
          reason: `通过订单${order.orderNo}开通会员`,
          performedBy: order.userId,
          metadata: {
            orderId: order.id,
            orderNo: order.orderNo,
            amount: toNumber(order.amount),
            transactionId,
          },
        },
      });

      return orderResult;
    });

    logger.info('[OrderService] 处理支付成功:', {
      orderId,
      transactionId,
    });

    return createOrderObject(updatedOrder);
  } catch (error) {
    logger.error('[OrderService] 处理支付成功失败:', error);
    throw error;
  }
}

/**
 * 处理支付失败
 */
export async function handlePaymentFailure(
  orderId: string,
  errorCode: string,
  errorMessage: string
): Promise<Order> {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'FAILED',
        failedReason: `${errorCode}: ${errorMessage}`,
      },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    logger.info('[OrderService] 处理支付失败:', {
      orderId,
      errorCode,
      errorMessage,
    });

    return createOrderObject(order);
  } catch (error) {
    logger.error('[OrderService] 处理支付失败错误:', error);
    throw error;
  }
}
