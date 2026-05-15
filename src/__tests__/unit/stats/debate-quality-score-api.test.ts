/**
 * 辩论质量评分统计API单元测试
 */

import { GET } from '@/app/api/stats/debates/quality-score/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    argument: {
      findMany: jest.fn(),
    },
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

describe('辩论质量评分统计API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockArgumentFindMany = prisma.argument.findMany as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/stats/debates/quality-score', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
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
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功返回质量评分数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.95, createdAt: new Date('2024-01-01') },
        { confidence: 0.85, createdAt: new Date('2024-01-01') },
        { confidence: 0.75, createdAt: new Date('2024-01-02') },
        { confidence: 0.65, createdAt: new Date('2024-01-02') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('trend');
      expect(json.data).toHaveProperty('distribution');
      expect(json.data).toHaveProperty('summary');
    });

    it('应该正确计算平均评分', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.8, createdAt: new Date('2024-01-01') },
        { confidence: 0.9, createdAt: new Date('2024-01-01') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 平均评分 = (0.8 + 0.9) / 2 = 0.85
      expect(json.data.summary.averageScore).toBe(0.85);
    });

    it('应该正确计算中位数评分', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.7, createdAt: new Date('2024-01-01') },
        { confidence: 0.8, createdAt: new Date('2024-01-01') },
        { confidence: 0.9, createdAt: new Date('2024-01-01') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 中位数 = 0.8
      expect(json.data.summary.medianScore).toBe(0.8);
    });

    it('应该正确计算最高和最低评分', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.5, createdAt: new Date('2024-01-01') },
        { confidence: 0.9, createdAt: new Date('2024-01-01') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.summary.minScore).toBe(0.5);
      expect(json.data.summary.maxScore).toBe(0.9);
    });

    it('应该正确计算质量评分分布', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.95, createdAt: new Date('2024-01-01') },
        { confidence: 0.85, createdAt: new Date('2024-01-01') },
        { confidence: 0.75, createdAt: new Date('2024-01-01') },
        { confidence: 0.55, createdAt: new Date('2024-01-01') },
        { confidence: 0.45, createdAt: new Date('2024-01-01') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.distribution.excellent).toBe(1); // >= 0.9
      expect(json.data.distribution.good).toBe(2); // 0.7-0.9
      expect(json.data.distribution.average).toBe(1); // 0.5-0.7
      expect(json.data.distribution.poor).toBe(1); // < 0.5
      expect(json.data.distribution.totalCount).toBe(5);
    });

    it('应该正确计算超过阈值的论点数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.95, createdAt: new Date('2024-01-01') },
        { confidence: 0.85, createdAt: new Date('2024-01-01') },
        { confidence: 0.75, createdAt: new Date('2024-01-01') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 超过0.8阈值的论点数 = 2
      expect(json.data.summary.scoreAboveThreshold).toBe(2);
      expect(json.data.summary.threshold).toBe(0.8);
    });

    it('应该支持timeRange查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockArgumentFindMany.mockResolvedValue([
        { confidence: 0.8, createdAt: new Date('2024-01-15') },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score?timeRange=TODAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持minConfidence查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockArgumentFindMany.mockResolvedValue([
        { confidence: 0.85, createdAt: new Date('2024-01-01') },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score?minConfidence=0.7'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持maxConfidence查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockArgumentFindMany.mockResolvedValue([
        { confidence: 0.75, createdAt: new Date('2024-01-01') },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score?maxConfidence=0.9'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该把 debateStatus 筛选应用到论点查询', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockArgumentFindMany.mockResolvedValue([
        { confidence: 0.8, createdAt: new Date('2024-01-01') },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score?debateStatus=COMPLETED'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockArgumentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            round: {
              debate: {
                status: 'COMPLETED',
                deletedAt: null,
              },
            },
          }),
        })
      );
    });

    it('应该返回400当查询参数无效', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score?minConfidence=1.5'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该处理查询错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockArgumentFindMany.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该正确处理空数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockArgumentFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.summary.averageScore).toBe(0);
      expect(json.data.summary.medianScore).toBe(0);
      expect(json.data.distribution.totalCount).toBe(0);
    });

    it('应该正确处理confidence为null的数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: null, createdAt: new Date('2024-01-01') },
        { confidence: 0.8, createdAt: new Date('2024-01-01') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 应该忽略null的confidence
      expect(json.data.summary.averageScore).toBe(0.8);
      expect(json.data.distribution.totalCount).toBe(1);
    });

    it('应该正确构建质量评分趋势', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const mockArguments = [
        { confidence: 0.8, createdAt: new Date('2024-01-01') },
        { confidence: 0.9, createdAt: new Date('2024-01-01') },
        { confidence: 0.7, createdAt: new Date('2024-01-02') },
      ];
      mockArgumentFindMany.mockResolvedValue(mockArguments);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/quality-score'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.trend).toHaveLength(2);
      expect(json.data.trend[0].date).toBe('2024-01-01');
      expect(json.data.trend[0].averageScore).toBe(0.85);
      expect(json.data.trend[0].argumentsCount).toBe(2);
      expect(json.data.trend[1].date).toBe('2024-01-02');
      expect(json.data.trend[1].averageScore).toBe(0.7);
      expect(json.data.trend[1].argumentsCount).toBe(1);
    });
  });
});
