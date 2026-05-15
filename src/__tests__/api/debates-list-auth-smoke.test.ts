/**
 * 辩论列表 API 认证 smoke 测试
 *
 * 目标：
 * - 用最小依赖覆盖 GET/POST 的关键 401 契约
 * - 避免旧大体量测试文件导入链过重导致执行超时
 */

jest.mock('@/lib/ai/quota', () => ({
  checkAIQuota: jest.fn().mockResolvedValue({ allowed: true }),
  recordAIUsage: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    debate: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    actionLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

import { GET, POST } from '@/app/api/v1/debates/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { createMockRequest } from './test-utils';

describe('辩论列表 API 认证 smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET 未认证时返回 401 和登录提示', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/v1/debates');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('未认证');
    expect(data.message).toBe('请先登录');
  });

  it('POST 未认证时返回 401 和登录提示', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const request = createMockRequest('http://localhost:3000/api/v1/debates', {
      method: 'POST',
      body: {
        caseId: 'cmjtg7np100axc0zgwiwpwt9a',
        title: 'Smoke Debate',
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('未认证');
    expect(data.message).toBe('请先登录');
  });
});
