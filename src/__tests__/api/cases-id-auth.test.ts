/**
 * 单个案件API认证集成测试
 *
 * 验证GET/PUT/DELETE方法的认证集成是否正常工作
 */

import { GET, PUT, DELETE } from '@/app/api/v1/cases/[id]/route';
import { createMockRequest } from './test-utils';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkResourceOwnership } from '@/lib/middleware/resource-permission';

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

const mockCaseId = '123e4567-e89b-12d3-a456-426614174000';

/**
 * 辅助函数：创建模拟的认证用户
 */
function createMockAuthUser(userId: string, role: string = 'USER') {
  return { userId, email: `test${userId}@example.com`, role };
}

describe('单个案件API - 认证集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET方法 - 认证验证', () => {
    it('未认证请求应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    it('已认证请求应通过验证并继续处理', async () => {
      const mockAuthUser = createMockAuthUser(mockCaseId);
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const mockPermissionResult = {
        hasPermission: true,
      };
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(getAuthUser).toHaveBeenCalledTimes(1);
    });

    it('应正确处理认证中间件抛出的错误', async () => {
      (getAuthUser as jest.Mock).mockImplementation(() => {
        throw new Error('Token解析失败');
      });

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      const response = await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const data = await response.json();
      expect(response.status).toBe(500);
      expect(data.error?.message).toBe('Token解析失败');
    });
  });

  describe('PUT方法 - 认证验证', () => {
    it('未认证请求应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const updateData = { title: '更新标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    it('已认证请求应通过验证并继续处理', async () => {
      const mockAuthUser = createMockAuthUser(mockCaseId);
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const mockPermissionResult = {
        hasPermission: true,
      };
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      const updateData = { title: '更新标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(getAuthUser).toHaveBeenCalledTimes(1);
    });

    it('未认证时不应执行数据库操作', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const updateData = { title: '更新标题' };
      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: updateData }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(401);
      expect(checkResourceOwnership).not.toHaveBeenCalled();
    });
  });

  describe('DELETE方法 - 认证验证', () => {
    it('未认证请求应返回401', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    it('已认证请求应通过验证并继续处理', async () => {
      const mockAuthUser = createMockAuthUser(mockCaseId);
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const mockPermissionResult = {
        hasPermission: true,
      };
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(getAuthUser).toHaveBeenCalledTimes(1);
    });

    it('未认证时不应执行数据库操作', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(response.status).toBe(401);
      expect(checkResourceOwnership).not.toHaveBeenCalled();
    });
  });

  describe('认证与权限集成测试', () => {
    it('应先验证认证，再验证权限', async () => {
      const mockAuthUser = createMockAuthUser(mockCaseId);
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const mockPermissionResult = { hasPermission: true };
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(getAuthUser).toHaveBeenCalled();
      expect(checkResourceOwnership).toHaveBeenCalled();

      const authCallOrder = (getAuthUser as jest.Mock).mock
        .invocationCallOrder[0];
      const permCallOrder = (checkResourceOwnership as jest.Mock).mock
        .invocationCallOrder[0];
      expect(authCallOrder).toBeLessThan(permCallOrder);
    });

    it('认证失败时应不进行权限检查', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );

      await GET(request, {
        params: Promise.resolve({ id: mockCaseId }),
      });

      expect(getAuthUser).toHaveBeenCalled();
      expect(checkResourceOwnership).not.toHaveBeenCalled();
    });
  });

  describe('不同HTTP方法的认证一致性', () => {
    it('所有方法都应使用相同的认证逻辑', async () => {
      const mockAuthUser = createMockAuthUser(mockCaseId);
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      const mockPermissionResult = {
        hasPermission: true,
      };
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      const getRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`
      );
      const putRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'PUT', body: { title: '更新' } }
      );
      const deleteRequest = createMockRequest(
        `http://localhost:3000/api/v1/cases/${mockCaseId}`,
        { method: 'DELETE' }
      );

      await GET(getRequest, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      expect(getAuthUser).toHaveBeenCalledWith(getRequest);

      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      await PUT(putRequest, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      expect(getAuthUser).toHaveBeenCalledWith(putRequest);

      jest.clearAllMocks();
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (checkResourceOwnership as jest.Mock).mockResolvedValue(
        mockPermissionResult
      );

      await DELETE(deleteRequest, {
        params: Promise.resolve({ id: mockCaseId }),
      });
      expect(getAuthUser).toHaveBeenCalledWith(deleteRequest);
    });
  });
});
