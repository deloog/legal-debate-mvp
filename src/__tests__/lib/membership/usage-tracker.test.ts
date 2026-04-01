/**
 * Usage Tracker 单元测试
 * TDD 红阶段 - 先写测试再实现
 */

import { prisma } from '@/lib/db/prisma';
import {
  recordUsage,
  batchRecordUsage,
  getUsageStats,
  checkUsageLimit,
  getUsageHistory,
  resetUsagePeriod,
} from '@/lib/membership/usage-tracker';
import { MembershipStatus, LimitType } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    usageRecord: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
      deleteMany: jest.fn(),
    },
    userMembership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('UsageTracker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordUsage', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: 'tier-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-12-31'),
      tier: {
        tierLimits: [
          { limitType: 'MAX_CASES', limitValue: 10 },
          { limitType: 'MAX_DEBATES', limitValue: 50 },
        ],
      },
    };

    it('should record usage successfully', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.create as jest.Mock).mockResolvedValue({
        id: 'usage-1',
        userId: 'user-1',
        membershipId: 'membership-1',
        usageType: 'CASE_CREATED',
        quantity: 1,
      });

      const result = await recordUsage({
        userId: 'user-1',
        usageType: 'CASE_CREATED',
        quantity: 1,
        description: '创建案件',
      });

      expect(result).toBe('usage-1');
      expect(prisma.usageRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            usageType: 'CASE_CREATED',
            quantity: 1,
          }),
        })
      );
    });

    it('should throw error if user has no active membership', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        recordUsage({
          userId: 'user-1',
          usageType: 'CASE_CREATED',
          quantity: 1,
        })
      ).rejects.toThrow('用户没有活跃的会员');
    });

    it('should support different usage types', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.create as jest.Mock).mockResolvedValue({
        id: 'usage-1',
      });

      const usageTypes = [
        'CASE_CREATED',
        'DEBATE_GENERATED',
        'DOCUMENT_ANALYZED',
        'LAW_ARTICLE_SEARCHED',
        'AI_TOKEN_USED',
        'STORAGE_USED',
      ];

      for (const usageType of usageTypes) {
        await recordUsage({
          userId: 'user-1',
          usageType: usageType as any,
          quantity: 1,
        });
      }

      expect(prisma.usageRecord.create).toHaveBeenCalledTimes(6);
    });

    it('should include resourceId and resourceType when provided', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.create as jest.Mock).mockResolvedValue({
        id: 'usage-1',
      });

      await recordUsage({
        userId: 'user-1',
        usageType: 'CASE_CREATED',
        quantity: 1,
        resourceId: 'case-123',
        resourceType: 'CASE',
        description: '创建案件',
        metadata: { source: 'web' },
      });

      expect(prisma.usageRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            resourceId: 'case-123',
            resourceType: 'CASE',
            description: '创建案件',
            metadata: { source: 'web' },
          }),
        })
      );
    });

    it('should use default unit as count', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.create as jest.Mock).mockResolvedValue({
        id: 'usage-1',
      });

      await recordUsage({
        userId: 'user-1',
        usageType: 'CASE_CREATED',
        quantity: 5,
      });

      expect(prisma.usageRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            unit: 'count',
          }),
        })
      );
    });

    it('should throw error if quantity is not positive', async () => {
      await expect(
        recordUsage({
          userId: 'user-1',
          usageType: 'CASE_CREATED',
          quantity: 0,
        })
      ).rejects.toThrow('quantity 必须在 1-1000000 之间');

      await expect(
        recordUsage({
          userId: 'user-1',
          usageType: 'CASE_CREATED',
          quantity: -1,
        })
      ).rejects.toThrow('quantity 必须在 1-1000000 之间');
    });

    it('should throw error if quantity exceeds maximum', async () => {
      await expect(
        recordUsage({
          userId: 'user-1',
          usageType: 'CASE_CREATED',
          quantity: 1000001,
        })
      ).rejects.toThrow('quantity 必须在 1-1000000 之间');
    });

    it('should throw error if userId is empty', async () => {
      await expect(
        recordUsage({
          userId: '',
          usageType: 'CASE_CREATED',
          quantity: 1,
        })
      ).rejects.toThrow('userId 不能为空');
    });

    it('should throw error if usageType is empty', async () => {
      await expect(
        recordUsage({
          userId: 'user-1',
          usageType: '' as any,
          quantity: 1,
        })
      ).rejects.toThrow('usageType 不能为空');
    });

    it('should throw error if description exceeds max length', async () => {
      await expect(
        recordUsage({
          userId: 'user-1',
          usageType: 'CASE_CREATED',
          quantity: 1,
          description: 'a'.repeat(501),
        })
      ).rejects.toThrow('description 超出最大长度');
    });
  });

  describe('batchRecordUsage', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-12-31'),
    };

    it('should use optimized batch insert with createMany', async () => {
      // 优化后的实现应该使用 createMany 而不是循环调用 create
      (prisma.userMembership.findMany as jest.Mock).mockResolvedValue([
        mockMembership,
      ]);
      (prisma.usageRecord.createMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const records = [
        { userId: 'user-1', usageType: 'CASE_CREATED' as const, quantity: 1 },
        {
          userId: 'user-1',
          usageType: 'DEBATE_GENERATED' as const,
          quantity: 2,
        },
        {
          userId: 'user-1',
          usageType: 'DOCUMENT_ANALYZED' as const,
          quantity: 1,
        },
      ];

      const result = await batchRecordUsage(records);

      expect(result).toBe(3);
      // 验证使用了 createMany 而不是多次调用 create
      expect(prisma.usageRecord.createMany).toHaveBeenCalledTimes(1);
      expect(prisma.usageRecord.create).not.toHaveBeenCalled();
    });

    it('should validate all users have active membership before batch insert', async () => {
      (prisma.userMembership.findMany as jest.Mock).mockResolvedValue([
        mockMembership,
      ]);
      (prisma.usageRecord.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const records = [
        { userId: 'user-1', usageType: 'CASE_CREATED' as const, quantity: 1 },
        {
          userId: 'user-1',
          usageType: 'DEBATE_GENERATED' as const,
          quantity: 2,
        },
      ];

      await batchRecordUsage(records);

      // 验证只查询了一次会员状态
      expect(prisma.userMembership.findMany).toHaveBeenCalledTimes(1);
    });

    it('should throw error if any user has no active membership', async () => {
      // 只返回一个会员，但请求中有两个不同用户
      (prisma.userMembership.findMany as jest.Mock).mockResolvedValue([
        mockMembership,
      ]);

      const records = [
        { userId: 'user-1', usageType: 'CASE_CREATED' as const, quantity: 1 },
        {
          userId: 'user-2',
          usageType: 'DEBATE_GENERATED' as const,
          quantity: 2,
        },
      ];

      await expect(batchRecordUsage(records)).rejects.toThrow(
        '用户没有活跃的会员'
      );
      expect(prisma.usageRecord.createMany).not.toHaveBeenCalled();
    });

    it('should handle empty array', async () => {
      const result = await batchRecordUsage([]);
      expect(result).toBe(0);
      expect(prisma.usageRecord.createMany).not.toHaveBeenCalled();
    });

    it('should fail entire batch if database error occurs', async () => {
      (prisma.userMembership.findMany as jest.Mock).mockResolvedValue([
        mockMembership,
      ]);
      (prisma.usageRecord.createMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const records = [
        { userId: 'user-1', usageType: 'CASE_CREATED' as const, quantity: 1 },
        {
          userId: 'user-1',
          usageType: 'DEBATE_GENERATED' as const,
          quantity: 2,
        },
      ];

      await expect(batchRecordUsage(records)).rejects.toThrow('批量记录失败');
    });
  });

  describe('getUsageStats', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-12-31'),
      tier: {
        tierLimits: [
          { limitType: LimitType.MAX_CASES, limitValue: 10 },
          { limitType: LimitType.MAX_DEBATES, limitValue: 50 },
          { limitType: LimitType.MAX_DOCUMENTS, limitValue: 100 },
          { limitType: LimitType.MAX_AI_TOKENS_MONTHLY, limitValue: 10000 },
          { limitType: LimitType.MAX_STORAGE_MB, limitValue: 1024 },
          { limitType: LimitType.MAX_LAW_ARTICLE_SEARCHES, limitValue: null },
        ],
      },
    };

    it('should return usage statistics for current period', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 3 },
        { usageType: 'CASE_CREATED', quantity: 2 },
        { usageType: 'DEBATE_GENERATED', quantity: 10 },
        { usageType: 'DOCUMENT_ANALYZED', quantity: 5 },
      ]);

      const result = await getUsageStats('user-1');

      expect(result.casesCreated).toBe(5);
      expect(result.debatesGenerated).toBe(10);
      expect(result.documentsAnalyzed).toBe(5);
    });

    it('should calculate remaining quota correctly', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 7 },
      ]);

      const result = await getUsageStats('user-1');

      expect(result.remaining.cases).toBe(3); // 10 - 7
      expect(result.remaining.debates).toBe(50); // 50 - 0
    });

    it('should handle unlimited quota (null limit)', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([
        { usageType: 'LAW_ARTICLE_SEARCHED', quantity: 1000 },
      ]);

      const result = await getUsageStats('user-1');

      expect(result.remaining.lawArticleSearches).toBe(Infinity);
    });

    it('should accept custom date range', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await getUsageStats('user-1', startDate, endDate);

      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            periodStart: { gte: startDate },
            periodEnd: { lte: endDate },
          }),
        })
      );
    });

    it('should throw error if no active membership', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(getUsageStats('user-1')).rejects.toThrow(
        '用户没有活跃的会员'
      );
    });
  });

  describe('checkUsageLimit', () => {
    const mockMembership = {
      id: 'membership-1',
      userId: 'user-1',
      status: MembershipStatus.ACTIVE,
      endDate: new Date('2026-12-31'),
      tier: {
        tierLimits: [{ limitType: LimitType.MAX_CASES, limitValue: 10 }],
      },
    };

    it('should return not exceeded when under limit', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 5 },
      ]);

      const result = await checkUsageLimit('user-1', 'CASE_CREATED', 1);

      expect(result.exceeded).toBe(false);
      expect(result.currentUsage).toBe(5);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(4);
    });

    it('should return exceeded when over limit', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 9 },
      ]);

      const result = await checkUsageLimit('user-1', 'CASE_CREATED', 2);

      expect(result.exceeded).toBe(true);
      expect(result.currentUsage).toBe(9);
      expect(result.remaining).toBe(0);
    });

    it('should return not exceeded when no limit', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue({
        ...mockMembership,
        tier: {
          tierLimits: [{ limitType: LimitType.MAX_CASES, limitValue: null }],
        },
      });
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      const result = await checkUsageLimit('user-1', 'CASE_CREATED', 100);

      expect(result.exceeded).toBe(false);
      expect(result.limit).toBeNull();
      expect(result.remaining).toBeNull();
    });

    it('should use default quantity of 1', async () => {
      (prisma.userMembership.findFirst as jest.Mock).mockResolvedValue(
        mockMembership
      );
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      await checkUsageLimit('user-1', 'CASE_CREATED');

      // Should check with quantity 1
      expect(prisma.usageRecord.findMany).toHaveBeenCalled();
    });
  });

  describe('getUsageHistory', () => {
    it('should return paginated usage history', async () => {
      const mockRecords = Array.from({ length: 10 }, (_, i) => ({
        id: `usage-${i}`,
        userId: 'user-1',
        usageType: 'CASE_CREATED',
        quantity: 1,
        createdAt: new Date(),
      }));

      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      const result = await getUsageHistory('user-1', { page: 1, pageSize: 10 });

      expect(result).toHaveLength(10);
      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
          take: 10,
          skip: 0,
        })
      );
    });

    it('should filter by usage type', async () => {
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      await getUsageHistory('user-1', {
        page: 1,
        pageSize: 10,
        usageType: 'CASE_CREATED',
      });

      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            usageType: 'CASE_CREATED',
          },
        })
      );
    });

    it('should filter by date range', async () => {
      (prisma.usageRecord.findMany as jest.Mock).mockResolvedValue([]);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await getUsageHistory('user-1', {
        page: 1,
        pageSize: 10,
        startDate,
        endDate,
      });

      expect(prisma.usageRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            createdAt: expect.objectContaining({
              gte: startDate,
              lte: endDate,
            }),
          }),
        })
      );
    });
  });

  describe('resetUsagePeriod', () => {
    it('should delete usage records for user', async () => {
      (prisma.usageRecord.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      const result = await resetUsagePeriod('user-1');

      expect(result).toBe(10);
      expect(prisma.usageRecord.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });

    it('should delete records within specific date range', async () => {
      (prisma.usageRecord.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await resetUsagePeriod('user-1', startDate, endDate);

      expect(prisma.usageRecord.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          periodStart: { gte: startDate },
          periodEnd: { lte: endDate },
        },
      });
    });
  });
});
