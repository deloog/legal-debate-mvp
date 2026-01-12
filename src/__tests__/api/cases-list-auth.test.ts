/**
 * 案件列表API认证测试
 *
 * 测试案件列表API (GET /api/v1/cases) 的认证功能
 */

import { GET } from '@/app/api/v1/cases/route';
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

const mockAuthUser: JwtPayload = {
  userId: 'test-user-id',
  email: 'test@example.com',
  role: 'USER',
  iat: 1234567890,
  exp: 1234567890 + 3600,
};

const mockCases = [
  {
    id: 'case-1',
    title: '案件1',
    description: '描述1',
    type: 'CIVIL',
    status: 'ACTIVE',
    userId: 'test-user-id',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
    debates: [],
    user: {
      id: 'test-user-id',
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    },
  },
  {
    id: 'case-2',
    title: '案件2',
    description: '描述2',
    type: 'CRIMINAL',
    status: 'DRAFT',
    userId: 'test-user-id',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    documents: [],
    debates: [],
    user: {
      id: 'test-user-id',
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    },
  },
];

// =============================================================================
// 测试用例
// =============================================================================

describe('案件列表API - 认证测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ========================================
  // 认证验证测试
  // ========================================

  describe('认证验证', () => {
    it('未认证请求应返回401状态码', async () => {
      // Mock getAuthUser返回null（未认证）
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      // 创建请求
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      // 调用API
      const response = await GET(request);

      // 验证响应
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: '未认证',
        message: '请先登录',
      });

      // 验证getAuthUser被调用
      expect(getAuthUser).toHaveBeenCalledWith(request);

      // 验证数据库查询未被调用（因为认证失败）
      expect(prisma.case.findMany).not.toHaveBeenCalled();
    });

    it('缺少Authorization头部应返回401状态码', async () => {
      // Mock getAuthUser返回null（缺少token）
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      // 创建请求（不带Authorization头部）
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      // 调用API
      const response = await GET(request);

      // 验证响应
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('无效token应返回401状态码', async () => {
      // Mock getAuthUser返回null（无效token）
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      // 创建请求（使用无效token）
      const request = createMockRequest('http://localhost:3000/api/v1/cases', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      // 调用API
      const response = await GET(request);

      // 验证响应
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('已认证请求应通过验证并继续处理', async () => {
      // Mock getAuthUser返回认证用户
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      // Mock数据库查询
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);
      (prisma.case.count as jest.Mock).mockResolvedValue(2);

      // 创建请求（使用有效token）
      const request = createMockRequest('http://localhost:3000/api/v1/cases', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      // 调用API
      const response = await GET(request);

      // 验证响应
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      // 验证返回的案件数据结构正确（日期格式可能因JSON序列化而不同）
      expect(data.data.cases).toHaveLength(2);
      expect(data.data.cases[0].id).toBe(mockCases[0].id);
      expect(data.data.cases[0].title).toBe(mockCases[0].title);
      expect(data.data.cases[1].id).toBe(mockCases[1].id);
      expect(data.data.cases[1].title).toBe(mockCases[1].title);
      expect(data.data.total).toBe(2);

      // 验证getAuthUser被调用
      expect(getAuthUser).toHaveBeenCalledWith(request);

      // 验证数据库查询被调用
      expect(prisma.case.findMany).toHaveBeenCalled();
      expect(prisma.case.count).toHaveBeenCalled();
    });

    it('认证失败时应不执行数据库查询', async () => {
      // Mock getAuthUser返回null
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      // 创建请求
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      // 调用API
      await GET(request);

      // 验证数据库查询未被调用
      expect(prisma.case.findMany).not.toHaveBeenCalled();
      expect(prisma.case.count).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // 认证中间件调用测试
  // ========================================

  describe('认证中间件调用', () => {
    it('应调用getAuthUser获取认证用户信息', async () => {
      // Mock getAuthUser返回认证用户
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      // Mock数据库查询
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      // 创建请求
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      // 调用API
      await GET(request);

      // 验证getAuthUser被调用
      expect(getAuthUser).toHaveBeenCalledTimes(1);
      expect(getAuthUser).toHaveBeenCalledWith(request);
    });

    it('应正确处理getAuthUser抛出的错误', async () => {
      // Mock getAuthUser抛出错误
      (getAuthUser as jest.Mock).mockImplementation(() => {
        throw new Error('Token解析失败');
      });

      // 创建请求
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      // 调用API
      const response = await GET(request);

      // 验证响应（错误处理中间件应捕获错误）
      expect(response.status).toBe(500);
    });

    it('getAuthUser返回null时应返回401而非500', async () => {
      // Mock getAuthUser返回null
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      // 创建请求
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      // 调用API
      const response = await GET(request);

      // 验证响应
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });
  });

  // ========================================
  // 不同认证场景测试
  // ========================================

  describe('不同认证场景', () => {
    it('USER角色用户可以访问案件列表', async () => {
      const userPayload: JwtPayload = {
        userId: 'user-1',
        email: 'user@example.com',
        role: 'USER',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(userPayload);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('ADMIN角色用户可以访问案件列表', async () => {
      const adminPayload: JwtPayload = {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(adminPayload);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('SUPER_ADMIN角色用户可以访问案件列表', async () => {
      const superAdminPayload: JwtPayload = {
        userId: 'super-admin-1',
        email: 'superadmin@example.com',
        role: 'SUPER_ADMIN',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(superAdminPayload);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('LAWYER角色用户可以访问案件列表', async () => {
      const lawyerPayload: JwtPayload = {
        userId: 'lawyer-1',
        email: 'lawyer@example.com',
        role: 'LAWYER',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(lawyerPayload);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  // ========================================
  // 认证与业务逻辑集成测试
  // ========================================

  describe('认证与业务逻辑集成', () => {
    it('认证通过后应使用userId构建查询条件', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      // 请求中包含userId参数
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?userId=test-user-id'
      );

      await GET(request);

      // 验证数据库查询被调用
      expect(prisma.case.findMany).toHaveBeenCalled();
      expect(prisma.case.count).toHaveBeenCalled();
    });

    it('认证通过后应正确处理查询参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      // 请求中包含多个查询参数
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?page=2&limit=10&type=CIVIL&status=ACTIVE&search=测试'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.case.findMany).toHaveBeenCalled();
    });

    it('认证通过后应正确返回分页信息', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);
      (prisma.case.count as jest.Mock).mockResolvedValue(25);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?page=2&limit=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.meta.pagination).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrevious: true,
      });
    });
  });

  // ========================================
  // 边界情况测试
  // ========================================

  describe('边界情况', () => {
    it('空案件列表应返回200状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data.cases).toEqual([]);
      expect(data.data.total).toBe(0);
    });

    it('数据库连接失败应返回500状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('认证成功但count查询失败应返回500状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('认证成功但findMany查询失败应返回500状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest('http://localhost:3000/api/v1/cases');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('认证通过后应正确处理无效查询参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      // 请求中包含无效的查询参数
      const request = createMockRequest(
        'http://localhost:3000/api/v1/cases?invalid=param&sortBy=invalid_field'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('认证通过后应正确处理空查询参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);
      (prisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.case.count as jest.Mock).mockResolvedValue(0);

      // 请求中无查询参数
      const request = createMockRequest('http://localhost:3000/api/v1/cases');

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.meta.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      });
    });
  });
});
