/**
 * 律师绩效分析API单元测试
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/analytics/lawyers/route';
import { prisma } from '@/lib/db/prisma';
import { TimeRange } from '@/types/stats';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth');
jest.mock('@/lib/middleware/permission-check');

describe('GET /api/analytics/lawyers', () => {
  let mockRequest: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = new NextRequest(
      new URL('http://localhost:3000/api/analytics/lawyers')
    );

    // Mock successful auth and permissions
    (getAuthUser as jest.Mock).mockResolvedValue({
      id: 'test-user-id',
      role: 'ADMIN',
    });
    (validatePermissions as jest.Mock).mockResolvedValue(null);
  });

  it('应该返回律师绩效数据', async () => {
    // Mock database responses
    (prisma.$queryRawUnsafe as jest.Mock).mockImplementation(
      (query: string) => {
        if (query.includes('"totalCases" as "totalCases"')) {
          return [
            {
              lawyerId: 'lawyer-1',
              lawyerName: '张律师',
              lawyerRole: 'LAWYER',
              totalCases: BigInt(10),
              activeCases: BigInt(3),
              completedCases: BigInt(6),
              archivedCases: BigInt(1),
            },
            {
              lawyerId: 'lawyer-2',
              lawyerName: '李律师',
              lawyerRole: 'LAWYER',
              totalCases: BigInt(8),
              activeCases: BigInt(2),
              completedCases: BigInt(5),
              archivedCases: BigInt(1),
            },
          ];
        }
        if (query.includes('"successfulCases" as "successfulCases"')) {
          return [
            {
              lawyerId: 'lawyer-1',
              lawyerName: '张律师',
              lawyerRole: 'LAWYER',
              totalCases: BigInt(10),
              successfulCases: BigInt(6),
            },
            {
              lawyerId: 'lawyer-2',
              lawyerName: '李律师',
              lawyerRole: 'LAWYER',
              totalCases: BigInt(8),
              successfulCases: BigInt(5),
            },
          ];
        }
        if (query.includes('"totalRevenue" as "totalRevenue"')) {
          return [
            {
              lawyerId: 'lawyer-1',
              lawyerName: '张律师',
              lawyerRole: 'LAWYER',
              totalRevenue: '100000.00',
              avg: '10000.00',
              max: '20000.00',
              min: '5000.00',
            },
            {
              lawyerId: 'lawyer-2',
              lawyerName: '李律师',
              lawyerRole: 'LAWYER',
              totalRevenue: '80000.00',
              avg: '8000.00',
              max: '15000.00',
              min: '4000.00',
            },
          ];
        }
        if (query.includes('"completedCases" as "completedCases"')) {
          return [
            {
              lawyerId: 'lawyer-1',
              lawyerName: '张律师',
              lawyerRole: 'LAWYER',
              completedCases: BigInt(6),
              avgDuration: '7.50',
              medianDuration: '7.00',
              fastestDuration: '5.00',
              slowestDuration: '10.00',
            },
            {
              lawyerId: 'lawyer-2',
              lawyerName: '李律师',
              lawyerRole: 'LAWYER',
              completedCases: BigInt(5),
              avgDuration: '8.20',
              medianDuration: '8.00',
              fastestDuration: '6.00',
              slowestDuration: '11.00',
            },
          ];
        }
        if (query.includes('"workDays" as "workDays"')) {
          return [
            {
              lawyerId: 'lawyer-1',
              lawyerName: '张律师',
              lawyerRole: 'LAWYER',
              completedCases: BigInt(6),
              avgDurationDays: '7.50',
              workDays: BigInt(20),
            },
            {
              lawyerId: 'lawyer-2',
              lawyerName: '李律师',
              lawyerRole: 'LAWYER',
              completedCases: BigInt(5),
              avgDurationDays: '8.20',
              workDays: BigInt(18),
            },
          ];
        }
        return [];
      }
    );

    const response = await GET(mockRequest as NextRequest);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('caseVolume');
    expect(result.data).toHaveProperty('successRate');
    expect(result.data).toHaveProperty('revenue');
    expect(result.data).toHaveProperty('efficiency');
    expect(result.data).toHaveProperty('workHours');
    expect(result.data).toHaveProperty('summary');
    expect(result.data).toHaveProperty('metadata');
  });

  it('应该支持时间范围参数', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockReturnValue([]);

    const url = new URL('http://localhost:3000/api/analytics/lawyers');
    url.searchParams.set('timeRange', TimeRange.LAST_7_DAYS);

    const request = new NextRequest(url);
    const response = await GET(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.data.metadata.timeRange).toBe(TimeRange.LAST_7_DAYS);
  });

  it('应该支持排序参数', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockReturnValue([
      {
        lawyerId: 'lawyer-1',
        lawyerName: '张律师',
        lawyerRole: 'LAWYER',
        totalCases: BigInt(10),
        activeCases: BigInt(3),
        completedCases: BigInt(6),
        archivedCases: BigInt(1),
      },
    ]);

    const url = new URL('http://localhost:3000/api/analytics/lawyers');
    url.searchParams.set('sortBy', 'revenue');
    url.searchParams.set('sortOrder', 'desc');

    const request = new NextRequest(url);
    const response = await GET(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
  });

  it('应该拒绝无效的查询参数', async () => {
    const url = new URL('http://localhost:3000/api/analytics/lawyers');
    url.searchParams.set('timeRange', 'INVALID_TIME_RANGE');

    const request = new NextRequest(url);
    const response = await GET(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无效的查询参数');
  });

  it('未认证用户应该返回401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const response = await GET(mockRequest as NextRequest);

    expect(response.status).toBe(401);
  });

  it('无权限用户应该返回403', async () => {
    (validatePermissions as jest.Mock).mockResolvedValue(new Error('无权限'));

    const response = await GET(mockRequest as NextRequest);

    expect(response.status).toBe(403);
  });

  it('应该计算正确的摘要统计', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockReturnValue([
      {
        lawyerId: 'lawyer-1',
        lawyerName: '张律师',
        lawyerRole: 'LAWYER',
        totalCases: BigInt(10),
        activeCases: BigInt(3),
        completedCases: BigInt(6),
        archivedCases: BigInt(1),
      },
      {
        lawyerId: 'lawyer-2',
        lawyerName: '李律师',
        lawyerRole: 'LAWYER',
        totalCases: BigInt(8),
        activeCases: BigInt(2),
        completedCases: BigInt(5),
        archivedCases: BigInt(1),
      },
    ]);

    const response = await GET(mockRequest as NextRequest);
    const result = await response.json();

    expect(result.data.summary.totalLawyers).toBe(2);
    expect(result.data.summary.averageCasesPerLawyer).toBe(9);
  });

  it('应该返回正确的元数据', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockReturnValue([]);

    const response = await GET(mockRequest as NextRequest);
    const result = await response.json();

    expect(result.data.metadata).toHaveProperty('timeRange');
    expect(result.data.metadata).toHaveProperty('startDate');
    expect(result.data.metadata).toHaveProperty('endDate');
    expect(result.data.metadata).toHaveProperty('generatedAt');
    expect(result.data.metadata).toHaveProperty('dataPoints');
    expect(result.data.metadata).toHaveProperty('granularity');
  });

  it('数据库错误应该返回500', async () => {
    (prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    const response = await GET(mockRequest as NextRequest);
    const result = await response.json();

    expect(response.status).toBe(500);
    expect(result.success).toBe(false);
    expect(result.message).toContain('失败');
  });
});
