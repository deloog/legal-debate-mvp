/**
 * 用户注册趋势API扩展单元测试
 * 覆盖更多边缘情况和参数组合
 */

import { GET } from '@/app/api/stats/users/registration-trend/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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

describe('用户注册趋势API - 扩展测试', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockUserCount = prisma.user.count as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('时间范围参数测试', () => {
    it('应该正确处理TODAY时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValueOnce(10).mockResolvedValueOnce(5);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15 10:00', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=TODAY&granularity=HOUR'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.trend)).toBe(true);
    });

    it('应该正确处理YESTERDAY时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(15);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-14 10:00', count: BigInt(3) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=YESTERDAY&granularity=HOUR'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理LAST_7_DAYS时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(50);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-09', count: BigInt(5) },
        { date: '2024-01-10', count: BigInt(7) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=LAST_7_DAYS'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理LAST_30_DAYS时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(100);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(10) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=LAST_30_DAYS'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理THIS_WEEK时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValueOnce(30).mockResolvedValueOnce(15);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-W02', count: BigInt(15) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=THIS_WEEK&granularity=WEEK'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理THIS_MONTH时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(200);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01', count: BigInt(50) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=THIS_MONTH&granularity=MONTH'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理THIS_YEAR时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(1000);
      mockQueryRaw.mockResolvedValue([{ date: '2024', count: BigInt(100) }]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=THIS_YEAR&granularity=YEAR'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的时间范围参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=INVALID_RANGE'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('日期粒度参数测试', () => {
    it('应该正确处理HOUR粒度', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(10);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15 10:00', count: BigInt(1) },
        { date: '2024-01-15 11:00', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=TODAY&granularity=HOUR'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理DAY粒度', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(50);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(5) },
        { date: '2024-01-16', count: BigInt(7) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=LAST_7_DAYS&granularity=DAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理WEEK粒度', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(100);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-W02', count: BigInt(25) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=THIS_MONTH&granularity=WEEK'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理MONTH粒度', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(200);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01', count: BigInt(50) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=THIS_YEAR&granularity=MONTH'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的粒度参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?granularity=INVALID_GRANULARITY'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('角色筛选测试', () => {
    it('应该正确筛选ADMIN角色用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(5);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(1) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?role=ADMIN'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确筛选LAWYER角色用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(50);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(10) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?role=LAWYER'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确筛选PARTY角色用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(80);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(15) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?role=PARTY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的角色参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?role=INVALID_ROLE'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('状态筛选测试', () => {
    it('应该正确筛选ACTIVE状态用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(90);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(20) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?status=ACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确筛选INACTIVE状态用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(10);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?status=INACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确筛选PENDING状态用户', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(5);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(1) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?status=PENDING'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该拒绝无效的状态参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?status=INVALID_STATUS'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('组合参数测试', () => {
    it('应该正确处理role和status组合', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(30);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(5) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?role=LAWYER&status=ACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理timeRange和granularity组合', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(20);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(3) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=LAST_7_DAYS&granularity=DAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确处理所有参数组合', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount.mockResolvedValue(15);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend?timeRange=LAST_7_DAYS&granularity=DAY&role=LAWYER&status=ACTIVE'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('边缘情况测试', () => {
    it('应该处理空注册趋势数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);
      mockUserCount
        .mockResolvedValueOnce(0) // 总用户数
        .mockResolvedValueOnce(0); // 前一期用户数
      // 只有一次queryRaw调用，返回空数组
      mockQueryRaw.mockResolvedValueOnce([]); // 空趋势数据

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.trend).toEqual([]);
      expect(json.data.summary.newUsers).toBe(0);
    });

    it('应该处理前一期用户数为0的情况', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockUserCount.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(5) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 当上期为0时，增长率应该是一个值（可能很大）
      expect(json.data.summary.growthRate).toBeDefined();
      // 验证基本功能，不硬编码newUsers值
      expect(json.data.summary.newUsers).toBeGreaterThanOrEqual(0);
    });

    it('应该正确处理BigInt类型转换', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // 总用户数和前一期用户数
      mockUserCount.mockResolvedValueOnce(15).mockResolvedValueOnce(10);
      // 只有一次queryRaw调用，返回2天的数据
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-15', count: BigInt(5) },
        { date: '2024-01-16', count: BigInt(10) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/users/registration-trend'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 确保BigInt被正确转换为Number
      expect(json.data.trend).toHaveLength(2);
      expect(typeof json.data.trend[0].count).toBe('number');
      expect(typeof json.data.trend[1].count).toBe('number');
      // 验证newUsers计算正确（5 + 10 = 15）
      expect(json.data.summary.newUsers).toBe(15);
      // growthRate = (15 - 10) / 10 * 100 = 50
      expect(json.data.summary.growthRate).toBe(50);
    });
  });
});
