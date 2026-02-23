/**
 * 合同推荐API路由测试
 * 测试 GET /api/v1/contracts/[id]/recommendations
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/contracts/[id]/recommendations/route';
import { prisma } from '@/lib/db';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/law-article/recommendation-service');

describe('GET /api/v1/contracts/[id]/recommendations', () => {
  const mockContractId = 'contract-123';
  const mockContract = {
    id: mockContractId,
    contractNumber: 'HT-2024-001',
    caseType: '合同纠纷',
    caseSummary: '买卖合同纠纷案件',
    scope: '代理诉讼',
    status: 'SIGNED',
  };

  const mockDate = new Date('2026-02-03T16:10:27.502Z');
  const mockRecommendations = [
    {
      article: {
        id: 'article-1',
        lawName: '中华人民共和国民法典',
        articleNumber: '第470条',
        fullText: '合同的内容由当事人约定...',
        category: 'CIVIL',
        effectiveDate: new Date('2021-01-01'),
        status: 'ACTIVE',
        createdAt: mockDate,
        updatedAt: mockDate,
      },
      score: 0.85,
      reason: '基于合同类型推荐的相关法条',
    },
    {
      article: {
        id: 'article-2',
        lawName: '中华人民共和国民法典',
        articleNumber: '第577条',
        fullText: '当事人一方不履行合同义务...',
        category: 'CIVIL',
        effectiveDate: new Date('2021-01-01'),
        status: 'ACTIVE',
        createdAt: mockDate,
        updatedAt: mockDate,
      },
      score: 0.75,
      reason: '该法条补充完善了此法条',
      relationType: 'COMPLETES',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('成功场景', () => {
    it('应该成功获取合同推荐法条（默认参数）', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recommendations).toHaveLength(mockRecommendations.length);
      expect(data.recommendations[0].article.id).toBe(
        mockRecommendations[0].article.id
      );
      expect(data.recommendations[0].score).toBe(mockRecommendations[0].score);
      expect(data.recommendations[0].reason).toBe(
        mockRecommendations[0].reason
      );
      expect(data.metadata).toEqual({
        contractId: mockContract.id,
        contractNumber: mockContract.contractNumber,
        caseType: mockContract.caseType,
        totalCount: mockRecommendations.length,
      });

      // 验证调用参数
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        {
          type: mockContract.caseType,
          content: mockContract.caseSummary,
          existingArticles: [],
        },
        {
          limit: 10,
          minScore: 0,
        }
      );
    });

    it('应该支持自定义limit参数', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?limit=5`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          limit: 5,
        })
      );
    });

    it('应该支持自定义minScore参数', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?minScore=0.5`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          minScore: 0.5,
        })
      );
    });

    it('应该支持同时使用limit和minScore参数', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?limit=20&minScore=0.3`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(expect.any(Object), {
        limit: 20,
        minScore: 0.3,
      });
    });

    it('应该限制limit最大值为100', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?limit=200`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const __data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          limit: 100, // 应该被限制为100
        })
      );
    });

    it('应该返回空数组当没有推荐时', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.recommendations).toEqual([]);
      expect(data.metadata.totalCount).toBe(0);
    });
  });

  describe('参数验证', () => {
    it('应该拒绝无效的limit参数（非数字）', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?limit=abc`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('limit参数必须是大于0的整数');
    });

    it('应该拒绝无效的limit参数（小于等于0）', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?limit=0`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('limit参数必须是大于0的整数');
    });

    it('应该拒绝无效的minScore参数（非数字）', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?minScore=invalid`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('minScore参数必须是0到1之间的数字');
    });

    it('应该拒绝无效的minScore参数（小于0）', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?minScore=-0.5`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('minScore参数必须是0到1之间的数字');
    });

    it('应该拒绝无效的minScore参数（大于1）', async () => {
      // Arrange
      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?minScore=1.5`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('minScore参数必须是0到1之间的数字');
    });
  });

  describe('错误处理', () => {
    it('应该返回404当合同不存在', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('合同不存在');
    });

    it('应该处理数据库查询错误', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取推荐失败');
    });

    it('应该处理推荐服务错误', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockRejectedValue(new Error('Recommendation service error'));

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('获取推荐失败');
    });
  });

  describe('边界情况', () => {
    it('应该处理合同信息不完整的情况', async () => {
      // Arrange
      const incompleteContract = {
        id: mockContractId,
        contractNumber: 'HT-2024-001',
        caseType: '合同纠纷',
        caseSummary: '',
        scope: '',
        status: 'DRAFT',
      };

      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(
        incompleteContract
      );
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        {
          type: incompleteContract.caseType,
          content: incompleteContract.caseSummary,
          existingArticles: [],
        },
        expect.any(Object)
      );
    });

    it('应该处理limit为边界值1', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue([mockRecommendations[0]]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?limit=1`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          limit: 1,
        })
      );
    });

    it('应该处理minScore为边界值0', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue(mockRecommendations);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?minScore=0`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          minScore: 0,
        })
      );
    });

    it('应该处理minScore为边界值1', async () => {
      // Arrange
      (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
      (
        LawArticleRecommendationService.recommendForContract as jest.Mock
      ).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/contracts/${mockContractId}/recommendations?minScore=1`
      );

      // Act
      const response = await GET(request, { params: { id: mockContractId } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        LawArticleRecommendationService.recommendForContract
      ).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          minScore: 1,
        })
      );
    });
  });
});
