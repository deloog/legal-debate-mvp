/**
 * 知识图谱浏览器API测试
 *
 * 测试覆盖：
 * 1. 获取全量图谱数据
 * 2. 按法条名称搜索
 * 3. 按分类过滤
 * 4. 按关系类型过滤
 * 5. 分页功能
 * 6. 错误处理
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/knowledge-graph/browse/route';
import { prisma } from '@/lib/db';
import { LawCategory, RelationType, VerificationStatus } from '@prisma/client';

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/v1/knowledge-graph/browse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础功能', () => {
    it('应该返回全量图谱数据', async () => {
      // 准备测试数据
      const mockArticles = [
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第1条',
          category: LawCategory.CIVIL,
          fullText: '为了保护民事主体的合法权益...',
        },
        {
          id: 'article2',
          lawName: '民法典',
          articleNumber: '第2条',
          category: LawCategory.CIVIL,
          fullText: '民法调整平等主体的自然人...',
        },
      ];

      const mockRelations = [
        {
          sourceId: 'article1',
          targetId: 'article2',
          relationType: RelationType.CITES,
          strength: 0.8,
          confidence: 0.9,
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(2);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue(
        mockRelations
      );

      // 创建请求
      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse'
      );

      // 执行请求
      const response = await GET(request);
      const data = await response.json();

      // 验证响应
      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(2);
      expect(data.links).toHaveLength(1);
      expect(data.pagination).toEqual({
        page: 1,
        pageSize: 100,
        total: 2,
        totalPages: 1,
      });

      // 验证节点数据
      expect(data.nodes[0]).toMatchObject({
        id: 'article1',
        lawName: '民法典',
        articleNumber: '第1条',
        category: LawCategory.CIVIL,
      });

      // 验证边数据
      expect(data.links[0]).toMatchObject({
        source: 'article1',
        target: 'article2',
        relationType: RelationType.CITES,
        strength: 0.8,
        confidence: 0.9,
      });
    });

    it('应该支持分页', async () => {
      const mockArticles = Array.from({ length: 10 }, (_, i) => ({
        id: `article${i + 1}`,
        lawName: '民法典',
        articleNumber: `第${i + 1}条`,
        category: LawCategory.CIVIL,
        fullText: `法条内容${i + 1}`,
      }));

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(
        mockArticles.slice(0, 5)
      );
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(10);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?page=1&pageSize=5'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(5);
      expect(data.pagination).toEqual({
        page: 1,
        pageSize: 5,
        total: 10,
        totalPages: 2,
      });
    });
  });

  describe('搜索功能', () => {
    it('应该支持按法条名称搜索', async () => {
      const mockArticles = [
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第1条',
          category: LawCategory.CIVIL,
          fullText: '民法典内容',
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(1);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?search=民法典'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(1);
      expect(data.nodes[0].lawName).toBe('民法典');

      // 验证调用参数
      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { lawName: { contains: '民法典', mode: 'insensitive' } },
              { articleNumber: { contains: '民法典', mode: 'insensitive' } },
              { fullText: { contains: '民法典', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });

    it('应该支持按条文号搜索', async () => {
      const mockArticles = [
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第100条',
          category: LawCategory.CIVIL,
          fullText: '法条内容',
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(1);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?search=第100条'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(1);
      expect(data.nodes[0].articleNumber).toBe('第100条');
    });
  });

  describe('过滤功能', () => {
    it('应该支持按分类过滤', async () => {
      const mockArticles = [
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第1条',
          category: LawCategory.CIVIL,
          fullText: '民法内容',
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(1);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?category=CIVIL'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(1);
      expect(data.nodes[0].category).toBe(LawCategory.CIVIL);

      // 验证调用参数
      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: LawCategory.CIVIL,
          }),
        })
      );
    });

    it('应该支持按关系类型过滤', async () => {
      const mockArticles = [
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第1条',
          category: LawCategory.CIVIL,
          fullText: '内容1',
        },
        {
          id: 'article2',
          lawName: '民法典',
          articleNumber: '第2条',
          category: LawCategory.CIVIL,
          fullText: '内容2',
        },
      ];

      const mockRelations = [
        {
          sourceId: 'article1',
          targetId: 'article2',
          relationType: RelationType.CITES,
          strength: 0.8,
          confidence: 0.9,
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(2);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue(
        mockRelations
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?relationType=CITES'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.links).toHaveLength(1);
      expect(data.links[0].relationType).toBe(RelationType.CITES);

      // 验证调用参数
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            relationType: RelationType.CITES,
          }),
        })
      );
    });

    it('应该支持组合过滤（搜索+分类）', async () => {
      const mockArticles = [
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第1条',
          category: LawCategory.CIVIL,
          fullText: '民法内容',
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(1);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?search=民法&category=CIVIL'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(1);

      // 验证调用参数包含两个过滤条件
      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: LawCategory.CIVIL,
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('边界情况', () => {
    it('应该处理空结果', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?search=不存在的法条'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(0);
      expect(data.links).toHaveLength(0);
      expect(data.pagination.total).toBe(0);
    });

    it('应该处理无效的分页参数', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?page=-1&pageSize=0'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 应该使用默认值
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.pageSize).toBe(100);
    });

    it('应该限制最大页面大小', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?pageSize=10000'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 应该限制为最大值
      expect(data.pagination.pageSize).toBeLessThanOrEqual(500);
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
    });

    it('应该处理无效的分类参数', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse?category=INVALID'
      );

      const response = await GET(request);
      const data = await response.json();

      // 应该忽略无效参数，返回所有数据
      expect(response.status).toBe(200);
    });
  });

  describe('性能优化', () => {
    it('应该只查询必要的字段', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse'
      );

      await GET(request);

      // 验证只查询必要的字段
      const callArgs = (prisma.lawArticle.findMany as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.select).toBeDefined();
      expect(callArgs.select.id).toBe(true);
      expect(callArgs.select.lawName).toBe(true);
      expect(callArgs.select.articleNumber).toBe(true);
      expect(callArgs.select.category).toBe(true);
      expect(callArgs.select.fullText).toBeUndefined(); // 不查询全文
    });

    it('应该只查询已验证的关系', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.count as jest.Mock).mockResolvedValue(0);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/knowledge-graph/browse'
      );

      await GET(request);

      // 验证只查询已验证的关系
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            verificationStatus: VerificationStatus.VERIFIED,
          }),
        })
      );
    });
  });
});
