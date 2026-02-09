/**
 * 反馈列表API测试
 *
 * 测试反馈列表API的功能
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/feedbacks/list/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    recommendationFeedback: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    relationFeedback: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('GET /api/v1/feedbacks/list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该返回推荐反馈列表', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          lawArticleId: 'article-1',
          contextType: 'DEBATE',
          contextId: 'debate-1',
          feedbackType: 'HELPFUL',
          comment: '很有帮助',
          createdAt: new Date('2026-01-15'),
          lawArticle: {
            id: 'article-1',
            lawName: '民法典',
            articleNumber: '第1条',
          },
        },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(1);
      expect(data.data.feedbacks[0].id).toBe('feedback-1');
      expect(data.data.total).toBe(1);
    });

    it('应该返回关系反馈列表', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          relationId: 'relation-1',
          feedbackType: 'ACCURATE',
          comment: '关系准确',
          createdAt: new Date('2026-01-15'),
          relation: {
            id: 'relation-1',
            sourceArticleId: 'article-1',
            targetArticleId: 'article-2',
            relationType: 'CITES',
          },
        },
      ];

      (prisma.relationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );
      (prisma.relationFeedback.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=relation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(1);
      expect(data.data.feedbacks[0].id).toBe('feedback-1');
      expect(data.data.total).toBe(1);
    });

    it('应该支持分页', async () => {
      const mockFeedbacks = Array.from({ length: 10 }, (_, i) => ({
        id: `feedback-${i + 1}`,
        userId: 'user-1',
        lawArticleId: 'article-1',
        contextType: 'GENERAL',
        feedbackType: 'HELPFUL',
        createdAt: new Date('2026-01-15'),
      }));

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&page=2&pageSize=10'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(10);
      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.pageSize).toBe(10);
      expect(data.data.pagination.totalPages).toBe(5);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('应该支持按反馈类型过滤', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          lawArticleId: 'article-1',
          contextType: 'GENERAL',
          feedbackType: 'HELPFUL',
          createdAt: new Date('2026-01-15'),
        },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&feedbackType=HELPFUL'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            feedbackType: 'HELPFUL',
          }),
        })
      );
    });

    it('应该支持按用户ID过滤', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          lawArticleId: 'article-1',
          contextType: 'GENERAL',
          feedbackType: 'HELPFUL',
          createdAt: new Date('2026-01-15'),
        },
      ];

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&userId=user-1'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('应该支持按时间范围过滤', async () => {
      const startDate = '2026-01-01';
      const endDate = '2026-01-31';

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/feedbacks/list?type=recommendation&startDate=${startDate}&endDate=${endDate}`
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date(startDate),
              lte: new Date(endDate),
            },
          }),
        })
      );
    });

    it('应该支持排序', async () => {
      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&sortBy=createdAt&sortOrder=asc'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'asc',
          },
        })
      );
    });
  });

  describe('参数验证', () => {
    it('应该拒绝缺少type参数的请求', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('type');
    });

    it('应该拒绝无效的type参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=invalid'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('type');
    });

    it('应该拒绝无效的页码', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&page=0'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('page');
    });

    it('应该拒绝无效的pageSize', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&pageSize=0'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('pageSize');
    });

    it('应该限制最大pageSize', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&pageSize=200'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('pageSize');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      (prisma.recommendationFeedback.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('获取反馈列表失败');
    });

    it('应该处理空结果', async () => {
      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(0);
      expect(data.data.total).toBe(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理最后一页', async () => {
      const mockFeedbacks = Array.from({ length: 5 }, (_, i) => ({
        id: `feedback-${i + 1}`,
        userId: 'user-1',
        lawArticleId: 'article-1',
        contextType: 'GENERAL',
        feedbackType: 'HELPFUL',
        createdAt: new Date('2026-01-15'),
      }));

      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        mockFeedbacks
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(25);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&page=3&pageSize=10'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(5);
      expect(data.data.pagination.page).toBe(3);
      expect(data.data.pagination.totalPages).toBe(3);
    });

    it('应该处理超出范围的页码', async () => {
      (prisma.recommendationFeedback.findMany as jest.Mock).mockResolvedValue(
        []
      );
      (prisma.recommendationFeedback.count as jest.Mock).mockResolvedValue(10);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/list?type=recommendation&page=10&pageSize=10'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(0);
    });
  });
});
