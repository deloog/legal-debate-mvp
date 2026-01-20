/**
 * 法条审核API测试
 * 测试POST审核接口
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/admin/law-articles/[id]/review/route';
import { prisma } from '@/lib/db/prisma';
import { LawStatus } from '@prisma/client';

// Mock依赖
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/middleware/permission-check');

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

const mockedGetAuthUser = getAuthUser as jest.Mock;
const mockedValidatePermissions = validatePermissions as jest.Mock;

describe('法条审核API', () => {
  let mockArticleId: string;
  let mockArticle: Record<string, unknown>;

  beforeEach(() => {
    mockArticleId = 'test-article-id';
    mockArticle = {
      id: mockArticleId,
      lawName: '测试法条',
      articleNumber: '第一条',
      fullText: '这是测试法条的内容',
      lawType: 'LAW',
      category: 'CIVIL',
      status: LawStatus.DRAFT,
      version: '1.0',
      effectiveDate: new Date('2020-01-01'),
      viewCount: 100,
      referenceCount: 50,
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
      parent: null,
      children: [],
    };

    jest.clearAllMocks();
    // 重置mock实现
    (prisma.lawArticle.findUnique as jest.Mock).mockReset();
    (prisma.lawArticle.update as jest.Mock).mockReset();
    mockedGetAuthUser.mockReset();
    mockedValidatePermissions.mockReset();

    // 设置默认mock行为
    (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(mockArticle);
    (prisma.lawArticle.update as jest.Mock).mockResolvedValue(mockArticle);
  });

  const mockUser = {
    id: 'admin-123',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  describe('POST /api/admin/law-articles/[id]/review', () => {
    it('应该成功通过审核', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticle,
        status: LawStatus.VALID,
      });

      const reviewData = {
        status: 'APPROVED',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('审核法条成功');
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: mockArticleId },
        data: { status: LawStatus.VALID },
        include: expect.any(Object),
      });
    });

    it('应该成功拒绝审核', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticle,
        status: LawStatus.DRAFT,
      });

      const reviewData = {
        status: 'REJECTED',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: mockArticleId },
        data: { status: LawStatus.DRAFT },
        include: expect.any(Object),
      });
    });

    it('应该支持审核备注', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticle,
        status: LawStatus.VALID,
      });

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const reviewData = {
        status: 'APPROVED',
        comment: '审核通过',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });

      expect(consoleSpy).toHaveBeenCalledWith(
        `审核法条 ${mockArticleId}: ${reviewData.status}, 备注: ${reviewData.comment}`
      );

      consoleSpy.mockRestore();
    });

    it('应该返回401当用户未认证', async () => {
      mockedGetAuthUser.mockResolvedValue(null);

      const reviewData = {
        status: 'APPROVED',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });

      expect(response.status).toBe(401);
    });

    it('应该返回403当用户无权限', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(
        Response.json({ error: '权限不足' }, { status: 403 })
      );

      const reviewData = {
        status: 'APPROVED',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });

      expect(response.status).toBe(403);
    });

    it('应该返回404当法条不存在', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const reviewData = {
        status: 'APPROVED',
      };

      const request = new NextRequest(
        'http://localhost/api/admin/law-articles/non-existent-id/review',
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: 'non-existent-id' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('应该返回400当请求格式错误', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);

      const request = {
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as NextRequest;
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });

      expect(response.status).toBe(400);
    });

    it('应该返回400当缺少审核状态', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      // 确保findUnique返回mockArticle
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );

      const reviewData = {};

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('无效的审核状态');
    });

    it('应该返回400当审核状态无效', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );

      const reviewData = {
        status: 'INVALID_STATUS',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('无效的审核状态');
    });

    it('应该返回500当数据库更新失败', async () => {
      mockedGetAuthUser.mockResolvedValue(mockUser);
      mockedValidatePermissions.mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const reviewData = {
        status: 'APPROVED',
      };

      const request = new NextRequest(
        `http://localhost/api/admin/law-articles/${mockArticleId}/review`,
        {
          method: 'POST',
          body: JSON.stringify(reviewData),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const params = Promise.resolve({ id: mockArticleId });

      const response = await POST(request, { params });

      expect(response.status).toBe(500);
    });
  });
});
