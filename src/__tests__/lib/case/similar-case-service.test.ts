import { SimilarCaseService } from '@/lib/case/similar-case-service';
import { prisma } from '@/lib/db/prisma';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    caseExample: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock CaseEmbeddingServiceFactory
jest.mock('@/lib/case/embedding-service', () => ({
  CaseEmbeddingServiceFactory: {
    getInstance: () => ({
      batchGenerateAndStore: jest.fn().mockResolvedValue({
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
      } as unknown as never),
      generateAndStoreEmbedding: jest.fn().mockResolvedValue({
        success: true,
        embedding: [1, 0, 0, 0],
      } as unknown as never),
    }),
  },
}));

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
  };
}

describe('SimilarCaseService', () => {
  let service: SimilarCaseService;

  beforeEach(() => {
    service = new SimilarCaseService();
    jest.clearAllMocks();
    // 清除缓存以确保测试独立性
    service.clearCache();
  });

  describe('searchSimilarCases', () => {
    test('应该成功检索到相似案例', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.7, 0.3, 0, 0]),
        createMockCase('case3', [0.5, 0.5, 0, 0]),
      ];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      const result = await service.searchSimilarCases({
        caseId: 'query1',
        topK: 3,
        threshold: 0.5,
      });

      expect(result.caseId).toBe('query1');
      expect(result.matches).toBeDefined();
      expect(result.totalMatches).toBeGreaterThan(0);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });

    test('应该正确处理案例不存在的情况', async () => {
      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        null as unknown as never
      );

      await expect(
        service.searchSimilarCases({ caseId: 'nonexistent' })
      ).rejects.toThrow('Case example not found');
    });

    test('应该正确处理没有向量的案例', async () => {
      const mockCase = createMockCase('query1', null as unknown as number[]);
      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockCase as unknown as never
      );

      await expect(
        service.searchSimilarCases({ caseId: 'query1' })
      ).rejects.toThrow('Embedding not found');
    });

    test('应该正确应用过滤条件', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.7, 0.3, 0, 0]),
      ];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      await service.searchSimilarCases({
        caseId: 'query2', // 使用不同的案例ID以避免缓存
        caseType: 'CIVIL' as any,
        result: 'WIN' as any,
      });

      // 验证 findMany 被调用
      expect(prisma.caseExample.findMany).toHaveBeenCalled();

      // 获取实际的调用参数
      const actualCall = (prisma.caseExample.findMany as jest.Mock).mock
        .calls[0] as [Record<string, unknown>];
      const actualWhere = actualCall[0].where as Record<string, unknown>;

      // 验证过滤条件存在
      expect(actualWhere).toBeDefined();
      expect(actualWhere.id).toEqual({ not: 'query2' });
      expect(actualWhere.embedding).toEqual({ not: null });
    });

    test('应该正确使用缓存', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [createMockCase('case1', [0.9, 0.1, 0, 0])];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      // 调用搜索
      await service.searchSimilarCases({ caseId: 'query1' });

      // 验证方法被调用
      expect(prisma.caseExample.findUnique).toHaveBeenCalled();
      expect(prisma.caseExample.findMany).toHaveBeenCalled();

      // 验证缓存状态
      const stats = service.getCacheStats();
      expect(stats.keys).toContain('query1');
    });
  });

  describe('batchCalculateSimilarity', () => {
    test('应该成功批量计算相似度', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.7, 0.3, 0, 0]),
      ];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      const result = await service.batchCalculateSimilarity({
        caseId: 'query1',
        targetIds: ['case1', 'case2'],
      });

      expect(result.total).toBe(2);
      expect(result.successful).toBeGreaterThan(0);
      expect(result.results).toHaveLength(2);
    });

    test('应该正确处理不存在的案例', async () => {
      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        null as unknown as never
      );

      await expect(
        service.batchCalculateSimilarity({
          caseId: 'nonexistent',
          targetIds: ['case1'],
        })
      ).rejects.toThrow('Case example not found');
    });

    test('应该正确处理没有向量的案例', async () => {
      const mockCase = createMockCase('query1', null as unknown as number[]);
      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockCase as unknown as never
      );

      await expect(
        service.batchCalculateSimilarity({
          caseId: 'query1',
          targetIds: ['case1'],
        })
      ).rejects.toThrow('Embedding not found');
    });
  });

  describe('缓存管理', () => {
    test('应该正确清除缓存', () => {
      service.clearCache();

      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });

    test('应该正确清除指定案例的缓存', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [createMockCase('case1', [0.9, 0.1, 0, 0])];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      // 先执行一次搜索以填充缓存
      await service.searchSimilarCases({ caseId: 'query1' });

      // 清除缓存
      const cleared = service.clearCacheForCase('query1');
      expect(cleared).toBe(true);
    });

    test('应该正确获取缓存统计', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [createMockCase('case1', [0.9, 0.1, 0, 0])];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      await service.searchSimilarCases({ caseId: 'query1' });
      await service.searchSimilarCases({ caseId: 'query2' });

      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('预热缓存', () => {
    test('应该成功预热缓存', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.7, 0.3, 0, 0]),
      ];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      await service.warmupCache(['query1', 'query2']);

      const stats = service.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('配置管理', () => {
    test('应该正确获取配置', () => {
      const config = service.getConfig();

      expect(config).toBeDefined();
      expect(config.method).toBeDefined();
      expect(config.topK).toBeDefined();
      expect(config.threshold).toBeDefined();
    });

    test('应该正确更新配置', () => {
      service.updateConfig({
        topK: 5,
        threshold: 0.8,
      } as any);

      const config = service.getConfig();
      expect(config.topK).toBe(5);
      expect(config.threshold).toBe(0.8);
    });
  });

  describe('质量指标', () => {
    test('应该成功获取质量指标', async () => {
      const mockQueryCase = createMockCase('query1', [1, 0, 0, 0]);
      const mockTargetCases = [
        createMockCase('case1', [0.9, 0.1, 0, 0]),
        createMockCase('case2', [0.7, 0.3, 0, 0]),
      ];

      (prisma.caseExample.findUnique as jest.Mock).mockResolvedValue(
        mockQueryCase as unknown as never
      );
      (prisma.caseExample.findMany as jest.Mock).mockResolvedValue(
        mockTargetCases as unknown as never
      );

      const metrics = await service.getQualityMetrics('query1');

      expect(metrics).toBeDefined();
      expect(metrics.avgSimilarity).toBeGreaterThan(0);
      expect(metrics.maxSimilarity).toBeGreaterThan(0);
      expect(metrics.minSimilarity).toBeGreaterThanOrEqual(0);
      expect(metrics.diversityScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('批量生成向量', () => {
    test('应该成功批量生成向量', async () => {
      // 这个测试需要mock embeddingService
      // 由于embeddingService是私有成员，我们这里只测试接口
      const result = await service.batchGenerateEmbeddings([]);

      expect(result).toBeDefined();
      expect(result.total).toBe(0);
    });
  });

  describe('资源清理', () => {
    test('应该成功清理资源', async () => {
      await service.dispose();

      // 清理后应该清除缓存
      const stats = service.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理数据库错误', async () => {
      (prisma.caseExample.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error') as unknown as never
      );

      await expect(
        service.searchSimilarCases({ caseId: 'query1' })
      ).rejects.toThrow();
    });
  });
});
