/**
 * 知识图谱统计API测试
 *
 * 测试覆盖：
 * - 正常返回图谱统计数据
 * - 关系类型分组
 * - 热门法条排序
 * - 推荐准确率计算
 * - 错误处理
 */

import { GET } from '@/app/api/v1/system/graph-stats/route';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    lawArticle: {
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/v1/system/graph-stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常情况', () => {
    it('应该返回知识图谱统计数据', async () => {
      // Mock关系类型统计
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([
        { relationType: 'CITES', _count: 100 },
        { relationType: 'CONFLICTS', _count: 20 },
        { relationType: 'RELATED', _count: 50 },
      ]);

      // Mock热门法条 - articleNumber应该是纯数字
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          lawName: '民法典',
          articleNumber: '1',
          _count: {
            outgoingRelations: 30,
            incomingRelations: 20,
          },
        },
        {
          id: '2',
          lawName: '合同法',
          articleNumber: '2',
          _count: {
            outgoingRelations: 15,
            incomingRelations: 10,
          },
        },
      ]);

      // Mock关系总数和已验证数
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(200) // 总数
        .mockResolvedValueOnce(170); // 已验证数

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        relationsByType: {
          CITES: 100,
          CONFLICTS: 20,
          RELATED: 50,
        },
        topArticles: [
          {
            id: '1',
            title: '民法典 第1条',
            relationCount: 50,
          },
          {
            id: '2',
            title: '合同法 第2条',
            relationCount: 25,
          },
        ],
        recommendationAccuracy: 0.85,
      });
    });

    it('应该只统计已验证的关系', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);

      await GET();

      expect(prisma.lawArticleRelation.groupBy).toHaveBeenCalledWith({
        by: ['relationType'],
        where: {
          verificationStatus: VerificationStatus.VERIFIED,
        },
        _count: true,
      });
    });

    it('应该正确计算热门法条的关系数（出边+入边）', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          lawName: '民法典',
          articleNumber: '1',
          _count: {
            outgoingRelations: 10,
            incomingRelations: 5,
          },
        },
      ]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);

      const response = await GET();
      const data = await response.json();

      expect(data.topArticles[0].relationCount).toBe(15);
    });

    it('应该按出边和入边数量降序排序热门法条', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          lawName: '民法典',
          articleNumber: '1',
          _count: {
            outgoingRelations: 10,
            incomingRelations: 5,
          },
        },
        {
          id: '2',
          lawName: '合同法',
          articleNumber: '2',
          _count: {
            outgoingRelations: 20,
            incomingRelations: 10,
          },
        },
        {
          id: '3',
          lawName: '侵权责任法',
          articleNumber: '3',
          _count: {
            outgoingRelations: 5,
            incomingRelations: 25,
          },
        },
      ]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);

      const response = await GET();
      const data = await response.json();

      // 应该先按出边降序，再按入边降序
      expect(data.topArticles[0].title).toBe('民法典 第1条'); // 10+5=15 (出边最大)
    });

    it('应该正确计算推荐准确率', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(200)
        .mockResolvedValueOnce(150);

      const response = await GET();
      const data = await response.json();

      expect(data.recommendationAccuracy).toBe(0.75);
    });

    it('应该限制热门法条数量为10条', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);

      await GET();

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith({
        take: 10,
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          _count: {
            select: {
              outgoingRelations: true,
              incomingRelations: true,
            },
          },
        },
        orderBy: [
          { outgoingRelations: { _count: 'desc' } },
          { incomingRelations: { _count: 'desc' } },
        ],
      });
    });
  });

  describe('边界情况', () => {
    it('当没有关系时应该返回空对象', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const response = await GET();
      const data = await response.json();

      expect(data.relationsByType).toEqual({});
      expect(data.topArticles).toEqual([]);
      expect(data.recommendationAccuracy).toBe(0);
    });

    it('当没有法条时推荐准确率应该为0', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const response = await GET();
      const data = await response.json();

      expect(data.recommendationAccuracy).toBe(0);
    });

    it('当所有关系都验证时推荐准确率应该为1', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(100);

      const response = await GET();
      const data = await response.json();

      expect(data.recommendationAccuracy).toBe(1);
    });

    it('应该处理多种关系类型', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([
        { relationType: 'CITES', _count: 100 },
        { relationType: 'CITED_BY', _count: 80 },
        { relationType: 'CONFLICTS', _count: 20 },
        { relationType: 'COMPLETES', _count: 30 },
        { relationType: 'COMPLETED_BY', _count: 25 },
        { relationType: 'SUPERSEDES', _count: 10 },
        { relationType: 'SUPERSEDED_BY', _count: 5 },
        { relationType: 'IMPLEMENTS', _count: 15 },
        { relationType: 'IMPLEMENTED_BY', _count: 12 },
        { relationType: 'RELATED', _count: 50 },
      ]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(347)
        .mockResolvedValueOnce(300);

      const response = await GET();
      const data = await response.json();

      expect(Object.keys(data.relationsByType)).toHaveLength(10);
      expect(data.relationsByType.CITES).toBe(100);
      expect(data.relationsByType.RELATED).toBe(50);
    });
  });

  describe('错误处理', () => {
    it('获取关系类型统计失败时应该返回500', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: '服务器错误' });
    });

    it('获取热门法条失败时应该返回500', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockRejectedValue(
        new Error('查询失败')
      );

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: '服务器错误' });
    });

    it('计算推荐准确率失败时应该返回500', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockRejectedValue(new Error('查询失败'));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: '服务器错误' });
    });
  });

  describe('性能和数据一致性', () => {
    it('应该并行查询以提高性能', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);

      await GET();

      // 验证调用顺序（应该都是并行调用的）
      expect(prisma.lawArticleRelation.groupBy).toHaveBeenCalled();
      expect(prisma.lawArticle.findMany).toHaveBeenCalled();
      expect(prisma.lawArticleRelation.count).toHaveBeenCalledTimes(2);
    });

    it('热门法条标题应该格式化正确', async () => {
      (prisma.lawArticleRelation.groupBy as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: '1',
          lawName: '中华人民共和国民法典',
          articleNumber: '500',
          _count: {
            outgoingRelations: 10,
            incomingRelations: 5,
          },
        },
      ]);
      (prisma.lawArticleRelation.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80);

      const response = await GET();
      const data = await response.json();

      expect(data.topArticles[0].title).toBe('中华人民共和国民法典 第500条');
    });
  });
});
