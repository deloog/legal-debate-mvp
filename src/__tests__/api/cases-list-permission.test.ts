/**
 * 案件列表API权限过滤测试
 *
 * 测试案件列表API (GET /api/v1/cases) 的权限过滤功能
 * 验证非管理员用户只能看到自己创建的案件，管理员可以看到所有案件
 */

import { GET } from '@/app/api/v1/cases/route';
import { createMockRequest } from './test-utils';
import type { JwtPayload } from '@/types/auth';
import { UserRole } from '@/types/auth';

// =============================================================================
// Mock配置
// =============================================================================

// Mock getAuthUser
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// =============================================================================
// 测试数据
// =============================================================================

const mockUser1: JwtPayload = {
  userId: 'user-1',
  email: 'user1@example.com',
  role: UserRole.USER,
  iat: 1234567890,
  exp: 1234567890 + 3600,
};

const mockAdmin: JwtPayload = {
  userId: 'admin-1',
  email: 'admin@example.com',
  role: UserRole.ADMIN,
  iat: 1234567890,
  exp: 1234567890 + 3600,
};

const mockSuperAdmin: JwtPayload = {
  userId: 'super-admin-1',
  email: 'superadmin@example.com',
  role: UserRole.SUPER_ADMIN,
  iat: 1234567890,
  exp: 1234567890 + 3600,
};

const mockUser1Cases = [
  {
    id: 'case-1',
    title: '案件1',
    description: '描述1',
    type: 'CIVIL' as const,
    status: 'ACTIVE' as const,
    userId: 'user-1',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
    debates: [],
    user: {
      id: 'user-1',
      username: 'user1',
      name: 'User 1',
      email: 'user1@example.com',
    },
  },
  {
    id: 'case-2',
    title: '案件2',
    description: '描述2',
    type: 'CRIMINAL' as const,
    status: 'DRAFT' as const,
    userId: 'user-1',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
    debates: [],
    user: {
      id: 'user-1',
      username: 'user1',
      name: 'User 1',
      email: 'user1@example.com',
    },
  },
];

const mockUser2Cases = [
  {
    id: 'case-3',
    title: '案件3',
    description: '描述3',
    type: 'ADMINISTRATIVE' as const,
    status: 'ACTIVE' as const,
    userId: 'user-2',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
    debates: [],
    user: {
      id: 'user-2',
      username: 'user2',
      name: 'User 2',
      email: 'user2@example.com',
    },
  },
];

const mockAllCases = [...mockUser1Cases, ...mockUser2Cases];

// =============================================================================
// 测试用例
// =============================================================================

describe('案件列表API - 权限过滤测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ========================================
  // 普通用户权限过滤测试
  // ========================================

  describe('普通用户权限过滤', () => {
    it('普通用户只能看到自己创建的案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser1);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser1Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.cases).toHaveLength(2);

      // 验证所有案件的userId都匹配当前用户
      data.data.cases.forEach((item: unknown) => {
        expect((item as { userId: string }).userId).toBe('user-1');
      });

      // 验证数据库查询的where条件包含userId过滤
      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
    });

    it('普通用户无法看到他人创建的案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser1);
      // Mock返回的所有案件（包含user-2的案件）
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser1Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();

      // 验证不会返回user-2的案件
      const caseIds = data.data.cases.map(
        (item: unknown) => (item as { id: string }).id
      );
      expect(caseIds).not.toContain('case-3');
    });

    it('普通用户不能通过userId参数覆盖权限过滤', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser1);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser1Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      // 尝试通过userId参数查询他人案件
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?userId=user-2'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      // 验证数据库查询仍然使用当前用户的userId
      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
      expect(findManyCall.where.userId).not.toBe('user-2');
    });
  });

  // ========================================
  // 管理员权限测试
  // ========================================

  describe('管理员权限', () => {
    it('管理员可以看到所有案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockAllCases);
      (prisma.case.count as jest.Mock).mockResolvedValue(3);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.cases).toHaveLength(3);

      // 验证可以看到多个用户的案件
      const userIds = new Set(
        data.data.cases.map(
          (item: unknown) => (item as { userId: string }).userId
        )
      );
      expect(userIds.has('user-1')).toBe(true);
      expect(userIds.has('user-2')).toBe(true);
    });

    it('管理员可以通过userId参数过滤特定用户的案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser1Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?userId=user-1'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      // 验证数据库查询使用请求的userId
      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
    });

    it('管理员不传userId参数时应看到所有案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockAllCases);
      (prisma.case.count as jest.Mock).mockResolvedValue(3);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);

      // 验证数据库查询不包含userId过滤
      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBeUndefined();
    });
  });

  // ========================================
  // 超级管理员权限测试
  // ========================================

  describe('超级管理员权限', () => {
    it('超级管理员可以看到所有案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockSuperAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockAllCases);
      (prisma.case.count as jest.Mock).mockResolvedValue(3);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.cases).toHaveLength(3);
    });

    it('超级管理员可以通过userId参数过滤案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockSuperAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser2Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?userId=user-2'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-2');
    });
  });

  // ========================================
  // 不同角色权限对比测试
  // ========================================

  describe('不同角色权限对比', () => {
    it('USER角色不能看到ADMIN用户创建的案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser1);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser1Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      await GET(request);

      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
    });

    it('ADMIN角色可以看到USER用户创建的案件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockAllCases);
      (prisma.case.count as jest.Mock).mockResolvedValue(3);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      await GET(request);

      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBeUndefined();
    });
  });

  // ========================================
  // 权限过滤与其他筛选条件集成测试
  // ========================================

  describe('权限过滤与其他筛选条件集成', () => {
    it('普通用户的权限过滤应与其他筛选条件正确配合', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser1);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([
        mockUser1Cases[0],
      ]);
      (prisma.case.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?type=CIVIL&status=ACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      // 验证查询条件包含userId、type和status
      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
      expect(findManyCall.where.type).toBe('CIVIL');
      expect(findManyCall.where.status).toBe('ACTIVE');
    });

    it('管理员的userId过滤应与其他筛选条件正确配合', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([
        mockUser1Cases[0],
      ]);
      (prisma.case.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?userId=user-1&type=CIVIL'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
      expect(findManyCall.where.type).toBe('CIVIL');
    });

    it('搜索功能应与权限过滤正确配合', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser1);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockUser1Cases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?search=案件'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);

      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-1');
      expect(findManyCall.where.OR).toBeDefined();
    });
  });

  // ========================================
  // 边界情况测试
  // ========================================

  describe('边界情况', () => {
    it('用户没有案件时应返回空列表', async () => {
      const emptyUser: JwtPayload = {
        userId: 'user-empty',
        email: 'empty@example.com',
        role: UserRole.USER,
      };

      (getAuthUser as jest.Mock).mockResolvedValue(emptyUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.cases).toEqual([]);
      expect(data.data.total).toBe(0);

      // 验证userId过滤仍然生效
      const findManyCall = (prisma.case.findMany as jest.Mock).mock.calls[0][0];
      expect(findManyCall.where.userId).toBe('user-empty');
    });

    it('管理员查询不存在用户的案件时应返回空列表', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?userId=nonexistent-user'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.cases).toEqual([]);
      expect(data.data.total).toBe(0);
    });
  });
});
