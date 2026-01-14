/**
 * 系统性能统计API - 响应时间 单元测试
 */

import { GET } from '@/app/api/stats/performance/response-time/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
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
import { DateGranularity, TimeRange } from '@/types/stats';

describe('响应时间统计API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/performance/response-time', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
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
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功返回响应时间数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // Mock汇总查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(100),
          avg_duration: 1500,
          min_duration: 500,
          max_duration: 5000,
        },
      ]);

      // Mock百分位查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          p95_duration: 3000,
          p99_duration: 4500,
        },
      ]);

      // Mock趋势查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          date: '2024-01-01',
          count: BigInt(30),
          avg_duration: 1400,
          min_duration: 500,
          max_duration: 4000,
        },
        {
          date: '2024-01-02',
          count: BigInt(40),
          avg_duration: 1600,
          min_duration: 600,
          max_duration: 5000,
        },
      ]);

      // Mock按服务商查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          provider: 'deepseek',
          count: BigInt(60),
          avg_duration: 1400,
        },
        {
          provider: 'zhipu',
          count: BigInt(40),
          avg_duration: 1600,
        },
      ]);

      // Mock按模型查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          model: 'deepseek-chat',
          count: BigInt(50),
          avg_duration: 1350,
        },
        {
          model: 'deepseek-reasoner',
          count: BigInt(10),
          avg_duration: 1600,
        },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('trend');
      expect(json.data).toHaveProperty('summary');
      expect(json.data.summary.totalRequests).toBe(100);
      expect(json.data.summary.averageResponseTime).toBe(1500);
      expect(json.data.summary.p95ResponseTime).toBe(3000);
      expect(json.data.summary.p99ResponseTime).toBe(4500);
    });

    it('应该支持timeRange查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(50),
          avg_duration: 1200,
          min_duration: 400,
          max_duration: 3000,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 2500, p99_duration: 2800 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time?timeRange=TODAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持granularity查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(30),
          avg_duration: 1400,
          min_duration: 500,
          max_duration: 4000,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 3000, p99_duration: 4000 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time?granularity=WEEK'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持provider查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(60),
          avg_duration: 1400,
          min_duration: 500,
          max_duration: 4000,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 2800, p99_duration: 3500 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time?provider=deepseek'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持model查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(50),
          avg_duration: 1350,
          min_duration: 450,
          max_duration: 3500,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 2600, p99_duration: 3200 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time?model=deepseek-chat'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确计算响应时间百分位数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          avg_duration: 1500,
          min_duration: 300,
          max_duration: 8000,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          p95_duration: 4000,
          p99_duration: 6500,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.summary.p95ResponseTime).toBe(4000);
      expect(json.data.summary.p99ResponseTime).toBe(6500);
    });

    it('应该返回400当查询参数无效', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time?timeRange=INVALID'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该处理查询错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该正确处理空数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.summary.totalRequests).toBe(0);
    });

    it('应该正确构建趋势数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(80),
          avg_duration: 1550,
          min_duration: 550,
          max_duration: 5500,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 3200, p99_duration: 4800 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          date: '2024-01-01',
          count: BigInt(25),
          avg_duration: 1400,
          min_duration: 550,
          max_duration: 4000,
        },
        {
          date: '2024-01-02',
          count: BigInt(30),
          avg_duration: 1500,
          min_duration: 600,
          max_duration: 4500,
        },
        {
          date: '2024-01-03',
          count: BigInt(25),
          avg_duration: 1600,
          min_duration: 700,
          max_duration: 5500,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.trend.length).toBe(3);
      expect(json.data.trend[0].date).toBe('2024-01-01');
      expect(json.data.trend[0].count).toBe(25);
      expect(json.data.trend[0].averageResponseTime).toBe(1400);
    });

    it('应该正确按服务商分组统计', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(150),
          avg_duration: 1500,
          min_duration: 500,
          max_duration: 5000,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 3000, p99_duration: 4500 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          provider: 'deepseek',
          count: BigInt(90),
          avg_duration: 1400,
        },
        {
          provider: 'zhipu',
          count: BigInt(60),
          avg_duration: 1650,
        },
      ]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.byProvider.length).toBe(2);
      expect(json.data.byProvider[0].provider).toBe('deepseek');
      expect(json.data.byProvider[0].totalRequests).toBe(90);
      expect(json.data.byProvider[0].averageResponseTime).toBe(1400);
    });

    it('应该正确按模型分组统计', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(120),
          avg_duration: 1450,
          min_duration: 480,
          max_duration: 4800,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 2900, p99_duration: 4300 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          model: 'deepseek-chat',
          count: BigInt(70),
          avg_duration: 1300,
        },
        {
          model: 'deepseek-reasoner',
          count: BigInt(30),
          avg_duration: 1750,
        },
        {
          model: 'zhipu-chat',
          count: BigInt(20),
          avg_duration: 1500,
        },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.byModel.length).toBe(3);
      expect(json.data.byModel[0].model).toBe('deepseek-chat');
      expect(json.data.byModel[0].totalRequests).toBe(70);
    });

    it('应该正确处理模型为null的情况', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(30),
          avg_duration: 1500,
          min_duration: 500,
          max_duration: 5000,
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { p95_duration: 3000, p99_duration: 4500 },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          model: null,
          count: BigInt(30),
          avg_duration: 1500,
        },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/response-time'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.byModel[0].model).toBe('unknown');
    });
  });
});
