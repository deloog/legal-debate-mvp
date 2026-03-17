/**
 * 覆盖率监控模块测试
 */

// Mock 依赖（必须在 import 前）
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    lawArticleRelation: {
      count: jest.fn(),
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
  CoverageMonitor,
  calculateCoverageMetrics,
  identifyOrphanArticles,
} from '@/lib/knowledge-graph/quality-monitor/coverage-monitor';
import { prisma } from '@/lib/db';
import { LawStatus } from '@prisma/client';

const mockPrisma = prisma as {
  lawArticle: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  lawArticleRelation: {
    count: jest.Mock;
  };
};

describe('CoverageMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCoverageMetrics', () => {
    test('应该正确计算覆盖率指标', async () => {
      mockPrisma.lawArticle.count
        .mockResolvedValueOnce(3) // totalArticles
        .mockResolvedValueOnce(3); // articlesWithRelations
      mockPrisma.lawArticleRelation.count.mockResolvedValueOnce(2); // totalRelations

      const metrics = await calculateCoverageMetrics({});

      expect(metrics.totalArticles).toBe(3);
      expect(metrics.articlesWithRelations).toBe(3);
      expect(metrics.coverageRate).toBe(1);
      expect(metrics.orphanArticles).toBe(0);
    });

    test('应该正确计算孤立法条', async () => {
      mockPrisma.lawArticle.count
        .mockResolvedValueOnce(3) // totalArticles
        .mockResolvedValueOnce(2); // articlesWithRelations
      mockPrisma.lawArticleRelation.count.mockResolvedValueOnce(1); // totalRelations

      const metrics = await calculateCoverageMetrics({});

      expect(metrics.totalArticles).toBe(3);
      expect(metrics.articlesWithRelations).toBe(2);
      expect(metrics.coverageRate).toBeCloseTo(2 / 3);
      expect(metrics.orphanArticles).toBe(1);
    });

    test('应该支持按法条类型过滤', async () => {
      mockPrisma.lawArticle.count
        .mockResolvedValueOnce(1) // totalArticles (CIVIL only)
        .mockResolvedValueOnce(1); // articlesWithRelations
      mockPrisma.lawArticleRelation.count.mockResolvedValueOnce(1); // totalRelations

      const metrics = await calculateCoverageMetrics({ category: 'CIVIL' });

      expect(metrics.totalArticles).toBe(1);
    });

    test('应该计算平均每个法条的关系数', async () => {
      mockPrisma.lawArticle.count
        .mockResolvedValueOnce(2) // totalArticles
        .mockResolvedValueOnce(2); // articlesWithRelations
      mockPrisma.lawArticleRelation.count.mockResolvedValueOnce(3); // totalRelations (3 relations for 2 articles)

      const metrics = await calculateCoverageMetrics({});

      expect(metrics.totalArticles).toBe(2);
      expect(metrics.averageRelationsPerArticle).toBeCloseTo(1.5);
    });
  });

  describe('identifyOrphanArticles', () => {
    test('应该识别孤立法条', async () => {
      mockPrisma.lawArticle.findMany.mockResolvedValue([
        {
          id: 'article-orphan',
          lawName: '民法典',
          articleNumber: '602',
          lawType: 'LAW',
          category: 'CIVIL',
          status: 'VALID',
          createdAt: new Date(),
        },
      ]);

      const orphanArticles = await identifyOrphanArticles({});

      expect(orphanArticles).toHaveLength(1);
      expect(orphanArticles[0].articleNumber).toBe('602');
    });

    test('应该支持按法条状态过滤', async () => {
      mockPrisma.lawArticle.findMany.mockResolvedValue([
        {
          id: 'article-valid',
          lawName: '民法典',
          articleNumber: '701',
          lawType: 'LAW',
          category: 'CIVIL',
          status: LawStatus.VALID,
          createdAt: new Date(),
        },
      ]);

      const orphanArticles = await identifyOrphanArticles({
        status: LawStatus.VALID,
      });

      expect(orphanArticles).toHaveLength(1);
      expect(orphanArticles[0].status).toBe(LawStatus.VALID);
    });

    test('应该返回空的孤立法条列表（所有法条都有关系）', async () => {
      mockPrisma.lawArticle.findMany.mockResolvedValue([]);

      const orphanArticles = await identifyOrphanArticles({});

      expect(orphanArticles).toHaveLength(0);
    });
  });

  describe('CoverageMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new CoverageMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供calculateCoverageMetrics方法', async () => {
      mockPrisma.lawArticle.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.lawArticleRelation.count.mockResolvedValueOnce(0);

      const monitor = new CoverageMonitor();
      const metrics = await monitor.calculateMetrics({});
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalArticles).toBe('number');
    });

    test('应该提供identifyOrphanArticles方法', async () => {
      mockPrisma.lawArticle.findMany.mockResolvedValue([]);

      const monitor = new CoverageMonitor();
      const orphanArticles = await monitor.identifyOrphanArticles({});
      expect(Array.isArray(orphanArticles)).toBe(true);
    });
  });
});
