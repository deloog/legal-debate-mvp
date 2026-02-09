/**
 * 推荐反馈 API 路由测试
 *
 * 测试推荐反馈的创建、查询和统计功能
 */

import { NextRequest } from 'next/server';
import {
  POST,
  GET,
} from '../../../../../app/api/v1/feedbacks/recommendation/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    recommendationFeedback: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    lawArticle: {
      findUnique: jest.fn(),
    },
  },
}));

describe('推荐反馈 API 路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/feedbacks/recommendation - 创建推荐反馈', () => {
    it('应该成功创建推荐反馈', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        userId: 'user-1',
        lawArticleId: 'article-1',
        contextType: 'DEBATE',
        contextId: 'debate-1',
        feedbackType: 'HELPFUL',
        comment: '这个推荐很有用',
        metadata: { score: 0.95 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(prisma.lawArticle.findUnique).mockResolvedValue({
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '第1条',
      } as never);

      jest
        .mocked(prisma.recommendationFeedback.create)
        .mockResolvedValue(mockFeedback as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            lawArticleId: 'article-1',
            contextType: 'DEBATE',
            contextId: 'debate-1',
            feedbackType: 'HELPFUL',
            comment: '这个推荐很有用',
            metadata: { score: 0.95 },
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('feedback-1');
      expect(data.data.feedbackType).toBe('HELPFUL');
    });

    it('应该验证必填字段', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            // 缺少 lawArticleId
            contextType: 'DEBATE',
            feedbackType: 'HELPFUL',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('lawArticleId');
    });

    it('应该验证反馈类型', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            lawArticleId: 'article-1',
            contextType: 'DEBATE',
            feedbackType: 'INVALID_TYPE',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的反馈类型');
    });

    it('应该验证上下文类型', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            lawArticleId: 'article-1',
            contextType: 'INVALID_CONTEXT',
            feedbackType: 'HELPFUL',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的上下文类型');
    });

    it('应该处理法条不存在的情况', async () => {
      jest.mocked(prisma.lawArticle.findUnique).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            lawArticleId: 'non-existent',
            contextType: 'DEBATE',
            feedbackType: 'HELPFUL',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('法条不存在');
    });

    it('应该处理数据库错误', async () => {
      jest.mocked(prisma.lawArticle.findUnique).mockResolvedValue({
        id: 'article-1',
      } as never);

      jest
        .mocked(prisma.recommendationFeedback.create)
        .mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            lawArticleId: 'article-1',
            contextType: 'DEBATE',
            feedbackType: 'HELPFUL',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/feedbacks/recommendation - 查询推荐反馈', () => {
    it('应该查询用户的反馈记录', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          lawArticleId: 'article-1',
          contextType: 'DEBATE',
          feedbackType: 'HELPFUL',
          createdAt: new Date(),
        },
        {
          id: 'feedback-2',
          userId: 'user-1',
          lawArticleId: 'article-2',
          contextType: 'CONTRACT',
          feedbackType: 'NOT_HELPFUL',
          createdAt: new Date(),
        },
      ];

      jest
        .mocked(prisma.recommendationFeedback.findMany)
        .mockResolvedValue(mockFeedbacks as never);
      jest.mocked(prisma.recommendationFeedback.count).mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation?userId=user-1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('应该按法条ID过滤', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          lawArticleId: 'article-1',
          feedbackType: 'HELPFUL',
        },
      ];

      jest
        .mocked(prisma.recommendationFeedback.findMany)
        .mockResolvedValue(mockFeedbacks as never);
      jest.mocked(prisma.recommendationFeedback.count).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation?lawArticleId=article-1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.feedbacks).toHaveLength(1);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lawArticleId: 'article-1',
          }),
        })
      );
    });

    it('应该按上下文类型过滤', async () => {
      jest
        .mocked(prisma.recommendationFeedback.findMany)
        .mockResolvedValue([] as never);
      jest.mocked(prisma.recommendationFeedback.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation?contextType=DEBATE'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contextType: 'DEBATE',
          }),
        })
      );
    });

    it('应该支持分页', async () => {
      jest
        .mocked(prisma.recommendationFeedback.findMany)
        .mockResolvedValue([] as never);
      jest.mocked(prisma.recommendationFeedback.count).mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation?page=2&limit=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.limit).toBe(10);
      expect(data.data.pagination.total).toBe(50);
      expect(data.data.pagination.totalPages).toBe(5);
      expect(prisma.recommendationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('应该获取反馈统计', async () => {
      const mockStats = [
        { feedbackType: 'HELPFUL', _count: { id: 10 } },
        { feedbackType: 'NOT_HELPFUL', _count: { id: 3 } },
        { feedbackType: 'IRRELEVANT', _count: { id: 2 } },
      ];

      // @ts-expect-error - Prisma groupBy 类型循环引用问题
      jest
        .mocked(prisma.recommendationFeedback.groupBy)
        .mockResolvedValue(mockStats as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/recommendation?stats=true&lawArticleId=article-1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats.HELPFUL).toBe(10);
      expect(data.data.stats.NOT_HELPFUL).toBe(3);
    });
  });
});
