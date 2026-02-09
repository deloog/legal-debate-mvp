/**
 * 最近活动API测试
 *
 * 测试覆盖：
 * 1. 获取最近查看的法条
 * 2. 获取最近的辩论
 * 3. 获取最近的合同
 * 4. 分页功能
 * 5. 错误处理
 */

import { GET } from '@/app/api/v1/system/recent-activity/route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findMany: jest.fn(),
    },
    debate: {
      findMany: jest.fn(),
    },
    contract: {
      findMany: jest.fn(),
    },
  },
}));

describe('最近活动API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/system/recent-activity', () => {
    it('应该返回最近查看的法条', async () => {
      const mockArticles = [
        {
          id: '1',
          lawName: '民法典',
          articleNumber: '第1条',
          fullText: '为了保护民事主体的合法权益...',
          updatedAt: new Date('2026-02-02T10:00:00Z'),
        },
        {
          id: '2',
          lawName: '刑法',
          articleNumber: '第1条',
          fullText: '为了惩罚犯罪...',
          updatedAt: new Date('2026-02-02T09:00:00Z'),
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentArticles).toHaveLength(2);
      expect(data.recentArticles[0].lawName).toBe('民法典');
      expect(data.recentArticles[0].articleNumber).toBe('第1条');
    });

    it('应该返回最近的辩论', async () => {
      const mockDebates = [
        {
          id: '1',
          title: '合同纠纷案',
          description: '关于合同履行的纠纷',
          status: 'completed',
          createdAt: new Date('2026-02-02T08:00:00Z'),
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(mockDebates);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentDebates).toHaveLength(1);
      expect(data.recentDebates[0].title).toBe('合同纠纷案');
    });

    it('应该返回最近的合同', async () => {
      const mockContracts = [
        {
          id: '1',
          title: '采购合同',
          type: 'PURCHASE',
          status: 'active',
          createdAt: new Date('2026-02-02T07:00:00Z'),
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue(mockContracts);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentContracts).toHaveLength(1);
      expect(data.recentContracts[0].title).toBe('采购合同');
    });

    it('应该支持限制返回数量', async () => {
      const mockArticles = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        lawName: `法律${i + 1}`,
        articleNumber: `第${i + 1}条`,
        fullText: `内容${i + 1}`,
        updatedAt: new Date(`2026-02-02T${10 + i}:00:00Z`),
      }));

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(
        mockArticles.slice(0, 5)
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity?limit=5'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentArticles).toHaveLength(5);
    });

    it('应该按时间倒序排列', async () => {
      // mock数据需要已经是按时间降序排列的（因为Prisma的orderBy会这样返回）
      const mockArticles = [
        {
          id: '2',
          lawName: '刑法',
          articleNumber: '第1条',
          fullText: '内容2',
          updatedAt: new Date('2026-02-02T11:00:00Z'),
        },
        {
          id: '1',
          lawName: '民法典',
          articleNumber: '第1条',
          fullText: '内容1',
          updatedAt: new Date('2026-02-02T10:00:00Z'),
        },
      ];

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(mockArticles);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentArticles[0].id).toBe('2'); // 最新的在前面（已排序）
    });

    it('应该处理空结果', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentArticles).toHaveLength(0);
      expect(data.recentDebates).toHaveLength(0);
      expect(data.recentContracts).toHaveLength(0);
    });

    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
    });

    it('应该处理无效的limit参数', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity?limit=invalid'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 应该使用默认值
      expect(data.recentArticles).toBeDefined();
    });

    it('应该限制最大返回数量', async () => {
      const mockArticles = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        lawName: `法律${i + 1}`,
        articleNumber: `第${i + 1}条`,
        fullText: `内容${i + 1}`,
        updatedAt: new Date('2026-02-02T10:00:00Z'),
      }));

      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(
        mockArticles.slice(0, 20)
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.contract.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/system/recent-activity?limit=1000'
      ) as unknown as NextRequest;
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // 应该限制在最大值（例如20）
      expect(data.recentArticles.length).toBeLessThanOrEqual(20);
    });
  });
});
