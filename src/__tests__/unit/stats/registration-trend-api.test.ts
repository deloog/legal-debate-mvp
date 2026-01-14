/**
 * 用户注册趋势API单元测试
 */

import { GET } from '@/app/api/stats/users/registration-trend/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      count: jest.fn(),
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
import { TimeRange, DateGranularity } from '@/types/stats';

describe('用户注册趋势API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockUserCount = prisma.user.count as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/users/registration-trend', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      // 确保不调用数据库操作
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
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
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功返回注册趋势数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // Mock查询结果：第一次count查询总用户数，第二次count查询上期用户数
      mockUserCount
        .mockResolvedValueOnce(100) // 总用户数
        .mockResolvedValueOnce(20); // 上期用户数
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(5) },
        { date: '2024-01-02', count: BigInt(10) },
        { date: '2024-01-03', count: BigInt(15) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('trend');
      expect(json.data).toHaveProperty('summary');
      expect(json.data.summary.totalUsers).toBe(100);
    });

    it('应该支持timeRange查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(50);
      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=TODAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持granularity查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(30);
      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(1) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?granularity=WEEK'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持role查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(25);
      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(1) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?role=LAWYER'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持status查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValue(80);
      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?status=ACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确计算增长率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValueOnce(100).mockResolvedValueOnce(10);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(30) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 增长率 = (30 - 10) / 10 * 100 = 200%
      expect(json.data.summary.growthRate).toBe(200);
    });

    it('应该正确计算日均新增用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // 3天数据，使用LAST_7_DAYS范围（包含3天数据点）
      mockUserCount.mockResolvedValueOnce(100).mockResolvedValueOnce(40);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(10) },
        { date: '2024-01-02', count: BigInt(20) },
        { date: '2024-01-03', count: BigInt(30) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=LAST_7_DAYS'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // newUsers = 10 + 20 + 30 = 60
      // 日均 = 60 / (7天范围) = 8.57
      expect(json.data.summary.newUsers).toBe(60);
      expect(json.data.summary.averageDaily).toBeCloseTo(8.57, 2);
    });

    it('应该处理查询错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockRejectedValue(new Error('数据库错误'));
      // queryRaw不会被调用，因为count已经抛出错误，但mock它以防万一
      mockQueryRaw.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
    });
  });
});
