/**
 * 准确性监控模块测试
 */

// Mock 依赖（必须在 import 前）
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    relationFeedback: {
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
    relationFeedback: { createMany: jest.fn(), create: jest.fn() },
    user: { create: jest.fn() },
  },
  setupTestDatabase: jest.fn().mockResolvedValue(undefined),
  cleanupTestDatabase: jest.fn().mockResolvedValue(undefined),
}));

import {
  AccuracyMonitor,
  calculateAccuracyMetrics,
  identifyLowQualityRelations,
} from '@/lib/knowledge-graph/quality-monitor/accuracy-monitor';
import { prisma } from '@/lib/db';
import {
  RelationFeedbackType,
  VerificationStatus,
  DiscoveryMethod,
} from '@prisma/client';

const mockPrisma = prisma as {
  lawArticleRelation: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  relationFeedback: {
    findMany: jest.Mock;
  };
};

describe('AccuracyMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateAccuracyMetrics', () => {
    test('应该正确计算准确性指标 - 无反馈', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(2) // totalRelations
        .mockResolvedValueOnce(1); // verifiedRelations
      mockPrisma.relationFeedback.findMany.mockResolvedValue([]);

      const metrics = await calculateAccuracyMetrics({});

      expect(metrics.totalRelations).toBe(2);
      expect(metrics.verifiedRelations).toBe(1);
      expect(metrics.userFeedbackCount).toBe(0);
      expect(metrics.positiveFeedbackCount).toBe(0);
      expect(metrics.negativeFeedbackCount).toBe(0);
      expect(metrics.positiveFeedbackRate).toBe(1); // 默认1.0
      expect(metrics.verificationRate).toBe(0.5);
    });

    test('应该正确计算准确性指标 - 有正面反馈', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(1) // totalRelations
        .mockResolvedValueOnce(1); // verifiedRelations
      mockPrisma.relationFeedback.findMany.mockResolvedValue([
        { feedbackType: RelationFeedbackType.ACCURATE },
        { feedbackType: RelationFeedbackType.ACCURATE },
      ]);

      const metrics = await calculateAccuracyMetrics({});

      expect(metrics.totalRelations).toBe(1);
      expect(metrics.userFeedbackCount).toBe(2);
      expect(metrics.positiveFeedbackCount).toBe(2);
      expect(metrics.negativeFeedbackCount).toBe(0);
      expect(metrics.positiveFeedbackRate).toBe(1);
    });

    test('应该正确计算准确性指标 - 有负面反馈', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(1) // totalRelations
        .mockResolvedValueOnce(1); // verifiedRelations
      mockPrisma.relationFeedback.findMany.mockResolvedValue([
        { feedbackType: RelationFeedbackType.INACCURATE },
        { feedbackType: RelationFeedbackType.SHOULD_REMOVE },
      ]);

      const metrics = await calculateAccuracyMetrics({});

      expect(metrics.totalRelations).toBe(1);
      expect(metrics.userFeedbackCount).toBe(2);
      expect(metrics.positiveFeedbackCount).toBe(0);
      expect(metrics.negativeFeedbackCount).toBe(2);
      expect(metrics.positiveFeedbackRate).toBe(0);
    });

    test('应该支持按关系类型过滤', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(1) // totalRelations (CITES only)
        .mockResolvedValueOnce(1); // verifiedRelations
      mockPrisma.relationFeedback.findMany.mockResolvedValue([]);

      const metrics = await calculateAccuracyMetrics({ relationType: 'CITES' });

      expect(metrics.totalRelations).toBe(1);
    });

    test('应该支持按发现方式过滤', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(1) // totalRelations (AI_DETECTED only)
        .mockResolvedValueOnce(1); // verifiedRelations
      mockPrisma.relationFeedback.findMany.mockResolvedValue([]);

      const metrics = await calculateAccuracyMetrics({
        discoveryMethod: DiscoveryMethod.AI_DETECTED,
      });

      expect(metrics.totalRelations).toBe(1);
    });
  });

  describe('identifyLowQualityRelations', () => {
    test('应该识别高负面反馈率的关系', async () => {
      const relationId = 'rel-low-quality';
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: relationId,
          sourceId: 'src-1',
          targetId: 'tgt-1',
          relationType: 'CITES',
          feedbacks: [
            { feedbackType: RelationFeedbackType.INACCURATE },
            { feedbackType: RelationFeedbackType.SHOULD_REMOVE },
            { feedbackType: RelationFeedbackType.WRONG_TYPE },
            { feedbackType: RelationFeedbackType.ACCURATE },
          ],
        },
      ]);

      const lowQualityRelations = await identifyLowQualityRelations(0.5);

      expect(lowQualityRelations).toHaveLength(1);
      expect(lowQualityRelations[0].relationId).toBe(relationId);
      expect(lowQualityRelations[0].negativeFeedbackRate).toBe(0.75); // 3/4
      expect(lowQualityRelations[0].feedbackCount).toBe(4);
      expect(lowQualityRelations[0].negativeFeedbackCount).toBe(3);
    });

    test('应该只返回超过阈值的关系', async () => {
      const relation1Id = 'rel-1';
      const relation2Id = 'rel-2';
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: relation1Id,
          sourceId: 'src-1',
          targetId: 'tgt-1',
          relationType: 'CITES',
          feedbacks: [
            { feedbackType: RelationFeedbackType.INACCURATE },
            { feedbackType: RelationFeedbackType.ACCURATE },
          ],
        },
        {
          id: relation2Id,
          sourceId: 'src-2',
          targetId: 'tgt-2',
          relationType: 'CONFLICTS',
          feedbacks: [
            { feedbackType: RelationFeedbackType.SHOULD_REMOVE },
            { feedbackType: RelationFeedbackType.ACCURATE },
            { feedbackType: RelationFeedbackType.ACCURATE },
          ],
        },
      ]);

      const lowQualityRelations = await identifyLowQualityRelations(0.5);

      // 只有 relation1 (50%) 超过阈值，relation2 (33%) 未超过
      expect(lowQualityRelations).toHaveLength(1);
      expect(lowQualityRelations[0].relationId).toBe(relation1Id);
    });

    test('应该正确处理无反馈的关系', async () => {
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: 'rel-no-feedback',
          sourceId: 'src-1',
          targetId: 'tgt-1',
          relationType: 'CITES',
          feedbacks: [],
        },
      ]);

      const lowQualityRelations = await identifyLowQualityRelations(0.5);

      expect(lowQualityRelations).toHaveLength(0);
    });
  });

  describe('AccuracyMonitor类', () => {
    test('应该能够初始化', () => {
      const monitor = new AccuracyMonitor();
      expect(monitor).toBeDefined();
    });

    test('应该提供calculateAccuracyMetrics方法', async () => {
      mockPrisma.lawArticleRelation.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockPrisma.relationFeedback.findMany.mockResolvedValue([]);

      const monitor = new AccuracyMonitor();
      const metrics = await monitor.calculateMetrics({});
      expect(metrics).toBeDefined();
      expect(typeof metrics.totalRelations).toBe('number');
    });

    test('应该提供identifyLowQualityRelations方法', async () => {
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const monitor = new AccuracyMonitor();
      const lowQualityRelations =
        await monitor.identifyLowQualityRelations(0.5);
      expect(Array.isArray(lowQualityRelations)).toBe(true);
    });
  });
});
