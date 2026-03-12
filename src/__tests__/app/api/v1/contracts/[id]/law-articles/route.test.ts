/**
 * 合同法条关联API测试
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/v1/contracts/[id]/law-articles/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      findUnique: jest.fn(),
    },
    lawArticle: {
      findUnique: jest.fn(),
    },
    contractLawArticle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('GET /api/v1/contracts/[id]/law-articles', () => {
  const mockContractId = 'contract-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功获取已关联的法条', async () => {
    // Mock数据
    const mockContract = { id: mockContractId };
    const mockAssociations = [
      {
        id: 'assoc-1',
        contractId: mockContractId,
        lawArticleId: 'article-1',
        addedBy: 'user-1',
        addedAt: new Date('2024-01-01'),
        reason: '测试原因',
        relevanceScore: 0.9,
        lawArticle: {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '第1条',
          fullText: '测试内容',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['测试'],
          effectiveDate: new Date('2021-01-01'),
          status: 'VALID',
        },
      },
    ];

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
    (prisma.contractLawArticle.findMany as jest.Mock).mockResolvedValue(
      mockAssociations
    );

    // 创建请求
    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`
    );

    // 调用API
    const response = await GET(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    // 验证
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.lawArticles).toHaveLength(1);
    expect(data.lawArticles[0].id).toBe('article-1');
    expect(data.lawArticles[0].associationId).toBe('assoc-1');
    expect(data.metadata.totalCount).toBe(1);
  });

  it('应该在合同不存在时返回404', async () => {
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('合同不存在');
  });

  it('应该处理数据库错误', async () => {
    (prisma.contract.findUnique as jest.Mock).mockRejectedValue(
      new Error('数据库错误')
    );

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`
    );

    const response = await GET(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('获取关联法条失败');
  });
});

describe('POST /api/v1/contracts/[id]/law-articles', () => {
  const mockContractId = 'contract-123';
  const mockLawArticleId = 'article-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功添加法条关联', async () => {
    const mockContract = { id: mockContractId };
    const mockLawArticle = { id: mockLawArticleId };
    const mockAssociation = {
      id: 'assoc-1',
      contractId: mockContractId,
      lawArticleId: mockLawArticleId,
      addedBy: mockUserId,
      addedAt: new Date('2024-01-01'),
      reason: '测试原因',
      relevanceScore: 0.9,
      lawArticle: {
        id: mockLawArticleId,
        lawName: '民法典',
        articleNumber: '第1条',
        fullText: '测试内容',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: ['测试'],
        effectiveDate: new Date('2021-01-01'),
        status: 'VALID',
      },
    };

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
    (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
      mockLawArticle
    );
    (prisma.contractLawArticle.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.contractLawArticle.create as jest.Mock).mockResolvedValue(
      mockAssociation
    );

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`,
      {
        method: 'POST',
        body: JSON.stringify({
          lawArticleId: mockLawArticleId,
          addedBy: mockUserId,
          reason: '测试原因',
          relevanceScore: 0.9,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.association.id).toBe(mockLawArticleId);
    expect(data.association.associationId).toBe('assoc-1');
  });

  it('应该验证必需字段', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('lawArticleId是必需的');
  });

  it('应该验证相关性分数范围', async () => {
    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`,
      {
        method: 'POST',
        body: JSON.stringify({
          lawArticleId: mockLawArticleId,
          addedBy: mockUserId,
          relevanceScore: 1.5, // 超出范围
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('relevanceScore必须是0到1之间的数字');
  });

  it('应该在合同不存在时返回404', async () => {
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`,
      {
        method: 'POST',
        body: JSON.stringify({
          lawArticleId: mockLawArticleId,
          addedBy: mockUserId,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('合同不存在');
  });

  it('应该在法条不存在时返回404', async () => {
    const mockContract = { id: mockContractId };

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
    (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`,
      {
        method: 'POST',
        body: JSON.stringify({
          lawArticleId: mockLawArticleId,
          addedBy: mockUserId,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('法条不存在');
  });

  it('应该在关联已存在时返回409', async () => {
    const mockContract = { id: mockContractId };
    const mockLawArticle = { id: mockLawArticleId };
    const existingAssociation = { id: 'assoc-1' };

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
    (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
      mockLawArticle
    );
    (prisma.contractLawArticle.findUnique as jest.Mock).mockResolvedValue(
      existingAssociation
    );

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles`,
      {
        method: 'POST',
        body: JSON.stringify({
          lawArticleId: mockLawArticleId,
          addedBy: mockUserId,
        }),
      }
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: mockContractId }),
    });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe('该法条已经关联到此合同');
  });
});
