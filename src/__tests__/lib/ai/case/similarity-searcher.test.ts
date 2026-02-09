import {
  SimilaritySearcher,
  SimilaritySearcherFactory,
} from '@/lib/ai/case/similarity-searcher';
import { SimilarityMethod } from '@/types/case-example';
import { describe, test, expect, beforeEach } from '@jest/globals';

/**
 * 创建测试用的案例数据
 */
function createMockCase(id: string, embedding: number[]) {
  return {
    id,
    title: `Case ${id}`,
    caseNumber: `${id}001`,
    court: '北京市朝阳区人民法院',
    type: 'CIVIL' as const,
    cause: '合同纠纷',
    facts: '测试案情描述',
    judgment: '测试判决',
    result: 'WIN' as const,
    judgmentDate: new Date('2024-01-01'),
    embedding,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    dataSource: 'cail',
    sourceId: null,
    importedAt: null,
  };
}

describe('SimilaritySearcher', () => {
  let searcher: SimilaritySearcher;
  const mockEmbedding1 = [1, 0, 0, 0];
  const mockEmbedding2 = [0, 1, 0, 0];
  const mockEmbedding3 = [0.707, 0.707, 0, 0];
  const mockEmbedding4 = [0.5, 0.5, 0.5, 0.5];

  beforeEach(() => {
    searcher = new SimilaritySearcher({
      method: SimilarityMethod.COSINE,
      topK: 3,
      threshold: 0.5,
      normalizeVectors: true,
      cacheEnabled: true,
      maxCacheSize: 10,
    });
  });

  describe('searchSimilarCases', () => {
    test('应该成功检索到相似案例', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', mockEmbedding1),
        createMockCase('case2', mockEmbedding2),
        createMockCase('case3', mockEmbedding3),
        createMockCase('case4', mockEmbedding4),
      ];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results).toHaveLength(3);
      expect(results[0].caseExample.id).toBe('case1');
      expect(results[0].similarity).toBeGreaterThan(0.9);
      expect(results[0].matchingFactors).toContain('整体高度相似');
    });

    test('应该正确排序结果（相似度降序）', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [1, 0, 0, 0]),
        createMockCase('case3', [0.8, 0.2, 0, 0]),
      ];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results[0].caseExample.id).toBe('case2');
      expect(results[1].caseExample.id).toBe('case1');
      expect(results[2].caseExample.id).toBe('case3');
      expect(results[0].similarity).toBeGreaterThanOrEqual(
        results[1].similarity
      );
      expect(results[1].similarity).toBeGreaterThanOrEqual(
        results[2].similarity
      );
    });

    test('应该正确应用阈值过滤', async () => {
      const searcherWithHighThreshold = new SimilaritySearcher({
        threshold: 0.8,
        topK: 10,
        method: SimilarityMethod.COSINE,
        normalizeVectors: true,
        cacheEnabled: false,
        maxCacheSize: 100,
      });

      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.5, 0.5, 0, 0]),
        createMockCase('case3', [0.3, 0.7, 0, 0]),
      ];

      const results = await searcherWithHighThreshold.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results).toHaveLength(1);
      expect(results[0].caseExample.id).toBe('case1');
    });

    test('应该正确应用top-k限制', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.8, 0.2, 0, 0]),
        createMockCase('case3', [0.7, 0.3, 0, 0]),
        createMockCase('case4', [0.6, 0.4, 0, 0]),
        createMockCase('case5', [0.5, 0.5, 0, 0]),
      ];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results).toHaveLength(3);
    });

    test('应该跳过没有向量的案例', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', mockEmbedding1),
        createMockCase('case2', null as unknown as number[]),
        createMockCase('case3', undefined as unknown as number[]),
        createMockCase('case4', [0.9, 0.1, 0, 0]),
      ];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results).toHaveLength(2);
      expect(results.every(r => r.caseExample.id !== 'case2')).toBe(true);
      expect(results.every(r => r.caseExample.id !== 'case3')).toBe(true);
    });

    test('应该正确提取匹配因素', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [createMockCase('case1', [0.99, 0.01, 0, 0])];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results[0].matchingFactors.length).toBeGreaterThan(0);
      expect(results[0].matchingFactors.some(f => f.includes('相似'))).toBe(
        true
      );
    });
  });

  describe('batchCalculateSimilarity', () => {
    test('应该成功批量计算相似度', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetEmbeddings = [
        { id: 'case1', embedding: mockEmbedding1 },
        { id: 'case2', embedding: mockEmbedding2 },
        { id: 'case3', embedding: mockEmbedding3 },
      ];

      const results = await searcher.batchCalculateSimilarity(
        queryEmbedding,
        targetEmbeddings
      );

      expect(results).toHaveLength(3);
      expect(results.every(r => r.similarity >= 0)).toBe(true);
      expect(results.every(r => !r.error)).toBe(true);
    });

    test('应该正确处理无效的向量', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetEmbeddings = [
        { id: 'case1', embedding: mockEmbedding1 },
        { id: 'case2', embedding: [] as number[] },
        { id: 'case3', embedding: [1] as number[] },
      ];

      const results = await searcher.batchCalculateSimilarity(
        queryEmbedding,
        targetEmbeddings
      );

      expect(results).toHaveLength(3);
      expect(results[0].similarity).toBeGreaterThan(0);
      expect(results[1].error).toBeDefined();
      expect(results[2].error).toBeDefined();
    });

    test('应该正确处理向量长度不一致的情况', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetEmbeddings = [
        { id: 'case1', embedding: [1, 0, 0, 0] },
        { id: 'case2', embedding: [0.707, 0.707, 0, 0] },
        { id: 'case3', embedding: [1, 0] },
      ];

      const results = await searcher.batchCalculateSimilarity(
        queryEmbedding,
        targetEmbeddings
      );

      expect(results).toHaveLength(3);
      expect(results[2].error).toBeDefined();
    });
  });

  describe('缓存功能', () => {
    test('应该正确缓存和读取缓存', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [createMockCase('case1', mockEmbedding1)];

      const firstResults = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );
      searcher.setCache('case1', firstResults);

      const cachedResults = searcher.getCache('case1');

      expect(cachedResults).toBeDefined();
      expect(cachedResults).toHaveLength(firstResults.length);
      expect(cachedResults![0].caseExample.id).toBe('case1');
    });

    test('应该正确清除缓存', async () => {
      searcher.setCache('case1', [
        {
          caseExample: createMockCase('case1', mockEmbedding1),
          similarity: 1,
          matchingFactors: [],
        },
      ]);
      const cleared = searcher.clearCacheForCase('case1');

      expect(cleared).toBe(true);
      expect(searcher.getCache('case1')).toBeUndefined();
    });

    test('应该返回缓存统计信息', async () => {
      searcher.setCache('case1', [
        {
          caseExample: createMockCase('case1', mockEmbedding1),
          similarity: 1,
          matchingFactors: [],
        },
      ]);
      searcher.setCache('case2', [
        {
          caseExample: createMockCase('case2', mockEmbedding2),
          similarity: 1,
          matchingFactors: [],
        },
      ]);

      const stats = searcher.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('case1');
      expect(stats.keys).toContain('case2');
    });

    test('应该正确清除所有缓存', () => {
      searcher.setCache('case1', [
        {
          caseExample: createMockCase('case1', mockEmbedding1),
          similarity: 1,
          matchingFactors: [],
        },
      ]);
      searcher.setCache('case2', [
        {
          caseExample: createMockCase('case2', mockEmbedding2),
          similarity: 1,
          matchingFactors: [],
        },
      ]);

      searcher.clearCache();

      const stats = searcher.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('应该正确限制缓存大小', () => {
      const smallCacheSearcher = new SimilaritySearcher({
        maxCacheSize: 2,
        topK: 10,
        threshold: 0.5,
        method: SimilarityMethod.COSINE,
        normalizeVectors: true,
        cacheEnabled: true,
      });

      smallCacheSearcher.setCache('case1', [
        {
          caseExample: createMockCase('case1', mockEmbedding1),
          similarity: 1,
          matchingFactors: [],
        },
      ]);
      smallCacheSearcher.setCache('case2', [
        {
          caseExample: createMockCase('case2', mockEmbedding2),
          similarity: 1,
          matchingFactors: [],
        },
      ]);
      smallCacheSearcher.setCache('case3', [
        {
          caseExample: createMockCase('case3', mockEmbedding3),
          similarity: 1,
          matchingFactors: [],
        },
      ]);

      const stats = smallCacheSearcher.getCacheStats();
      expect(stats.size).toBe(2);
    });
  });

  describe('配置管理', () => {
    test('应该正确获取配置', () => {
      const config = searcher.getConfig();

      expect(config.method).toBe(SimilarityMethod.COSINE);
      expect(config.topK).toBe(3);
      expect(config.threshold).toBe(0.5);
      expect(config.normalizeVectors).toBe(true);
      expect(config.cacheEnabled).toBe(true);
      expect(config.maxCacheSize).toBe(10);
    });

    test('应该正确更新配置', () => {
      searcher.updateConfig({
        topK: 5,
        threshold: 0.8,
      });

      const config = searcher.getConfig();
      expect(config.topK).toBe(5);
      expect(config.threshold).toBe(0.8);
      expect(config.method).toBe(SimilarityMethod.COSINE);
    });
  });

  describe('质量指标', () => {
    test('应该正确计算质量指标', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.7, 0.3, 0, 0]),
        createMockCase('case3', [0.5, 0.5, 0, 0]),
      ];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );
      const metrics = searcher.calculateQualityMetrics(results);

      expect(metrics.avgSimilarity).toBeGreaterThan(0);
      expect(metrics.maxSimilarity).toBeGreaterThan(0);
      expect(metrics.minSimilarity).toBeGreaterThanOrEqual(0);
      expect(metrics.diversityScore).toBeGreaterThanOrEqual(0);
      expect(metrics.diversityScore).toBeLessThanOrEqual(1);
    });

    test('应该正确处理空结果', () => {
      const metrics = searcher.calculateQualityMetrics([]);

      expect(metrics.avgSimilarity).toBe(0);
      expect(metrics.maxSimilarity).toBe(0);
      expect(metrics.minSimilarity).toBe(0);
      expect(metrics.diversityScore).toBe(0);
    });

    test('应该正确计算多样性得分', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.8, 0.2, 0, 0]),
        createMockCase('case3', [0.7, 0.3, 0, 0]),
      ];

      const results = await searcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );
      const metrics = searcher.calculateQualityMetrics(results);

      // 所有案例类型相同，多样性应该为1/3
      expect(metrics.diversityScore).toBeLessThanOrEqual(1);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理无效的查询向量', async () => {
      const invalidEmbedding = [] as number[];
      const targetCases = [createMockCase('case1', mockEmbedding1)];

      await expect(
        searcher.searchSimilarCases(invalidEmbedding, targetCases)
      ).rejects.toThrow();
    });

    test('应该正确处理null查询向量', async () => {
      const nullEmbedding = null as unknown as number[];
      const targetCases = [createMockCase('case1', mockEmbedding1)];

      await expect(
        searcher.searchSimilarCases(nullEmbedding, targetCases)
      ).rejects.toThrow();
    });
  });

  describe('相似度计算方法', () => {
    test('应该正确使用欧几里得距离方法', async () => {
      const euclideanSearcher = new SimilaritySearcher({
        method: SimilarityMethod.EUCLIDEAN,
        threshold: 0.9,
        topK: 10,
        normalizeVectors: false,
        cacheEnabled: false,
        maxCacheSize: 100,
      });

      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', [1, 0, 0, 0]),
        createMockCase('case2', [0, 1, 0, 0]),
      ];

      const results = await euclideanSearcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].caseExample.id).toBe('case1');
    });

    test('应该正确使用点积方法', async () => {
      const dotProductSearcher = new SimilaritySearcher({
        method: SimilarityMethod.DOT_PRODUCT,
        threshold: 0.5,
        topK: 10,
        normalizeVectors: false,
        cacheEnabled: false,
        maxCacheSize: 100,
      });

      const queryEmbedding = [1, 1, 0, 0];
      const targetCases = [
        createMockCase('case1', [1, 0, 0, 0]),
        createMockCase('case2', [0, 1, 0, 0]),
      ];

      const results = await dotProductSearcher.searchSimilarCases(
        queryEmbedding,
        targetCases
      );

      expect(results).toHaveLength(2);
    });
  });

  describe('工厂类', () => {
    test('应该正确创建和管理实例', () => {
      const instance1 = SimilaritySearcherFactory.getInstance('test1');
      const instance2 = SimilaritySearcherFactory.getInstance('test1');
      const instance3 = SimilaritySearcherFactory.getInstance('test2');

      // 相同名称应该返回相同实例
      expect(instance1).toBe(instance2);
      expect(instance1).not.toBe(instance3);
    });

    test('应该正确移除实例', () => {
      SimilaritySearcherFactory.getInstance('test-remove');
      const removed = SimilaritySearcherFactory.removeInstance('test-remove');

      expect(removed).toBe(true);
    });

    test('应该正确获取所有实例', () => {
      SimilaritySearcherFactory.getInstance('test-all-1');
      SimilaritySearcherFactory.getInstance('test-all-2');

      const instances = SimilaritySearcherFactory.getAllInstances();

      expect(instances.size).toBeGreaterThanOrEqual(2);
    });

    test('应该正确清除所有实例', async () => {
      await SimilaritySearcherFactory.clearAllInstances();

      const instances = SimilaritySearcherFactory.getAllInstances();
      expect(instances.size).toBe(0);
    });
  });

  describe('缓存预热', () => {
    test('应该成功预热缓存', async () => {
      const queryEmbedding = [1, 0, 0, 0];
      const targetCases = [
        createMockCase('case1', mockEmbedding1),
        createMockCase('case2', mockEmbedding2),
      ];

      await searcher.warmupCache(
        ['case1', 'case2'],
        queryEmbedding,
        targetCases
      );

      const stats = searcher.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(2);
    });
  });
});
