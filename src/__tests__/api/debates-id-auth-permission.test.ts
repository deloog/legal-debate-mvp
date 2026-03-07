/**
 * 辩论单个API认证和权限测试
 *
 * 测试辩论单个API (GET/PUT/DELETE /api/v1/debates/[id]) 的认证和权限功能
 */

import { GET, PUT, DELETE } from '@/app/api/v1/debates/[id]/route';
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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// Mock checkResourceOwnership - 使用requireActual获取真实实现
jest.mock('@/lib/middleware/resource-permission', () => {
  const actual = jest.requireActual('@/lib/middleware/resource-permission');
  return {
    ...actual,
    checkResourceOwnership: jest.fn(),
  };
});

import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';

// =============================================================================
// 测试数据
// =============================================================================

const mockAuthUser: JwtPayload = {
  userId: 'user-1',
  email: 'user@example.com',
  role: 'USER',
  iat: 1234567890,
  exp: 1234567890 + 3600,
};

const mockAdmin: JwtPayload = {
  userId: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN',
  iat: 1234567890,
  exp: 1234567890 + 3600,
};

const mockDebate = {
  id: 'cmjtg7np100axc0zgwiwpwt1a',
  title: '辩论1',
  caseId: 'cmjtg7np100axc0zgwiwpwt9a',
  userId: 'user-1',
  status: 'DRAFT',
  currentRound: 0,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  case: {
    id: 'cmjtg7np100axc0zgwiwpwt9a',
    title: '案件1',
    description: '案件描述',
    type: 'CIVIL',
    status: 'ACTIVE',
    amount: null,
  },
  user: {
    id: 'user-1',
    username: 'testuser',
    name: 'Test User',
    role: 'USER',
  },
  rounds: [
    {
      id: 'round-1',
      roundNumber: 1,
      status: 'PENDING',
      arguments: [],
    },
  ],
};

const mockDebateNotFound = null;

// =============================================================================
// 测试用例
// =============================================================================

describe('辩论单个API - 认证和权限测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ========================================
  // GET方法认证测试
  // ========================================

  describe('GET方法认证', () => {
    it('未认证请求应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(401);
      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(prisma.debate.findUnique).not.toHaveBeenCalled();
    });

    it('已认证请求应通过验证并继续处理', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(200);
      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(prisma.debate.findUnique).toHaveBeenCalled();
    });

    it('应正确处理getAuthUser抛出的错误', async () => {
      (getAuthUser as jest.Mock).mockImplementation(() => {
        throw new Error('Token解析失败');
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(500);
    });
  });

  // ========================================
  // GET方法权限测试
  // ========================================

  describe('GET方法权限', () => {
    it('所有者应该能够访问自己创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('非所有者应该无法访问他人创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权访问此辩论',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(403);
      expect(prisma.debate.findUnique).not.toHaveBeenCalled();
    });

    it('不存在的辩论应返回404', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(
        mockDebateNotFound
      );

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(404);
    });

    it('管理员可以访问所有辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue(mockDebate);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // PUT方法认证测试
  // ========================================

  describe('PUT方法认证', () => {
    it('未认证请求应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'PUT', body: { title: '新标题' } }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(401);
      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(prisma.debate.update).not.toHaveBeenCalled();
    });

    it('已认证请求应通过验证并继续处理', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmjtg7np100axc0zgwiwpwt1a',
      });
      (prisma.debate.update as jest.Mock).mockResolvedValue({
        ...mockDebate,
        title: '新标题',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'PUT', body: { title: '新标题' } }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // PUT方法权限测试
  // ========================================

  describe('PUT方法权限', () => {
    it('所有者应该能够更新自己创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmjtg7np100axc0zgwiwpwt1a',
      });
      (prisma.debate.update as jest.Mock).mockResolvedValue({
        ...mockDebate,
        title: '新标题',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'PUT', body: { title: '新标题' } }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(200);
      expect(prisma.debate.update).toHaveBeenCalled();
    });

    it('非所有者应该无法更新他人创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权修改此辩论',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'PUT', body: { title: '新标题' } }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(403);
      expect(prisma.debate.update).not.toHaveBeenCalled();
    });

    it('管理员可以更新所有辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmjtg7np100axc0zgwiwpwt1a',
      });
      (prisma.debate.update as jest.Mock).mockResolvedValue({
        ...mockDebate,
        title: '新标题',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'PUT', body: { title: '新标题' } }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // DELETE方法认证测试
  // ========================================

  describe('DELETE方法认证', () => {
    it('未认证请求应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(401);
      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(prisma.debate.update).not.toHaveBeenCalled();
    });

    it('已认证请求应通过验证并继续处理', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmjtg7np100axc0zgwiwpwt1a',
      });
      (prisma.debate.update as jest.Mock).mockResolvedValue({
        ...mockDebate,
        deletedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(204);
    });
  });

  // ========================================
  // DELETE方法权限测试
  // ========================================

  describe('DELETE方法权限', () => {
    it('所有者应该能够删除自己创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmjtg7np100axc0zgwiwpwt1a',
      });
      (prisma.debate.update as jest.Mock).mockResolvedValue({
        ...mockDebate,
        deletedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(204);
      expect(prisma.debate.update).toHaveBeenCalledWith({
        where: { id: 'cmjtg7np100axc0zgwiwpwt1a' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('非所有者应该无法删除他人创建的辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权删除此辩论',
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(403);
      expect(prisma.debate.update).not.toHaveBeenCalled();
    });

    it('管理员可以删除所有辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAdmin);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.debate.findUnique as jest.Mock).mockResolvedValue({
        id: 'cmjtg7np100axc0zgwiwpwt1a',
      });
      (prisma.debate.update as jest.Mock).mockResolvedValue({
        ...mockDebate,
        deletedAt: new Date(),
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(204);
    });
  });

  // ========================================
  // 认证与权限集成测试
  // ========================================

  describe('认证与权限集成', () => {
    it('应先验证认证，再验证权限（GET）', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(401);
      expect(getAuthUser).toHaveBeenCalled();
      expect(checkResourceOwnership).not.toHaveBeenCalled();
    });

    it('应先验证认证，再验证权限（PUT）', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'PUT', body: { title: '新标题' } }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(401);
      expect(getAuthUser).toHaveBeenCalled();
      expect(checkResourceOwnership).not.toHaveBeenCalled();
    });

    it('应先验证认证，再验证权限（DELETE）', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        { method: 'DELETE' }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(401);
      expect(getAuthUser).toHaveBeenCalled();
      expect(checkResourceOwnership).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // 权限参数验证测试
  // ========================================

  describe('权限参数验证', () => {
    it('所有方法都应传递正确的资源类型（DEBATE）', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(checkResourceOwnership).toHaveBeenCalledWith(
        mockAuthUser.userId,
        'cmjtg7np100axc0zgwiwpwt1a',
        ResourceType.DEBATE
      );
    });
  });

  // ========================================
  // 边界情况测试
  // ========================================

  describe('边界情况', () => {
    it('空权限原因应使用默认消息', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(data.error.message).toContain('权');
    });

    it('普通用户角色无法获取管理员权限', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
      });

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('FORBIDDEN');
      expect(prisma.debate.findUnique).not.toHaveBeenCalled();
    });
  });
});
