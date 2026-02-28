/**
 * RelationSearchTool 测试套件
 *
 * 遵循 TDD 原则，先编写测试用例
 */

import { RelationSearchTool } from '@/lib/knowledge-graph/agent-tools/relation-search-tool';
import type {
  RelationSearchParams,
  RelationSearchResult,
} from '@/lib/knowledge-graph/agent-tools/types';
import type { PrismaClient } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';
import { RelationType, VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

// Mock Prisma Client
const mockPrisma = mockDeep<PrismaClient>();

// Mock logger
jest.mock('@/lib/logger');
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('RelationSearchTool', () => {
  let tool: RelationSearchTool;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new RelationSearchTool(mockPrisma);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('工具基础功能', () => {
    test('应该成功创建工具实例', () => {
      expect(tool).toBeDefined();
      expect(tool.getName()).toBe('kg_search_relations');
      expect(tool.getDescription()).toBeDefined();
    });

    test('应该返回工具配置', () => {
      const config = tool.getConfig();
      expect(config).toBeDefined();
      expect(config.enableCache).toBeDefined();
      expect(config.cacheTTL).toBeDefined();
      expect(config.maxResults).toBeDefined();
      expect(config.timeout).toBeDefined();
    });

    test('应该能够更新配置', () => {
      tool.updateConfig({ maxResults: 500 });
      const config = tool.getConfig();
      expect(config.maxResults).toBe(500);
    });
  });

  describe('参数验证', () => {
    test('应该拒绝缺少articleId的参数', async () => {
      const invalidParams = {} as RelationSearchParams;

      const result = await tool.execute(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('articleId');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('应该拒绝无效的深度参数', async () => {
      const invalidParams: RelationSearchParams = {
        articleId: 'test-article-id',
        depth: 5, // 超过最大深度3
      };

      const result = await tool.execute(invalidParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('depth');
    });

    test('应该接受有效的参数', async () => {
      const validParams: RelationSearchParams = {
        articleId: 'test-article-id',
        depth: 2,
        relationTypes: [RelationType.CITES],
      };

      // Mock数据库查询
      mockPrisma.lawArticle.findUnique.mockResolvedValue({
        id: 'test-article-id',
        title: '测试法条',
        category: '民事',
        status: 'VALID',
      } as never);

      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const result = await tool.execute(validParams);

      expect(result.success).toBe(true);
    });
  });

  describe('关系查询功能', () => {
    beforeEach(() => {
      // Mock 中心法条查询
      mockPrisma.lawArticle.findUnique.mockResolvedValue({
        id: 'center-article',
        title: '中心法条',
        category: '民事',
        status: 'VALID',
      } as never);

      // Mock 关系列表查询
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: 'rel-1',
          sourceId: 'center-article',
          targetId: 'related-1',
          relationType: RelationType.CITES,
          strength: 0.8,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        {
          id: 'rel-2',
          sourceId: 'center-article',
          targetId: 'related-2',
          relationType: RelationType.CONFLICTS,
          strength: 0.9,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ] as never);

      // Mock 关联法条查询
      mockPrisma.lawArticle.findMany.mockResolvedValue([
        {
          id: 'related-1',
          title: '关联法条1',
          category: '民事',
          status: 'VALID',
        },
        {
          id: 'related-2',
          title: '关联法条2',
          category: '民事',
          status: 'VALID',
        },
      ] as never);
    });

    test('应该成功查询法条关系（单向）', async () => {
      const params: RelationSearchParams = {
        articleId: 'center-article',
        depth: 1,
        bidirectional: false,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      const searchResult = result.data as RelationSearchResult;
      expect(searchResult.centerNode.id).toBe('center-article');
      expect(searchResult.nodes).toHaveLength(2);
      expect(searchResult.edges).toHaveLength(2);
      expect(searchResult.stats.totalNodes).toBe(3); // 包括中心节点
      expect(searchResult.stats.totalEdges).toBe(2);
    });

    test('应该成功查询法条关系（双向）', async () => {
      const params: RelationSearchParams = {
        articleId: 'center-article',
        depth: 1,
        bidirectional: true,
      };

      // 额外 mock 入边查询
      mockPrisma.lawArticleRelation.findMany.mockResolvedValueOnce([
        {
          id: 'rel-1',
          sourceId: 'center-article',
          targetId: 'related-1',
          relationType: RelationType.CITES,
          strength: 0.8,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        {
          id: 'rel-in-1',
          sourceId: 'other-article',
          targetId: 'center-article',
          relationType: RelationType.CITED_BY,
          strength: 0.7,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ] as never);

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('应该支持关系类型过滤', async () => {
      const params: RelationSearchParams = {
        articleId: 'center-article',
        depth: 1,
        relationTypes: [RelationType.CITES],
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const searchResult = result.data as RelationSearchResult;

      // 验证只包含CITES类型的关系
      searchResult.edges.forEach(edge => {
        expect(edge.relationType).toBe(RelationType.CITES);
      });
    });

    test('应该正确统计按类型分组的关系', async () => {
      const params: RelationSearchParams = {
        articleId: 'center-article',
        depth: 1,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const searchResult = result.data as RelationSearchResult;

      expect(searchResult.stats.byRelationType).toBeDefined();
      expect(searchResult.stats.byRelationType[RelationType.CITES]).toBe(1);
      expect(searchResult.stats.byRelationType[RelationType.CONFLICTS]).toBe(1);
    });

    test('应该处理没有关系的情况', async () => {
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const params: RelationSearchParams = {
        articleId: 'center-article',
        depth: 1,
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const searchResult = result.data as RelationSearchResult;
      expect(searchResult.nodes).toHaveLength(0);
      expect(searchResult.edges).toHaveLength(0);
      expect(searchResult.stats.totalEdges).toBe(0);
    });
  });

  describe('错误处理', () => {
    test('应该处理法条不存在的情况', async () => {
      mockPrisma.lawArticle.findUnique.mockResolvedValue(null);

      const params: RelationSearchParams = {
        articleId: 'non-existent-article',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('不存在');
    });

    test('应该处理数据库查询错误', async () => {
      mockPrisma.lawArticle.findUnique.mockRejectedValue(
        new Error('Database connection failed')
      );

      const params: RelationSearchParams = {
        articleId: 'center-article',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed'),
        expect.any(Object)
      );
    });

    test('应该记录执行时间', async () => {
      mockPrisma.lawArticle.findUnique.mockResolvedValue({
        id: 'center-article',
        title: '中心法条',
        category: '民事',
        status: 'VALID',
      } as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([]);

      const params: RelationSearchParams = {
        articleId: 'center-article',
      };

      const result = await tool.execute(params);

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(10000); // 应该在10秒内完成
    });
  });

  describe('性能和边界情况', () => {
    test('应该限制最大返回节点数', async () => {
      // Mock大量关系
      const manyRelations = Array.from({ length: 1500 }, (_, i) => ({
        id: `rel-${i}`,
        sourceId: 'center-article',
        targetId: `related-${i}`,
        relationType: RelationType.CITES,
        strength: 0.5,
        verificationStatus: VerificationStatus.VERIFIED,
      }));

      mockPrisma.lawArticle.findUnique.mockResolvedValue({
        id: 'center-article',
        title: '中心法条',
        category: '民事',
        status: 'VALID',
      } as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue(
        manyRelations as never
      );
      mockPrisma.lawArticle.findMany.mockResolvedValue(
        manyRelations.map(r => ({
          id: r.targetId,
          title: `法条${r.targetId}`,
          category: '民事',
          status: 'VALID',
        })) as never
      );

      const params: RelationSearchParams = {
        articleId: 'center-article',
      };

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
      const searchResult = result.data as RelationSearchResult;
      expect(searchResult.nodes.length).toBeLessThanOrEqual(1000); // 默认最大结果数
    });

    test('应该支持深度为2的多跳查询', async () => {
      const params: RelationSearchParams = {
        articleId: 'center-article',
        depth: 2,
      };

      mockPrisma.lawArticle.findUnique.mockResolvedValue({
        id: 'center-article',
        title: '中心法条',
        category: '民事',
        status: 'VALID',
      } as never);
      mockPrisma.lawArticleRelation.findMany.mockResolvedValue([
        {
          id: 'rel-1',
          sourceId: 'center-article',
          targetId: 'related-1',
          relationType: RelationType.CITES,
          strength: 0.8,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ] as never);
      mockPrisma.lawArticle.findMany.mockResolvedValue([
        {
          id: 'related-1',
          title: '关联法条1',
          category: '民事',
          status: 'VALID',
        },
      ] as never);

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
    });
  });
});
