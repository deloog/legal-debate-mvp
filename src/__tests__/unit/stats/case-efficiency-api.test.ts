/**
 * 案件效率统计API单元测试
 */

import { GET } from '@/app/api/stats/cases/efficiency/route';
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

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { TimeRange } from '@/types/stats';

describe('案件效率统计API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/cases/efficiency', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency'
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
        'http://localhost/api/stats/cases/efficiency'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功获取案件效率数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw
        .mockResolvedValueOnce([
          {
            id: '1',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T02:00:00.000Z'),
          },
          {
            id: '2',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T04:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            completedCases: BigInt(2),
            avgCompletionTime: '3.00',
          },
        ]);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      // 完成时间计算：1天2小时=26小时，1天4小时=28小时
      expect(json.data.summary.totalCompletedCases).toBe(2);
      expect(json.data.summary.averageCompletionTime).toBe(27);
      expect(json.data.summary.medianCompletionTime).toBe(27);
      expect(json.data.summary.fastestCompletionTime).toBe(26);
      expect(json.data.summary.slowestCompletionTime).toBe(28);
    });

    it('应该支持按案件类型筛选', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw
        .mockResolvedValueOnce([
          {
            id: '1',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T02:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            completedCases: BigInt(1),
            avgCompletionTime: '2.00',
          },
        ]);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency?caseType=CIVIL'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.summary.totalCompletedCases).toBe(1);
    });

    it('应该支持不同的时间范围', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

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
        mockQueryRaw
          .mockResolvedValueOnce([
            {
              id: '1',
              createdAt: new Date('2024-01-01T00:00:00.000Z'),
              updatedAt: new Date('2024-01-02T02:00:00.000Z'),
            },
          ])
          .mockResolvedValueOnce([
            {
              date: '2024-01-01',
              completedCases: BigInt(1),
              avgCompletionTime: '2.00',
            },
          ]);

        const request = new NextRequest(
          `http://localhost/api/stats/cases/efficiency?timeRange=${timeRange}`
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
        'http://localhost/api/stats/cases/efficiency?timeRange=INVALID'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.message).toBe('无效的查询参数');
    });

    it('应该处理无效的案件类型参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency?caseType=INVALID'
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

      mockQueryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency'
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.summary.totalCompletedCases).toBe(0);
      expect(json.data.summary.averageCompletionTime).toBe(0);
      expect(json.data.summary.medianCompletionTime).toBe(0);
      expect(json.data.summary.fastestCompletionTime).toBe(0);
      expect(json.data.summary.slowestCompletionTime).toBe(0);
      expect(json.data.trend).toHaveLength(0);
    });

    it('应该正确计算中位数（奇数）', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw
        .mockResolvedValueOnce([
          {
            id: '1',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T02:00:00.000Z'),
          },
          {
            id: '2',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T03:00:00.000Z'),
          },
          {
            id: '3',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T04:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            completedCases: BigInt(3),
            avgCompletionTime: '3.00',
          },
        ]);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency'
      );
      const response = await GET(request);
      const json = await response.json();
      // 完成时间：26、27、28小时，中位数是27
      expect(json.data.summary.medianCompletionTime).toBe(27);
    });

    it('应该正确计算中位数（偶数）', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw
        .mockResolvedValueOnce([
          {
            id: '1',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T02:00:00.000Z'),
          },
          {
            id: '2',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T04:00:00.000Z'),
          },
          {
            id: '3',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T06:00:00.000Z'),
          },
          {
            id: '4',
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-02T08:00:00.000Z'),
          },
        ])
        .mockResolvedValueOnce([
          {
            date: '2024-01-01',
            completedCases: BigInt(4),
            avgCompletionTime: '5.00',
          },
        ]);

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency'
      );
      const response = await GET(request);
      const json = await response.json();
      // 完成时间：26、28、30、32小时，中位数是(28+30)/2=29
      expect(json.data.summary.medianCompletionTime).toBe(29);
    });

    it('应该处理数据库错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockQueryRaw.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/cases/efficiency'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.message).toBe('获取案件效率统计失败');
    });
  });
});
