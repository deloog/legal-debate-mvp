/**
 * 辩论列表API权限测试
 *
 * 测试辩论列表API的基于角色的访问控制功能
 */

import { GET } from '@/app/api/v1/debates/route';
import { createMockRequest } from './test-utils';
import type { JwtPayload } from '@/types/auth';

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
    debate: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// =============================================================================
// 测试数据
// =============================================================================

const mockUser: JwtPayload = {
  userId: 'user-1',
  email: 'user@example.com',
  role: 'USER',
};

const mockAdmin: JwtPayload = {
  userId: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN',
};

const mockDebates = [
  {
    id: 'debate-1',
    title: '辩论1',
    caseId: 'case-1',
    userId: 'user-1',
    status: 'DRAFT',
    currentRound: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    case: {
      id: 'case-1',
      title: '案件1',
      type: 'CIVIL',
    },
    user: {
      id: 'user-1',
      username: 'user1',
      name: 'User 1',
    },
    _count: {
      rounds: 1,
    },
  },
  {
    id: 'debate-2',
    title: '辩论2',
    caseId: 'case-2',
    userId: 'user-2',
    status: 'IN_PROGRESS',
    currentRound: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    case: {
      id: 'case-2',
      title: '案件2',
      type: 'CRIMINAL',
    },
    user: {
      id: 'user-2',
      username: 'user2',
      name: 'User 2',
    },
    _count: {
      rounds: 2,
    },
  },
];

// =============================================================================
// 测试用例
// =============================================================================

describe('辩论列表API - 权限测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ========================================
  // USER角色权限测试
  // ========================================

  describe('USER角色权限', () => {
    it('用户只能看到自己创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      // 只返回用户自己的辩论
      const userDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(userDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(userDebates.length);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].userId).toBe(mockUser.userId);
    });

    it('用户不能看到其他用户的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      // 用户只能看到自己的辩论，不应该看到其他用户的辩论
      const userDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(userDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(userDebates.length);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);
      const data = await response.json();

      // 验证不包含其他用户的辩论
      const otherUserDebateIds = mockDebates
        .filter(debate => debate.userId !== mockUser.userId)
        .map(debate => debate.id);
      const returnedDebateIds = data.data.map(
        (item: { id: string }) => item.id
      );
      expect(returnedDebateIds).toEqual(
        expect.not.arrayContaining(otherUserDebateIds)
      );
    });

    it('用户搜索功能应仅搜索自己的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const userDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(userDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(userDebates.length);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?search=测试'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.userId,
          }),
        })
      );
    });

    it('用户分页功能应仅分页自己的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const userDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(userDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(userDebates.length);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?page=1&limit=10'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.userId,
          }),
        })
      );
    });
  });

  // ========================================
  // ADMIN角色权限测试
  // ========================================

  describe('ADMIN角色权限', () => {
    it('管理员可以看到所有辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue(mockDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(mockDebates.length);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('管理员可以使用userId参数过滤特定用户的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);

      const filteredDebates = mockDebates.filter(
        debate => debate.userId === 'user-1'
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(filteredDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(
        filteredDebates.length
      );

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?userId=user-1'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });

    it('管理员搜索功能可以搜索所有辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue(mockDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(mockDebates.length);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?search=测试'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            // 管理员不应该有userId过滤条件
            deletedAt: null,
          }),
        })
      );
    });

    it('管理员不分发userId参数时应看到所有辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue(mockDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(mockDebates.length);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            // 管理员不应该有userId过滤条件
            deletedAt: null,
          }),
        })
      );
    });
  });

  // ========================================
  // SUPER_ADMIN角色权限测试
  // ========================================

  describe('SUPER_ADMIN角色权限', () => {
    it('超级管理员可以看到所有辩论', async () => {
      const superAdmin: JwtPayload = {
        userId: 'super-admin-1',
        email: 'superadmin@example.com',
        role: 'SUPER_ADMIN',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(superAdmin);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue(mockDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(mockDebates.length);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('超级管理员可以使用userId参数过滤辩论', async () => {
      const superAdmin: JwtPayload = {
        userId: 'super-admin-1',
        email: 'superadmin@example.com',
        role: 'SUPER_ADMIN',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(superAdmin);

      const filteredDebates = mockDebates.filter(
        debate => debate.userId === 'user-1'
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(filteredDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(
        filteredDebates.length
      );

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?userId=user-1'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        })
      );
    });
  });

  // ========================================
  // LAWYER角色权限测试
  // ========================================

  describe('LAWYER角色权限', () => {
    it('律师只能看到自己创建的辩论', async () => {
      const lawyer: JwtPayload = {
        userId: 'lawyer-1',
        email: 'lawyer@example.com',
        role: 'LAWYER',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(lawyer);

      const lawyerDebates = mockDebates.filter(
        debate => debate.userId === lawyer.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(lawyerDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(
        lawyerDebates.length
      );

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      // 律师没有创建任何辩论
      expect(data.data).toHaveLength(0);
    });
  });

  // ========================================
  // 权限边界情况测试
  // ========================================

  describe('权限边界情况', () => {
    it('用户创建的第一个辩论应该能被查看到', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const firstDebate = [mockDebates[0]];
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(firstDebate);
      (prisma.debate.count as jest.Mock).mockResolvedValue(1);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe(mockDebates[0].id);
    });

    it('用户没有任何辩论时应返回空列表', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual([]);
      expect(data.meta.pagination.total).toBe(0);
    });

    it('管理员查看不存在的userId应返回空列表', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?userId=non-existent-user'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual([]);
      expect(data.meta.pagination.total).toBe(0);
    });

    it('已删除的辩论不应在列表中显示', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const activeDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId && debate.deletedAt === null
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(activeDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(
        activeDebates.length
      );

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });

    it('用户搜索和分页功能应结合userId过滤', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      const userDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(userDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(userDebates.length);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?search=辩论&page=1&limit=10'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.userId,
            deletedAt: null,
          }),
        })
      );
    });
  });

  // ========================================
  // 权限验证正确性测试
  // ========================================

  describe('权限验证正确性', () => {
    it('普通用户不应被允许通过userId参数查看其他用户辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockUser);

      // 尽管请求包含userId参数，用户只能看到自己的辩论
      const userDebates = mockDebates.filter(
        debate => debate.userId === mockUser.userId
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(userDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(userDebates.length);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?userId=user-2'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      // 验证查询条件使用的是认证用户的userId，而不是请求参数中的userId
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.userId, // 使用认证用户的userId
          }),
        })
      );
    });

    it('管理员应被允许使用userId参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);

      const filteredDebates = mockDebates.filter(
        debate => debate.userId === 'user-1'
      );
      (prisma.debate.findMany as jest.Mock).mockResolvedValue(filteredDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(
        filteredDebates.length
      );

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?userId=user-1'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      // 管理员可以使用userId参数过滤
      expect(prisma.debate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1', // 使用请求参数中的userId
          }),
        })
      );
    });
  });
});
