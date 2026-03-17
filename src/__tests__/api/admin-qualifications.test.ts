/**
 * 资格审核列表API测试
 * 测试资格审核列表接口的分页、筛选、搜索功能
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/qualifications/route';
import { prisma } from '@/lib/db/prisma';

// =============================================================================
// Mock设置
// =============================================================================

// Mock Prisma客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    lawyerQualification: {
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

import { validatePermissions } from '@/lib/middleware/permission-check';
import { getAuthUser } from '@/lib/middleware/auth';

// =============================================================================
// 测试数据
// =============================================================================

const mockUsers = [
  {
    id: '1',
    email: 'user1@example.com',
    username: 'user1',
    name: '用户1',
  },
  {
    id: '2',
    email: 'user2@example.com',
    username: 'user2',
    name: '用户2',
  },
];

const mockQualifications = [
  {
    id: '1',
    userId: '1',
    licenseNumber: '111012019900000000',
    fullName: '张三',
    lawFirm: '北京律师事务所',
    status: 'PENDING',
    submittedAt: new Date('2024-01-01'),
    reviewedAt: null,
    reviewNotes: null,
    verificationData: null,
    metadata: null,
    user: mockUsers[0],
  },
  {
    id: '2',
    userId: '2',
    licenseNumber: '111012019850000000',
    fullName: '李四',
    lawFirm: '上海律师事务所',
    status: 'UNDER_REVIEW',
    submittedAt: new Date('2024-02-01'),
    reviewedAt: null,
    reviewNotes: null,
    verificationData: null,
    metadata: null,
    user: mockUsers[1],
  },
  {
    id: '3',
    userId: '1',
    licenseNumber: '111012019880000000',
    fullName: '王五',
    lawFirm: '广州律师事务所',
    status: 'APPROVED',
    submittedAt: new Date('2024-03-01'),
    reviewedAt: new Date('2024-03-02'),
    reviewNotes: '审核通过',
    verificationData: null,
    metadata: null,
    user: mockUsers[0],
  },
];

const mockAdminUser = {
  id: 'admin1',
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
  qualifications = mockQualifications,
  totalCount = 3,
}: {
  isAuthenticated?: boolean;
  hasPermission?: boolean;
  qualifications?: typeof mockQualifications;
  totalCount?: number;
} = {}) {
  // Mock认证
  (getAuthUser as jest.Mock).mockResolvedValue(
    isAuthenticated ? mockAdminUser : null
  );

  // Mock权限检查
  (validatePermissions as jest.Mock).mockResolvedValue(
    hasPermission ? null : Response.json({ error: '权限不足' }, { status: 403 })
  );

  // Mock数据库查询
  (prisma.lawyerQualification.count as jest.Mock).mockResolvedValue(totalCount);
  (prisma.lawyerQualification.findMany as jest.Mock).mockResolvedValue(
    qualifications
  );
}

function createTestRequest(queryParams?: Record<string, string>) {
  const searchParams = new URLSearchParams(queryParams).toString();
  const url = `http://localhost:3000/api/admin/qualifications${searchParams ? `?${searchParams}` : ''}`;
  return new NextRequest(url, {
    headers: {
      'x-user-id': mockAdminUser.id,
    },
  });
}

// =============================================================================
// 测试用例
// =============================================================================

describe('资格审核列表API', () => {
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
      expect(data.error).toBe('未认证');
      expect(data.message).toBe('请先登录');
    });

    test('无权限时应返回403错误', async () => {
      setupMocks({ hasPermission: false });
      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    test('应检查qualification:read权限', async () => {
      setupMocks();
      const request = createTestRequest();
      await GET(request);

      expect(validatePermissions).toHaveBeenCalledWith(
        request,
        'qualification:read'
      );
    });
  });

  describe('基础功能', () => {
    test('成功获取资格列表', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data.qualifications).toHaveLength(3);
      expect(result.data.qualifications[0].id).toBe(mockQualifications[0].id);
      expect(result.data.qualifications[0].licenseNumber).toBe(
        mockQualifications[0].licenseNumber
      );
      expect(result.data.pagination).toBeDefined();
      expect(result.data.pagination.total).toBe(3);
      expect(result.data.pagination.page).toBe(1);
      expect(result.data.pagination.limit).toBe(20);
      expect(result.data.pagination.totalPages).toBe(1);
    });

    test('应使用正确的查询参数调用数据库', async () => {
      setupMocks();
      const request = createTestRequest({ page: '2', limit: '10' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
          orderBy: { submittedAt: 'desc' },
        })
      );
    });

    test('应包含用户信息', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.qualifications[0].user).toBeDefined();
      expect(result.data.qualifications[0].user.id).toBe(mockUsers[0].id);
      expect(result.data.qualifications[0].user.email).toBe(mockUsers[0].email);
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
      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 })
      );
    });

    test('应限制最大每页数量为100', async () => {
      setupMocks();
      const request = createTestRequest({ limit: '200' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 })
      );
    });

    test('应确保页码最小为1', async () => {
      setupMocks();
      const request = createTestRequest({ page: '0' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 })
      );
    });
  });

  describe('状态筛选', () => {
    test('应按状态筛选资格', async () => {
      setupMocks({
        qualifications: [mockQualifications[0]],
        totalCount: 1,
      });
      const request = createTestRequest({ status: 'PENDING' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    test('应支持所有状态筛选', async () => {
      const statuses = [
        'PENDING',
        'UNDER_REVIEW',
        'APPROVED',
        'REJECTED',
        'EXPIRED',
      ];

      for (const status of statuses) {
        jest.clearAllMocks();
        setupMocks();
        const request = createTestRequest({ status });
        await GET(request);

        expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
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

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: 'INVALID' }),
        })
      );
    });
  });

  describe('搜索功能', () => {
    test('应按执业证号搜索', async () => {
      setupMocks({
        qualifications: [mockQualifications[0]],
        totalCount: 1,
      });
      const request = createTestRequest({ search: '1110120199' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                licenseNumber: expect.any(Object),
              }),
            ]),
          }),
        })
      );
    });

    test('应按律师姓名搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: '张三' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                fullName: expect.any(Object),
              }),
            ]),
          }),
        })
      );
    });

    test('应按律所名称搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: '北京' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                lawFirm: expect.any(Object),
              }),
            ]),
          }),
        })
      );
    });

    test('应按用户邮箱搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: 'user1' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                user: expect.objectContaining({
                  OR: expect.arrayContaining([
                    expect.objectContaining({
                      email: expect.any(Object),
                    }),
                  ]),
                }),
              }),
            ]),
          }),
        })
      );
    });

    test('应按用户名搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: 'user1' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                user: expect.objectContaining({
                  OR: expect.arrayContaining([
                    expect.objectContaining({
                      username: expect.any(Object),
                    }),
                  ]),
                }),
              }),
            ]),
          }),
        })
      );
    });

    test('应使用不区分大小写的搜索', async () => {
      setupMocks();
      const request = createTestRequest({ search: 'BEIJING' });
      await GET(request);

      const whereClause = (prisma.lawyerQualification.findMany as jest.Mock)
        .mock.calls[0][0].where;
      expect(whereClause.OR[0].licenseNumber.mode).toBe('insensitive');
    });

    test('应忽略空搜索词', async () => {
      setupMocks();
      const request = createTestRequest({ search: '   ' });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('组合查询', () => {
    test('应支持状态和搜索组合筛选', async () => {
      setupMocks({
        qualifications: [mockQualifications[0]],
        totalCount: 1,
      });
      const request = createTestRequest({
        status: 'PENDING',
        search: '张三',
      });
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
            OR: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('错误处理', () => {
    test('应处理数据库错误', async () => {
      setupMocks();
      (prisma.lawyerQualification.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = createTestRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
      expect(data.message).toBe('获取资格审核列表失败');
    });

    test('应记录错误日志', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      setupMocks();
      (prisma.lawyerQualification.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = createTestRequest();
      await GET(request);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('获取资格审核列表失败:')
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('数据验证', () => {
    test('应返回正确的资格字段', async () => {
      setupMocks();
      const request = createTestRequest();
      const response = await GET(request);
      const result = await response.json();

      expect(result.data.qualifications[0]).toHaveProperty('id');
      expect(result.data.qualifications[0]).toHaveProperty('userId');
      expect(result.data.qualifications[0]).toHaveProperty('licenseNumber');
      expect(result.data.qualifications[0]).toHaveProperty('fullName');
      expect(result.data.qualifications[0]).toHaveProperty('lawFirm');
      expect(result.data.qualifications[0]).toHaveProperty('status');
      expect(result.data.qualifications[0]).toHaveProperty('submittedAt');
      expect(result.data.qualifications[0]).toHaveProperty('reviewedAt');
      expect(result.data.qualifications[0]).toHaveProperty('reviewNotes');
      expect(result.data.qualifications[0]).toHaveProperty('user');
    });

    test('应按提交时间降序排列', async () => {
      setupMocks();
      const request = createTestRequest();
      await GET(request);

      expect(prisma.lawyerQualification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { submittedAt: 'desc' },
        })
      );
    });
  });
});
