/**
 * 案件类型分布API单元测试
 */

import { GET } from '@/app/api/stats/cases/type-distribution/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
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
import { TimeRange } from '@/types/stats';

describe('案件类型分布API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockCaseCount = prisma.case.count as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/cases/type-distribution', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution'
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
        'http://localhost/api/stats/cases/type-distribution'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功获取案件类型分布数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValue([
        { type: 'CIVIL', count: BigInt(10) },
        { type: 'CRIMINAL', count: BigInt(5) },
        { type: 'COMMERCIAL', count: BigInt(3) },
      ]);
      mockCaseCount.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.distribution).toHaveLength(3);
      expect(json.data.summary.totalCases).toBe(18);
      expect(json.data.summary.completedCases).toBe(10);
      expect(json.data.summary.activeCases).toBe(5);
    });

    it('应该支持按状态筛选', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValue([{ type: 'CIVIL', count: BigInt(5) }]);
      mockCaseCount.mockResolvedValue(5);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution?status=COMPLETED'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.summary.totalCases).toBe(5);
    });

    it('应该支持不同的时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValue([{ type: 'CIVIL', count: BigInt(10) }]);
      mockCaseCount.mockResolvedValue(10);

      const timeRanges = [
        TimeRange.TODAY,
        TimeRange.LAST_7_DAYS,
        TimeRange.LAST_30_DAYS,
        TimeRange.LAST_90_DAYS,
      ];

      for (const timeRange of timeRanges) {
        jest.clearAllMocks();
        mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
        mockValidatePermissions.mockResolvedValue(null);
        mockQueryRaw.mockResolvedValue([{ type: 'CIVIL', count: BigInt(10) }]);
        mockQueryRaw.mockResolvedValue([{ type: 'CIVIL', count: BigInt(10) }]);
        mockCaseCount.mockResolvedValue(10);

        const request = new NextRequest(
          `http://localhost/api/stats/cases/type-distribution?timeRange=${timeRange}`
        );
        const response = await GET(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      }
    });

    it('应该处理无效的时间范围参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution?timeRange=INVALID'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.message).toBe('无效的查询参数');
    });

    it('应该处理无效的状态参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution?status=INVALID'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.message).toBe('无效的查询参数');
    });

    it('应该处理空数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValue([]);
      mockCaseCount.mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.distribution).toHaveLength(0);
      expect(json.data.summary.totalCases).toBe(0);
    });

    it('应该正确计算百分比', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValue([
        { type: 'CIVIL', count: BigInt(50) },
        { type: 'CRIMINAL', count: BigInt(30) },
        { type: 'COMMERCIAL', count: BigInt(20) },
      ]);
      mockCaseCount.mockResolvedValue(50);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(json.data.distribution[0].percentage).toBe(50);
      expect(json.data.distribution[1].percentage).toBe(30);
      expect(json.data.distribution[2].percentage).toBe(20);
    });

    it('应该处理数据库错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockRejectedValue(new Error('数据库错误'));
      mockCaseCount.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/cases/type-distribution'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.message).toBe('获取案件类型分布失败');
    });
  });
});
