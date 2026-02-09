/**
 * 关系反馈 API 路由测试
 *
 * 测试关系反馈的创建、查询和统计功能
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '../../../../../app/api/v1/feedbacks/relation/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    relationFeedback: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    lawArticleRelation: {
      findUnique: jest.fn(),
    },
  },
}));

describe('关系反馈 API 路由', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/feedbacks/relation - 创建关系反馈', () => {
    it('应该成功创建关系反馈', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        userId: 'user-1',
        relationId: 'relation-1',
        feedbackType: 'ACCURATE',
        comment: '这个关系很准确',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(prisma.lawArticleRelation.findUnique).mockResolvedValue({
        id: 'relation-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: 'CITES',
      } as never);

      jest
        .mocked(prisma.relationFeedback.create)
        .mockResolvedValue(mockFeedback as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            relationId: 'relation-1',
            feedbackType: 'ACCURATE',
            comment: '这个关系很准确',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('feedback-1');
      expect(data.data.feedbackType).toBe('ACCURATE');
    });

    it('应该验证必填字段', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            // 缺少 relationId
            feedbackType: 'ACCURATE',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('relationId');
    });

    it('应该验证反馈类型', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            relationId: 'relation-1',
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

    it('应该支持建议的关系类型', async () => {
      const mockFeedback = {
        id: 'feedback-1',
        userId: 'user-1',
        relationId: 'relation-1',
        feedbackType: 'WRONG_TYPE',
        suggestedRelationType: 'COMPLETES',
        comment: '应该是补全关系',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.mocked(prisma.lawArticleRelation.findUnique).mockResolvedValue({
        id: 'relation-1',
      } as never);

      jest
        .mocked(prisma.relationFeedback.create)
        .mockResolvedValue(mockFeedback as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            relationId: 'relation-1',
            feedbackType: 'WRONG_TYPE',
            suggestedRelationType: 'COMPLETES',
            comment: '应该是补全关系',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.suggestedRelationType).toBe('COMPLETES');
    });

    it('应该处理关系不存在的情况', async () => {
      jest.mocked(prisma.lawArticleRelation.findUnique).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            relationId: 'non-existent',
            feedbackType: 'ACCURATE',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('关系不存在');
    });

    it('应该处理数据库错误', async () => {
      jest.mocked(prisma.lawArticleRelation.findUnique).mockResolvedValue({
        id: 'relation-1',
      } as never);

      jest
        .mocked(prisma.relationFeedback.create)
        .mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'user-1',
            relationId: 'relation-1',
            feedbackType: 'ACCURATE',
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/feedbacks/relation - 查询关系反馈', () => {
    it('应该查询用户的反馈记录', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          relationId: 'relation-1',
          feedbackType: 'ACCURATE',
          createdAt: new Date(),
        },
        {
          id: 'feedback-2',
          userId: 'user-1',
          relationId: 'relation-2',
          feedbackType: 'INACCURATE',
          createdAt: new Date(),
        },
      ];

      jest
        .mocked(prisma.relationFeedback.findMany)
        .mockResolvedValue(mockFeedbacks as never);
      jest.mocked(prisma.relationFeedback.count).mockResolvedValue(2);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation?userId=user-1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.feedbacks).toHaveLength(2);
      expect(data.data.total).toBe(2);
    });

    it('应该按关系ID过滤', async () => {
      const mockFeedbacks = [
        {
          id: 'feedback-1',
          relationId: 'relation-1',
          feedbackType: 'ACCURATE',
        },
      ];

      jest
        .mocked(prisma.relationFeedback.findMany)
        .mockResolvedValue(mockFeedbacks as never);
      jest.mocked(prisma.relationFeedback.count).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation?relationId=relation-1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.feedbacks).toHaveLength(1);
      expect(prisma.relationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            relationId: 'relation-1',
          }),
        })
      );
    });

    it('应该按反馈类型过滤', async () => {
      jest
        .mocked(prisma.relationFeedback.findMany)
        .mockResolvedValue([] as never);
      jest.mocked(prisma.relationFeedback.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation?feedbackType=ACCURATE'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.relationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            feedbackType: 'ACCURATE',
          }),
        })
      );
    });

    it('应该支持分页', async () => {
      jest
        .mocked(prisma.relationFeedback.findMany)
        .mockResolvedValue([] as never);
      jest.mocked(prisma.relationFeedback.count).mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation?page=2&limit=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.limit).toBe(10);
      expect(data.data.pagination.total).toBe(50);
      expect(data.data.pagination.totalPages).toBe(5);
      expect(prisma.relationFeedback.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('应该获取反馈统计', async () => {
      const mockStats = [
        { feedbackType: 'ACCURATE', _count: { id: 15 } },
        { feedbackType: 'INACCURATE', _count: { id: 5 } },
        { feedbackType: 'WRONG_TYPE', _count: { id: 3 } },
      ];

      // @ts-expect-error - Prisma groupBy 类型循环引用问题
      jest
        .mocked(prisma.relationFeedback.groupBy)
        .mockResolvedValue(mockStats as never);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/feedbacks/relation?stats=true&relationId=relation-1'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.stats).toBeDefined();
      expect(data.data.stats.ACCURATE).toBe(15);
      expect(data.data.stats.INACCURATE).toBe(5);
    });
  });
});
