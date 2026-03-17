/**
 * 图谱构建服务测试
 *
 * 测试覆盖：
 * 1. 基本图谱构建功能
 * 2. 深度限制
 * 3. 节点和边的正确性
 * 4. 性能测试
 * 5. 边界情况
 */

import { RelationType, VerificationStatus } from '@prisma/client';

// Mock prisma before any imports
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
    },
  },
}));

// Import after mock
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { prisma } from '@/lib/db';

describe('GraphBuilder', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('buildGraph', () => {
    it('应该构建单层图谱（depth=1）', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const targetArticle = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
      };

      const relation = {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
        target: targetArticle,
      };

      // Mock数据库调用（findUnique只用于中心节点，子节点数据从rel.target获取）
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );

      (prisma.lawArticleRelation.findMany as jest.Mock)
        .mockResolvedValueOnce([relation])
        .mockResolvedValueOnce([]);

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 1);

      // 验证结果
      expect(graph.nodes).toHaveLength(2);
      expect(graph.links).toHaveLength(1);
      expect(graph.nodes[0].id).toBe('article-1');
      expect(graph.nodes[0].level).toBe(0);
      expect(graph.links[0].source).toBe('article-1');
      expect(graph.links[0].target).toBe('article-2');
    });

    it('应该构建多层图谱（depth=2）', async () => {
      // 准备测试数据
      const article1 = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const article2 = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
      };

      const article3 = {
        id: 'article-3',
        lawName: '民法典',
        articleNumber: '3',
        category: 'CIVIL',
      };

      const relation1 = {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
        target: article2,
      };

      const relation2 = {
        id: 'rel-2',
        sourceId: 'article-2',
        targetId: 'article-3',
        relationType: RelationType.COMPLETES,
        strength: 0.8,
        confidence: 0.85,
        verificationStatus: VerificationStatus.VERIFIED,
        target: article3,
      };

      // Mock数据库调用（BFS逐节点查询：article-1→[rel1], article-2→[rel2], article-3→[]）
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        article1
      );

      (prisma.lawArticleRelation.findMany as jest.Mock)
        .mockResolvedValueOnce([relation1]) // article-1的关系
        .mockResolvedValueOnce([relation2]) // article-2的关系
        .mockResolvedValueOnce([]); // article-3的关系

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 2);

      // 验证结果
      expect(graph.nodes).toHaveLength(3);
      expect(graph.links).toHaveLength(2);
      expect(graph.nodes.find(n => n.id === 'article-1')?.level).toBe(0);
      expect(graph.nodes.find(n => n.id === 'article-2')?.level).toBe(1);
      expect(graph.nodes.find(n => n.id === 'article-3')?.level).toBe(2);
    });

    it('应该正确处理循环引用', async () => {
      // 准备测试数据 - A -> B -> A
      const article1 = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const article2 = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
      };

      const relation1 = {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
        target: article2,
      };

      const relation2 = {
        id: 'rel-2',
        sourceId: 'article-2',
        targetId: 'article-1',
        relationType: RelationType.RELATED,
        strength: 0.7,
        confidence: 0.8,
        verificationStatus: VerificationStatus.VERIFIED,
        target: article1,
      };

      // Mock数据库调用（BFS：article-1→[rel1 A→B], article-2→[rel2 B→A]，A已访问不重新加入）
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        article1
      );

      (prisma.lawArticleRelation.findMany as jest.Mock)
        .mockResolvedValueOnce([relation1]) // article-1的关系：A→B
        .mockResolvedValueOnce([relation2]); // article-2的关系：B→A（A已访问，但link仍添加）

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 2);

      // 验证结果 - 应该只有2个节点，不会无限循环
      expect(graph.nodes).toHaveLength(2);
      expect(graph.links).toHaveLength(2);
    });

    it('应该只返回已验证的关系', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const targetArticle = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
      };

      const verifiedRelation = {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
        target: targetArticle,
      };

      // Mock数据库调用（findUnique只用于中心节点）
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );

      (prisma.lawArticleRelation.findMany as jest.Mock)
        .mockResolvedValueOnce([verifiedRelation])
        .mockResolvedValueOnce([]);

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 1);

      // 验证结果
      expect(graph.links).toHaveLength(1);
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verificationStatus: VerificationStatus.VERIFIED,
          }),
        })
      );
    });

    it('应该处理不存在的法条', async () => {
      // Mock数据库调用 - 法条不存在
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(null);

      // 执行测试
      const graph = await GraphBuilder.buildGraph('non-existent', 1);

      // 验证结果 - 应该返回空图谱
      expect(graph.nodes).toHaveLength(0);
      expect(graph.links).toHaveLength(0);
    });

    it('应该处理没有关系的法条', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      // Mock数据库调用
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        []
      );

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 1);

      // 验证结果 - 应该只有中心节点
      expect(graph.nodes).toHaveLength(1);
      expect(graph.links).toHaveLength(0);
      expect(graph.nodes[0].id).toBe('article-1');
    });

    it('应该正确设置节点的层级', async () => {
      // 准备测试数据
      const article1 = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const article2 = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
      };

      const article3 = {
        id: 'article-3',
        lawName: '民法典',
        articleNumber: '3',
        category: 'CIVIL',
      };

      const relation1 = {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
        target: article2,
      };

      const relation2 = {
        id: 'rel-2',
        sourceId: 'article-2',
        targetId: 'article-3',
        relationType: RelationType.COMPLETES,
        strength: 0.8,
        confidence: 0.85,
        verificationStatus: VerificationStatus.VERIFIED,
        target: article3,
      };

      // Mock数据库调用（BFS逐节点查询：article-1→[rel1], article-2→[rel2], article-3→[]）
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        article1
      );

      (prisma.lawArticleRelation.findMany as jest.Mock)
        .mockResolvedValueOnce([relation1]) // article-1的关系
        .mockResolvedValueOnce([relation2]) // article-2的关系
        .mockResolvedValueOnce([]); // article-3的关系

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 2);

      // 验证结果
      const node1 = graph.nodes.find(n => n.id === 'article-1');
      const node2 = graph.nodes.find(n => n.id === 'article-2');
      const node3 = graph.nodes.find(n => n.id === 'article-3');

      expect(node1?.level).toBe(0);
      expect(node2?.level).toBe(1);
      expect(node3?.level).toBe(2);
    });

    it('应该正确处理关系强度和置信度', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const targetArticle = {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '2',
        category: 'CIVIL',
      };

      const relation = {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.75,
        confidence: 0.88,
        verificationStatus: VerificationStatus.VERIFIED,
        target: targetArticle,
      };

      // Mock数据库调用（findUnique只用于中心节点）
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );

      (prisma.lawArticleRelation.findMany as jest.Mock)
        .mockResolvedValueOnce([relation])
        .mockResolvedValueOnce([]);

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 1);

      // 验证结果
      expect(graph.links[0].strength).toBe(0.75);
      expect(graph.links[0].confidence).toBe(0.88);
    });
  });

  describe('buildFullGraph', () => {
    it('应该构建全量图谱', async () => {
      // 准备测试数据
      const articles = [
        {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '1',
          category: 'CIVIL',
        },
        {
          id: 'article-2',
          lawName: '民法典',
          articleNumber: '2',
          category: 'CIVIL',
        },
        {
          id: 'article-3',
          lawName: '刑法',
          articleNumber: '1',
          category: 'CRIMINAL',
        },
      ];

      const relations = [
        {
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        {
          sourceId: 'article-2',
          targetId: 'article-3',
          relationType: RelationType.RELATED,
          strength: 0.7,
          confidence: 0.8,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ];

      // Mock数据库调用
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValueOnce(articles);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        relations
      );

      // 执行测试
      const graph = await GraphBuilder.buildFullGraph();

      // 验证结果
      expect(graph.nodes).toHaveLength(3);
      expect(graph.links).toHaveLength(2);
      expect(graph.nodes.every(n => n.level === 0)).toBe(true);
    });

    it('应该只返回已验证的关系', async () => {
      // 准备测试数据
      const articles = [
        {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '1',
          category: 'CIVIL',
        },
      ];

      const relations = [
        {
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      ];

      // Mock数据库调用
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValueOnce(articles);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        relations
      );

      // 执行测试
      await GraphBuilder.buildFullGraph();

      // 验证调用
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { verificationStatus: VerificationStatus.VERIFIED },
        })
      );
    });

    it('应该处理空数据库', async () => {
      // Mock数据库调用 - 空数据
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        []
      );

      // 执行测试
      const graph = await GraphBuilder.buildFullGraph();

      // 验证结果
      expect(graph.nodes).toHaveLength(0);
      expect(graph.links).toHaveLength(0);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成图谱构建', async () => {
      // 准备测试数据 - 模拟100个节点
      const articles = Array.from({ length: 100 }, (_, i) => ({
        id: `article-${i}`,
        lawName: '民法典',
        articleNumber: `${i}`,
        category: 'CIVIL',
      }));

      const relations = Array.from({ length: 200 }, (_, i) => ({
        id: `rel-${i}`,
        sourceId: `article-${i % 100}`,
        targetId: `article-${(i + 1) % 100}`,
        relationType: RelationType.CITES,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
        target: articles[(i + 1) % 100],
      }));

      // Mock数据库调用
      (prisma.lawArticle.findUnique as jest.Mock).mockImplementation(
        ({ where }) => {
          return Promise.resolve(articles.find(a => a.id === where.id) || null);
        }
      );

      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue(
        relations
      );

      // 执行测试
      const startTime = Date.now();
      await GraphBuilder.buildGraph('article-0', 2);
      const duration = Date.now() - startTime;

      // 验证性能 - 应该在1秒内完成
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('边界情况', () => {
    it('应该处理depth=0的情况', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      // Mock数据库调用
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        []
      );

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', 0);

      // 验证结果 - 应该只有中心节点
      expect(graph.nodes).toHaveLength(1);
      expect(graph.links).toHaveLength(0);
    });

    it('应该处理负数depth', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      // Mock数据库调用
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        []
      );

      // 执行测试
      const graph = await GraphBuilder.buildGraph('article-1', -1);

      // 验证结果 - 应该只有中心节点
      expect(graph.nodes).toHaveLength(1);
      expect(graph.links).toHaveLength(0);
    });

    it('应该处理非常大的depth值', async () => {
      // 准备测试数据
      const centerArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      // Mock数据库调用
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValueOnce(
        centerArticle
      );
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValueOnce(
        []
      );

      // 执行测试 - 不应该崩溃
      const graph = await GraphBuilder.buildGraph('article-1', 1000);

      // 验证结果
      expect(graph.nodes).toHaveLength(1);
      expect(graph.links).toHaveLength(0);
    });
  });
});
