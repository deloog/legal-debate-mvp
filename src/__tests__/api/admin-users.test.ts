/**
 * 用户列表API测试
 * 测试用户列表接口的分页、筛选、搜索功能
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/users/route';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// =============================================================================
// Mock设置
// =============================================================================

// Mock Prisma客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
      findMany: jest.fn(),
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

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { validatePermissions } from '@/lib/middleware/permission-check';
import { getAuthUser } from '@/lib/middleware/auth';

// =============================================================================
// 测试数据
// =============================================================================

const mockUsers = [
  {
    id: '1',
    email: 'admin@example.com',
    username: 'admin',
    name: '管理员',
    role: 'ADMIN',
    status: 'ACTIVE',
    createdAt: new Date('2024-01-01'),
    lastLoginAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    email: 'user@example.com',
    username: 'user',
    name: '普通用户',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date('2024-02-01'),
    lastLoginAt: new Date('2024-02-15'),
  },
  {
    id: '3',
    email: 'lawyer@example.com',
    username: 'lawyer',
    name: '律师',
    role: 'LAWYER',
    status: 'ACTIVE',
    createdAt: new Date('2024-03-01'),
    lastLoginAt: null,
  },
  {
    id: '4',
    email: 'enterprise@example.com',
    username: 'enterprise',
    name: '企业用户',
    role: 'ENTERPRISE',
    status: 'SUSPENDED',
    createdAt: new Date('2024-04-01'),
    lastLoginAt: new Date('2024-04-15'),
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
  users = mockUsers,
  totalCount = 4,
}: {
  isAuthenticated?: boolean;
  hasPermission?: boolean;
  users?: typeof mockUsers;
  totalCount?: number;
} = {}) {
  // Mock认证
  (getAuthUser as jest.Mock).mockResolvedValue(
    isAuthenticated ? mockUser : null
  );

  // Mock权限检查
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

  // Mock数据库查询
  (prisma.user.count as jest.Mock).mockResolvedValue(totalCount);
  (prisma.user.findMany as jest.Mock).mockResolvedValue(users);
}

function createTestRequest(queryParams?: Record<string, string>) {
  const searchParams = new URLSearchParams(queryParams).toString();
  const url = `http://localhost:3000/api/admin/users${searchParams ? `?${searchParams}` : ''}`;
  return new NextRequest(url, {
    headers: {
      'x-user-id': mockUser.id,
    },
  });
}

// =============================================================================
// 测试用例
// =============================================================================

describe('用户列表API', () => {
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
      // API返回格式: { success: false, message: string, error: string }
      expect(data.success).toBe(false);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    test('无权限时应返回403错误', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      // API返回格式: { success: false, message: string, error: string }
      expect(data.success).toBe(false);
      expect(data.error).toBe('FORBIDDEN');
    });
  });

  describe('基础功能', () => {
    test('成功获取用户列表', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      // Date对象会被序列化为字符串，所以需要比较期望的数据格式
      expect(result.data.users).toHaveLength(4);
      expect(result.data.users[0].email).toBe(mockUsers[0].email);
      expect(result.data.users[0].username).toBe(mockUsers[0].username);
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

      expect(prisma.user.findMany).toHaveBeenCalledWith(
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
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 })
      );
    });

    test('应限制最大每页数量为100', async () => {
      setupMocks();
      const request = createTestRequest({ limit: '200' });
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.pagination.limit).toBe(100);
    });

    test('应确保页码最小为1', async () => {
      setupMocks();
      const request = createTestRequest({ page: '0' });
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data.pagination.page).toBe(1);
    });
  });

  describe('角色筛选', () => {
    test('应按角色筛选用户', async () => {
      setupMocks({ users: [mockUsers[1]], totalCount: 1 });
      const request = createTestRequest({ role: 'USER' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'USER' }),
        })
      );
    });

    test('应支持所有角色筛选', async () => {
      const roles = ['USER', 'LAWYER', 'ENTERPRISE', 'ADMIN', 'SUPER_ADMIN'];

      for (const role of roles) {
        jest.clearAllMocks();
        setupMocks();
        const request = createTestRequest({ role });
        await GET(request);

        expect(prisma.user.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ role }),
          })
        );
      }
    });

    test('应忽略无效的角色值', async () => {
      setupMocks();
      const request = createTestRequest({ role: 'INVALID' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ role: 'INVALID' }),
        })
      );
    });
  });

  describe('状态筛选', () => {
    test('应按状态筛选用户', async () => {
      setupMocks({ users: [mockUsers[3]], totalCount: 1 });
      const request = createTestRequest({ status: 'SUSPENDED' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'SUSPENDED' }),
        })
      );
    });

    test('应支持所有状态筛选', async () => {
      const statuses = ['ACTIVE', 'SUSPENDED', 'BANNED', 'INACTIVE'];

      for (const status of statuses) {
        jest.clearAllMocks();
        setupMocks();
        const request = createTestRequest({ status });
        await GET(request);

        expect(prisma.user.findMany).toHaveBeenCalledWith(
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

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: 'INVALID' }),
        })
      );
    });
  });

  describe('搜索功能', () => {
    test('应按邮箱搜索', async () => {
      setupMocks({ users: [mockUsers[0]], totalCount: 1 });
      const request = createTestRequest({ search: 'admin' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ email: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应按用户名搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: 'lawyer' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ username: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应按姓名搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: '律师' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    test('应使用不区分大小写的搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: 'ADMIN' });
      await GET(request);

      const whereClause = (prisma.user.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(whereClause.OR[0].email.mode).toBe('insensitive');
    });

    test('应忽略空搜索词', async () => {
      setupMocks();
      const request = createTestRequest({ search: '   ' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('组合查询', () => {
    test('应支持角色和状态组合筛选', async () => {
      setupMocks({ users: [mockUsers[1]], totalCount: 1 });
      const request = createTestRequest({ role: 'USER', status: 'ACTIVE' });
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            role: 'USER',
            status: 'ACTIVE',
          }),
        })
      );
    });

    test('应支持搜索和筛选组合', async () => {
      setupMocks();
      const request = createTestRequest({
        role: 'LAWYER',
        search: 'law',
      });
      await GET(request);

      const whereClause = (prisma.user.findMany as jest.Mock).mock.calls[0][0]
        .where;
      expect(whereClause.role).toBe('LAWYER');
      expect(whereClause.OR).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('应处理数据库错误', async () => {
      setupMocks();
      (prisma.user.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      // API返回格式: { success: false, message: string, error: string }
      expect(data.success).toBe(false);
      expect(data.error).toBe('INTERNAL_SERVER_ERROR');
      expect(data.message).toBe('获取用户列表失败');
    });

    test('应记录错误日志', async () => {
      setupMocks();
      (prisma.user.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = createTestRequest();
      await GET(request);

      expect(logger.error).toHaveBeenCalledWith(
        '获取用户列表失败:',
        expect.any(Error)
      );
    });
  });

  describe('数据验证', () => {
    test('应返回正确的用户字段', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.users[0]).toHaveProperty('id');
      expect(result.data.users[0]).toHaveProperty('email');
      expect(result.data.users[0]).toHaveProperty('username');
      expect(result.data.users[0]).toHaveProperty('name');
      expect(result.data.users[0]).toHaveProperty('role');
      expect(result.data.users[0]).toHaveProperty('status');
      expect(result.data.users[0]).toHaveProperty('createdAt');
      expect(result.data.users[0]).toHaveProperty('lastLoginAt');
    });

    test('应按创建时间降序排列', async () => {
      setupMocks();
      const request = createTestRequest();
      await GET(request);

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
});
