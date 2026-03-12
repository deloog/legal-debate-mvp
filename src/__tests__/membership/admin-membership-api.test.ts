/**
 * 会员管理API单元测试
 * 测试会员列表、详情、导出、编辑等功能
 */

import { GET as GET_MEMBERSHIPS } from '../../app/api/admin/memberships/route';
import {
  GET as GET_MEMBERSHIP_DETAIL,
  PATCH as UPDATE_MEMBERSHIP,
} from '../../app/api/admin/memberships/[id]/route';
import { GET as EXPORT_MEMBERSHIPS } from '../../app/api/admin/memberships/export/route';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser as getAuthUserImported } from '@/lib/middleware/auth';
import { validatePermissions as validatePermissionsImported } from '@/lib/middleware/permission-check';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userMembership: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    membershipTier: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    membershipHistory: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

describe('会员管理API测试', () => {
  let mockGetAuthUser: jest.Mock;
  let mockValidatePermissions: jest.Mock;
  let mockCount: jest.Mock;
  let mockFindMany: jest.Mock;
  let mockFindUniqueMembership: jest.Mock;
  let mockUpdate: jest.Mock;
  let __mockFindUniqueUser: jest.Mock;
  let __mockFindFirstTier: jest.Mock;
  let mockCreateHistory: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser = getAuthUserImported as jest.Mock;
    mockValidatePermissions = validatePermissionsImported as jest.Mock;
    mockCount = prisma.userMembership.count as jest.Mock;
    mockFindMany = prisma.userMembership.findMany as jest.Mock;
    mockFindUniqueMembership = prisma.userMembership.findUnique as jest.Mock;
    mockUpdate = prisma.userMembership.update as jest.Mock;
    __mockFindUniqueUser = prisma.user.findUnique as jest.Mock;
    __mockFindFirstTier = prisma.membershipTier.findFirst as jest.Mock;
    mockCreateHistory = prisma.membershipHistory.create as jest.Mock;

    // 默认mock返回已认证管理员
    mockGetAuthUser.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });

    // 默认权限验证通过
    mockValidatePermissions.mockResolvedValue(null);

    // 默认mock会员数据
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('GET /api/admin/memberships - 会员列表', () => {
    test('应该成功获取会员列表', async () => {
      const request = new Request(
        'http://localhost:3000/api/admin/memberships?page=1&limit=20',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('memberships');
      expect(data.data).toHaveProperty('pagination');
      expect(mockCount).toHaveBeenCalled();
      expect(mockFindMany).toHaveBeenCalled();
    });

    test('应该支持按等级筛选', async () => {
      const request = new Request(
        'http://localhost:3000/api/admin/memberships?tier=FREE',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tier: expect.objectContaining({
              tier: 'FREE',
            }),
          }),
        })
      );
    });

    test('应该支持按状态筛选', async () => {
      const request = new Request(
        'http://localhost:3000/api/admin/memberships?status=ACTIVE',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    test('应该支持关键词搜索', async () => {
      const request = new Request(
        'http://localhost:3000/api/admin/memberships?search=test',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ email: expect.any(Object) }),
                expect.objectContaining({ username: expect.any(Object) }),
                expect.objectContaining({ name: expect.any(Object) }),
              ]),
            }),
          }),
        })
      );
    });

    test('应该正确处理分页参数', async () => {
      const request = new Request(
        'http://localhost:3000/api/admin/memberships?page=1&limit=10',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.pagination.limit).toBe(10);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        })
      );
    });

    test('未授权用户应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toContain('未认证');
    });

    test('无权限用户应该返回403', async () => {
      mockValidatePermissions.mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: '无权限' }), {
          status: 403,
        })
      );

      const request = new Request(
        'http://localhost:3000/api/admin/memberships',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/memberships/[id] - 会员详情', () => {
    const testMembershipId = 'membership-1';

    test('应该成功获取会员详情', async () => {
      const membershipData = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        autoRenew: true,
        cancelledAt: null,
        cancelledReason: null,
        pausedAt: null,
        pausedReason: null,
        notes: '测试备注',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: {
          id: 'tier-1',
          name: 'BASIC',
          displayName: '基础版',
        },
      };

      mockFindUniqueMembership.mockResolvedValue(membershipData);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIP_DETAIL(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testMembershipId);
      expect(data.data.userEmail).toBe('user@example.com');
      expect(data.data.tierName).toBe('BASIC');
      expect(data.data.status).toBe('ACTIVE');
    });

    test('不存在的会员ID应该返回404', async () => {
      mockFindUniqueMembership.mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/non-existent-id',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIP_DETAIL(request as any, {
        params: Promise.resolve({ id: 'non-existent-id' }),
      });

      expect(response.status).toBe(404);
    });

    test('未授权用户应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIP_DETAIL(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/admin/memberships/[id] - 编辑会员', () => {
    const testMembershipId = 'membership-1';

    test('应该成功更新会员状态为SUSPENDED', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        autoRenew: true,
        notes: '原始备注',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      const updatedMembership = {
        ...originalMembership,
        status: 'SUSPENDED',
        pausedAt: expect.any(Date),
        pausedReason: '测试暂停',
        updatedAt: expect.any(Date),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);
      mockUpdate.mockResolvedValue(updatedMembership);
      mockCreateHistory.mockResolvedValue({});

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'SUSPENDED',
            pausedReason: '测试暂停',
          }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('SUSPENDED');
      expect(data.data.pausedReason).toBe('测试暂停');
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockCreateHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            changeType: 'PAUSE',
            toStatus: 'SUSPENDED',
          }),
        })
      );
    });

    test('应该成功恢复会员状态为ACTIVE', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'SUSPENDED',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        autoRenew: true,
        pausedAt: new Date(),
        pausedReason: '之前暂停',
        notes: '原始备注',
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      const updatedMembership = {
        ...originalMembership,
        status: 'ACTIVE',
        pausedAt: null,
        pausedReason: null,
        updatedAt: expect.any(Date),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);
      mockUpdate.mockResolvedValue(updatedMembership);
      mockCreateHistory.mockResolvedValue({});

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'ACTIVE',
          }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('ACTIVE');
      expect(data.data.pausedAt).toBeNull();
    });

    test('应该成功更新自动续费设置', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        autoRenew: true,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      const updatedMembership = {
        ...originalMembership,
        autoRenew: false,
        updatedAt: expect.any(Date),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);
      mockUpdate.mockResolvedValue(updatedMembership);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            autoRenew: false,
          }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.autoRenew).toBe(false);
    });

    test('应该成功更新会员备注', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        notes: '原始备注',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      const updatedMembership = {
        ...originalMembership,
        notes: '这是测试备注',
        updatedAt: expect.any(Date),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);
      mockUpdate.mockResolvedValue(updatedMembership);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            notes: '这是测试备注',
          }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.notes).toBe('这是测试备注');
    });

    test('应该成功设置取消状态和取消原因', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        autoRenew: true,
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      const updatedMembership = {
        ...originalMembership,
        status: 'CANCELLED',
        cancelledAt: expect.any(Date),
        cancelledReason: '用户要求取消',
        autoRenew: false,
        updatedAt: expect.any(Date),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);
      mockUpdate.mockResolvedValue(updatedMembership);
      mockCreateHistory.mockResolvedValue({});

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'CANCELLED',
            cancelledReason: '用户要求取消',
          }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('CANCELLED');
      expect(data.data.cancelledReason).toBe('用户要求取消');
      expect(data.data.autoRenew).toBe(false);
    });

    test('无效的状态值应该返回400', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'INVALID_STATUS',
          }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      expect(response.status).toBe(400);
    });

    test('空更新应该返回400', async () => {
      const originalMembership = {
        id: testMembershipId,
        userId: 'user-1',
        tierId: 'tier-1',
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
        tier: { name: 'BASIC', displayName: '基础版' },
      };

      mockFindUniqueMembership.mockResolvedValue(originalMembership);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({}),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      expect(response.status).toBe(400);
    });

    test('未授权用户应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'SUSPENDED' }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      expect(response.status).toBe(401);
    });

    test('会员不存在应该返回404', async () => {
      mockFindUniqueMembership.mockResolvedValue(null);

      const request = new Request(
        `http://localhost:3000/api/admin/memberships/${testMembershipId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: 'SUSPENDED' }),
        }
      );

      const response = await UPDATE_MEMBERSHIP(request as any, {
        params: Promise.resolve({ id: testMembershipId }),
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/memberships/export - 导出CSV', () => {
    test('应该成功导出会员CSV', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          tier: { name: 'BASIC', displayName: '基础版' },
          status: 'ACTIVE',
          user: { email: 'user@example.com', username: 'testuser' },
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          autoRenew: true,
          notes: '测试备注',
          cancelledAt: null,
          cancelledReason: null,
          pausedAt: null,
          pausedReason: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/export',
        {
          method: 'GET',
        }
      );

      const response = await EXPORT_MEMBERSHIPS(request as any);

      expect(response.status).toBe(200);
      const contentType =
        response.headers.get('Content-Type') ||
        response.headers.get('content-type');
      expect(contentType).toContain('text/csv');
    });

    test('导出应该支持筛选条件', async () => {
      mockFindMany.mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/export?tier=FREE&status=ACTIVE',
        {
          method: 'GET',
        }
      );

      const response = await EXPORT_MEMBERSHIPS(request as any);

      expect(response.status).toBe(200);
      const contentType =
        response.headers.get('Content-Type') ||
        response.headers.get('content-type');
      expect(contentType).toContain('text/csv');
    });

    test('导出的CSV应该包含正确的表头', async () => {
      mockFindMany.mockResolvedValue([
        {
          id: 'membership-1',
          userId: 'user-1',
          tier: { name: 'BASIC', displayName: '基础版' },
          status: 'ACTIVE',
          user: { email: 'user@example.com', username: 'testuser' },
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          autoRenew: true,
          notes: '测试备注',
        },
      ]);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/export',
        {
          method: 'GET',
        }
      );

      const response = await EXPORT_MEMBERSHIPS(request as any);
      const text = await response.text();

      expect(text).toContain('用户ID');
      expect(text).toContain('用户邮箱');
      expect(text).toContain('会员等级');
      expect(text).toContain('状态');
      expect(text).toContain('开始日期');
      expect(text).toContain('结束日期');
    });

    test('导出文件名应该包含日期', async () => {
      mockFindMany.mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/export',
        {
          method: 'GET',
        }
      );

      const response = await EXPORT_MEMBERSHIPS(request as any);

      const contentDisposition =
        response.headers.get('Content-Disposition') ||
        response.headers.get('content-disposition');
      expect(contentDisposition).toContain('filename');
      expect(contentDisposition).toMatch(/memberships_\d{4}-\d{2}-\d{2}\.csv/);
    });

    test('未授权用户应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/export',
        {
          method: 'GET',
        }
      );

      const response = await EXPORT_MEMBERSHIPS(request as any);

      expect(response.status).toBe(401);
    });

    test('无权限用户应该返回403', async () => {
      mockValidatePermissions.mockResolvedValue(
        new Response(JSON.stringify({ success: false, message: '无权限' }), {
          status: 403,
        })
      );

      const request = new Request(
        'http://localhost:3000/api/admin/memberships/export',
        {
          method: 'GET',
        }
      );

      const response = await EXPORT_MEMBERSHIPS(request as any);

      expect(response.status).toBe(403);
    });
  });

  describe('错误处理', () => {
    test('应该正确处理空结果', async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const request = new Request(
        'http://localhost:3000/api/admin/memberships?search=nonexistent-user-xyz',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.memberships).toEqual([]);
    });

    test('应该处理服务器错误', async () => {
      mockCount.mockRejectedValue(new Error('Database error'));

      const request = new Request(
        'http://localhost:3000/api/admin/memberships',
        {
          method: 'GET',
        }
      );

      const response = await GET_MEMBERSHIPS(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.message).toContain('获取会员列表失败');
    });
  });
});
