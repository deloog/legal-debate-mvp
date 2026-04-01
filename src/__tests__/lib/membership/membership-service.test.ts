/**
 * Membership Service 单元测试
 * TDD 红阶段 - 先写测试再实现
 */

import { prisma } from '@/lib/db/prisma';
import {
  activateMembership,
  upgradeMembership,
  extendMembership,
  cancelMembership,
  getMembershipDetails,
  calculateEndDate,
} from '@/lib/membership/membership-service';
import { MembershipStatus, MembershipTierType } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    userMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    membershipHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    membershipTier: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
  },
}));

describe('MembershipService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateEndDate', () => {
    it('should calculate monthly end date correctly', () => {
      const startDate = new Date('2026-01-15');
      const endDate = calculateEndDate(startDate, 'MONTHLY');

      expect(endDate.getMonth()).toBe(1); // February (0-indexed: Jan=0, Feb=1)
      expect(endDate.getDate()).toBe(15);
      expect(endDate.getFullYear()).toBe(2026);
    });

    it('should calculate quarterly end date correctly', () => {
      const startDate = new Date('2026-01-15');
      const endDate = calculateEndDate(startDate, 'QUARTERLY');

      expect(endDate.getMonth()).toBe(3); // April (0-indexed: Jan=0, Apr=3)
      expect(endDate.getDate()).toBe(15);
    });

    it('should calculate yearly end date correctly', () => {
      const startDate = new Date('2026-01-15');
      const endDate = calculateEndDate(startDate, 'YEARLY');

      expect(endDate.getFullYear()).toBe(2027);
      expect(endDate.getMonth()).toBe(0);
    });

    it('should calculate lifetime end date correctly', () => {
      const startDate = new Date('2026-01-15');
      const endDate = calculateEndDate(startDate, 'LIFETIME');

      expect(endDate.getFullYear()).toBe(2126); // 100 years later
    });

    it('should default to monthly for invalid billing cycle', () => {
      const startDate = new Date('2026-01-15');
      const endDate = calculateEndDate(startDate, 'INVALID' as any);

      expect(endDate.getMonth()).toBe(1); // February (default to monthly)
    });
  });

  describe('activateMembership', () => {
    const mockOrder = {
      id: 'order-1',
      userId: 'user-1',
      membershipTierId: 'tier-1',
      orderNo: 'ORD-2026-001',
      metadata: { billingCycle: 'MONTHLY', autoRenew: false },
      amount: { toNumber: () => 99 },
    };

    const mockTier = {
      id: 'tier-1',
      tier: 'BASIC' as MembershipTierType,
      name: '基础版',
    };

    it('should activate membership successfully for new user', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue(
        mockTier
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              userId: 'user-1',
              tierId: 'tier-1',
              status: MembershipStatus.ACTIVE,
              endDate: new Date('2026-02-15'),
              tier: mockTier,
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      const result = await activateMembership({
        orderId: 'order-1',
        userId: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(MembershipStatus.ACTIVE);
      expect(result.userId).toBe('user-1');
    });

    it('should extend existing membership if current one is active', async () => {
      const existingMembership = {
        id: 'existing-membership',
        userId: 'user-1',
        tierId: 'tier-1',
        status: MembershipStatus.ACTIVE,
        endDate: new Date('2026-03-15'),
        tier: { tier: 'BASIC' as MembershipTierType },
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue(
        mockTier
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(existingMembership),
            create: jest.fn().mockResolvedValue({
              id: 'membership-2',
              userId: 'user-1',
              tierId: 'tier-1',
              status: MembershipStatus.ACTIVE,
              endDate: new Date('2026-04-15'),
              tier: mockTier,
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-2' }),
          },
        });
      });

      const result = await activateMembership({
        orderId: 'order-1',
        userId: 'user-1',
      });

      expect(result).toBeDefined();
    });

    it('should throw error if order not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        activateMembership({ orderId: 'invalid-order', userId: 'user-1' })
      ).rejects.toThrow('订单不存在');
    });

    it('should throw error if order does not belong to user', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        userId: 'different-user',
      });

      await expect(
        activateMembership({ orderId: 'order-1', userId: 'user-1' })
      ).rejects.toThrow('订单不属于当前用户');
    });

    it('should throw error if membership tier not found', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        activateMembership({ orderId: 'order-1', userId: 'user-1' })
      ).rejects.toThrow('会员套餐不存在');
    });

    it('should support different billing cycles', async () => {
      const yearlyOrder = {
        ...mockOrder,
        metadata: { billingCycle: 'YEARLY', autoRenew: true },
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(yearlyOrder);
      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue(
        mockTier
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          userMembership: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'membership-1',
              userId: 'user-1',
              tierId: 'tier-1',
              status: MembershipStatus.ACTIVE,
              endDate: new Date('2027-01-15'),
              autoRenew: true,
              tier: mockTier,
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      const result = await activateMembership({
        orderId: 'order-1',
        userId: 'user-1',
      });

      expect(result.autoRenew).toBe(true);
    });

    it('should throw error if orderId is empty', async () => {
      await expect(
        activateMembership({ orderId: '', userId: 'user-1' })
      ).rejects.toThrow('orderId 和 userId 不能为空');
    });

    it('should throw error if userId is empty', async () => {
      await expect(
        activateMembership({ orderId: 'order-1', userId: '' })
      ).rejects.toThrow('orderId 和 userId 不能为空');
    });
  });

  describe('upgradeMembership', () => {
    const mockCurrentMembership = {
      id: 'current-membership',
      userId: 'user-1',
      tierId: 'basic-tier',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-06-15'),
      tier: { tier: 'BASIC' as MembershipTierType },
    };

    const mockNewTier = {
      id: 'pro-tier',
      tier: 'PRO' as MembershipTierType,
      name: '专业版',
    };

    it('should upgrade membership to higher tier', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockCurrentMembership
      );
      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue(
        mockNewTier
      );
      (prisma.$transaction as jest.Mock).mockImplementation(async callback => {
        return callback({
          userMembership: {
            update: jest.fn().mockResolvedValue({
              ...mockCurrentMembership,
              tierId: 'pro-tier',
              tier: mockNewTier,
            }),
          },
          membershipHistory: {
            create: jest.fn().mockResolvedValue({ id: 'history-1' }),
          },
        });
      });

      const result = await upgradeMembership({
        userId: 'user-1',
        newTierId: 'pro-tier',
        reason: '用户升级',
      });

      expect(result).toBeDefined();
      expect(result.tierId).toBe('pro-tier');
    });

    it('should throw error if no active membership', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        upgradeMembership({ userId: 'user-1', newTierId: 'pro-tier' })
      ).rejects.toThrow('用户没有活跃的会员');
    });

    it('should throw error if upgrading to same tier', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockCurrentMembership
      );
      (prisma.membershipTier.findUnique as jest.Mock).mockResolvedValue({
        id: 'basic-tier',
        tier: 'BASIC' as MembershipTierType,
      });

      await expect(
        upgradeMembership({ userId: 'user-1', newTierId: 'basic-tier' })
      ).rejects.toThrow('不能升级到相同套餐');
    });
  });

  describe('extendMembership', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: 'tier-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-03-15'),
      tier: { tier: 'BASIC' as MembershipTierType },
    };

    it('should extend membership by specified months', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.userMembership.update as jest.Mock).mockResolvedValue({
        ...mockMembership,
        endDate: new Date('2026-06-15'), // +3 months
      });
      (prisma.membershipHistory.create as jest.Mock).mockResolvedValue({
        id: 'history-1',
      });

      const result = await extendMembership({
        userId: 'user-1',
        months: 3,
        reason: '延期补偿',
      });

      expect(result).toBeDefined();
    });

    it('should throw error if no active membership', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        extendMembership({ userId: 'user-1', months: 3 })
      ).rejects.toThrow('用户没有活跃的会员');
    });

    it('should throw error if months is not positive', async () => {
      await expect(
        extendMembership({ userId: 'user-1', months: 0 })
      ).rejects.toThrow('延期月数必须大于0');

      await expect(
        extendMembership({ userId: 'user-1', months: -1 })
      ).rejects.toThrow('延期月数必须大于0');
    });

    it('should throw error if months exceeds maximum (1200)', async () => {
      await expect(
        extendMembership({ userId: 'user-1', months: 1201 })
      ).rejects.toThrow('延期月数不能超过1200个月');
    });

    it('should throw error if userId is empty', async () => {
      await expect(extendMembership({ userId: '', months: 3 })).rejects.toThrow(
        'userId 不能为空'
      );
    });
  });

  describe('cancelMembership', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: 'tier-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-03-15'),
      tier: { tier: 'BASIC' as MembershipTierType },
    };

    it('should cancel membership immediately', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.userMembership.update as jest.Mock).mockResolvedValue({
        ...mockMembership,
        status: MembershipStatus.CANCELLED,
      });
      (prisma.membershipHistory.create as jest.Mock).mockResolvedValue({
        id: 'history-1',
      });

      const result = await cancelMembership({
        userId: 'user-1',
        immediate: true,
        reason: '用户申请退款',
      });

      expect(result.status).toBe(MembershipStatus.CANCELLED);
    });

    it('should cancel membership at period end', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.userMembership.update as jest.Mock).mockResolvedValue({
        ...mockMembership,
        autoRenew: false,
      });

      const result = await cancelMembership({
        userId: 'user-1',
        immediate: false,
        reason: '用户取消自动续费',
      });

      expect(result.autoRenew).toBe(false);
    });

    it('should throw error if no active membership', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(cancelMembership({ userId: 'user-1' })).rejects.toThrow(
        '用户没有活跃的会员'
      );
    });
  });

  describe('getMembershipDetails', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: 'tier-1',
      status: MembershipStatus.ACTIVE,
      startDate: new Date('2026-01-15'),
      endDate: new Date('2026-04-15'),
      autoRenew: true,
      tier: {
        tier: 'BASIC' as MembershipTierType,
        name: '基础版',
        tierLimits: [
          { limitType: 'MAX_CASES', limitValue: 10 },
          { limitType: 'MAX_DEBATES', limitValue: 50 },
        ],
      },
    };

    it('should return membership details with limits', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );

      const result = await getMembershipDetails('user-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('membership-1');
      expect(result?.tier.name).toBe('基础版');
      expect(result?.limits).toHaveLength(2);
    });

    it('should return null if no active membership', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getMembershipDetails('user-1');

      expect(result).toBeNull();
    });

    it('should calculate days remaining correctly', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15); // 15 days from now

      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue({
        ...mockMembership,
        endDate: futureDate,
      });

      const result = await getMembershipDetails('user-1');

      expect(result?.daysRemaining).toBe(15);
    });
  });
});
