/**
 * 反馈统计API测试
 *
 * 测试反馈统计API的功能
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/feedbacks/stats/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    recommendationFeedback: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    relationFeedback: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('GET /api/v1/feedbacks/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该返回推荐反馈统计', async () => {
      // Mock数据
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(100);
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { feedbackType: 60 } },
        { feedbackType: 'NOT_HELPFUL', _count: { feedbackType: 30 } },
        { feedbackType: 'IRRELEVANT', _count: { feedbackType: 10 } },
      ]);
      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(100);
      expect(data.data.byType).toHaveLength(3);
      expect(data.data.byType[0].feedbackType).toBe('HELPFUL');
      expect(data.data.byType[0].count).toBe(60);
    });

    it('应该返回关系反馈统计', async () => {
      // Mock数据
      (prisma.relationFeedback.count as jest.Mock).mockResolvedValue(50);
      (prisma.relationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'ACCURATE', _count: { feedbackType: 30 } },
        { feedbackType: 'INACCURATE', _count: { feedbackType: 15 } },
        { feedbackType: 'WRONG_TYPE', _count: { feedbackType: 5 } },
      ]);
      (prisma.relationFeedback.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=relation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(50);
      expect(data.data.byType).toHaveLength(3);
      expect(data.data.byType[0].feedbackType).toBe('ACCURATE');
      expect(data.data.byType[0].count).toBe(30);
    });

    it('应该支持按时间范围过滤', async () => {
      const startDate = '2026-01-01';
      const endDate = '2026-01-31';

      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(50);
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { id: 30 } },
        { feedbackType: 'NOT_HELPFUL', _count: { id: 20 } },
      ]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&startDate=${startDate}&endDate=${endDate}`
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.recommendationFeedback.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        },
      });
    });

    it('应该支持按上下文类型过滤', async () => {
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(30);
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { id: 20 } },
        { feedbackType: 'NOT_HELPFUL', _count: { id: 10 } },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&contextType=DEBATE'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.recommendationFeedback.count).toHaveBeenCalledWith({
        where: {
          contextType: 'DEBATE',
        },
      });
    });

    it('应该返回趋势数据', async () => {
      const mockTrendData = [
        { date: '2026-01-01', count: 10 },
        { date: '2026-01-02', count: 15 },
        { date: '2026-01-03', count: 20 },
      ];

      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(45);
      (prisma.recommendationFeedback.groupBy as jest.Mock)
        .mockResolvedValueOnce([
          { feedbackType: 'HELPFUL', _count: { id: 30 } },
        ])
        .mockResolvedValueOnce(
          mockTrendData.map(item => ({
            createdAt: new Date(item.date),
            _count: { id: item.count },
          }))
        );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&includeTrend=true'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.trend).toBeDefined();
      expect(data.data.trend).toHaveLength(3);
    });
  });

  describe('参数验证', () => {
    it('应该拒绝缺少type参数的请求', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('type');
    });

    it('应该拒绝无效的type参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('type');
    });

    it('应该拒绝无效的日期格式', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&startDate=invalid-date'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('日期');
    });

    it('应该拒绝无效的contextType', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&contextType=INVALID'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('contextType');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      (prisma.recommendationFeedback.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('获取反馈统计失败');
    });

    it('应该处理空数据情况', async () => {
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(0);
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue(
        []
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(0);
      expect(data.data.byType).toHaveLength(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理大量数据', async () => {
      const largeCount = 1000000;
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(
        largeCount
      );
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { id: largeCount } },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(largeCount);
    });

    it('应该处理跨年度查询', async () => {
      const startDate = '2025-12-01';
      const endDate = '2026-01-31';

      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(100);
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { id: 60 } },
      ]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&startDate=${startDate}&endDate=${endDate}`
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该处理同一天的查询', async () => {
      const date = '2026-01-15';

      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(10);
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { id: 10 } },
      ]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/feedbacks/stats?type=recommendation&startDate=${date}&endDate=${date}`
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内返回结果', async () => {
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(
        1000
      );
      (prisma.recommendationFeedback.groupBy as jest.Mock).mockResolvedValue([
        { feedbackType: 'HELPFUL', _count: { id: 600 } },
        { feedbackType: 'NOT_HELPFUL', _count: { id: 400 } },
      ]);

      const startTime = Date.now();
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/stats?type=recommendation'
      );
      await GET(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
