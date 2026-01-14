/**
 * 用户活跃度API单元测试
 */

import { GET } from '@/app/api/stats/users/activity/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
    },
    actionLog: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(),
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { TimeRange } from '@/types/stats';

describe('用户活跃度API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockUserCount = prisma.user.count as jest.Mock;
  const mockActionLogFindMany = prisma.actionLog.findMany as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/users/activity', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该返回403当用户没有stats:read权限', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
      mockValidatePermissions.mockResolvedValue(
        new Response(JSON.stringify({ error: '无权限' }), { status: 403 })
      );

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功返回活跃度数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // Mock活跃度分布统计
      mockUserCount
        .mockResolvedValueOnce(20) // veryActive
        .mockResolvedValueOnce(30) // active
        .mockResolvedValueOnce(40) // inactive
        .mockResolvedValueOnce(10); // dormant

      // Mock趋势数据
      mockQueryRaw
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            active_users: BigInt(15),
            new_users: BigInt(5),
          },
          {
            date: '2024-01-02',
            active_users: BigInt(20),
            new_users: BigInt(8),
          },
        ])
        .mockResolvedValueOnce([
          { date: '2024-01-01', new_users: BigInt(5) },
          { date: '2024-01-02', new_users: BigInt(8) },
        ]);

      // Mock登录日志
      mockActionLogFindMany.mockResolvedValue([
        { userId: 'user-1', createdAt: new Date() },
        { userId: 'user-2', createdAt: new Date() },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('distribution');
      expect(json.data).toHaveProperty('trend');
      expect(json.data).toHaveProperty('summary');
      expect(json.data.summary.totalUsers).toBe(100);
    });

    it('应该正确计算活跃度分布', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount
        .mockResolvedValueOnce(10) // veryActive
        .mockResolvedValueOnce(20) // active
        .mockResolvedValueOnce(30) // inactive
        .mockResolvedValueOnce(5); // dormant

      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);
      mockActionLogFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.distribution.veryActive).toBe(10);
      expect(json.data.distribution.active).toBe(20);
      expect(json.data.distribution.inactive).toBe(30);
      expect(json.data.distribution.dormant).toBe(5);
    });

    it('应该正确计算活跃率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // veryActive: 20, active: 30, inactive: 40, dormant: 10
      // total = 20 + 30 + 40 + 10 = 100
      mockUserCount
        .mockResolvedValueOnce(20) // veryActive
        .mockResolvedValueOnce(30) // active
        .mockResolvedValueOnce(40) // inactive
        .mockResolvedValueOnce(10); // dormant

      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);
      mockActionLogFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // activeRate = (20 + 30) / 100 * 100 = 50%
      expect(json.data.summary.activeRate).toBe(50);
    });

    it('应该正确计算平均登录频率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(50);
      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);

      // Mock登录日志：用户1登录3次，用户2登录2次
      mockActionLogFindMany.mockResolvedValue([
        { userId: 'user-1', createdAt: new Date() },
        { userId: 'user-1', createdAt: new Date() },
        { userId: 'user-1', createdAt: new Date() },
        { userId: 'user-2', createdAt: new Date() },
        { userId: 'user-2', createdAt: new Date() },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 平均频率 = (3 + 2) / 2 = 2.5
      expect(json.data.summary.avgLoginFrequency).toBeCloseTo(2.5, 1);
    });

    it('应该支持timeRange查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(25);
      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);
      mockActionLogFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity?timeRange=TODAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持role查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(30);
      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);
      mockActionLogFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity?role=LAWYER'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持status查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(80);
      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);
      mockActionLogFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity?status=ACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该处理查询错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该处理空数据情况', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockQueryRaw.mockResolvedValue([]).mockResolvedValue([]);
      mockActionLogFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/activity'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.summary.totalUsers).toBe(0);
      expect(json.data.summary.activeRate).toBe(0);
    });
  });
});
