/**
 * 订单过期自动取消定时任务
 * 定期检查并取消过期的待支付订单
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 取消过期订单
 * 查询所有状态为 PENDING 且已过期的订单，批量更新为 EXPIRED
 */
export async function cancelExpiredOrders(): Promise<{
  cancelledCount: number;
  failedCount: number;
  errors: Array<{ orderId: string; error: string }>;
}> {
  logger.info('[CancelExpiredOrders] 开始处理过期订单...');

  const now = new Date();

  try {
    // 查询所有过期且状态为 PENDING 的订单
    const expiredOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        expiredAt: {
          lt: now,
        },
      },
      include: {
        user: true,
        membershipTier: true,
      },
    });

    if (expiredOrders.length === 0) {
      logger.info('[CancelExpiredOrders] 没有需要取消的过期订单');
      return {
        cancelledCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    logger.info(
      `[CancelExpiredOrders] 找到 ${expiredOrders.length} 个过期订单`
    );

    // 批量更新过期订单状态
    const cancelledOrderIds: string[] = [];
    const failedOrders: Array<{ orderId: string; error: string }> = [];

    for (const order of expiredOrders) {
      try {
        // 更新订单状态为 EXPIRED
        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'EXPIRED',
            failedReason: '订单支付超时，已自动过期',
          },
        });

        logger.info('[CancelExpiredOrders] 订单已过期:', {
          orderId: order.id,
          orderNo: order.orderNo,
          userId: order.userId,
          expiredAt: order.expiredAt,
        });

        cancelledOrderIds.push(order.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('[CancelExpiredOrders] 取消过期订单失败:', {
          orderId: order.id,
          orderNo: order.orderNo,
          error: errorMessage,
        });

        failedOrders.push({
          orderId: order.id,
          error: errorMessage,
        });
      }
    }

    logger.info('[CancelExpiredOrders] 过期订单处理完成:', {
      totalCount: expiredOrders.length,
      cancelledCount: cancelledOrderIds.length,
      failedCount: failedOrders.length,
    });

    return {
      cancelledCount: cancelledOrderIds.length,
      failedCount: failedOrders.length,
      errors: failedOrders,
    };
  } catch (error) {
    logger.error('[CancelExpiredOrders] 处理过期订单时发生错误:', error);
    throw error;
  }
}

/**
 * 手动触发过期订单取消（用于测试或立即执行）
 */
export async function manuallyCancelExpiredOrders(): Promise<{
  success: boolean;
  message: string;
  result: {
    cancelledCount: number;
    failedCount: number;
    errors: Array<{ orderId: string; error: string }>;
  };
}> {
  try {
    logger.info('[CancelExpiredOrders] 手动触发过期订单取消...');
    const result = await cancelExpiredOrders();

    return {
      success: true,
      message: `成功取消 ${result.cancelledCount} 个过期订单，失败 ${result.failedCount} 个`,
      result,
    };
  } catch (error) {
    logger.error('[CancelExpiredOrders] 手动取消过期订单失败:', error);

    return {
      success: false,
      message: '取消过期订单失败',
      result: {
        cancelledCount: 0,
        failedCount: 0,
        errors: [],
      },
    };
  }
}

/**
 * 获取过期订单统计信息
 */
export async function getExpiredOrdersStats(): Promise<{
  pendingExpiredCount: number;
  processingExpiredCount: number;
  totalExpiredCount: number;
  soonToExpireCount: number; // 1小时内即将过期的订单
}> {
  try {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    // 统计状态为 PENDING 且已过期的订单
    const pendingExpiredCount = await prisma.order.count({
      where: {
        status: 'PENDING',
        expiredAt: {
          lt: now,
        },
      },
    });

    // 统计1小时内即将过期的订单
    const soonToExpireCount = await prisma.order.count({
      where: {
        status: 'PENDING',
        expiredAt: {
          gte: now,
          lt: oneHourLater,
        },
      },
    });

    const totalExpiredCount = pendingExpiredCount;

    return {
      pendingExpiredCount,
      processingExpiredCount: 0,
      totalExpiredCount,
      soonToExpireCount,
    };
  } catch (error) {
    logger.error('[CancelExpiredOrders] 获取过期订单统计失败:', error);
    throw error;
  }
}

/**
 * 获取即将过期的订单列表
 * @param hours 未来多少小时内过期的订单，默认为1小时
 */
export async function getOrdersExpiringSoon(hours = 1): Promise<
  Array<{
    id: string;
    orderNo: string;
    userId: string;
    status: string;
    amount: number;
    expiredAt: Date;
    userEmail?: string;
  }>
> {
  try {
    const now = new Date();
    const timeLater = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const expiringOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        expiredAt: {
          gte: now,
          lt: timeLater,
        },
      },
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        expiredAt: 'asc',
      },
      take: 100, // 限制返回数量
    });

    return expiringOrders.map(order => ({
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      status: order.status,
      amount: order.amount.toNumber(),
      expiredAt: order.expiredAt,
      userEmail: order.user?.email,
    }));
  } catch (error) {
    logger.error('[CancelExpiredOrders] 获取即将过期订单失败:', error);
    throw error;
  }
}

/**
 * 删除已过期且超过指定时间的订单
 * 用于清理历史过期订单数据
 * @param days 过期多少天后删除，默认为30天
 */
export async function cleanupOldExpiredOrders(days = 30): Promise<{
  deletedCount: number;
}> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await prisma.order.deleteMany({
      where: {
        status: 'EXPIRED',
        expiredAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info('[CancelExpiredOrders] 清理历史过期订单:', {
      deletedCount: result.count,
      cutoffDate,
    });

    return {
      deletedCount: result.count,
    };
  } catch (error) {
    logger.error('[CancelExpiredOrders] 清理历史过期订单失败:', error);
    throw error;
  }
}
