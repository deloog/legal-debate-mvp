/**
 * 案件管理API测试
 * 测试案件列表接口的分页、筛选、搜索功能
 */

import { NextRequest } from 'next/server';
import { GET, DELETE } from '@/app/api/admin/cases/route';
import { prisma } from '@/lib/db/prisma';

// =============================================================================
// Mock设置
// =============================================================================

// Mock Prisma客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
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

import { validatePermissions } from '@/lib/middleware/permission-check';
import { getAuthUser } from '@/lib/middleware/auth';

// =============================================================================
// 测试数据
// =============================================================================

const mockCases = [
  {
    id: '1',
    title: '民事纠纷案',
    description: '合同纠纷案件',
    type: 'CIVIL',
    status: 'ACTIVE',
    amount: '10000.00',
    caseNumber: 'CF-2024-001',
    cause: '合同纠纷',
    court: '北京市海淀区人民法院',
    plaintiffName: '张三',
    defendantName: '李四',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    user: {
      id: 'user1',
      email: 'user1@example.com',
      username: 'user1',
      name: '张三',
    },
    _count: {
      documents: 3,
      debates: 1,
    },
  },
  {
    id: '2',
    title: '刑事案件',
    description: '盗窃案件',
    type: 'CRIMINAL',
    status: 'DRAFT',
    amount: null,
    caseNumber: 'XS-2024-002',
    cause: '盗窃',
    court: '北京市朝阳区人民法院',
    plaintiffName: null,
    defendantName: '王五',
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-15'),
    user: {
      id: 'user2',
      email: 'user2@example.com',
      username: 'user2',
      name: '李四',
    },
    _count: {
      documents: 1,
      debates: 0,
    },
  },
  {
    id: '3',
    title: '劳动纠纷案',
    description: '工资拖欠',
    type: 'LABOR',
    status: 'COMPLETED',
    amount: '5000.00',
    caseNumber: null,
    cause: '工资拖欠',
    court: null,
    plaintiffName: '赵六',
    defendantName: '某公司',
    createdAt: new Date('2024-03-01'),
    updatedAt: new Date('2024-03-15'),
    user: {
      id: 'user3',
      email: 'user3@example.com',
      username: 'user3',
      name: '赵六',
    },
    _count: {
      documents: 5,
      debates: 2,
    },
  },
  {
    id: '4',
    title: '知识产权案',
    description: '专利侵权',
    type: 'INTELLECTUAL',
    status: 'ARCHIVED',
    amount: null,
    caseNumber: null,
    cause: null,
    court: null,
    plaintiffName: null,
    defendantName: null,
    createdAt: new Date('2024-04-01'),
    updatedAt: new Date('2024-04-15'),
    user: {
      id: 'user4',
      email: 'user4@example.com',
      username: 'user4',
      name: '孙七',
    },
    _count: {
      documents: 0,
      debates: 0,
    },
  },
];

const mockUser = {
  id: '1',
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMIN',
};

// =============================================================================
// 辅助函数
// =============================================================================

function setupMocks({
  isAuthenticated = true,
  hasPermission = true,
  cases = mockCases,
  totalCount = 4,
  caseExists = true,
}: {
  isAuthenticated?: boolean;
  hasPermission?: boolean;
  cases?: typeof mockCases;
  totalCount?: number;
  caseExists?: boolean;
} = {}) {
  // Mock认证
  (getAuthUser as jest.Mock).mockResolvedValue(
    isAuthenticated ? mockUser : null
  );

  // Mock权限检查
  (validatePermissions as jest.Mock).mockResolvedValue(
    hasPermission ? null : Response.json({ error: '权限不足' }, { status: 403 })
  );

  // Mock数据库查询
  (prisma.case.count as jest.Mock).mockResolvedValue(totalCount);
  (prisma.case.findMany as jest.Mock).mockResolvedValue(cases);
  (prisma.case.findUnique as jest.Mock).mockResolvedValue(
    caseExists ? mockCases[0] : null
  );
  (prisma.case.update as jest.Mock).mockResolvedValue({
    ...mockCases[0],
    deletedAt: new Date(),
  });
}

function createTestRequest(queryParams?: Record<string, string>) {
  const searchParams = new URLSearchParams(queryParams).toString();
  const url = `http://localhost:3000/api/admin/cases${searchParams ? `?${searchParams}` : ''}`;
  return new NextRequest(url, {
    headers: {
      'x-user-id': mockUser.id,
    },
  });
}

// =============================================================================
// 测试用例 - GET
// =============================================================================

describe('案件列表API - GET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('认证和授权', () => {
    test('未认证时应返回401错误', async () => {
      setupMocks({ isAuthenticated: false });
      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    test('无权限时应返回403错误', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });
  });

  describe('基础功能', () => {
    test('成功获取案件列表', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data.cases).toHaveLength(4);
      expect(result.data.cases[0].title).toBe(mockCases[0].title);
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.total).toBe(4);
      expect(result.data.pagination.page).toBe(1);
      expect(result.data.pagination.limit).toBe(20);
      expect(result.data.pagination.totalPages).toBe(1);
    });

    test('应使用正确的查询参数调用数据库', async () => {
      setupMocks();
      const request = createTestRequest({ page: '2', limit: '10' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });

  describe('分页功能', () => {
    test('应正确处理分页参数', async () => {
      setupMocks({ totalCount: 100 });
      const request = createTestRequest({ page: '3', limit: '20' });
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.pagination.page).toBe(3);
      expect(result.data.pagination.limit).toBe(20);
      expect(result.data.pagination.totalPages).toBe(5);
      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 })
      );
    });

    test('应限制最大每页数量为100', async () => {
      setupMocks();
      const request = createTestRequest({ limit: '200' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    test('应确保页码最小为1', async () => {
      setupMocks();
      const request = createTestRequest({ page: '0' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });
  });

  describe('类型筛选', () => {
    test('应按案件类型筛选', async () => {
      setupMocks({ cases: [mockCases[0]], totalCount: 1 });
      const request = createTestRequest({ type: 'CIVIL' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'CIVIL' }),
        })
      );
    });

    test('应支持所有类型筛选', async () => {
      const types = [
        'CIVIL',
        'CRIMINAL',
        'ADMINISTRATIVE',
        'COMMERCIAL',
        'LABOR',
        'INTELLECTUAL',
        'OTHER',
      ];

      for (const type of types) {
        jest.clearAllMocks();
        setupMocks();
        const request = createTestRequest({ type });
        await GET(request);

        expect(prisma.case.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ type }),
          })
        );
      }
    });

    test('应忽略无效的类型值', async () => {
      setupMocks();
      const request = createTestRequest({ type: 'INVALID' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ type: 'INVALID' }),
        })
      );
    });
  });

  describe('状态筛选', () => {
    test('应按状态筛选案件', async () => {
      setupMocks({ cases: [mockCases[2]], totalCount: 1 });
      const request = createTestRequest({ status: 'COMPLETED' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        })
      );
    });

    test('应支持所有状态筛选', async () => {
      const statuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];

      for (const status of statuses) {
        jest.clearAllMocks();
        setupMocks();
        const request = createTestRequest({ status });
        await GET(request);

        expect(prisma.case.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ status }),
          })
        );
      }
    });

    test('应忽略无效的状态值', async () => {
      setupMocks();
      const request = createTestRequest({ status: 'INVALID' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: 'INVALID' }),
        })
      );
    });
  });

  describe('用户筛选', () => {
    test('应按用户ID筛选案件', async () => {
      setupMocks({ cases: [mockCases[0]], totalCount: 1 });
      const request = createTestRequest({ userId: 'user1' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user1' }),
        })
      );
    });
  });

  describe('搜索功能', () => {
    test('应按标题搜索', async () => {
      setupMocks({ cases: [mockCases[0]], totalCount: 1 });
      const request = createTestRequest({ search: '民事' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应按案号搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: 'CF-2024-001' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ caseNumber: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应按案由搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: '合同' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ cause: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应按当事人搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: '张三' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ plaintiffName: expect.any(Object) }),
              expect.objectContaining({ defendantName: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应使用不区分大小写的搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: '民事纠纷案' });
      await GET(request);

      const whereClause = (prisma.case.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(whereClause.OR[0].title.mode).toBe('insensitive');
    });

    test('应忽略空搜索词', async () => {
      setupMocks();
      const request = createTestRequest({ search: '   ' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('组合查询', () => {
    test('应支持类型和状态组合筛选', async () => {
      setupMocks({ cases: [mockCases[0]], totalCount: 1 });
      const request = createTestRequest({ type: 'CIVIL', status: 'ACTIVE' });
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'CIVIL',
            status: 'ACTIVE',
          }),
        })
      );
    });

    test('应支持搜索和筛选组合', async () => {
      setupMocks();
      const request = createTestRequest({
        type: 'CIVIL',
        search: '民事',
      });
      await GET(request);

      const whereClause = (prisma.case.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(whereClause.type).toBe('CIVIL');
      expect(whereClause.OR).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('应处理数据库错误', async () => {
      setupMocks();
      (prisma.case.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
      expect(data.message).toBe('获取案件列表失败');
    });

    test('应记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupMocks();
      (prisma.case.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = createTestRequest();
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '获取案件列表失败:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('数据验证', () => {
    test('应返回正确的案件字段', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.cases[0]).toHaveProperty('id');
      expect(result.data.cases[0]).toHaveProperty('title');
      expect(result.data.cases[0]).toHaveProperty('description');
      expect(result.data.cases[0]).toHaveProperty('type');
      expect(result.data.cases[0]).toHaveProperty('status');
      expect(result.data.cases[0]).toHaveProperty('amount');
      expect(result.data.cases[0]).toHaveProperty('caseNumber');
      expect(result.data.cases[0]).toHaveProperty('cause');
      expect(result.data.cases[0]).toHaveProperty('court');
      expect(result.data.cases[0]).toHaveProperty('plaintiffName');
      expect(result.data.cases[0]).toHaveProperty('defendantName');
      expect(result.data.cases[0]).toHaveProperty('createdAt');
      expect(result.data.cases[0]).toHaveProperty('updatedAt');
      expect(result.data.cases[0]).toHaveProperty('user');
      expect(result.data.cases[0]).toHaveProperty('documentsCount');
      expect(result.data.cases[0]).toHaveProperty('debatesCount');
      expect(result.data.cases[0].documentsCount).toBe(3);
      expect(result.data.cases[0].debatesCount).toBe(1);
    });

    test('应按创建时间降序排列', async () => {
      setupMocks();
      const request = createTestRequest();
      await GET(request);

      expect(prisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    test('应包含用户信息', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.cases[0].user).toHaveProperty('id');
      expect(result.data.cases[0].user).toHaveProperty('email');
      expect(result.data.cases[0].user).toHaveProperty('username');
      expect(result.data.cases[0].user).toHaveProperty('name');
    });
  });
});

// =============================================================================
// 测试用例 - DELETE
// =============================================================================

describe('案件删除API - DELETE', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('认证和授权', () => {
    test('未认证时应返回401错误', async () => {
      setupMocks({ isAuthenticated: false });
      const request = createTestRequest();
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    test('无权限时应返回403错误', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest();
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });
  });

  describe('基础功能', () => {
    test('成功删除案件', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('案件删除成功');
      expect(prisma.case.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    test('案件不存在时应返回404错误', async () => {
      setupMocks({ caseExists: false });
      const request = createTestRequest();
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '999' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('案件不存在');
      expect(data.message).toBe('未找到指定案件');
      expect(prisma.case.update).not.toHaveBeenCalled();
    });
  });

  describe('错误处理', () => {
    test('应处理数据库错误', async () => {
      setupMocks();
      (prisma.case.update as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createTestRequest();
      const response = await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
      expect(data.message).toBe('删除案件失败');
    });

    test('应记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupMocks();
      (prisma.case.update as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = createTestRequest();
      await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '删除案件失败:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('数据验证', () => {
    test('应先检查案件是否存在', async () => {
      setupMocks();
      const request = createTestRequest();
      await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });

      expect(prisma.case.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    test('应执行软删除（设置deletedAt）', async () => {
      setupMocks();
      const request = createTestRequest();
      await DELETE(request, {
        params: Promise.resolve({ id: '1' }),
      });

      const updateData = (prisma.case.update as jest.Mock).mock.calls[0][0]
        .data;
      expect(updateData.deletedAt).toBeInstanceOf(Date);
    });
  });
});
