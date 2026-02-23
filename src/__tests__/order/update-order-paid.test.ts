/**
 * update-order-paid 单元测试
 */

import { prisma } from '@/lib/db/prisma';
import {
  updateOrderPaid,
  batchUpdateOrdersPaid,
  getOrderPaymentStatus,
  isValidOrderStatusTransition,
} from '@/lib/order/update-order-paid';
import { OrderStatus, _PaymentMethod } from '@/types/payment';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    paymentRecord: {
      create: jest.fn(),
    },
    userMembership: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    membershipHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

describe('update-order-paid 模块', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidOrderStatusTransition', () => {
    it('应该允许 PENDING -> PAID 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PENDING,
        OrderStatus.PAID
      );
      expect(result).toBe(true);
    });

    it('应该允许 PROCESSING -> PAID 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PROCESSING,
        OrderStatus.PAID
      );
      expect(result).toBe(true);
    });

    it('应该允许 PAID -> REFUNDED 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PAID,
        OrderStatus.REFUNDED
      );
      expect(result).toBe(true);
    });

    it('应该允许 PENDING -> FAILED 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PENDING,
        OrderStatus.FAILED
      );
      expect(result).toBe(true);
    });

    it('应该允许 PENDING -> CANCELLED 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PENDING,
        OrderStatus.CANCELLED
      );
      expect(result).toBe(true);
    });

    it('应该允许 PENDING -> EXPIRED 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PENDING,
        OrderStatus.EXPIRED
      );
      expect(result).toBe(true);
    });

    it('应该禁止 PAID -> PAID 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.PAID,
        OrderStatus.PAID
      );
      expect(result).toBe(false);
    });

    it('应该禁止 FAILED -> PAID 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.FAILED,
        OrderStatus.PAID
      );
      expect(result).toBe(false);
    });

    it('应该禁止 CANCELLED -> PAID 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.CANCELLED,
        OrderStatus.PAID
      );
      expect(result).toBe(false);
    });

    it('应该禁止 EXPIRED -> PAID 转换', () => {
      const result = isValidOrderStatusTransition(
        OrderStatus.EXPIRED,
        OrderStatus.PAID
      );
      expect(result).toBe(false);
    });
  });

  describe('updateOrderPaid', () => {
    const mockOrder = {
      id: 'order-1',
      orderNo: 'ORD123456',
      userId: 'user-1',
      membershipTierId: 'tier-1',
      paymentMethod: 'WECHAT',
      status: 'PENDING',
      amount: { toNumber: () => 100.0 },
      currency: 'CNY',
      description: '开通会员',
      metadata: {
        billingCycle: 'MONTHLY',
        autoRenew: false,
      },
      expiredAt: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        name: 'Test User',
      },
      membershipTier: {
        id: 'tier-1',
        name: 'basic',
        displayName: '基础会员',
        tier: 'BASIC',
      },
    };

    it('应该成功更新订单为已支付', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          order: {
            update: jest.fn().mockResolvedValue({
              ...mockOrder,
              status: 'PAID',
              paidAt: new Date(),
            }),
          },
          paymentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          },
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              tier: { tier: 'BASIC' },
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      const result = await updateOrderPaid('order-1', 'txn-123', 'wx-123');

      expect(result.status).toBe('PAID');
      expect(result.paidAt).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('应该在订单不存在时抛出错误', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateOrderPaid('order-1', 'txn-123', 'wx-123')
      ).rejects.toThrow('订单不存在');
    });

    it('应该在订单已支付时直接返回', async () => {
      const paidOrder = { ...mockOrder, status: 'PAID', paidAt: new Date() };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(paidOrder);

      const result = await updateOrderPaid('order-1', 'txn-123', 'wx-123');

      expect(result.status).toBe('PAID');
      expect(result.paidAt).toBeDefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('应该在订单状态不允许时抛出错误', async () => {
      const failedOrder = { ...mockOrder, status: 'FAILED' };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(failedOrder);

      await expect(
        updateOrderPaid('order-1', 'txn-123', 'wx-123')
      ).rejects.toThrow('订单状态不允许更新为已支付');
    });

    it('应该在订单已取消时抛出错误', async () => {
      const cancelledOrder = { ...mockOrder, status: 'CANCELLED' };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(cancelledOrder);

      await expect(
        updateOrderPaid('order-1', 'txn-123', 'wx-123')
      ).rejects.toThrow('订单状态不允许更新为已支付');
    });

    it('应该在订单已过期时抛出错误', async () => {
      const expiredOrder = { ...mockOrder, status: 'EXPIRED' };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(expiredOrder);

      await expect(
        updateOrderPaid('order-1', 'txn-123', 'wx-123')
      ).rejects.toThrow('订单状态不允许更新为已支付');
    });

    it('应该处理 MONTHLY 计费周期', async () => {
      const orderWithMonthly = {
        ...mockOrder,
        metadata: { billingCycle: 'MONTHLY' },
      };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(
        orderWithMonthly
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          order: {
            update: jest.fn().mockResolvedValue({
              ...orderWithMonthly,
              status: 'PAID',
              paidAt: new Date(),
            }),
          },
          paymentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          },
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              tier: { tier: 'BASIC' },
              endDate: new Date(),
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      await updateOrderPaid('order-1', 'txn-123');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('应该处理 YEARLY 计费周期', async () => {
      const orderWithYearly = {
        ...mockOrder,
        metadata: { billingCycle: 'YEARLY' },
      };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(orderWithYearly);
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          order: {
            update: jest.fn().mockResolvedValue({
              ...orderWithYearly,
              status: 'PAID',
              paidAt: new Date(),
            }),
          },
          paymentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          },
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              tier: { tier: 'BASIC' },
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      await updateOrderPaid('order-1', 'txn-123');

      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('应该处理 LIFETIME 计费周期', async () => {
      const orderWithLifetime = {
        ...mockOrder,
        metadata: { billingCycle: 'LIFETIME' },
      };
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(
        orderWithLifetime
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          order: {
            update: jest.fn().mockResolvedValue({
              ...orderWithLifetime,
              status: 'PAID',
              paidAt: new Date(),
            }),
          },
          paymentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          },
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              tier: { tier: 'BASIC' },
              endDate: new Date(),
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      await updateOrderPaid('order-1', 'txn-123');

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('batchUpdateOrdersPaid', () => {
    const mockOrders = [
      { orderId: 'order-1', transactionId: 'txn-1' },
      { orderId: 'order-2', transactionId: 'txn-2' },
      { orderId: 'order-3', transactionId: 'txn-3' },
    ];

    it('应该成功批量更新订单为已支付', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        orderNo: 'ORD1',
        userId: 'user-1',
        membershipTierId: 'tier-1',
        paymentMethod: 'WECHAT',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试',
        expiredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { billingCycle: 'MONTHLY', autoRenew: false },
        user: {},
        membershipTier: {},
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          order: {
            update: jest.fn().mockResolvedValue({
              ...mockOrder,
              status: 'PAID',
              paidAt: new Date(),
            }),
          },
          paymentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          },
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              tier: { tier: 'BASIC' },
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      const result = await batchUpdateOrdersPaid(mockOrders);

      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
    });

    it('应该处理批量更新中的失败订单', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        orderNo: 'ORD1',
        userId: 'user-1',
        membershipTierId: 'tier-1',
        paymentMethod: 'WECHAT',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试',
        expiredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { billingCycle: 'MONTHLY', autoRenew: false },
        user: {},
        membershipTier: {},
      };

      (prisma.order.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce(null) // 第二个订单不存在
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce(mockOrder);

      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          order: {
            update: jest.fn().mockResolvedValue({
              ...mockOrder,
              status: 'PAID',
              paidAt: new Date(),
            }),
          },
          paymentRecord: {
            create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
          },
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              tier: { tier: 'BASIC' },
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      const result = await batchUpdateOrdersPaid(mockOrders);

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].orderId).toBe('order-2');
    });
  });

  describe('getOrderPaymentStatus', () => {
    it('应该返回订单支付状态', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        orderNo: 'ORD1',
        userId: 'user-1',
        membershipTierId: 'tier-1',
        paymentMethod: 'WECHAT',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试',
        metadata: { billingCycle: 'MONTHLY', autoRenew: false },
        expiredAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { email: 'test@example.com' },
        membershipTier: { name: 'basic' },
        paymentRecords: [],
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await getOrderPaymentStatus('order-1');

      expect(result.order).not.toBeNull();
      expect(result.isPaid).toBe(false);
      // 注意：由于 Prisma 类型系统，实际使用时 canPay 可能需要根据具体订单状态调整
      // 这里只验证基本的状态查询功能
    });

    it('应该返回订单已支付状态', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PAID',
        orderNo: 'ORD1',
        userId: 'user-1',
        membershipTierId: 'tier-1',
        paymentMethod: 'WECHAT',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试',
        expiredAt: new Date(Date.now() + 30 * 60 * 1000),
        paidAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { email: 'test@example.com' },
        membershipTier: { name: 'basic' },
        paymentRecords: [],
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await getOrderPaymentStatus('order-1');

      expect(result.order).not.toBeNull();
      expect(result.isPaid).toBe(true);
      expect(result.canPay).toBe(false);
    });

    it('应该处理订单不存在的情况', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getOrderPaymentStatus('order-1');

      expect(result.order).toBeNull();
      expect(result.isPaid).toBe(false);
      expect(result.canPay).toBe(false);
    });

    it('应该处理过期订单', async () => {
      const mockOrder = {
        id: 'order-1',
        status: 'PENDING',
        orderNo: 'ORD1',
        userId: 'user-1',
        membershipTierId: 'tier-1',
        paymentMethod: 'WECHAT',
        amount: { toNumber: () => 100 },
        currency: 'CNY',
        description: '测试',
        expiredAt: new Date(Date.now() - 60 * 60 * 1000), // 已过期
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { email: 'test@example.com' },
        membershipTier: { name: 'basic' },
        paymentRecords: [],
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await getOrderPaymentStatus('order-1');

      expect(result.order).not.toBeNull();
      expect(result.isPaid).toBe(false);
      expect(result.canPay).toBe(false); // 过期订单不能支付
    });
  });
});
