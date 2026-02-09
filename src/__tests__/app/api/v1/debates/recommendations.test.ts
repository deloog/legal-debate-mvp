/**
 * 辩论推荐API路由测试
 * 测试 GET /api/v1/debates/[id]/recommendations
 * 覆盖率目标：90%+
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/debates/[id]/recommendations/route';
import { prisma } from '@/lib/db';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    debate: {
      findUnique: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/law-article/recommendation-service');

describe('GET /api/v1/debates/[id]/recommendations', () => {
  const mockDebateId = 'debate_123';
  const mockCaseId = 'case_456';

  const mockDebate = {
    id: mockDebateId,
    caseId: mockCaseId,
    userId: 'user_789',
    title: '测试辩论',
    status: 'IN_PROGRESS',
    currentRound: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockCase = {
    id: mockCaseId,
    userId: 'user_789',
    title: '劳动合同纠纷案',
    description: '原告与被告因劳动合同解除产生纠纷',
    type: 'LABOR',
    cause: '劳动合同纠纷',
    status: 'IN_PROGRESS',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockRecommendations = [
    {
      article: {
        id: 'article_1',
        lawName: '劳动合同法',
        articleNumber: '第39条',
        fullText: '劳动者有下列情形之一的，用人单位可以解除劳动合同...',
        category: 'LABOR',
        effectiveDate: new Date('2008-01-01'),
        status: 'EFFECTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        keywords: ['解除', '劳动合同'],
        tags: ['劳动法'],
      },
      score: 0.95,
      reason: '案件类型匹配，关键词匹配: 劳动合同、解除',
      relationType: undefined,
    },
    {
      article: {
        id: 'article_2',
        lawName: '劳动合同法',
        articleNumber: '第46条',
        fullText: '有下列情形之一的，用人单位应当向劳动者支付经济补偿...',
        category: 'LABOR',
        effectiveDate: new Date('2008-01-01'),
        status: 'EFFECTIVE',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        keywords: ['经济补偿', '劳动合同'],
        tags: ['劳动法'],
      },
      score: 0.88,
      reason: '案件类型匹配，关键词匹配: 劳动合同',
      relationType: undefined,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该成功返回辩论推荐法条', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recommendations).toHaveLength(2);
      expect(data.recommendations[0]).toMatchObject({
        article: expect.objectContaining({
          id: 'article_1',
          lawName: '劳动合同法',
          articleNumber: '第39条',
        }),
        score: 0.95,
        reason: expect.stringContaining('案件类型匹配'),
      });

      // Verify service was called with correct parameters
      expect(
        LawArticleRecommendationService.recommendForDebate
      ).toHaveBeenCalledWith(
        {
          title: mockCase.title,
          description: mockCase.description,
          type: mockCase.type,
          keywords: ['劳动合同纠纷'],
        },
        { limit: 10, minScore: 0 }
      );
    });

    it('应该支持自定义limit参数', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue(mockRecommendations.slice(0, 1));

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?limit=5`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForDebate
      ).toHaveBeenCalledWith(expect.any(Object), { limit: 5, minScore: 0 });
    });

    it('应该支持自定义minScore参数', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue(mockRecommendations.filter(r => r.score >= 0.9));

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?minScore=0.9`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForDebate
      ).toHaveBeenCalledWith(expect.any(Object), { limit: 10, minScore: 0.9 });
    });

    it('应该在没有推荐结果时返回空数组', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recommendations).toEqual([]);
    });
  });

  describe('错误场景', () => {
    it('应该在辩论不存在时返回404', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('辩论不存在');
    });

    it('应该在案件不存在时返回404', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('关联案件不存在');
    });

    it('应该在limit参数无效时返回400', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?limit=-1`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('limit');
    });

    it('应该在minScore参数无效时返回400', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?minScore=1.5`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('minScore');
    });

    it('应该在数据库错误时返回500', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取推荐失败');
    });

    it('应该在推荐服务错误时返回500', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockRejectedValue(new Error('Recommendation service error'));

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取推荐失败');
    });
  });

  describe('边界条件', () => {
    it('应该处理limit为0的情况', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?limit=0`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('应该处理limit超过最大值的情况', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?limit=1000`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      // 应该限制为最大值（例如100）
      expect(
        LawArticleRecommendationService.recommendForDebate
      ).toHaveBeenCalledWith(expect.any(Object), { limit: 100, minScore: 0 });
    });

    it('应该处理minScore为0的情况', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?minScore=0`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该处理minScore为1的情况', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations?minScore=1`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const response = await GET(request, params);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recommendations).toEqual([]);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内返回结果', async () => {
      // Arrange
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (
        LawArticleRecommendationService.recommendForDebate as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/debates/${mockDebateId}/recommendations`
      );
      const params = { params: { id: mockDebateId } };

      // Act
      const startTime = Date.now();
      const response = await GET(request, params);
      const endTime = Date.now();
      await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
