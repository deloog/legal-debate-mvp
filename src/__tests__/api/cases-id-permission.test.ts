/**
 * 单个案件API权限集成测试
 *
 * 验证GET/PUT/DELETE方法的权限集成是否正常工作
 * 包括资源所有权验证、管理员权限验证、边界情况等
 */

import { GET, PUT, DELETE } from '@/app/api/v1/cases/[id]/route';
import { createMockRequest } from './test-utils';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkResourceOwnership,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { prisma } from '@/lib/db/prisma';

// Mock the authentication middleware
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Mock the permission middleware
jest.mock('@/lib/middleware/resource-permission', () => ({
  checkResourceOwnership: jest.fn(),
  createPermissionErrorResponse: jest.fn((reason: string) => {
    return new Response(
      JSON.stringify({ error: '权限不足', message: reason }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }),
  ResourceType: {
    CASE: 'CASE',
  },
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

const mockCaseId = '123e4567-e89b-12d3-a456-426614174000';
const mockOtherCaseId = '123e4567-e89b-12d3-a456-426614174001';
const mockUserId = 'user-123';
const mockOtherUserId = 'user-456';
const mockAdminUserId = 'admin-123';

/**
 * 辅助函数：创建模拟的认证用户
 */
function createMockAuthUser(userId: string, role: string = 'USER') {
  return { userId, email: `test${userId}@example.com`, role };
}

/**
 * 辅助函数：创建模拟的案件数据
 */
function createMockCase(overrides: Record<string, unknown> = {}) {
  return {
    id: mockCaseId,
    userId: mockUserId,
    title: '测试案件',
    description: '这是一个测试案件',
    type: 'CIVIL',
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('单个案件API - 权限集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 默认mock：权限通过，数据库操作成功
    (checkResourceOwnership as jest.Mock).mockResolvedValue({
      hasPermission: true,
    });
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      id: mockCaseId,
      userId: mockUserId,
      title: '测试案件',
      description: '这是一个测试案件',
      type: 'CIVIL',
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    (prisma.case.update as jest.Mock).mockResolvedValue({
      id: mockCaseId,
      userId: mockUserId,
      title: '更新后的案件',
      deletedAt: new Date(),
    });
  });

  describe('GET方法 - 资源所有权验证', () => {
    it('用户可以访问自己创建的案件', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const mockCase = createMockCase();

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(200);
      expect(checkResourceOwnership).toHaveBeenCalledWith(
        mockUserId,
        mockCaseId,
        ResourceType.CASE
      );
    });

    it('用户无法访问他人创建的案件', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权访问此案件',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
      expect(prisma.case.findUnique).not.toHaveBeenCalled();
    });

    it('管理员可以访问所有案件', async () => {
      const mockAuthUser = createMockAuthUser(mockAdminUserId, 'ADMIN');
      const mockCase = createMockCase({ userId: mockOtherUserId });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(200);
    });

    it('不存在的案件应返回404', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error?.code).toBe('NOT_FOUND');
    });

    it('已删除的案件不能被访问（权限检查拦截）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      // 权限检查应该拒绝已删除的案件
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '案件已被删除',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT方法 - 资源所有权验证', () => {
    it('用户可以更新自己创建的案件', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const mockCase = createMockCase();
      const updatedCase = { ...mockCase, title: '更新后的标题' };

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(updatedCase);

      const updateData = { title: '更新后的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(200);
      expect(prisma.case.update).toHaveBeenCalled();
    });

    it('用户无法更新他人创建的案件', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权修改此案件',
      });

      const updateData = { title: '更新后的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
      expect(prisma.case.update).not.toHaveBeenCalled();
    });

    it('管理员可以更新所有案件', async () => {
      const mockAuthUser = createMockAuthUser(mockAdminUserId, 'ADMIN');
      const updatedCase = createMockCase({
        userId: mockOtherUserId,
        title: '管理员更新的标题',
      });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(updatedCase);

      const updateData = { title: '管理员更新的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(200);
    });

    it('超级管理员可以更新所有案件', async () => {
      const mockAuthUser = createMockAuthUser(mockAdminUserId, 'SUPER_ADMIN');
      const updatedCase = createMockCase({
        userId: mockOtherUserId,
        title: '超级管理员更新的标题',
      });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(updatedCase);

      const updateData = { title: '超级管理员更新的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(200);
    });

    it('权限检查失败时不应执行数据库更新操作', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const updateData = { title: '更新后的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
      expect(prisma.case.update).not.toHaveBeenCalled();
    });
  });

  describe('DELETE方法 - 资源所有权验证', () => {
    it('用户可以删除自己创建的案件', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({ deletedAt: new Date() });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(deletedCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(204);
      expect(prisma.case.update).toHaveBeenCalledWith({
        where: { id: mockCaseId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('用户无法删除他人创建的案件', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权删除此案件',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
      expect(prisma.case.update).not.toHaveBeenCalled();
    });

    it('管理员可以删除所有案件', async () => {
      const mockAuthUser = createMockAuthUser(mockAdminUserId, 'ADMIN');
      const deletedCase = createMockCase({
        userId: mockOtherUserId,
        deletedAt: new Date(),
      });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(deletedCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(204);
    });

    it('超级管理员可以删除所有案件', async () => {
      const mockAuthUser = createMockAuthUser(mockAdminUserId, 'SUPER_ADMIN');
      const deletedCase = createMockCase({
        userId: mockOtherUserId,
        deletedAt: new Date(),
      });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(deletedCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(204);
    });

    it('权限检查失败时不应执行数据库删除操作', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
      expect(prisma.case.update).not.toHaveBeenCalled();
    });
  });

  describe('权限与认证集成测试', () => {
    it('应先验证认证，再验证权限（GET）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const mockCase = createMockCase();

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const authCallOrder = (getAuthUser as jest.Mock).mock
        .invocationCallOrder[0];
      const permCallOrder = (checkResourceOwnership as jest.Mock).mock
        .invocationCallOrder[0];
      expect(authCallOrder).toBeLessThan(permCallOrder);
    });

    it('应先验证认证，再验证权限（PUT）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const updatedCase = createMockCase({ title: '更新后的标题' });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(updatedCase);

      const updateData = { title: '更新后的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const authCallOrder = (getAuthUser as jest.Mock).mock
        .invocationCallOrder[0];
      const permCallOrder = (checkResourceOwnership as jest.Mock).mock
        .invocationCallOrder[0];
      expect(authCallOrder).toBeLessThan(permCallOrder);
    });

    it('应先验证认证，再验证权限（DELETE）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({ deletedAt: new Date() });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(deletedCase);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const authCallOrder = (getAuthUser as jest.Mock).mock
        .invocationCallOrder[0];
      const permCallOrder = (checkResourceOwnership as jest.Mock).mock
        .invocationCallOrder[0];
      expect(authCallOrder).toBeLessThan(permCallOrder);
    });
  });

  describe('权限检查错误处理', () => {
    it('应正确处理权限检查抛出的错误（GET）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(500);
    });

    it('应正确处理权限检查抛出的错误（PUT）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const updateData = { title: '更新后的标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(500);
    });

    it('应正确处理权限检查抛出的错误（DELETE）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe('权限参数验证', () => {
    it('所有方法都应传递正确的资源类型（CASE）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const mockCase = createMockCase();
      const updatedCase = createMockCase({ title: '更新' });
      const deletedCase = createMockCase({ deletedAt: new Date() });

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (prisma.case.update as jest.Mock)
        .mockResolvedValue(updatedCase)
        .mockResolvedValue(deletedCase);

      // 测试GET
      const getRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      await GET(getRequest, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      expect(checkResourceOwnership).toHaveBeenCalledWith(
        mockUserId,
        mockCaseId,
        ResourceType.CASE
      );

      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      // 测试PUT
      const putRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: { title: '更新' } }
      );
      await PUT(putRequest, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      expect(checkResourceOwnership).toHaveBeenCalledWith(
        mockUserId,
        mockCaseId,
        ResourceType.CASE
      );

      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });

      // 测试DELETE
      const deleteRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );
      await DELETE(deleteRequest, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      expect(checkResourceOwnership).toHaveBeenCalledWith(
        mockUserId,
        mockCaseId,
        ResourceType.CASE
      );
    });
  });

  describe('边界情况测试', () => {
    it('空权限原因应使用默认消息', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: undefined as unknown as string,
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.message).toBeDefined();
    });

    it('普通用户角色无法获取管理员权限', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId, 'USER');

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '您无权访问此案件',
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockOtherCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockOtherCaseId }),
      });

      expect(response.status).toBe(403);
    });
  });
});
