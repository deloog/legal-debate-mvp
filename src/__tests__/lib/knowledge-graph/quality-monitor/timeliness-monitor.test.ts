/**
 * 时效性监控模块测试
 */

// Mock 依赖（必须在 import 前）
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('@/test-utils/database', () => ({
  testPrisma: {
    lawArticle: { createMany: jest.fn(), create: jest.fn() },
    lawArticleRelation: { createMany: jest.fn(), create: jest.fn() },
    user: { create: jest.fn() },
  },
  setupTestDatabase: jest.fn().mockResolvedValue(undefined),
  cleanupTestDatabase: jest.fn().mockResolvedValue(undefined),
}));

import {
  TimelinessMonitor,
  calculateTimelinessMetrics,
  identifyExpiredRelations,
  identifyStaleRelations,
} from '@/lib/knowledge-graph/quality-monitor/timeliness-monitor';
import { prisma } from '@/lib/db';
import { VerificationStatus, LawStatus } from '@prisma/client';

const mockPrisma = prisma as {
  lawArticleRelation: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
};

describe('TimelinessMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTimelinessMetrics', () => {
    test('应该正确计算时效性指标', async () => {
      // count: total, pending, stale, expired
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(2) // totalRelations
        .mockResolvedValueOnce(1) // pendingRelations
        .mockResolvedValueOnce(1) // staleRelations
        .mockResolvedValueOnce(0); // expiredRelations (countExpiredRelations)

      const metrics = await calculateTimelinessMetrics({
        staleThresholdDays: 60,
      });

      expect(metrics.totalRelations).toBe(2);
      expect(metrics.pendingRelations).toBe(1);
      expect(metrics.staleRelations).toBe(1);
      expect(metrics.expiredRelations).toBe(0);
    });

    test('应该正确计算待审核率', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(2) // totalRelations
        .mockResolvedValueOnce(2) // pendingRelations
        .mockResolvedValueOnce(0) // staleRelations
        .mockResolvedValueOnce(0); // expiredRelations

      const metrics = await calculateTimelinessMetrics({});

      expect(metrics.totalRelations).toBe(2);
      expect(metrics.pendingRate).toBe(1);
    });
  });

  describe('identifyExpiredRelations', () => {
    test('应该识别失效关系（法条已失效）', async () => {
      const relationId = 'rel-expired';
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: relationId,
          sourceId: 'src-1',
          targetId: 'tgt-expired',
          relationType: 'CITES',
          createdAt: new Date(),
          updatedAt: new Date(),
          source: {
            id: 'src-1',
            lawName: '民法典',
            articleNumber: '901',
            status: 'VALID',
            expiryDate: null,
          },
          target: {
            id: 'tgt-expired',
            lawName: '旧法',
            articleNumber: '902',
            status: LawStatus.EXPIRED,
            expiryDate: new Date('2020-01-01'),
          },
        },
      ]);

      const expiredRelations = await identifyExpiredRelations();

      expect(expiredRelations).toHaveLength(1);
      expect(expiredRelations[0].relationId).toBe(relationId);
    });

    test('应该返回空列表（无失效关系）', async () => {
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const expiredRelations = await identifyExpiredRelations();

      expect(expiredRelations).toHaveLength(0);
    });
  });

  describe('identifyStaleRelations', () => {
    test('应该识别过期关系', async () => {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const relationId = 'rel-stale';

      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: relationId,
          sourceId: 'src-1',
          targetId: 'tgt-1',
          relationType: 'CITES',
          verificationStatus: VerificationStatus.PENDING,
          createdAt: ninetyDaysAgo,
          updatedAt: ninetyDaysAgo,
        },
      ]);

      const staleRelations = await identifyStaleRelations(60);

      expect(staleRelations).toHaveLength(1);
      expect(staleRelations[0].relationId).toBe(relationId);
      expect(staleRelations[0].daysSinceCreation).toBeGreaterThan(60);
    });

    test('应该支持不同的阈值', async () => {
      const now = new Date();
      const fortyFiveDaysAgo = new Date(
        now.getTime() - 45 * 24 * 60 * 60 * 1000
      );

      mockPrisma.lawArticleRelation.findMany
        .mockResolvedValueOnce([]) // 阈值60天：无结果（45天 < 60天）
        .mockResolvedValueOnce([
          // 阈值30天：有结果（45天 > 30天）
          {
            id: 'rel-stale',
            sourceId: 'src-1',
            targetId: 'tgt-1',
            relationType: 'CITES',
            verificationStatus: VerificationStatus.PENDING,
            createdAt: fortyFiveDaysAgo,
            updatedAt: fortyFiveDaysAgo,
          },
        ]);

      const staleRelations1 = await identifyStaleRelations(60);
      expect(staleRelations1).toHaveLength(0);

      const staleRelations2 = await identifyStaleRelations(30);
      expect(staleRelations2).toHaveLength(1);
    });
  });

  describe('TimelinessMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new TimelinessMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供calculateTimelinessMetrics方法', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const monitor = new TimelinessMonitor();
      const metrics = await monitor.calculateMetrics({});
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalRelations).toBe('number');
    });
  });
});
