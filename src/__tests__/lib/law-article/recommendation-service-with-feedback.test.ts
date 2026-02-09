/**
 * 推荐服务反馈优化测试
 *
 * 测试使用反馈数据优化推荐算法
 */

import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    recommendationFeedback: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    lawArticle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
    },
  },
}));

// Mock推荐服务
const mockRecommendationService = {
  /**
   * 根据反馈数据调整推荐分数
   */
  adjustScoreByFeedback: async (
    articleId: string,
    baseScore: number
  ): Promise<number> => {
    // 获取该法条的反馈统计
    const feedbacks = await prisma.recommendationFeedback.findMany({
      where: { lawArticleId: articleId },
      select: { feedbackType: true },
    });

    if (feedbacks.length === 0) {
      return baseScore;
    }

    // 计算反馈分数
    let feedbackScore = 0;
    const totalFeedbacks = feedbacks.length;

    for (const feedback of feedbacks) {
      switch (feedback.feedbackType) {
        case 'HELPFUL':
        case 'EXCELLENT':
          feedbackScore += 1;
          break;
        case 'NOT_HELPFUL':
          feedbackScore -= 0.5;
          break;
        case 'IRRELEVANT':
          feedbackScore -= 1;
          break;
      }
    }

    // 计算平均反馈分数（-1 到 1）
    const avgFeedbackScore = feedbackScore / totalFeedbacks;

    // 调整基础分数（最多调整 ±20%）
    const adjustment = avgFeedbackScore * 0.2;
    const adjustedScore = Math.max(0, Math.min(1, baseScore + adjustment));

    return adjustedScore;
  },

  /**
   * 获取法条的反馈质量分数
   */
  getFeedbackQualityScore: async (articleId: string): Promise<number> => {
    const feedbacks = await prisma.recommendationFeedback.findMany({
      where: { lawArticleId: articleId },
      select: { feedbackType: true },
    });

    if (feedbacks.length === 0) {
      return 0.5; // 默认中等质量
    }

    const helpfulCount = feedbacks.filter(
      f => f.feedbackType === 'HELPFUL' || f.feedbackType === 'EXCELLENT'
    ).length;

    return helpfulCount / feedbacks.length;
  },

  /**
   * 过滤低质量推荐
   */
  filterLowQualityRecommendations: async (
    recommendations: Array<{ articleId: string; score: number }>
  ): Promise<Array<{ articleId: string; score: number }>> => {
    const filtered = [];

    for (const rec of recommendations) {
      const qualityScore =
        await mockRecommendationService.getFeedbackQualityScore(rec.articleId);

      // 如果质量分数低于30%且有足够的反馈（>=5），则过滤掉
      const feedbackCount = await prisma.recommendationFeedback.findMany({
        where: { lawArticleId: rec.articleId },
      });

      if (feedbackCount.length >= 5 && qualityScore < 0.3) {
        continue; // 跳过低质量推荐
      }

      filtered.push(rec);
    }

    return filtered;
  },

  /**
   * 基于反馈优化推荐排序
   */
  optimizeRecommendationOrder: async (
    recommendations: Array<{ articleId: string; score: number }>
  ): Promise<
    Array<{ articleId: string; score: number; adjustedScore: number }>
  > => {
    const optimized = [];

    for (const rec of recommendations) {
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          rec.articleId,
          rec.score
        );

      optimized.push({
        ...rec,
        adjustedScore,
      });
    }

    // 按调整后的分数排序
    optimized.sort((a, b) => b.adjustedScore - a.adjustedScore);

    return optimized;
  },
};

describe('推荐服务反馈优化', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('adjustScoreByFeedback', () => {
    it('应该根据正面反馈提升分数', async () => {
      const mockFeedbacks = [
        { feedbackType: 'HELPFUL' },
        { feedbackType: 'HELPFUL' },
        { feedbackType: 'EXCELLENT' },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const baseScore = 0.7;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBeGreaterThan(baseScore);
      expect(adjustedScore).toBeLessThanOrEqual(1);
    });

    it('应该根据负面反馈降低分数', async () => {
      const mockFeedbacks = [
        { feedbackType: 'NOT_HELPFUL' },
        { feedbackType: 'IRRELEVANT' },
        { feedbackType: 'NOT_HELPFUL' },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const baseScore = 0.7;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBeLessThan(baseScore);
      expect(adjustedScore).toBeGreaterThanOrEqual(0);
    });

    it('应该处理混合反馈', async () => {
      const mockFeedbacks = [
        { feedbackType: 'HELPFUL' },
        { feedbackType: 'NOT_HELPFUL' },
        { feedbackType: 'HELPFUL' },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const baseScore = 0.7;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBeGreaterThanOrEqual(0);
      expect(adjustedScore).toBeLessThanOrEqual(1);
    });

    it('应该处理无反馈的情况', async () => {
      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const baseScore = 0.7;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBe(baseScore);
    });

    it('应该限制调整幅度在±20%以内', async () => {
      const mockFeedbacks = Array(100).fill({ feedbackType: 'EXCELLENT' });

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const baseScore = 0.5;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBeLessThanOrEqual(0.7); // 最多提升20%
    });

    it('应该确保分数不超过1', async () => {
      const mockFeedbacks = Array(100).fill({ feedbackType: 'EXCELLENT' });

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const baseScore = 0.95;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBeLessThanOrEqual(1);
    });

    it('应该确保分数不低于0', async () => {
      const mockFeedbacks = Array(100).fill({ feedbackType: 'IRRELEVANT' });

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const baseScore = 0.1;
      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback(
          'article-1',
          baseScore
        );

      expect(adjustedScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFeedbackQualityScore', () => {
    it('应该计算反馈质量分数', async () => {
      const mockFeedbacks = [
        { feedbackType: 'HELPFUL' },
        { feedbackType: 'HELPFUL' },
        { feedbackType: 'NOT_HELPFUL' },
        { feedbackType: 'EXCELLENT' },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const qualityScore =
        await mockRecommendationService.getFeedbackQualityScore('article-1');

      expect(qualityScore).toBe(0.75); // 3/4 = 75%
    });

    it('应该处理无反馈的情况', async () => {
      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const qualityScore =
        await mockRecommendationService.getFeedbackQualityScore('article-1');

      expect(qualityScore).toBe(0.5); // 默认中等质量
    });

    it('应该处理全部正面反馈', async () => {
      const mockFeedbacks = [
        { feedbackType: 'HELPFUL' },
        { feedbackType: 'EXCELLENT' },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const qualityScore =
        await mockRecommendationService.getFeedbackQualityScore('article-1');

      expect(qualityScore).toBe(1);
    });

    it('应该处理全部负面反馈', async () => {
      const mockFeedbacks = [
        { feedbackType: 'NOT_HELPFUL' },
        { feedbackType: 'IRRELEVANT' },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const qualityScore =
        await mockRecommendationService.getFeedbackQualityScore('article-1');

      expect(qualityScore).toBe(0);
    });
  });

  describe('filterLowQualityRecommendations', () => {
    it('应该过滤低质量推荐', async () => {
      const recommendations = [
        { articleId: 'article-1', score: 0.8 },
        { articleId: 'article-2', score: 0.7 },
        { articleId: 'article-3', score: 0.6 },
      ];

      // article-2 有低质量反馈
      (prisma.recommendationFeedback.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { feedbackType: 'HELPFUL' },
          { feedbackType: 'HELPFUL' },
        ]) // article-1 质量分数
        .mockResolvedValueOnce(Array(5).fill({ feedbackType: 'HELPFUL' })) // article-1 反馈数量
        .mockResolvedValueOnce(Array(5).fill({ feedbackType: 'IRRELEVANT' })) // article-2 质量分数
        .mockResolvedValueOnce(Array(5).fill({ feedbackType: 'IRRELEVANT' })) // article-2 反馈数量
        .mockResolvedValueOnce([{ feedbackType: 'HELPFUL' }]) // article-3 质量分数
        .mockResolvedValueOnce([{ feedbackType: 'HELPFUL' }]); // article-3 反馈数量

      const filtered =
        await mockRecommendationService.filterLowQualityRecommendations(
          recommendations
        );

      expect(filtered).toHaveLength(2);
      expect(filtered.find(r => r.articleId === 'article-2')).toBeUndefined();
    });

    it('应该保留反馈不足的推荐', async () => {
      const recommendations = [{ articleId: 'article-1', score: 0.8 }];

      // 只有3条反馈，不足5条
      (prisma.recommendationFeedback.findMany as jest.Mock)
        .mockResolvedValueOnce([
          { feedbackType: 'IRRELEVANT' },
          { feedbackType: 'IRRELEVANT' },
          { feedbackType: 'IRRELEVANT' },
        ])
        .mockResolvedValueOnce([
          { feedbackType: 'IRRELEVANT' },
          { feedbackType: 'IRRELEVANT' },
          { feedbackType: 'IRRELEVANT' },
        ]);

      const filtered =
        await mockRecommendationService.filterLowQualityRecommendations(
          recommendations
        );

      expect(filtered).toHaveLength(1);
    });

    it('应该处理空推荐列表', async () => {
      const filtered =
        await mockRecommendationService.filterLowQualityRecommendations([]);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('optimizeRecommendationOrder', () => {
    it('应该根据反馈优化推荐排序', async () => {
      const recommendations = [
        { articleId: 'article-1', score: 0.5 },
        { articleId: 'article-2', score: 0.5 },
        { articleId: 'article-3', score: 0.5 },
      ];

      // article-3 有很好的反馈，应该排到前面
      (prisma.recommendationFeedback.findMany as jest.Mock)
        .mockResolvedValueOnce([{ feedbackType: 'HELPFUL' }])
        .mockResolvedValueOnce([{ feedbackType: 'NOT_HELPFUL' }])
        .mockResolvedValueOnce([
          { feedbackType: 'EXCELLENT' },
          { feedbackType: 'EXCELLENT' },
          { feedbackType: 'EXCELLENT' },
        ]);

      const optimized =
        await mockRecommendationService.optimizeRecommendationOrder(
          recommendations
        );

      expect(optimized).toHaveLength(3);
      // 验证排序是按adjustedScore降序
      expect(optimized[0].adjustedScore).toBeGreaterThanOrEqual(
        optimized[1].adjustedScore
      );
      expect(optimized[1].adjustedScore).toBeGreaterThanOrEqual(
        optimized[2].adjustedScore
      );
      // article-3应该有最高的adjustedScore（因为有3个EXCELLENT反馈）
      const article3 = optimized.find(r => r.articleId === 'article-3');
      expect(article3).toBeDefined();
      expect(article3!.adjustedScore).toBeGreaterThan(0.5); // 应该高于基础分数
    });

    it('应该保留原始分数', async () => {
      const recommendations = [{ articleId: 'article-1', score: 0.8 }];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL' },
      ]);

      const optimized =
        await mockRecommendationService.optimizeRecommendationOrder(
          recommendations
        );

      expect(optimized[0].score).toBe(0.8);
      expect(optimized[0].adjustedScore).toBeDefined();
    });

    it('应该处理空推荐列表', async () => {
      const optimized =
        await mockRecommendationService.optimizeRecommendationOrder([]);

      expect(optimized).toHaveLength(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理极端正面反馈', async () => {
      const mockFeedbacks = Array(1000).fill({ feedbackType: 'EXCELLENT' });

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback('article-1', 0.5);

      expect(adjustedScore).toBeLessThanOrEqual(1);
      expect(adjustedScore).toBeGreaterThan(0.5);
    });

    it('应该处理极端负面反馈', async () => {
      const mockFeedbacks = Array(1000).fill({ feedbackType: 'IRRELEVANT' });

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );

      const adjustedScore =
        await mockRecommendationService.adjustScoreByFeedback('article-1', 0.5);

      expect(adjustedScore).toBeGreaterThanOrEqual(0);
      expect(adjustedScore).toBeLessThan(0.5);
    });

    it('应该处理大量推荐', async () => {
      const recommendations = Array.from({ length: 100 }, (_, i) => ({
        articleId: `article-${i}`,
        score: Math.random(),
      }));

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL' },
      ]);

      const optimized =
        await mockRecommendationService.optimizeRecommendationOrder(
          recommendations
        );

      expect(optimized).toHaveLength(100);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成优化', async () => {
      const recommendations = Array.from({ length: 50 }, (_, i) => ({
        articleId: `article-${i}`,
        score: Math.random(),
      }));

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL' },
      ]);

      const startTime = Date.now();
      await mockRecommendationService.optimizeRecommendationOrder(
        recommendations
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // 应该在5秒内完成
    });
  });
});
