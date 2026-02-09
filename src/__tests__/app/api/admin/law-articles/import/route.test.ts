/**
 * 法条导入API测试
 *
 * 测试覆盖：
 * 1. 成功导入新法条
 * 2. 成功更新已存在的法条
 * 3. 批量导入（部分成功、部分失败）
 * 4. 数据验证失败
 * 5. 权限检查
 * 6. 错误处理
 */

import { POST } from '@/app/api/admin/law-articles/import/route';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { LawCategory, LawStatus, LawType } from '@prisma/client';
import { NextRequest } from 'next/server';

// Mock依赖
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/middleware/permission-check');

describe('POST /api/admin/law-articles/import', () => {
  const mockUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'ADMIN',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
    (validatePermissions as jest.Mock).mockResolvedValue(null);

    // 默认mock成功的数据库操作
    (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.lawArticle.create as jest.Mock).mockResolvedValue({
      id: 'article-1',
    });
    (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
      id: 'article-1',
    });
  });

  describe('成功导入', () => {
    it('应该成功导入新法条', async () => {
      const articleData = {
        lawName: '中华人民共和国民法典',
        articleNumber: '第一条',
        fullText: '为了保护民事主体的合法权益...',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({
            articles: [articleData],
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(1);
      expect(data.data.success).toBe(1);
      expect(data.data.failed).toBe(0);
      expect(data.data.errors).toHaveLength(0);
    });

    it('应该成功更新已存在的法条', async () => {
      const existingArticle = {
        id: 'article-1',
        lawName: '中华人民共和国民法典',
        articleNumber: '第一条',
        fullText: '旧内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        effectiveDate: new Date('2021-01-01'),
      };

      const updatedData = {
        lawName: '中华人民共和国民法典',
        articleNumber: '第一条',
        fullText: '新内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(
        existingArticle
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...existingArticle,
        fullText: updatedData.fullText,
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({
            articles: [updatedData],
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.success).toBe(1);
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: existingArticle.id },
        data: expect.objectContaining({
          fullText: updatedData.fullText,
        }),
      });
    });

    it('应该支持批量导入', async () => {
      const articles = [
        {
          lawName: '民法典',
          articleNumber: '第一条',
          fullText: '内容1',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: '2021-01-01',
        },
        {
          lawName: '民法典',
          articleNumber: '第二条',
          fullText: '内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: '2021-01-01',
        },
      ];

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total).toBe(2);
      expect(data.data.success).toBe(2);
      expect(data.data.failed).toBe(0);
    });

    it('应该支持数据源字段', async () => {
      const articleData = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({
            dataSource: 'judiciary',
            articles: [articleData],
          }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(1);
    });
  });

  describe('数据验证', () => {
    it('应该拒绝缺少lawName的法条', async () => {
      const invalidArticle = {
        lawName: '',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [invalidArticle] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('法条名称不能为空');
    });

    it('应该拒绝缺少articleNumber的法条', async () => {
      const invalidArticle = {
        lawName: '民法典',
        articleNumber: '',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [invalidArticle] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('法条编号不能为空');
    });

    it('应该拒绝缺少fullText的法条', async () => {
      const invalidArticle = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [invalidArticle] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('法条内容不能为空');
    });

    it('应该拒绝无效的lawType', async () => {
      const invalidArticle = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'INVALID_TYPE',
        category: 'CIVIL_GENERAL',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [invalidArticle] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('无效的法律类型');
    });

    it('应该拒绝无效的category', async () => {
      const invalidArticle = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'INVALID_CATEGORY',
        effectiveDate: '2021-01-01',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [invalidArticle] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('无效的法律类别');
    });

    it('应该拒绝缺少effectiveDate的法条', async () => {
      const invalidArticle = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [invalidArticle] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('生效日期不能为空');
    });

    it('应该拒绝空数组', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toContain('至少提供一条法条数据');
    });

    it('应该拒绝超过1000条的导入', async () => {
      const articles = Array(1001).fill({
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      });

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('单次最多导入1000条法条');
    });

    it('应该拒绝非数组的articles字段', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: 'not-an-array' }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('articles字段必须是数组');
    });
  });

  describe('批量导入（部分失败）', () => {
    it('应该正确处理部分成功、部分失败的情况', async () => {
      const articles = [
        {
          lawName: '民法典',
          articleNumber: '第一条',
          fullText: '内容1',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: '2021-01-01',
        },
        {
          lawName: '',
          articleNumber: '第二条',
          fullText: '内容2',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: '2021-01-01',
        },
        {
          lawName: '民法典',
          articleNumber: '第三条',
          fullText: '内容3',
          lawType: 'INVALID',
          category: 'CIVIL',
          effectiveDate: '2021-01-01',
        },
      ];

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.total).toBe(3);
      expect(data.data.success).toBe(1);
      expect(data.data.failed).toBe(2);
      expect(data.data.errors).toHaveLength(2);
    });
  });

  describe('权限检查', () => {
    it('应该拒绝未授权的请求', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('应该拒绝无权限的请求', async () => {
      const errorResponse = new Response(
        JSON.stringify({ success: false, message: '权限不足' }),
        { status: 403 }
      );
      (validatePermissions as jest.Mock).mockResolvedValue(errorResponse);

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [] }),
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe('错误处理', () => {
    it('应该处理无效的JSON', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: 'invalid-json',
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.message).toContain('请提供有效的JSON数据');
    });

    it('应该处理数据库错误', async () => {
      const articleData = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: '2021-01-01',
      };

      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.create as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [articleData] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.failed).toBe(1);
      expect(data.data.errors[0].reason).toContain('数据库错误');
    });
  });

  describe('可选字段', () => {
    it('应该支持所有可选字段', async () => {
      const articleData = {
        lawName: '民法典',
        articleNumber: '第一条',
        fullText: '内容',
        lawType: 'LAW',
        category: 'CIVIL',
        subCategory: '总则',
        tags: ['民事', '基本原则'],
        keywords: ['民事主体', '合法权益'],
        version: '2.0',
        effectiveDate: '2021-01-01',
        expiryDate: '2025-01-01',
        status: 'VALID',
        issuingAuthority: '全国人民代表大会',
        jurisdiction: '全国',
        searchableText: '自定义搜索文本',
        level: 1,
        sourceId: 'source-123',
      };

      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          body: JSON.stringify({ articles: [articleData] }),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.success).toBe(1);
      expect(prisma.lawArticle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          subCategory: '总则',
          tags: ['民事', '基本原则'],
          keywords: ['民事主体', '合法权益'],
          version: '2.0',
          level: 1,
        }),
      });
    });
  });
});
