/**
 * 法条库管理API测试
 * 测试法条列表、导入、审核功能
 */

import { POST as POST_REVIEW } from '@/app/api/admin/law-articles/[id]/review/route';
import { POST as POST_IMPORT } from '@/app/api/admin/law-articles/import/route';
import { GET } from '@/app/api/admin/law-articles/route';
import { prisma } from '@/lib/db/prisma';
import { LawStatus } from '@prisma/client';
import { NextRequest } from 'next/server';

// =============================================================================
// Mock设置
// =============================================================================

// Mock Prisma客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawArticle: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock权限检查中间件
jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

// Mock认证中间件
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

// =============================================================================
// 测试数据
// =============================================================================

const mockArticles = [
  {
    id: '1',
    lawName: '中华人民共和国民法典',
    articleNumber: '第一条',
    fullText: '为了保护民事主体的合法权益...',
    lawType: 'CIVIL',
    category: 'CIVIL_GENERAL',
    subCategory: null,
    status: 'VALID',
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    viewCount: 100,
    referenceCount: 50,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    lawName: '中华人民共和国刑法',
    articleNumber: '第一条',
    fullText: '为了惩罚犯罪，保护人民...',
    lawType: 'CRIMINAL',
    category: 'CRIMINAL_GENERAL',
    subCategory: null,
    status: 'VALID',
    version: '1.0',
    effectiveDate: new Date('2020-12-26'),
    viewCount: 200,
    referenceCount: 80,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    lawName: '中华人民共和国行政法',
    articleNumber: '第一条',
    fullText: '为了规范行政行为...',
    lawType: 'ADMINISTRATIVE',
    category: 'ADMINISTRATIVE_GENERAL',
    subCategory: null,
    status: 'DRAFT',
    version: '1.0',
    effectiveDate: new Date('2025-01-01'),
    viewCount: 0,
    referenceCount: 0,
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
  },
];

const mockUser = {
  userId: '1',
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
};

// =============================================================================
// 辅助函数
// =============================================================================

function setupListMocks({
  isAuthenticated = true,
  hasPermission = true,
  articles = mockArticles,
  totalCount = 3,
}: {
  isAuthenticated?: boolean;
  hasPermission?: boolean;
  articles?: typeof mockArticles;
  totalCount?: number;
} = {}) {
  (getAuthUser as jest.Mock).mockResolvedValue(
    isAuthenticated ? mockUser : null
  );

  // 修复权限检查的返回格式
  if (hasPermission) {
    (validatePermissions as jest.Mock).mockResolvedValue(null);
  } else {
    (validatePermissions as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: '无权限访问此资源',
          error: 'FORBIDDEN',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }

  (prisma.lawArticle.count as jest.Mock).mockResolvedValue(totalCount);
  (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue(articles);
}

function createTestRequest(queryParams?: Record<string, string>) {
  const searchParams = new URLSearchParams(queryParams).toString();
  const url = `http://localhost:3000/api/admin/law-articles${searchParams ? `?${searchParams}` : ''}`;
  return new NextRequest(url);
}

function createImportRequest(body: unknown) {
  const request = new NextRequest(
    'http://localhost:3000/api/admin/law-articles/import',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  // Mock the json() method to return the parsed body
  request.json = jest.fn().mockResolvedValue(body);
  return request;
}

function createReviewRequest(id: string, body: unknown) {
  const request = new NextRequest(
    `http://localhost:3000/api/admin/law-articles/${id}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  // Mock the json() method to return the parsed body
  request.json = jest.fn().mockResolvedValue(body);
  return request;
}

// =============================================================================
// 测试用例：法条列表API
// =============================================================================

describe('法条列表API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('认证和授权', () => {
    test('未认证时应返回401错误', async () => {
      setupListMocks({ isAuthenticated: false });
      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('无权限时应返回403错误', async () => {
      setupListMocks({ hasPermission: false });
      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
    });
  });

  describe('基础功能', () => {
    test('成功获取法条列表', async () => {
      setupListMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data.articles).toHaveLength(3);
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.total).toBe(3);
      expect(result.data.pagination.page).toBe(1);
      expect(result.data.pagination.limit).toBe(20);
    });

    test('应使用正确的查询参数调用数据库', async () => {
      setupListMocks();
      const request = createTestRequest({ page: '2', limit: '10' });
      await GET(request);

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });
  });

  describe('分页功能', () => {
    test('应正确处理分页参数', async () => {
      setupListMocks({ totalCount: 100 });
      const request = createTestRequest({ page: '3', limit: '20' });
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.pagination.page).toBe(3);
      expect(result.data.pagination.limit).toBe(20);
      expect(result.data.pagination.totalPages).toBe(5);
    });

    test('应限制最大每页数量为100', async () => {
      setupListMocks();
      const request = createTestRequest({ limit: '200' });
      await GET(request);

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });
  });

  describe('筛选功能', () => {
    test('应按法律类型筛选', async () => {
      setupListMocks({ articles: [mockArticles[0]], totalCount: 1 });
      const request = createTestRequest({ lawType: 'CIVIL' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.lawArticle.findMany).toHaveBeenCalled();
      expect(prisma.lawArticle.count).toHaveBeenCalled();
    });

    test('应按状态筛选', async () => {
      setupListMocks({ articles: [mockArticles[2]], totalCount: 1 });
      const request = createTestRequest({ status: 'DRAFT' });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.lawArticle.findMany).toHaveBeenCalled();
      expect(prisma.lawArticle.count).toHaveBeenCalled();
    });
  });

  describe('搜索功能', () => {
    test('应按法条名称搜索', async () => {
      setupListMocks({ articles: [mockArticles[0]], totalCount: 1 });
      const request = createTestRequest({ search: '民法典' });
      await GET(request);

      expect(prisma.lawArticle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ lawName: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应使用不区分大小写的搜索', async () => {
      setupListMocks();
      const request = createTestRequest({ search: '民法典' });
      await GET(request);

      const whereClause = (prisma.lawArticle.findMany as jest.Mock).mock
        .calls[0][0].where;
      expect(whereClause.OR[0].lawName.mode).toBe('insensitive');
    });
  });
});

// =============================================================================
// 测试用例：法条导入API
// =============================================================================

describe('法条导入API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 设置默认mock
    (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
    (validatePermissions as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('认证和授权', () => {
    test('未认证时应返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createImportRequest({ articles: [] });
      const response = await POST_IMPORT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('无权限时应返回403错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: '无权限访问此资源',
            error: 'FORBIDDEN',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const request = createImportRequest({ articles: [] });
      const response = await POST_IMPORT(request);

      expect(response.status).toBe(403);
      expect(data => {
        const parsed = data.json ? data : response.json();
        return parsed.then(p => {
          expect(p.success).toBe(false);
          expect(p.error).toBe('FORBIDDEN');
        });
      });
    });
  });

  describe('数据验证', () => {
    test('应验证JSON格式', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      const request = new NextRequest(
        'http://localhost:3000/api/admin/law-articles/import',
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: 'invalid json',
        }
      );

      const response = await POST_IMPORT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('BAD_REQUEST');
    });

    test('应验证articles字段为数组', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      const request = createImportRequest({ articles: 'not array' });

      const response = await POST_IMPORT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('BAD_REQUEST');
    });

    test('应验证articles字段不为空', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      const request = createImportRequest({ articles: [] });

      const response = await POST_IMPORT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('BAD_REQUEST');
    });

    test('应限制单次导入最多1000条', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      const largeArray = new Array(1001).fill({
        lawName: 'Test Law',
        articleNumber: '1',
        fullText: 'Test content',
        lawType: 'CIVIL',
        category: 'CIVIL_GENERAL',
        effectiveDate: '2024-01-01',
      });
      const request = createImportRequest({ articles: largeArray });

      const response = await POST_IMPORT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('BAD_REQUEST');
    });
  });

  describe('导入功能', () => {
    test('应成功导入新法条', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.create as jest.Mock).mockResolvedValue({
        id: 'new-id',
        lawName: '测试法律',
        articleNumber: '第一条',
        fullText: '测试内容',
        lawType: 'CIVIL',
        category: 'CIVIL_GENERAL',
        status: 'VALID',
        effectiveDate: new Date('2024-01-01'),
        version: '1.0',
        viewCount: 0,
        referenceCount: 0,
      });

      const request = createImportRequest({
        articles: [
          {
            lawName: '测试法律',
            articleNumber: '第一条',
            fullText: '测试内容',
            lawType: 'CIVIL',
            category: 'CIVIL_GENERAL',
            effectiveDate: '2024-01-01',
          },
        ],
      });

      const response = await POST_IMPORT(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data.total).toBe(1);
    });

    test('应更新已存在的法条', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(
        mockArticles[0]
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        ...mockArticles[0],
        fullText: '更新后的内容',
      });

      const request = createImportRequest({
        articles: [
          {
            lawName: '中华人民共和国民法典',
            articleNumber: '第一条',
            fullText: '更新后的内容',
            lawType: 'CIVIL',
            category: 'CIVIL_GENERAL',
            effectiveDate: '2024-01-01',
          },
        ],
      });

      const response = await POST_IMPORT(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data.total).toBe(1);
    });

    test('应处理导入失败的情况', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.create as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = createImportRequest({
        articles: [
          {
            lawName: '测试法律',
            articleNumber: '第一条',
            fullText: '测试内容',
            lawType: 'CIVIL',
            category: 'CIVIL_GENERAL',
            effectiveDate: '2024-01-01',
          },
        ],
      });

      const response = await POST_IMPORT(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.success).toBe(0);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors).toHaveLength(1);
    });
  });
});

// =============================================================================
// 测试用例：法条审核API
// =============================================================================

describe('法条审核API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('认证和授权', () => {
    test('未认证时应返回401错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);
      const request = createReviewRequest('1', { status: 'APPROVED' });
      const response = await POST_REVIEW(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('无权限时应返回403错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            message: '无权限访问此资源',
            error: 'FORBIDDEN',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );
      const request = createReviewRequest('1', { status: 'APPROVED' });
      const response = await POST_REVIEW(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
    });
  });

  describe('审核功能', () => {
    test('应成功审核通过法条', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticles[2]
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        id: '3',
        lawName: '中华人民共和国行政法',
        articleNumber: '第一条',
        status: 'VALID',
      });

      const request = createReviewRequest('3', { status: 'APPROVED' });
      const response = await POST_REVIEW(request, {
        params: Promise.resolve({ id: '3' }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.status).toBe('VALID');
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: '3' },
        data: expect.objectContaining({ status: LawStatus.VALID }),
        select: expect.any(Object),
      });
    });

    test('应成功拒绝法条', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticles[2]
      );
      (prisma.lawArticle.update as jest.Mock).mockResolvedValue({
        id: '3',
        lawName: '中华人民共和国行政法',
        articleNumber: '第一条',
        status: 'DRAFT',
      });

      const request = createReviewRequest('3', { status: 'REJECTED' });
      const response = await POST_REVIEW(request, {
        params: Promise.resolve({ id: '3' }),
      });
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.status).toBe('DRAFT');
      expect(prisma.lawArticle.update).toHaveBeenCalledWith({
        where: { id: '3' },
        data: expect.objectContaining({ status: LawStatus.DRAFT }),
        select: expect.any(Object),
      });
    });

    test('法条不存在时应返回404错误', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createReviewRequest('999', { status: 'APPROVED' });
      const response = await POST_REVIEW(request, {
        params: Promise.resolve({ id: '999' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('NOT_FOUND');
    });
  });

  describe('数据验证', () => {
    test('应验证status字段', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);
      (validatePermissions as jest.Mock).mockResolvedValue(null);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticles[0]
      );

      const request = createReviewRequest('1', { status: 'INVALID' });
      const response = await POST_REVIEW(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('BAD_REQUEST');
    });
  });
});
