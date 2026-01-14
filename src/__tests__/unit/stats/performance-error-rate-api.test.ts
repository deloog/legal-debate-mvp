/**
 * 系统性能统计API - 错误率 单元测试
 */

import { GET } from '@/app/api/stats/performance/error-rate/route';
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

describe('错误率统计API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/performance/error-rate', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
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
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功返回错误率数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // Mock AI交互统计查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      // Mock错误日志统计查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(10),
          recovered_errors: BigInt(5),
        },
      ]);

      // Mock按服务商查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          provider: 'deepseek',
          total_requests: BigInt(120),
          error_count: BigInt(5),
        },
        {
          provider: 'zhipu',
          total_requests: BigInt(80),
          error_count: BigInt(5),
        },
      ]);

      // Mock按错误类型分布查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          error_type: 'API_TIMEOUT',
          count: BigInt(4),
          recovered: BigInt(3),
        },
        {
          error_type: 'RATE_LIMIT',
          count: BigInt(3),
          recovered: BigInt(1),
        },
        {
          error_type: 'INVALID_RESPONSE',
          count: BigInt(3),
          recovered: BigInt(1),
        },
      ]);

      // Mock按严重程度分布查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          severity: 'LOW',
          count: BigInt(2),
        },
        {
          severity: 'MEDIUM',
          count: BigInt(5),
        },
        {
          severity: 'HIGH',
          count: BigInt(3),
        },
      ]);

      // Mock趋势查询
      mockQueryRaw.mockResolvedValueOnce([
        {
          date: '2024-01-01',
          total_requests: BigInt(65),
          success_count: BigInt(62),
          error_count: BigInt(3),
          recovered_count: BigInt(0),
        },
        {
          date: '2024-01-02',
          total_requests: BigInt(70),
          success_count: BigInt(66),
          error_count: BigInt(4),
          recovered_count: BigInt(0),
        },
        {
          date: '2024-01-03',
          total_requests: BigInt(65),
          success_count: BigInt(62),
          error_count: BigInt(3),
          recovered_count: BigInt(0),
        },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('trend');
      expect(json.data).toHaveProperty('summary');
      expect(json.data.summary.totalRequests).toBe(200);
      expect(json.data.summary.successCount).toBe(190);
      expect(json.data.summary.errorCount).toBe(10);
      expect(json.data.summary.errorRate).toBe(5);
      expect(json.data.summary.recoveredCount).toBe(5);
      expect(json.data.summary.recoveryRate).toBe(50);
    });

    it('应该支持timeRange查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(50),
          success_count: BigInt(48),
          error_count: BigInt(2),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(2),
          recovered_errors: BigInt(1),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate?timeRange=TODAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持provider查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(120),
          success_count: BigInt(115),
          error_count: BigInt(5),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(5),
          recovered_errors: BigInt(2),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate?provider=deepseek'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持model查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(70),
          success_count: BigInt(68),
          error_count: BigInt(2),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(2),
          recovered_errors: BigInt(1),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate?model=deepseek-chat'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持errorType查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(4),
          recovered_errors: BigInt(3),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          error_type: 'API_TIMEOUT',
          count: BigInt(4),
          recovered: BigInt(3),
        },
      ]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate?errorType=API_TIMEOUT'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持includeRecovered查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(10),
          recovered_errors: BigInt(5),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate?includeRecovered=true'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该正确计算错误率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(500),
          success_count: BigInt(450),
          error_count: BigInt(50),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(50),
          recovered_errors: BigInt(25),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 错误率 = 50 / 500 * 100 = 10%
      expect(json.data.summary.errorRate).toBe(10);
    });

    it('应该正确计算恢复率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(300),
          success_count: BigInt(270),
          error_count: BigInt(30),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(30),
          recovered_errors: BigInt(15),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 恢复率 = 15 / 30 * 100 = 50%
      expect(json.data.summary.recoveryRate).toBe(50);
    });

    it('应该返回400当查询参数无效', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate?timeRange=INVALID'
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
        'http://localhost/api/stats/performance/error-rate'
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
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.summary.totalRequests).toBe(0);
    });

    it('应该正确按服务商分组统计错误率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(10),
          recovered_errors: BigInt(5),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          provider: 'deepseek',
          total_requests: BigInt(120),
          error_count: BigInt(5),
        },
        {
          provider: 'zhipu',
          total_requests: BigInt(80),
          error_count: BigInt(5),
        },
      ]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.byProvider.length).toBe(2);
      expect(json.data.byProvider[0].provider).toBe('deepseek');
      expect(json.data.byProvider[0].totalRequests).toBe(120);
      expect(json.data.byProvider[0].errorRate).toBeCloseTo(4.17, 1);
    });

    it('应该正确按错误类型分布统计', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(10),
          recovered_errors: BigInt(5),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          error_type: 'API_TIMEOUT',
          count: BigInt(5),
          recovered: BigInt(4),
        },
        {
          error_type: 'RATE_LIMIT',
          count: BigInt(3),
          recovered: BigInt(1),
        },
        {
          error_type: 'INVALID_RESPONSE',
          count: BigInt(2),
          recovered: BigInt(0),
        },
      ]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.byErrorType.length).toBe(3);
      expect(json.data.byErrorType[0].errorType).toBe('API_TIMEOUT');
      expect(json.data.byErrorType[0].count).toBe(5);
      expect(json.data.byErrorType[0].percentage).toBe(50);
    });

    it('应该正确按严重程度分布统计', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(10),
          recovered_errors: BigInt(5),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          severity: 'LOW',
          count: BigInt(3),
        },
        {
          severity: 'MEDIUM',
          count: BigInt(5),
        },
        {
          severity: 'HIGH',
          count: BigInt(2),
        },
      ]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.bySeverity.length).toBe(3);
      expect(json.data.bySeverity[0].severity).toBe('LOW');
      expect(json.data.bySeverity[0].count).toBe(3);
      expect(json.data.bySeverity[0].percentage).toBe(30);
    });

    it('应该正确构建错误率趋势数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_requests: BigInt(200),
          success_count: BigInt(190),
          error_count: BigInt(10),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        {
          total_errors: BigInt(10),
          recovered_errors: BigInt(5),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([
        {
          date: '2024-01-01',
          total_requests: BigInt(65),
          success_count: BigInt(62),
          error_count: BigInt(3),
          recovered_count: BigInt(0),
        },
        {
          date: '2024-01-02',
          total_requests: BigInt(70),
          success_count: BigInt(66),
          error_count: BigInt(4),
          recovered_count: BigInt(0),
        },
        {
          date: '2024-01-03',
          total_requests: BigInt(65),
          success_count: BigInt(62),
          error_count: BigInt(3),
          recovered_count: BigInt(0),
        },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/performance/error-rate'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.trend.length).toBe(3);
      expect(json.data.trend[0].date).toBe('2024-01-01');
      expect(json.data.trend[0].totalRequests).toBe(65);
      expect(json.data.trend[0].errorCount).toBe(3);
      expect(json.data.trend[0].errorRate).toBeCloseTo(4.62, 1);
    });
  });
});
