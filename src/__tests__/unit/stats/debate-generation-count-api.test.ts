/**
 * 辩论生成次数统计API单元测试
 */

import { GET } from '@/app/api/stats/debates/generation-count/route';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    debate: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    debateRound: {
      findMany: jest.fn(),
    },
    argument: {
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
import { DateGranularity, TimeRange } from '@/types/stats';

describe('辩论生成次数统计API', () => {
  const mockGetAuthUser = getAuthUser as jest.Mock;
  const mockValidatePermissions = validatePermissions as jest.Mock;
  const mockDebateCount = prisma.debate.count as jest.Mock;
  const mockDebateFindMany = prisma.debate.findMany as jest.Mock;
  const mockDebateRoundFindMany = prisma.debateRound.findMany as jest.Mock;
  const mockArgumentCount = prisma.argument.count as jest.Mock;
  const mockQueryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    // 默认 findMany 返回空数组
    mockDebateFindMany.mockResolvedValue([]);
    mockDebateRoundFindMany.mockResolvedValue([]);
  });

  describe('GET /api/stats/debates/generation-count', () => {
    it('应该返回401当用户未登录', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
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
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(403);
    });

    it('应该成功返回辩论生成次数数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      // Mock查询结果
      mockDebateCount
        .mockResolvedValueOnce(100) // 总辩论数
        .mockResolvedValueOnce(20) // 上期辩论数
        .mockResolvedValueOnce(50); // 当前期辩论数
      mockArgumentCount.mockResolvedValue(200);

      // Mock辩论生成次数查询
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(5) },
        { date: '2024-01-02', count: BigInt(10) },
        { date: '2024-01-03', count: BigInt(15) },
      ]);

      // Mock论点生成次数查询
      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(15) },
        { date: '2024-01-02', count: BigInt(30) },
        { date: '2024-01-03', count: BigInt(45) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('trend');
      expect(json.data).toHaveProperty('summary');
      expect(json.data.summary.totalDebates).toBe(100);
    });

    it('应该支持timeRange查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(50);
      mockArgumentCount.mockResolvedValue(100);

      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(2) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count?timeRange=TODAY'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持granularity查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(30);
      mockArgumentCount.mockResolvedValue(60);

      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(1) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count?granularity=WEEK'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('应该支持status查询参数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(25);
      mockArgumentCount.mockResolvedValue(75);

      mockQueryRaw.mockResolvedValue([
        { date: '2024-01-15', count: BigInt(3) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count?status=COMPLETED'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('统计总论点数时应复用辩论状态和软删除过滤', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(2);
      mockArgumentCount.mockResolvedValue(6);
      mockDebateFindMany.mockResolvedValue([]);
      mockDebateRoundFindMany.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count?status=COMPLETED'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockArgumentCount).toHaveBeenCalledWith({
        where: {
          createdAt: expect.any(Object),
          round: {
            debate: {
              deletedAt: null,
              status: 'COMPLETED',
            },
          },
        },
      });
    });

    it('应该正确计算增长率', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValueOnce(100).mockResolvedValueOnce(10);
      mockArgumentCount.mockResolvedValue(200);

      // currentPeriodDebates = debatesInPeriod.length，需要返回30条记录
      const mockDebates = Array.from({ length: 30 }, (_, i) => ({
        id: `debate-${i}`,
        createdAt: new Date('2024-01-01'),
      }));
      mockDebateFindMany.mockResolvedValueOnce(mockDebates);

      mockQueryRaw.mockResolvedValueOnce([
        { date: '2024-01-01', count: BigInt(30) },
      ]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 增长率 = (30 - 10) / 10 * 100 = 200%
      expect(json.data.summary.growthRate).toBe(200);
    });

    it('应该正确计算平均每个辩论的论点数', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(10);
      mockArgumentCount.mockResolvedValue(50);

      mockQueryRaw.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 平均论点数 = 50 / 10 = 5
      expect(json.data.summary.averageArgumentsPerDebate).toBe(5);
    });

    it('应该正确计算平均每个辩论的论点数（带小数）', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(3);
      mockArgumentCount.mockResolvedValue(10);

      mockQueryRaw.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      // 平均论点数 = 10 / 3 ≈ 3.33
      expect(json.data.summary.averageArgumentsPerDebate).toBeCloseTo(3.33, 2);
    });

    it('应该返回400当查询参数无效', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count?timeRange=INVALID'
      );
      const response = await GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该处理查询错误', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockRejectedValue(new Error('数据库错误'));
      mockQueryRaw.mockRejectedValue(new Error('数据库错误'));

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.success).toBe(false);
    });

    it('应该正确处理空数据', async () => {
      mockGetAuthUser.mockResolvedValue({ userId: 'admin-1' });
      mockValidatePermissions.mockResolvedValue(null);

      mockDebateCount.mockResolvedValue(0);
      mockArgumentCount.mockResolvedValue(0);

      mockQueryRaw.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const request = new NextRequest(
        'http://localhost/api/stats/debates/generation-count'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.trend).toEqual([]);
    });
  });
});
