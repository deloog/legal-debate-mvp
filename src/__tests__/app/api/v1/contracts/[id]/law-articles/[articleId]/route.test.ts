/**
 * 合同法条关联删除API测试
 */

import { NextRequest } from 'next/server';
import { DELETE } from '@/app/api/v1/contracts/[id]/law-articles/[articleId]/route';
import { prisma } from '@/lib/db';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      findUnique: jest.fn(),
    },
    contractLawArticle: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe('DELETE /api/v1/contracts/[id]/law-articles/[articleId]', () => {
  const mockContractId = 'contract-123';
  const mockArticleId = 'article-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功删除法条关联', async () => {
    const mockContract = { id: mockContractId };
    const mockAssociation = {
      id: 'assoc-1',
      contractId: mockContractId,
      lawArticleId: mockArticleId,
    };

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
    (prisma.contractLawArticle.findUnique as jest.Mock).mockResolvedValue(
      mockAssociation
    );
    (prisma.contractLawArticle.delete as jest.Mock).mockResolvedValue(
      mockAssociation
    );

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles/${mockArticleId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { id: mockContractId, articleId: mockArticleId },
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('关联已删除');
    expect(prisma.contractLawArticle.delete).toHaveBeenCalledWith({
      where: {
        contractId_lawArticleId: {
          contractId: mockContractId,
          lawArticleId: mockArticleId,
        },
      },
    });
  });

  it('应该在合同不存在时返回404', async () => {
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles/${mockArticleId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { id: mockContractId, articleId: mockArticleId },
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('合同不存在');
  });

  it('应该在关联不存在时返回404', async () => {
    const mockContract = { id: mockContractId };

    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(mockContract);
    (prisma.contractLawArticle.findUnique as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles/${mockArticleId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { id: mockContractId, articleId: mockArticleId },
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('关联记录不存在');
  });

  it('应该处理数据库错误', async () => {
    (prisma.contract.findUnique as jest.Mock).mockRejectedValue(
      new Error('数据库错误')
    );

    const request = new NextRequest(
      `http://localhost:3000/api/v1/contracts/${mockContractId}/law-articles/${mockArticleId}`,
      { method: 'DELETE' }
    );

    const response = await DELETE(request, {
      params: { id: mockContractId, articleId: mockArticleId },
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('删除关联失败');
  });
});
