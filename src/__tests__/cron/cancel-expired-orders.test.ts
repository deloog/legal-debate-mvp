/**
 * cancel-expired-orders 单元测试
 */

import { prisma } from '@/lib/db/prisma';
import {
  cancelExpiredOrders,
  manuallyCancelExpiredOrders,
  getExpiredOrdersStats,
  getOrdersExpiringSoon,
  cleanupOldExpiredOrders,
} from '@/lib/cron/cancel-expired-orders';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      findMany: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('cancel-expired-orders 模块', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('cancelExpiredOrders', () => {
    const mockExpiredOrders = [
      {
        id: 'order-1',
        orderNo: 'ORD001',
        userId: 'user-1',
        membershipTierId: 'tier-1',
        paymentMethod: 'WECHAT',
        status: 'PENDING',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试订单',
        expiredAt: new Date(Date.now() - 60 * 60 * 1000), // 已过期
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'user-1', email: 'test@example.com' },
        membershipTier: { id: 'tier-1', name: 'basic' },
      },
      {
        id: 'order-2',
        orderNo: 'ORD002',
        userId: 'user-2',
        membershipTierId: 'tier-2',
        paymentMethod: 'ALIPAY',
        status: 'PENDING',
        amount: { toNumber: () => 200 },
        currency: 'CNY',
        description: '测试订单2',
        expiredAt: new Date(Date.now() - 30 * 60 * 1000), // 已过期
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'user-2', email: 'test2@example.com' },
        membershipTier: { id: 'tier-2', name: 'professional' },
      },
    ];

    it('应该成功取消过期订单', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockExpiredOrders);
      (prisma.order.update as jest.Mock).mockResolvedValue({ id: 'order-1' });

      const result = await cancelExpiredOrders();

      expect(result.cancelledCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiredAt: {
            lt: expect.any(Date),
          },
        },
        include: {
          user: true,
          membershipTier: true,
        },
      });
    });

    it('应该在没有过期订单时返回空结果', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const result = await cancelExpiredOrders();

      expect(result.cancelledCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('应该处理取消过期订单时的失败', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockExpiredOrders);
      (prisma.order.update as jest.Mock)
        .mockResolvedValueOnce({ id: 'order-1' })
        .mockRejectedValueOnce(new Error('数据库错误'));

      const result = await cancelExpiredOrders();

      expect(result.cancelledCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].orderId).toBe('order-2');
      expect(result.errors[0].error).toBe('数据库错误');
    });

    it('应该处理所有订单都取消失败的情况', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue(mockExpiredOrders);
      (prisma.order.update as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const result = await cancelExpiredOrders();

      expect(result.cancelledCount).toBe(0);
      expect(result.failedCount).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('manuallyCancelExpiredOrders', () => {
    it('应该手动触发过期订单取消', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.update as jest.Mock).mockResolvedValue({ id: 'order-1' });

      const result = await manuallyCancelExpiredOrders();

      expect(result.success).toBe(true);
      expect(result.message).toContain('成功取消 0 个过期订单');
      expect(result.result.cancelledCount).toBe(0);
    });

    it('应该处理手动取消时的错误', async () => {
      (prisma.order.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const result = await manuallyCancelExpiredOrders();

      expect(result.success).toBe(false);
      expect(result.message).toBe('取消过期订单失败');
      expect(result.result.cancelledCount).toBe(0);
    });
  });

  describe('getExpiredOrdersStats', () => {
    it('应该返回过期订单统计信息', async () => {
      (prisma.order.count as jest.Mock)
        .mockResolvedValueOnce(10) // pendingExpiredCount
        .mockResolvedValueOnce(5); // soonToExpireCount

      const result = await getExpiredOrdersStats();

      expect(result.pendingExpiredCount).toBe(10);
      expect(result.processingExpiredCount).toBe(0);
      expect(result.totalExpiredCount).toBe(10);
      expect(result.soonToExpireCount).toBe(5);
    });

    it('应该处理没有过期订单的情况', async () => {
      (prisma.order.count as jest.Mock)
        .mockResolvedValueOnce(0) // pendingExpiredCount
        .mockResolvedValueOnce(0); // soonToExpireCount

      const result = await getExpiredOrdersStats();

      expect(result.pendingExpiredCount).toBe(0);
      expect(result.processingExpiredCount).toBe(0);
      expect(result.totalExpiredCount).toBe(0);
      expect(result.soonToExpireCount).toBe(0);
    });

    it('应该正确计算即将过期的订单', async () => {
      (prisma.order.count as jest.Mock)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);

      const result = await getExpiredOrdersStats();

      expect(result.soonToExpireCount).toBe(3);
    });
  });

  describe('getOrdersExpiringSoon', () => {
    const mockExpiringOrders = [
      {
        id: 'order-1',
        orderNo: 'ORD001',
        userId: 'user-1',
        status: 'PENDING',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试订单',
        expiredAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { email: 'test@example.com' },
      },
      {
        id: 'order-2',
        orderNo: 'ORD002',
        userId: 'user-2',
        status: 'PENDING',
        amount: { toNumber: () => 200 },
        currency: 'CNY',
        description: '测试订单2',
        expiredAt: new Date(Date.now() + 45 * 60 * 1000), // 45分钟后过期
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { email: 'test2@example.com' },
      },
    ];

    it('应该返回即将过期的订单列表', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue(
        mockExpiringOrders
      );

      const result = await getOrdersExpiringSoon(1);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('order-1');
      expect(result[0].orderNo).toBe('ORD001');
      expect(result[0].amount).toBe(100);
      expect(result[0].userEmail).toBe('test@example.com');
    });

    it('应该返回空的订单列表', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getOrdersExpiringSoon(1);

      expect(result).toHaveLength(0);
    });

    it('应该限制返回的订单数量', async () => {
      const manyOrders = Array.from({ length: 50 }, (_, i) => ({
        id: `order-${i}`,
        orderNo: `ORD${i}`,
        userId: `user-${i}`,
        status: 'PENDING',
        amount: { toNumber: () => i * 100 },
        currency: 'CNY',
        description: `测试订单${i}`,
        expiredAt: new Date(Date.now() + i * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { email: `test${i}@example.com` },
      }));

      (prisma.order.findMany as jest.Mock).mockResolvedValue(manyOrders);

      const result = await getOrdersExpiringSoon(1);

      expect(result.length).toBeLessThanOrEqual(100);
      expect(result.length).toBe(50);
    });

    it('应该支持自定义过期时间范围', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await getOrdersExpiringSoon(2);

      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: {
          status: 'PENDING',
          expiredAt: {
            gte: expect.any(Date),
            lt: expect.any(Date),
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
        take: 100,
      });
    });
  });

  describe('cleanupOldExpiredOrders', () => {
    it('应该清理过期的旧订单', async () => {
      (prisma.order.deleteMany as jest.Mock).mockResolvedValue({
        count: 50,
      });

      const result = await cleanupOldExpiredOrders(30);

      expect(result.deletedCount).toBe(50);
      expect(prisma.order.deleteMany).toHaveBeenCalledWith({
        where: {
          status: 'EXPIRED',
          expiredAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('应该使用默认的30天清理周期', async () => {
      (prisma.order.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      await cleanupOldExpiredOrders();

      expect(prisma.order.deleteMany).toHaveBeenCalled();
    });

    it('应该处理没有需要清理的订单', async () => {
      (prisma.order.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await cleanupOldExpiredOrders(7);

      expect(result.deletedCount).toBe(0);
    });

    it('应该支持自定义清理天数', async () => {
      (prisma.order.deleteMany as jest.Mock).mockResolvedValue({
        count: 100,
      });

      const result = await cleanupOldExpiredOrders(60);

      expect(result.deletedCount).toBe(100);
    });
  });
});
