/**
 * 案件分析API测试
 */

import { GET } from '@/app/api/analytics/cases/route';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { JwtPayload } from '@/types/auth';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      count: jest.fn(),
    },
    $queryRawUnsafe: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(async () => ({
    userId: '1',
    email: 'admin@example.com',
    role: 'ADMIN',
  })),
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: jest.fn(async () => null),
}));

jest.mock('@/lib/api-response', () => ({
  successResponse: jest.fn((data, message) => ({
    status: 200,
    json: () => ({ success: true, message, data }),
  })),
  unauthorizedResponse: jest.fn(() => ({
    status: 401,
    json: () => ({ success: false, message: '未授权' }),
  })),
  forbiddenResponse: jest.fn(message => ({
    status: 403,
    json: () => ({ success: false, message }),
  })),
  serverErrorResponse: jest.fn(message => ({
    status: 500,
    json: () => ({ success: false, message }),
  })),
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

// 类型化mock函数
const mockedPrisma = prisma as jest.Mocked<typeof prisma>;
const mockedGetAuthUser = getAuthUser as jest.MockedFunction<
  (request: NextRequest) => Promise<JwtPayload | null>
>;
const mockedValidatePermissions = validatePermissions as jest.MockedFunction<
  (
    request: NextRequest,
    requiredPermissions: string | string[],
    options?: unknown
  ) => Promise<NextResponse<unknown>>
>;

describe('案件分析API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/cases', () => {
    it('应该返回未授权如果用户未登录', async () => {
      mockedGetAuthUser.mockResolvedValueOnce(null);
      const request = new NextRequest('http://localhost/api/analytics/cases');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('应该返回禁止访问如果权限不足', async () => {
      // Mock validatePermissions返回错误响应
      mockedValidatePermissions.mockResolvedValueOnce(
        new NextResponse(JSON.stringify({ error: '权限不足' }), { status: 403 })
      );
      const request = new NextRequest('http://localhost/api/analytics/cases');
      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('应该返回成功数据如果用户有权限', async () => {
      // Mock validatePermissions返回null表示权限通过
      mockedValidatePermissions.mockResolvedValueOnce(null);
      // Mock getAuthUser返回有效用户
      mockedGetAuthUser.mockResolvedValue({
        userId: '1',
        email: 'admin@example.com',
        role: 'ADMIN',
      });

      // Mock数据库查询结果 - 空数组，避免复杂的日期处理问题
      (mockedPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
      (mockedPrisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest('http://localhost/api/analytics/cases');
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('应该返回400如果参数无效', async () => {
      mockedValidatePermissions.mockResolvedValueOnce(null);

      const request = new NextRequest(
        'http://localhost/api/analytics/cases?timeRange=INVALID'
      );
      const response = await GET(request);
      expect(response.status).toBe(400);
    });

    it('应该支持自定义时间范围', async () => {
      mockedValidatePermissions.mockResolvedValueOnce(null);

      (mockedPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
      (mockedPrisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/analytics/cases?timeRange=LAST_7_DAYS'
      );
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('应该支持按状态筛选', async () => {
      mockedValidatePermissions.mockResolvedValueOnce(null);

      (mockedPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([]);
      (mockedPrisma.case.count as jest.Mock).mockResolvedValue(0);

      const request = new NextRequest(
        'http://localhost/api/analytics/cases?status=COMPLETED'
      );
      const response = await GET(request);
      expect(response.status).toBe(200);
    });

    it('应该处理数据库错误', async () => {
      mockedValidatePermissions.mockResolvedValueOnce(null);

      (mockedPrisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = new NextRequest('http://localhost/api/analytics/cases');
      const response = await GET(request);
      expect(response.status).toBe(500);
    });
  });
});
