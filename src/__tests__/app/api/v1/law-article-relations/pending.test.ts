/**
 * 待审核关系列表API测试
 * 测试覆盖率目标：90%+
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/law-article-relations/pending/route';
import { prisma } from '@/lib/db';
import {
  VerificationStatus,
  RelationType,
  DiscoveryMethod,
} from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
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
    VERIFY_RELATION: 'verify_relation',
  },
  KnowledgeGraphResource: {
    RELATION: 'law_article_relation',
  },
}));

describe('GET /api/v1/law-article-relations/pending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该返回待审核关系列表（默认参数）', async () => {
      const mockRelations = [
        {
          id: 'rel1',
          sourceId: 'article1',
          targetId: 'article2',
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.85,
          description: '引用关系',
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
          verificationStatus: VerificationStatus.PENDING,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
          evidence: null,
          verifiedBy: null,
          verifiedAt: null,
          addedByExpertId: 'expert1',
          createdBy: 'system',
          rejectionReason: null,
          aiProvider: null,
          aiModel: null,
          aiConfidence: null,
          aiReasoning: null,
          aiCreatedAt: null,
          reviewHistory: null,
          source: {
            id: 'article1',
            lawName: '民法典',
            articleNumber: '第1条',
            fullText: '为了保护民事主体的合法权益...',
          },
          target: {
            id: 'article2',
            lawName: '民法典',
            articleNumber: '第2条',
            fullText: '民法调整平等主体的自然人...',
          },
        },
      ];

      jest
        .mocked(prisma.lawArticleRelation.findMany)
        .mockResolvedValue(mockRelations);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations).toHaveLength(1);
      expect(data.data.relations[0].id).toBe('rel1');
      expect(data.data.pagination.total).toBe(1);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.pageSize).toBe(20);
    });

    it('应该支持分页参数', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?page=2&pageSize=10'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
      expect(data.data.pagination.page).toBe(2);
      expect(data.data.pagination.pageSize).toBe(10);
      expect(data.data.pagination.totalPages).toBe(5);
    });

    it('应该支持按关系类型过滤', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?relationType=CITES'
      );
      await GET(request);

      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            relationType: RelationType.CITES,
          }),
        })
      );
    });

    it('应该支持按发现方式过滤', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?discoveryMethod=AI_DETECTED'
      );
      await GET(request);

      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
          }),
        })
      );
    });

    it('应该支持按最小置信度过滤', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?minConfidence=0.8'
      );
      await GET(request);

      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { gte: 0.8 },
          }),
        })
      );
    });

    it('应该支持组合过滤条件', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?relationType=CITES&discoveryMethod=AI_DETECTED&minConfidence=0.7'
      );
      await GET(request);

      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            relationType: RelationType.CITES,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
            confidence: { gte: 0.7 },
          }),
        })
      );
    });

    it('应该返回空列表当没有待审核关系时', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.relations).toHaveLength(0);
      expect(data.data.pagination.total).toBe(0);
    });
  });

  describe('参数验证', () => {
    it('应该拒绝无效的页码', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?page=0'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('页码必须大于0');
    });

    it('应该拒绝无效的每页数量', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?pageSize=0'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('每页数量必须在1-100之间');
    });

    it('应该拒绝过大的每页数量', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?pageSize=101'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('每页数量必须在1-100之间');
    });

    it('应该拒绝无效的关系类型', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?relationType=INVALID'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的关系类型');
    });

    it('应该拒绝无效的发现方式', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?discoveryMethod=INVALID'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('无效的发现方式');
    });

    it('应该拒绝无效的最小置信度', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?minConfidence=1.5'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('最小置信度必须在0-1之间');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库查询错误', async () => {
      jest
        .mocked(prisma.lawArticleRelation.findMany)
        .mockRejectedValue(new Error('数据库连接失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('获取待审核关系失败');
    });

    it('应该处理计数查询错误', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest
        .mocked(prisma.lawArticleRelation.count)
        .mockRejectedValue(new Error('计数失败'));

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('应该处理超出范围的页码', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(10);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?page=100'
      );
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.relations).toHaveLength(0);
      expect(data.data.pagination.page).toBe(100);
    });

    it('应该处理最小置信度为0', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?minConfidence=0'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { gte: 0 },
          }),
        })
      );
    });

    it('应该处理最小置信度为1', async () => {
      jest.mocked(prisma.lawArticleRelation.findMany).mockResolvedValue([]);
      jest.mocked(prisma.lawArticleRelation.count).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-article-relations/pending?minConfidence=1'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            confidence: { gte: 1 },
          }),
        })
      );
    });
  });
});
