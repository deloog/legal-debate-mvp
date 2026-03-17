jest.mock('@/lib/ai/quota', () => ({
  checkAIQuota: jest.fn().mockResolvedValue({ allowed: true }),
  recordAIUsage: jest.fn().mockResolvedValue(undefined),
}));

/**
 * 辩论列表API认证测试
 *
 * 测试辩论列表API (GET /api/v1/debates) 的认证功能
 */

import { GET, POST } from '@/app/api/v1/debates/route';
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
      create: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    actionLog: {
      create: jest.fn().mockResolvedValue({}),
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

const mockDebates = [
  {
    id: 'cmjtg7np100axc0zgwiwpwt1a',
    title: '辩论1',
    caseId: 'cmjtg7np100axc0zgwiwpwt9a',
    userId: 'test-user-id',
    status: 'DRAFT',
    currentRound: 0,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    case: {
      id: 'cmjtg7np100axc0zgwiwpwt9a',
      title: '案件1',
      type: 'CIVIL',
    },
    user: {
      id: 'test-user-id',
      username: 'testuser',
      name: 'Test User',
    },
    _count: {
      rounds: 1,
    },
  },
  {
    id: 'cmjtg7np100axc0zgwiwpwt2a',
    title: '辩论2',
    caseId: 'cmjtg7np100axc0zgwiwpwt9b',
    userId: 'test-user-id',
    status: 'IN_PROGRESS',
    currentRound: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    case: {
      id: 'cmjtg7np100axc0zgwiwpwt9b',
      title: '案件2',
      type: 'CRIMINAL',
    },
    user: {
      id: 'test-user-id',
      username: 'testuser',
      name: 'Test User',
    },
    _count: {
      rounds: 2,
    },
  },
];

const mockCases = [
  {
    id: 'cmjtg7np100axc0zgwiwpwt9a',
    title: '案件1',
    type: 'CIVIL',
  },
  {
    id: 'cmjtg7np100axc0zgwiwpwt9b',
    title: '案件2',
    type: 'CRIMINAL',
  },
];

// =============================================================================
// 测试用例
// =============================================================================

describe('辩论列表API - 认证测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { checkAIQuota } = require('@/lib/ai/quota');
    (checkAIQuota as jest.Mock).mockResolvedValue({ allowed: true });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ========================================
  // 认证验证测试
  // ========================================

  describe('认证验证', () => {
    it('未认证请求应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: '未认证',
        message: '请先登录',
      });

      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(prisma.debate.findMany).not.toHaveBeenCalled();
      expect(prisma.debate.count).not.toHaveBeenCalled();
    });

    it('缺少Authorization头部应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('无效token应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          headers: { Authorization: 'Bearer invalid-token' },
        }
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });

    it('已认证请求应通过验证并继续处理', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue(mockDebates);
      (prisma.debate.count as jest.Mock).mockResolvedValue(2);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.meta.pagination.total).toBe(2);

      expect(getAuthUser).toHaveBeenCalledWith(request);
      expect(prisma.debate.findMany).toHaveBeenCalled();
      expect(prisma.debate.count).toHaveBeenCalled();
    });

    it('认证失败时应不执行数据库查询', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      await GET(request);

      expect(prisma.debate.findMany).not.toHaveBeenCalled();
      expect(prisma.debate.count).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // POST方法认证验证
  // ========================================

  describe('POST方法认证验证', () => {
    it('未认证请求应返回401状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const requestBody = {
        caseId: 'cmjtg7np100axc0zgwiwpwt9a',
        title: 'Test Debate',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          method: 'POST',
          body: requestBody,
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    it('已认证请求应通过验证并继续处理', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCases[0]);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.debate.create as jest.Mock).mockResolvedValue({
        id: 'new-debate-id',
        caseId: 'case-1',
        userId: mockAuthUser.userId,
        title: 'Test Debate',
      });

      const requestBody = {
        caseId: 'cmjtg7np100axc0zgwiwpwt9a',
        title: 'Test Debate',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          method: 'POST',
          body: requestBody,
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(getAuthUser).toHaveBeenCalled();
    });

    it('认证失败时应不执行数据库操作', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const requestBody = {
        caseId: 'cmjtg7np100axc0zgwiwpwt9a',
        title: 'Test Debate',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          method: 'POST',
          body: requestBody,
        }
      );

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(prisma.case.findUnique).not.toHaveBeenCalled();
    });
  });

  // ========================================
  // 认证中间件调用测试
  // ========================================

  describe('认证中间件调用', () => {
    it('GET方法应调用getAuthUser获取认证用户信息', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      await GET(request);

      expect(getAuthUser).toHaveBeenCalledTimes(1);
      expect(getAuthUser).toHaveBeenCalledWith(request);
    });

    it('POST方法应调用getAuthUser获取认证用户信息', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCases[0]);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.debate.create as jest.Mock).mockResolvedValue({
        id: 'new-debate-id',
        caseId: 'case-1',
        userId: mockAuthUser.userId,
        title: 'Test Debate',
      });

      const requestBody = {
        caseId: 'cmjtg7np100axc0zgwiwpwt9a',
        title: 'Test Debate',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          method: 'POST',
          body: requestBody,
        }
      );

      await POST(request);

      expect(getAuthUser).toHaveBeenCalledTimes(1);
      expect(getAuthUser).toHaveBeenCalledWith(request);
    });

    it('应正确处理getAuthUser抛出的错误', async () => {
      (getAuthUser as jest.Mock).mockImplementation(() => {
        throw new Error('Token解析失败');
      });

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('getAuthUser返回null时应返回401而非500', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('未认证');
    });
  });

  // ========================================
  // 不同认证场景测试
  // ========================================

  describe('不同认证场景', () => {
    it('USER角色用户可以访问辩论列表', async () => {
      const userPayload: JwtPayload = {
        userId: 'user-1',
        email: 'user@example.com',
        role: 'USER',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(userPayload);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('ADMIN角色用户可以访问辩论列表', async () => {
      const adminPayload: JwtPayload = {
        userId: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(adminPayload);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('SUPER_ADMIN角色用户可以访问辩论列表', async () => {
      const superAdminPayload: JwtPayload = {
        userId: 'super-admin-1',
        email: 'superadmin@example.com',
        role: 'SUPER_ADMIN',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(superAdminPayload);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('LAWYER角色用户可以访问辩论列表', async () => {
      const lawyerPayload: JwtPayload = {
        userId: 'lawyer-1',
        email: 'lawyer@example.com',
        role: 'LAWYER',
      };

      (getAuthUser as jest.Mock).mockResolvedValue(lawyerPayload);
      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
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

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      await GET(request);

      expect(prisma.debate.findMany).toHaveBeenCalled();
      expect(prisma.debate.count).toHaveBeenCalled();
    });

    it('认证通过后应正确处理查询参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?page=2&limit=10&search=test'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.debate.findMany).toHaveBeenCalled();
      expect(prisma.debate.count).toHaveBeenCalled();
    });

    it('认证通过后POST方法应使用userId创建辩论', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.case.findUnique as jest.Mock).mockResolvedValue(mockCases[0]);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.debate.create as jest.Mock).mockResolvedValue({
        id: 'new-debate-id',
        caseId: 'case-1',
        userId: mockAuthUser.userId,
        title: 'Test Debate',
      });

      const requestBody = {
        caseId: 'cmjtg7np100axc0zgwiwpwt9a',
        title: 'Test Debate',
      };

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates',
        {
          method: 'POST',
          body: requestBody,
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      await POST(request);

      expect(getAuthUser).toHaveBeenCalled();
      expect(prisma.debate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockAuthUser.userId,
          }),
        })
      );
    });
  });

  // ========================================
  // 边界情况测试
  // ========================================

  describe('边界情况', () => {
    it('空辩论列表应返回200状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
      expect(data.meta.pagination.total).toBe(0);
    });

    it('数据库连接失败应返回500状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('认证成功但count查询失败应返回500状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('认证成功但findMany查询失败应返回500状态码', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });

    it('认证通过后应正确处理无效查询参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest(
        'http://localhost:3000/api/v1/debates?page=invalid'
      );
      const response = await GET(request);

      // 验证失败应该返回400
      expect(response.status).toBe(400);
    });

    it('认证通过后应正确处理空查询参数', async () => {
      (getAuthUser as jest.Mock).mockResolvedValue(mockAuthUser);

      (prisma.debate.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.debate.count as jest.Mock).mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/v1/debates');
      const response = await GET(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.data).toEqual([]);
      expect(data.meta.pagination.total).toBe(0);
    });
  });
});
