/**
 * 法条详情和更新API测试
 * 测试GET、PUT、DELETE接口
 */

import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '@/app/api/admin/law-articles/[id]/route';
import { prisma } from '@/lib/db/prisma';
import { LawType, LawCategory, LawStatus } from '@prisma/client';

// Mock依赖
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/middleware/permission-check');

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

const mockedGetAuthUser = getAuthUser as jest.Mock;
const mockedValidatePermissions = validatePermissions as jest.Mock;

describe('法条详情和更新API', () => {
  let mockArticleId: string;
  let mockArticle: Record<string, unknown>;

  beforeEach(() => {
    mockArticleId = 'test-article-id';
    mockArticle = {
      id: mockArticleId,
      lawName: '测试法条',
      articleNumber: '第一条',
      fullText: '这是测试法条的内容',
      lawType: LawType.LAW,
      category: LawCategory.CIVIL,
      subCategory: '合同',
      tags: ['合同', '民事'],
      keywords: ['合同法', '民事'],
      version: '1.0',
      effectiveDate: new Date('2020-01-01'),
      expiryDate: null,
      status: LawStatus.VALID,
      amendmentHistory: null,
      issuingAuthority: '全国人民代表大会',
      jurisdiction: '全国',
      relatedArticles: [],
      legalBasis: null,
      viewCount: 100,
      referenceCount: 50,
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
      parent: null,
      children: [],
    };

    jest.clearAllMocks();
  });

  const mockUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  describe('GET /api/admin/law-articles/[id]', () => {
    it('应该成功获取法条详情', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(mockArticle.id);
      expect(data.data.lawName).toBe(mockArticle.lawName);
      expect(data.message).toBe('获取法条详情成功');
    });

    it('应该返回401当用户未认证', async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await GET(request, { params });

      expect(response.status).toBe(401);
    });

    it('应该返回403当用户无权限', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(
        Response.json({ error: '权限不足' }, { status: 403 })
      );

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await GET(request, { params });

      expect(response.status).toBe(403);
    });

    it('应该返回404当法条不存在', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/admin/law-articles/non-existent-id'
      );
      const params = Promise.resolve({ id: 'non-existent-id' });

      const response = await GET(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('应该返回500当数据库查询失败', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await GET(request, { params });

      expect(response.status).toBe(500);
    });
  });

  describe('PUT /api/admin/law-articles/[id]', () => {
    it('应该成功更新法条', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticle,
        lawName: '更新后的法条名称',
      });

      const updateData = {
        lawName: '更新后的法条名称',
        articleNumber: '第一条',
        fullText: '更新后的法条内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('更新法条成功');
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: mockArticleId },
        data: expect.objectContaining({
          lawName: '更新后的法条名称',
          fullText: '更新后的法条内容',
          searchableText: '更新后的法条内容',
        }),
        include: expect.any(Object),
      });
    });

    it('应该返回400当请求格式错误', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);

      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;
      const params = Promise.resolve({ id: mockArticleId });

      const response = await PUT(request, { params });

      expect(response.status).toBe(400);
    });

    it('应该返回400当没有需要更新的字段', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify({}),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('没有需要更新的字段');
    });

    it('应该验证法律类型枚举值', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );

      const updateData = {
        lawType: 'INVALID_TYPE',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await PUT(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('无效的法律类型');
    });

    it('应该支持更新标签', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticle,
        tags: ['新标签1', '新标签2'],
      });

      const updateData = {
        tags: ['新标签1', '新标签2'],
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await PUT(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: mockArticleId },
        data: expect.objectContaining({
          tags: ['新标签1', '新标签2'],
        }),
        include: expect.any(Object),
      });
    });

    it('应该支持更新关键词', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticle,
        keywords: ['新关键词1', '新关键词2'],
      });

      const updateData = {
        keywords: ['新关键词1', '新关键词2'],
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await PUT(request, { params });

      expect(response.status).toBe(200);
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: mockArticleId },
        data: expect.objectContaining({
          keywords: ['新关键词1', '新关键词2'],
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('DELETE /api/admin/law-articles/[id]', () => {
    it('应该成功删除法条', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.delete as jest.Mock).mockResolvedValue({
        id: mockArticleId,
      });

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await DELETE(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('删除法条成功');
      expect(data.data).toEqual({ id: mockArticleId });
      expect(prisma.lawArticle.delete).toHaveBeenCalledWith({
        where: { id: mockArticleId },
      });
    });

    it('应该返回404当法条不存在', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/admin/law-articles/non-existent-id',
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: 'non-existent-id' });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(404);
    });

    it('应该返回500当数据库删除失败', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await DELETE(request, { params });

      expect(response.status).toBe(500);
    });
  });
});
