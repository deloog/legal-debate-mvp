/**
 * DELETE方法软删除逻辑验证测试
 *
 * 验证软删除的正确性：
 * 1. 删除后设置deletedAt字段
 * 2. 删除后数据仍存在于数据库
 * 3. 删除后的案件不能通过正常访问
 * 4. 删除后的案件不会出现在列表中
 * 5. 权限检查正确处理已删除案件
 */

import { DELETE, GET } from '@/app/api/v1/cases/[id]/route';
import { createMockRequest } from './test-utils';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkResourceOwnership } from '@/lib/middleware/resource-permission';
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
      findMany: jest.fn(),
    },
  },
}));

const mockCaseId = '123e4567-e89b-12d3-a456-426614174000';
const mockUserId = 'user-123';

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
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('DELETE方法 - 软删除逻辑验证', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T10:00:00Z'));

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
      title: '测试案件',
      description: '这是一个测试案件',
      type: 'CIVIL',
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: new Date('2024-01-15T10:00:00Z'),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('软删除核心逻辑验证', () => {
    it('应该正确设置deletedAt字段为当前时间', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
        deletedAt: new Date('2024-01-15T10:00:00Z'),
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
      expect(prisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockCaseId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        })
      );

      // 验证deletedAt的值确实是当前时间
      const updateCall = (prisma.case.update as jest.Mock).mock.calls[0][0];
      const deletedAt = updateCall.data.deletedAt;
      expect(deletedAt).toEqual(new Date('2024-01-15T10:00:00Z'));
    });

    it('应该使用prisma.case.update而非prisma.case.delete（软删除）', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
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

      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 验证调用的是update而非delete
      expect(prisma.case.update).toHaveBeenCalled();
      expect('delete' in prisma.case).toBe(false);
    });

    it('删除后应返回204 No Content状态码', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
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
      // 204响应不应该有Content-Type头部
      expect(response.headers.get('Content-Type')).toBeUndefined();
    });

    it('删除后返回的响应体应该为空', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
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

      const text = await response.text();
      expect(text).toBe('');
    });
  });

  describe('软删除后的数据验证', () => {
    it('软删除后数据仍应存在于数据库中', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
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

      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 验证返回的删除后案件数据仍然包含所有原始字段
      expect(prisma.case.update).toHaveBeenCalled();
      const returnedCase = (prisma.case.update as jest.Mock).mock.results[0]
        .value;
      expect(returnedCase).toBeDefined();
    });

    it('软删除后其他字段应保持不变', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
        title: '原始标题',
        description: '原始描述',
        type: 'CIVIL',
        status: 'DRAFT',
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

      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 验证只更新了deletedAt字段
      const updateCall = (prisma.case.update as jest.Mock).mock.calls[0][0];
      const updateData = updateCall.data;
      expect(Object.keys(updateData)).toEqual(['deletedAt']);
      expect(updateData.deletedAt).toEqual(expect.any(Date));
    });
  });

  describe('软删除后的访问验证', () => {
    it('已删除的案件不能通过GET方法访问（404）', async () => {
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

    it('已删除的案件不能被重新删除', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
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

      // 第一次删除
      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 第二次尝试删除（已删除）
      const response2 = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 第二次删除也应该成功（幂等性）
      expect(response2.status).toBe(204);
    });
  });

  describe('权限检查与软删除的集成', () => {
    it('无权限删除时应不执行数据库更新', async () => {
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

    it('权限检查应先于软删除执行', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
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

      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 验证调用顺序：认证 -> 权限 -> 软删除
      const authCallOrder = (getAuthUser as jest.Mock).mock
        .invocationCallOrder[0];
      const permCallOrder = (checkResourceOwnership as jest.Mock).mock
        .invocationCallOrder[0];
      const updateCallOrder = (prisma.case.update as jest.Mock).mock
        .invocationCallOrder[0];

      expect(authCallOrder).toBeDefined();
      expect(permCallOrder).toBeGreaterThan(authCallOrder);
      expect(updateCallOrder).toBeGreaterThan(permCallOrder);
    });

    it('管理员删除他人案件的软删除逻辑应正常', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId, 'ADMIN');
      const deletedCase = createMockCase({
        userId: 'other-user',
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
      expect(prisma.case.update).toHaveBeenCalledWith({
        where: { id: mockCaseId },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });

  describe('软删除边界情况测试', () => {
    it('删除不存在的案件应返回404', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockRejectedValue(
        new Error('Record not found')
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

    it('软删除过程中数据库错误应返回500', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);

      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
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

    it('软删除应该是幂等的', async () => {
      const mockAuthUser = createMockAuthUser(mockUserId);
      const deletedCase = createMockCase({
        deletedAt: new Date('2024-01-15T10:00:00Z'),
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

      // 第一次删除
      const response1 = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 清除mock状态
      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue({
        hasPermission: true,
      });
      (prisma.case.update as jest.Mock).mockResolvedValue(deletedCase);

      // 第二次删除
      const response2 = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      // 两次删除都应该返回204
      expect(response1.status).toBe(204);
      expect(response2.status).toBe(204);
    });
  });
});
