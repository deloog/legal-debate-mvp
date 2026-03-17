/**
 * 用户详情API测试
 */

// =============================================================================
// Mock设置 - 必须在所有import之前
// =============================================================================

// Mock Prisma客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    lawyerQualification: {
      findFirst: jest.fn(),
    },
    enterpriseAccount: {
      findUnique: jest.fn(),
    },
    case: {
      count: jest.fn(),
    },
    debate: {
      count: jest.fn(),
    },
    document: {
      count: jest.fn(),
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

// =============================================================================
// 导入
// =============================================================================

import { DELETE, GET, OPTIONS, PUT } from '@/app/api/admin/users/[id]/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// =============================================================================
// 测试数据
// =============================================================================

const mockUserId = 'cmtest123456789';
const mockAdminId = 'cmadmin123456789';

const mockUser = {
  userId: mockAdminId,
  email: 'admin@example.com',
  role: 'ADMIN',
};

const mockUserData = {
  id: mockUserId,
  email: 'test@example.com',
  username: 'testuser',
  name: '测试用户',
  role: 'USER',
  status: 'ACTIVE',
  phone: '13800138000',
  address: '北京市朝阳区',
  bio: '这是一个测试用户',
  avatar: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
  lastLoginAt: new Date('2024-01-15'),
  loginCount: 10,
  emailVerified: new Date('2024-01-02'),
};

// =============================================================================
// 辅助函数
// =============================================================================

function setupMocks({
  isAuthenticated = true,
  hasPermission = true,
  userExists = true,
}: {
  isAuthenticated?: boolean;
  hasPermission?: boolean;
  userExists?: boolean;
} = {}) {
  // Mock认证
  (getAuthUser as jest.Mock).mockResolvedValue(
    isAuthenticated ? mockUser : null
  );

  // Mock权限检查
  (validatePermissions as jest.Mock).mockResolvedValue(
    hasPermission ? null : Response.json({ error: '权限不足' }, { status: 403 })
  );

  // Mock用户查询
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(
    userExists ? mockUserData : null
  );

  // Mock统计数据
  (prisma.case.count as jest.Mock).mockResolvedValue(5);
  (prisma.debate.count as jest.Mock).mockResolvedValue(3);
  (prisma.document.count as jest.Mock).mockResolvedValue(10);

  // Mock认证信息
  (prisma.lawyerQualification.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.enterpriseAccount.findUnique as jest.Mock).mockResolvedValue(null);
}

function createTestRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

  const requestHeaders: Record<string, string> = {
    'x-user-id': mockUser.userId,
    ...headers,
  };

  const requestInit: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
    if (!requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }
  }

  // 使用类型断言来绕过 Next.js RequestInit 的严格类型检查
  return new NextRequest(
    url,
    requestInit as RequestInit & {
      signal?: AbortSignal;
    }
  );
}

// =============================================================================
// 测试用例
// =============================================================================

describe('Admin Users Detail API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/admin/users/[id]', () => {
    it('应该成功获取用户详情', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toHaveProperty('user');
      expect(data.data).toHaveProperty('statistics');
      expect(data.data.user.id).toBe(mockUserId);
    });

    it('应该返回401未认证', async () => {
      setupMocks({ isAuthenticated: false });
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
    });

    it('应该返回403无权限', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该返回400用户ID格式不正确', async () => {
      setupMocks();
      const request = createTestRequest(
        'http://localhost:3000/api/admin/users/invalid@id'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid@id' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效参数');
    });

    it('应该返回404用户不存在', async () => {
      setupMocks({ userExists: false });
      const request = createTestRequest(
        'http://localhost:3000/api/admin/users/cmnonexistent123'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'cmnonexistent123' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('未找到');
    });

    it('应该包含用户统计信息', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.statistics).toHaveProperty('casesCount', 5);
      expect(data.data.statistics).toHaveProperty('debatesCount', 3);
      expect(data.data.statistics).toHaveProperty('documentsCount', 10);
    });

    it('应该包含正确的时间戳格式', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.user.createdAt).toBeDefined();
      expect(data.data.user.updatedAt).toBeDefined();
    });
  });

  describe('PUT /api/admin/users/[id]', () => {
    it('应该成功更新用户信息', async () => {
      setupMocks();
      const updatedData = { ...mockUserData, name: '测试用户-已更新' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedData);

      const updateData = {
        name: '测试用户-已更新',
        phone: '13800138000',
      };

      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.user.name).toBe(updateData.name);
      expect(data.data.user.phone).toBe(updateData.phone);
      expect(data.message).toBe('更新成功');
    });

    it('应该更新用户角色', async () => {
      setupMocks();
      const updatedData = { ...mockUserData, role: 'LAWYER' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedData);

      const updateData = {
        role: 'LAWYER',
      };

      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.user.role).toBe(updateData.role);
    });

    it('应该更新用户状态', async () => {
      setupMocks();
      const updatedData = { ...mockUserData, status: 'SUSPENDED' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedData);

      const updateData = {
        status: 'SUSPENDED',
      };

      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.user.status).toBe(updateData.status);
    });

    it('应该返回401未认证', async () => {
      setupMocks({ isAuthenticated: false });
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: { name: '测试' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
    });

    it('应该返回403无权限', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: { name: '测试' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该返回400角色值不正确', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: { role: 'INVALID_ROLE' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效参数');
    });

    it('应该返回400状态值不正确', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: { status: 'INVALID_STATUS' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效参数');
    });

    it('应该返回404用户不存在', async () => {
      setupMocks();
      const dbError = new Error('Record to update not found');
      (prisma.user.update as jest.Mock).mockRejectedValue(dbError);

      const request = createTestRequest(
        'http://localhost:3000/api/admin/users/cmnonexistent',
        {
          method: 'PUT',
          body: { name: '测试' },
        }
      );

      const response = await PUT(request, {
        params: Promise.resolve({ id: 'cmnonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('未找到');
    });
  });

  describe('DELETE /api/admin/users/[id]', () => {
    it('应该成功删除用户（软删除）', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBe('删除成功');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserId },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
            status: 'INACTIVE',
          }),
        })
      );
    });

    it('应该返回401未认证', async () => {
      setupMocks({ isAuthenticated: false });
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('未认证');
    });

    it('应该返回403无权限', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该返回403不能删除自己', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockAdminId}`,
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockAdminId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('禁止操作');
    });

    it('应该返回400用户ID格式不正确', async () => {
      setupMocks();
      const request = createTestRequest(
        'http://localhost:3000/api/admin/users/invalid@id',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'invalid@id' }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('无效参数');
    });

    it('应该返回404用户不存在', async () => {
      setupMocks();
      const dbError = new Error('Record to update not found');
      (prisma.user.update as jest.Mock).mockRejectedValue(dbError);

      const request = createTestRequest(
        'http://localhost:3000/api/admin/users/cmnonexistent',
        {
          method: 'DELETE',
        }
      );

      const response = await DELETE(request, {
        params: Promise.resolve({ id: 'cmnonexistent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('未找到');
    });
  });

  describe('OPTIONS /api/admin/users/[id]', () => {
    it('应该返回CORS头', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
        'http://localhost:3000'
      );
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
        'GET, PUT, DELETE, OPTIONS'
      );
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe(
        'Content-Type, Authorization'
      );
    });

    it('应该返回空body', async () => {
      const response = await OPTIONS();
      const text = await response.text();

      expect(text).toBe('');
    });
  });

  describe('Integration tests', () => {
    it('应该处理完整的CRUD流程', async () => {
      // GET
      setupMocks();
      const getRequest = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const getResponse = await GET(getRequest, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData.data.user.id).toBe(mockUserId);

      // PUT
      jest.clearAllMocks();
      setupMocks();
      const updatedData = { ...mockUserData, name: '集成测试更新' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedData);

      const updateData = {
        name: '集成测试更新',
        status: 'ACTIVE',
      };
      const putRequest = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: updateData,
        }
      );
      const putResponse = await PUT(putRequest, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const putData = await putResponse.json();

      expect(putResponse.status).toBe(200);
      expect(putData.data.user.name).toBe(updateData.name);
      expect(putData.data.user.status).toBe(updateData.status);

      // DELETE
      jest.clearAllMocks();
      setupMocks();
      const deleteRequest = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'DELETE',
        }
      );
      const deleteResponse = await DELETE(deleteRequest, {
        params: Promise.resolve({ id: mockUserId }),
      });
      const deleteData = await deleteResponse.json();

      expect(deleteResponse.status).toBe(200);
      expect(deleteData.message).toBe('删除成功');
    });
  });

  describe('Response headers', () => {
    it('GET应该返回正确的Content-Type', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: mockUserId }),
      });

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('PUT应该返回正确的Content-Type', async () => {
      setupMocks();
      const updatedData = { ...mockUserData, name: '测试' };
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedData);

      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'PUT',
          body: { name: '测试' },
        }
      );
      const response = await PUT(request, {
        params: Promise.resolve({ id: mockUserId }),
      });

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('DELETE应该返回正确的Content-Type', async () => {
      setupMocks();
      const request = createTestRequest(
        `http://localhost:3000/api/admin/users/${mockUserId}`,
        {
          method: 'DELETE',
        }
      );
      const response = await DELETE(request, {
        params: Promise.resolve({ id: mockUserId }),
      });

      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });
});
