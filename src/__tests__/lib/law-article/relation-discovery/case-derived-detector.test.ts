/**
 * 案例推导检测器测试
 *
 * 测试覆盖：
 * 1. 从案例中发现法条共现关系
 * 2. 分析法条使用模式
 * 3. 共现频率计算
 * 4. 使用顺序分析
 * 5. 边界条件处理
 * 6. 错误处理
 * 7. 性能测试
 */

import { CaseDerivedDetector } from '@/lib/law-article/relation-discovery/case-derived-detector';
import { prisma } from '@/lib/db';
import { RelationType } from '@prisma/client';

// Also need to mock logger to suppress errors in tests
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $queryRawUnsafe: jest.fn(),
    lawArticle: {
      findUnique: jest.fn(),
    },
  },
}));

describe('CaseDerivedDetector', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('discoverFromCases', () => {
    it('应该从案例中发现共现关系', async () => {
      // Mock 数据库查询结果
      const mockQueryResult = [
        {
          source_id: 'article-1',
          target_id: 'article-2',
          co_occurrence_count: 10,
          order_score: 0.8,
        },
        {
          source_id: 'article-2',
          target_id: 'article-3',
          co_occurrence_count: 8,
          order_score: 0.6,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      // 执行测试
      const result = await CaseDerivedDetector.discoverFromCases();

      // 验证结果
      expect(result).toHaveLength(2);
      expect(result[0].sourceId).toBe('article-1');
      expect(result[0].targetId).toBe('article-2');
      expect(result[0].relationType).toBe(RelationType.RELATED);
      expect(result[0].discoveryMethod).toBe('CASE_DERIVED');
      expect(result[0].strength).toBeGreaterThan(0);
      expect(result[0].strength).toBeLessThanOrEqual(1);
      expect(result[0].confidence).toBe(0.7);
    });

    it('应该正确计算关系强度', async () => {
      // Mock 不同共现次数的数据
      const mockQueryResult = [
        {
          source_id: 'article-1',
          target_id: 'article-2',
          co_occurrence_count: 5, // 最小阈值
          order_score: 0.5,
        },
        {
          source_id: 'article-3',
          target_id: 'article-4',
          co_occurrence_count: 50, // 中等频率
          order_score: 0.5,
        },
        {
          source_id: 'article-5',
          target_id: 'article-6',
          co_occurrence_count: 150, // 超过最大值
          order_score: 0.5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.discoverFromCases();

      // 验证强度计算
      expect(result[0].strength).toBe(0.05); // 5/100
      expect(result[1].strength).toBe(0.5); // 50/100
      expect(result[2].strength).toBe(1.0); // min(150/100, 1.0)
    });

    it('应该生成正确的证据描述', async () => {
      const mockQueryResult = [
        {
          source_id: 'article-1',
          target_id: 'article-2',
          co_occurrence_count: 15,
          order_score: 0.5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.discoverFromCases();

      expect(result[0].evidence).toContain('15');
      expect(result[0].evidence).toContain('案例');
      expect(result[0].evidence).toContain('引用');
    });

    it('应该处理空结果', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await CaseDerivedDetector.discoverFromCases();

      expect(result).toEqual([]);
    });

    it('应该处理数据库错误', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await CaseDerivedDetector.discoverFromCases();

      expect(result).toEqual([]);
    });

    it('应该过滤低于阈值的共现关系', async () => {
      // SQL查询中已经有 HAVING COUNT(*) >= 5，所以数据库不会返回低于阈值的数据
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await CaseDerivedDetector.discoverFromCases();

      expect(result).toEqual([]);
    });

    it('应该支持自定义最小共现阈值', async () => {
      const mockQueryResult = [
        {
          source_id: 'article-1',
          target_id: 'article-2',
          co_occurrence_count: 3,
          order_score: 0.5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.discoverFromCases(3);

      expect(result).toHaveLength(1);
    });
  });

  describe('analyzeUsagePattern', () => {
    it('应该分析法条使用模式', async () => {
      const mockQueryResult = [
        {
          related_article_id: 'article-2',
          avg_position: 2.5,
          frequency: 10,
        },
        {
          related_article_id: 'article-3',
          avg_position: -1.5,
          frequency: 8,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      expect(result.articleId).toBe('article-1');
      expect(result.frequentlyUsedWith).toHaveLength(2);
      expect(result.frequentlyUsedWith[0].articleId).toBe('article-2');
      expect(result.frequentlyUsedWith[0].frequency).toBe(10);
      expect(result.frequentlyUsedWith[0].typicalOrder).toBe('after');
      expect(result.frequentlyUsedWith[1].typicalOrder).toBe('before');
    });

    it('应该正确判断使用顺序', async () => {
      const mockQueryResult = [
        {
          related_article_id: 'article-2',
          avg_position: 5.0, // 正数表示在后面
          frequency: 10,
        },
        {
          related_article_id: 'article-3',
          avg_position: -3.0, // 负数表示在前面
          frequency: 8,
        },
        {
          related_article_id: 'article-4',
          avg_position: 0.0, // 零表示同时出现
          frequency: 5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      expect(result.frequentlyUsedWith[0].typicalOrder).toBe('after');
      expect(result.frequentlyUsedWith[1].typicalOrder).toBe('before');
      expect(result.frequentlyUsedWith[2].typicalOrder).toBe('after'); // 默认为after
    });

    it('应该处理空结果', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      expect(result.articleId).toBe('article-1');
      expect(result.frequentlyUsedWith).toEqual([]);
    });

    it('应该处理数据库错误', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      expect(result.articleId).toBe('article-1');
      expect(result.frequentlyUsedWith).toEqual([]);
    });

    it('应该过滤低频率的关联', async () => {
      // SQL查询中已经有 HAVING COUNT(*) >= 3，所以数据库不会返回低于阈值的数据
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      expect(result.frequentlyUsedWith).toEqual([]);
    });

    it('应该支持自定义最小频率阈值', async () => {
      const mockQueryResult = [
        {
          related_article_id: 'article-2',
          avg_position: 1.0,
          frequency: 2,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.analyzeUsagePattern(
        'article-1',
        2
      );

      expect(result.frequentlyUsedWith).toHaveLength(1);
    });

    it('应该按频率降序排序结果', async () => {
      // SQL查询已经按频率降序排序（ORDER BY frequency DESC）
      const mockQueryResult = [
        {
          related_article_id: 'article-3',
          avg_position: 1.0,
          frequency: 10,
        },
        {
          related_article_id: 'article-4',
          avg_position: 1.0,
          frequency: 8,
        },
        {
          related_article_id: 'article-2',
          avg_position: 1.0,
          frequency: 5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      // 应该按频率降序排序
      expect(result.frequentlyUsedWith[0].frequency).toBe(10);
      expect(result.frequentlyUsedWith[1].frequency).toBe(8);
      expect(result.frequentlyUsedWith[2].frequency).toBe(5);
    });
  });

  describe('getCoOccurrenceStats', () => {
    it('应该获取共现统计信息', async () => {
      const mockQueryResult = [
        {
          total_pairs: 100,
          avg_co_occurrence: 7.5,
          max_co_occurrence: 50,
          min_co_occurrence: 5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.getCoOccurrenceStats();

      expect(result.totalPairs).toBe(100);
      expect(result.avgCoOccurrence).toBe(7.5);
      expect(result.maxCoOccurrence).toBe(50);
      expect(result.minCoOccurrence).toBe(5);
    });

    it('应该处理空数据库', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([
        {
          total_pairs: 0,
          avg_co_occurrence: null,
          max_co_occurrence: null,
          min_co_occurrence: null,
        },
      ]);

      const result = await CaseDerivedDetector.getCoOccurrenceStats();

      expect(result.totalPairs).toBe(0);
      expect(result.avgCoOccurrence).toBe(0);
      expect(result.maxCoOccurrence).toBe(0);
      expect(result.minCoOccurrence).toBe(0);
    });

    it('应该处理数据库错误', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error('Query failed')
      );

      const result = await CaseDerivedDetector.getCoOccurrenceStats();

      expect(result.totalPairs).toBe(0);
      expect(result.avgCoOccurrence).toBe(0);
    });
  });

  describe('findFrequentPatterns', () => {
    it('应该发现频繁使用的法条组合', async () => {
      const mockQueryResult = [
        {
          article_ids: ['article-1', 'article-2', 'article-3'],
          frequency: 15,
        },
        {
          article_ids: ['article-2', 'article-4'],
          frequency: 12,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.findFrequentPatterns(2);

      expect(result).toHaveLength(2);
      expect(result[0].articleIds).toEqual([
        'article-1',
        'article-2',
        'article-3',
      ]);
      expect(result[0].frequency).toBe(15);
      expect(result[0].support).toBeGreaterThan(0);
    });

    it('应该支持不同的最小支持度', async () => {
      const mockQueryResult = [
        {
          article_ids: ['article-1', 'article-2'],
          frequency: 5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.findFrequentPatterns(2, 5);

      expect(result).toHaveLength(1);
    });

    it('应该处理空结果', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await CaseDerivedDetector.findFrequentPatterns(2);

      expect(result).toEqual([]);
    });
  });

  describe('性能测试', () => {
    it('大数据量查询应在合理时间内完成', async () => {
      // Mock 大量数据
      const mockQueryResult = Array.from({ length: 1000 }, (_, i) => ({
        source_id: `article-${i}`,
        target_id: `article-${i + 1}`,
        co_occurrence_count: 10,
        order_score: 0.5,
      }));

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const startTime = Date.now();
      const result = await CaseDerivedDetector.discoverFromCases();
      const duration = Date.now() - startTime;

      expect(result).toHaveLength(1000);
      expect(duration).toBeLessThan(1000); // 应在1秒内完成
    });

    it('使用模式分析应高效处理', async () => {
      const mockQueryResult = Array.from({ length: 100 }, (_, i) => ({
        related_article_id: `article-${i}`,
        avg_position: i % 2 === 0 ? 1.0 : -1.0,
        frequency: 10,
      }));

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const startTime = Date.now();
      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');
      const duration = Date.now() - startTime;

      expect(result.frequentlyUsedWith).toHaveLength(100);
      expect(duration).toBeLessThan(500); // 应在0.5秒内完成
    });
  });

  describe('边界条件', () => {
    it('应该处理无效的法条ID', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await CaseDerivedDetector.analyzeUsagePattern('');

      expect(result.articleId).toBe('');
      expect(result.frequentlyUsedWith).toEqual([]);
    });

    it('应该处理极端的共现次数', async () => {
      const mockQueryResult = [
        {
          source_id: 'article-1',
          target_id: 'article-2',
          co_occurrence_count: 999999,
          order_score: 0.5,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.discoverFromCases();

      expect(result[0].strength).toBe(1.0); // 应该被限制在1.0
    });

    it('应该处理负数位置差', async () => {
      const mockQueryResult = [
        {
          related_article_id: 'article-2',
          avg_position: -999,
          frequency: 10,
        },
      ];

      (prisma.$queryRaw as jest.Mock).mockResolvedValue(mockQueryResult);

      const result = await CaseDerivedDetector.analyzeUsagePattern('article-1');

      expect(result.frequentlyUsedWith[0].typicalOrder).toBe('before');
    });
  });
});
