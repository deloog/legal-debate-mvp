/**
 * AI反馈收集服务单元测试
 */

import { AIFeedbackService } from '@/lib/law-article/ai-feedback-service';
import { RelationType } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticleRelation: {
      findUnique: jest.fn(),
    },
  },
}));

describe('AIFeedbackService', () => {
  const mockPrisma = require('@/lib/db/prisma').prisma;
  const mockPrismaAny = mockPrisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitFeedback', () => {
    it('应该成功提交AI反馈', async () => {
      const mockRelation = {
        aiConfidence: 0.85,
        aiProvider: 'openai',
        aiModel: 'gpt-4',
        relationType: RelationType.CITES,
      };

      const mockFeedback = {
        id: 'feedback-1',
        relationId: 'relation-1',
        userId: 'user-1',
        feedbackType: 'CORRECTNESS_FEEDBACK',
        actualCorrectness: 'CORRECT',
      };

      mockPrisma.lawArticleRelation.findUnique.mockResolvedValue(mockRelation);
      mockPrismaAny.aIFeedback = {
        create: jest.fn().mockResolvedValue(mockFeedback),
      };

      const input = {
        relationId: 'relation-1',
        userId: 'user-1',
        feedbackType: 'CORRECTNESS_FEEDBACK' as const,
        actualCorrectness: 'CORRECT' as const,
        userConfidenceRating: 5,
        comment: 'AI判断准确',
      };

      const result = await AIFeedbackService.submitFeedback(input);

      expect(result).toEqual(mockFeedback);
      expect(mockPrisma.lawArticleRelation.findUnique).toHaveBeenCalledWith({
        where: { id: 'relation-1' },
        select: expect.objectContaining({
          aiConfidence: true,
          aiProvider: true,
          aiModel: true,
          relationType: true,
        }),
      });
      expect(mockPrismaAny.aIFeedback.create).toHaveBeenCalled();
    });

    it('应该在关系不存在时抛出错误', async () => {
      mockPrisma.lawArticleRelation.findUnique.mockResolvedValue(null);

      const input = {
        relationId: 'nonexistent-relation',
        userId: 'user-1',
        feedbackType: 'CORRECTNESS_FEEDBACK' as const,
        actualCorrectness: 'CORRECT' as const,
      };

      await expect(AIFeedbackService.submitFeedback(input)).rejects.toThrow(
        '关系不存在'
      );
    });
  });

  describe('batchSubmitFeedback', () => {
    it('应该成功批量提交反馈', async () => {
      const mockRelation = {
        aiConfidence: 0.85,
        aiProvider: 'openai',
        aiModel: 'gpt-4',
        relationType: RelationType.CITES,
      };

      const mockFeedback1 = {
        id: 'feedback-1',
        relationId: 'relation-1',
      };

      const mockFeedback2 = {
        id: 'feedback-2',
        relationId: 'relation-2',
      };

      mockPrisma.lawArticleRelation.findUnique.mockResolvedValue(mockRelation);
      mockPrismaAny.aIFeedback = {
        create: jest
          .fn()
          .mockResolvedValueOnce(mockFeedback1)
          .mockResolvedValueOnce(mockFeedback2),
      };

      const feedbacks = [
        {
          relationId: 'relation-1',
          userId: 'user-1',
          feedbackType: 'CORRECTNESS_FEEDBACK' as const,
          actualCorrectness: 'CORRECT' as const,
        },
        {
          relationId: 'relation-2',
          userId: 'user-1',
          feedbackType: 'CORRECTNESS_FEEDBACK' as const,
          actualCorrectness: 'INCORRECT' as const,
        },
      ];

      const results = await AIFeedbackService.batchSubmitFeedback(feedbacks);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(mockFeedback1);
      expect(results[1]).toEqual(mockFeedback2);
    });
  });

  describe('getFeedbackStats', () => {
    it('应该返回正确的反馈统计', async () => {
      const mockFeedbacks = [
        {
          actualCorrectness: 'CORRECT',
          userConfidenceRating: 5,
          feedbackType: 'CORRECTNESS_FEEDBACK',
          relation: { relationType: RelationType.CITES },
        },
        {
          actualCorrectness: 'INCORRECT',
          userConfidenceRating: 2,
          feedbackType: 'CORRECTNESS_FEEDBACK',
          relation: { relationType: RelationType.CONFLICTS },
        },
        {
          actualCorrectness: 'PARTIALLY_CORRECT',
          userConfidenceRating: 3,
          feedbackType: 'CONFIDENCE_FEEDBACK',
          relation: { relationType: RelationType.RELATED },
        },
      ];

      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue(mockFeedbacks),
      };

      const stats = await AIFeedbackService.getFeedbackStats();

      expect(stats.totalFeedbacks).toBe(3);
      expect(stats.avgAccuracy).toBe(0.5); // (1 + 0 + 0.5) / 3
      expect(stats.avgConfidenceRating).toBeCloseTo(3.33, 1); // (5 + 2 + 3) / 3
      expect(stats.correctnessBreakdown.CORRECT).toBe(1);
      expect(stats.correctnessBreakdown.INCORRECT).toBe(1);
      expect(stats.correctnessBreakdown.PARTIALLY_CORRECT).toBe(1);
    });

    it('应该支持按条件过滤', async () => {
      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      await AIFeedbackService.getFeedbackStats({
        relationId: 'relation-1',
        aiProvider: 'openai',
      });

      expect(mockPrismaAny.aIFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            relationId: 'relation-1',
            aiProvider: 'openai',
          }),
        })
      );
    });
  });

  describe('analyzeConfidence', () => {
    it('应该分析置信度并返回推荐阈值', async () => {
      const mockFeedbacks = [
        {
          actualCorrectness: 'CORRECT',
        },
        {
          actualCorrectness: 'CORRECT',
        },
      ];

      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue(mockFeedbacks),
      };

      const analysis = await AIFeedbackService.analyzeConfidence(0.85);

      expect(analysis.aiConfidence).toBe(0.85);
      expect(analysis.avgCorrectnessScore).toBe(1.0); // 两个CORRECT
      expect(analysis.totalFeedbacks).toBe(2);
      expect(analysis.recommendedThreshold).toBeLessThan(0.85); // 准确率高，降低阈值
    });

    it('应该在没有反馈数据时返回默认推荐', async () => {
      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const analysis = await AIFeedbackService.analyzeConfidence(0.85);

      expect(analysis.aiConfidence).toBe(0.85);
      expect(analysis.avgCorrectnessScore).toBe(0);
      expect(analysis.totalFeedbacks).toBe(0);
      expect(analysis.recommendedThreshold).toBe(0.85);
      expect(analysis.analysis).toBe('暂无反馈数据');
    });

    it('应该在准确率低时提高推荐阈值', async () => {
      const mockFeedbacks = [
        { actualCorrectness: 'INCORRECT' },
        { actualCorrectness: 'INCORRECT' },
      ];

      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue(mockFeedbacks),
      };

      const analysis = await AIFeedbackService.analyzeConfidence(0.85);

      expect(analysis.recommendedThreshold).toBeGreaterThan(0.85);
    });
  });

  describe('getRelationsNeedingReview', () => {
    it('应该返回需要重新审核的关系ID', async () => {
      const mockFeedbacks = [
        { relationId: 'relation-1' },
        { relationId: 'relation-2' },
      ];

      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue(mockFeedbacks),
      };

      const relations = await AIFeedbackService.getRelationsNeedingReview();

      expect(relations).toHaveLength(2);
      expect(relations).toContain('relation-1');
      expect(relations).toContain('relation-2');

      expect(mockPrismaAny.aIFeedback.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          actualCorrectness: 'INCORRECT',
        }),
        distinct: ['relationId'],
        take: 100,
      });
    });

    it('应该支持按AI提供商过滤', async () => {
      mockPrismaAny.aIFeedback = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      await AIFeedbackService.getRelationsNeedingReview({
        aiProvider: 'openai',
        limit: 50,
      });

      expect(mockPrismaAny.aIFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            aiProvider: 'openai',
          }),
          take: 50,
        })
      );
    });
  });

  describe('deleteFeedback', () => {
    it('应该成功删除反馈', async () => {
      mockPrismaAny.aIFeedback = {
        delete: jest.fn().mockResolvedValue(undefined),
      };

      await expect(
        AIFeedbackService.deleteFeedback('feedback-1')
      ).resolves.not.toThrow();

      expect(mockPrismaAny.aIFeedback.delete).toHaveBeenCalledWith({
        where: { id: 'feedback-1' },
      });
    });
  });
});
