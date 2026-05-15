/**
 * 推荐效果监控API测试
 * 测试覆盖率目标：90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/recommendation-stats/route';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(() =>
    Promise.resolve({
      userId: 'admin-user-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    })
  ),
}));

jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(() =>
    Promise.resolve({ hasPermission: true })
  ),
  KnowledgeGraphAction: {
    VIEW_STATS: 'view_stats',
  },
  KnowledgeGraphResource: {
    STATS: 'knowledge_graph_stats',
  },
}));

describe('GET /api/v1/law-article-relations/recommendation-stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock for findMany (used in top articles query)
    jest.mocked(prisma.lawArticle.findMany).mockResolvedValue([]);
  });

  describe('成功场景', () => {
    it('应该返回推荐效果统计', async () => {
      // Mock 法条总数
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(1000);

      // Mock 有关系的法条数量
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([
        { sourceId: 'article1', targetId: 'article2' },
        { sourceId: 'article2', targetId: 'article3' },
        { sourceId: 'article1', targetId: 'article2' }, // 重复
      ] as never);

      // Mock 关系总数
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockResolvedValueOnce(500) // 总关系数
        .mockResolvedValueOnce(450); // 已验证关系数

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        totalArticles: 1000,
        articlesWithRelations: 3, // source/target 双端去重后
        coverageRate: 0.003, // 3/1000
        totalRelations: 500,
        verifiedRelations: 450,
        avgRelationsPerArticle: 0.5, // 500/1000
      });
    });

    it('应该处理没有法条的情况', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(0);
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalArticles).toBe(0);
      expect(data.data.coverageRate).toBe(0);
      expect(data.data.avgRelationsPerArticle).toBe(0);
    });

    it('应该正确计算覆盖率', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(100);
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({
          sourceId: `article${i}`,
          targetId: `article${i + 50}`,
        })) as never
      );
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(200);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.coverageRate).toBe(1); // source + target 共覆盖 100 个法条
    });

    it('应该支持按时间范围过滤', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(100);
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats?startDate=2026-01-01&endDate=2026-01-31'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          }),
        })
      );
    });

    it('应该返回热门法条列表', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(100);

      // Mock 关系数据
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([
        { sourceId: 'article1', targetId: 'article2' },
        { sourceId: 'article1', targetId: 'article3' },
        { sourceId: 'article1', targetId: 'article4' },
        { sourceId: 'article2', targetId: 'article1' },
        { sourceId: 'article2', targetId: 'article3' },
      ] as never);

      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(5);

      // Mock 法条详情
      jest.mocked(prisma.lawArticle.findMany).mockResolvedValue([
        {
          id: 'article1',
          lawName: '民法典',
          articleNumber: '第1条',
          fullText: '为了保护民事主体的合法权益...',
        },
        {
          id: 'article2',
          lawName: '民法典',
          articleNumber: '第2条',
          fullText: '民法调整平等主体的自然人...',
        },
      ] as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.topArticles).toBeDefined();
      expect(data.data.topArticles.length).toBeGreaterThan(0);
      expect(data.data.topArticles[0]).toMatchObject({
        article: expect.objectContaining({
          id: 'article1',
        }),
        relationCount: 4,
      });
    });

    it('应该把只作为target的法条计入覆盖率和热门法条', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(10);
      jest
        .mocked(prisma.lawArticleRelation.findMany)
        .mockResolvedValue([
          { sourceId: 'article1', targetId: 'article-target-only' },
        ] as never);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(1);
      jest.mocked(prisma.lawArticle.findMany).mockResolvedValue([
        {
          id: 'article-target-only',
          lawName: '民法典',
          articleNumber: '第999条',
          fullText: '目标法条...',
        },
      ] as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.articlesWithRelations).toBe(2);
      expect(data.data.coverageRate).toBe(0.2);
      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: { in: expect.arrayContaining(['article-target-only']) },
          },
        })
      );
    });
  });

  describe('参数验证', () => {
    it('应该拒绝无效的开始日期', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats?startDate=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的开始日期');
    });

    it('应该拒绝无效的结束日期', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats?endDate=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的结束日期');
    });

    it('应该拒绝开始日期晚于结束日期', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats?startDate=2026-02-01&endDate=2026-01-01'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('开始日期不能晚于结束日期');
    });

    it('应该拒绝无效的limit参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats?limit=0'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('limit必须在1-100之间');
    });

    it('应该拒绝过大的limit参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats?limit=101'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('limit必须在1-100之间');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库查询错误', async () => {
      jest
        .mocked(prisma.lawArticle.count)
        .mockRejectedValue(new Error('数据库连接失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('获取推荐统计失败');
    });

    it('应该处理关系查询错误', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(100);
      jest
        .mocked(prisma.lawArticleRelation.findMany)
        .mockRejectedValue(new Error('查询失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理所有法条都有关系的情况', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(10);
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          sourceId: `article${i}`,
          targetId: `article${i}`,
        })) as never
      );
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.coverageRate).toBe(1); // 10/10
    });

    it('应该处理没有关系的情况', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(100);
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.coverageRate).toBe(0);
      expect(data.data.avgRelationsPerArticle).toBe(0);
    });

    it('应该正确去重sourceId', async () => {
      jest.mocked(prisma.lawArticle.count).mockResolvedValue(100);
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([
        { sourceId: 'article1', targetId: 'article1' },
        { sourceId: 'article1', targetId: 'article1' },
        { sourceId: 'article1', targetId: 'article1' },
      ] as never);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(3);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/recommendation-stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(data.data.articlesWithRelations).toBe(1); // 去重后只有1个
    });
  });
});
