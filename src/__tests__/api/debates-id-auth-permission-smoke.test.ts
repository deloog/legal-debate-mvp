/**
 * 辩论详情 API 认证与权限 smoke 测试
 *
 * 目标：
 * - 覆盖 GET/PUT/DELETE 的 401
 * - 覆盖权限拒绝时的 403
 * - 用最小依赖替代旧大体量测试文件
 */

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    debate: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/debate/access', () => ({
  canAccessDebateByCasePermission: jest.fn(),
}));

import { GET, PUT, DELETE } from '@/app/api/v1/debates/[id]/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { canAccessDebateByCasePermission } from '@/lib/debate/access';
import { createMockRequest } from './test-utils';

const params = {
  params: Promise.resolve({ id: 'cmjtg7np100axc0zgwiwpwt1a' }),
};

describe('辩论详情 API 认证/权限 smoke', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET 未认证时返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const response = await GET(
      createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      ),
      params
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('未认证');
  });

  it('PUT 未认证时返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const response = await PUT(
      createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        {
          method: 'PUT',
          body: { title: 'Updated' },
        }
      ),
      params
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('未认证');
  });

  it('DELETE 未认证时返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const response = await DELETE(
      createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a',
        {
          method: 'DELETE',
        }
      ),
      params
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    const errorCode =
      typeof data.error === 'string' ? data.error : data.error?.code;
    expect(errorCode).toBe('未认证');
  });

  it('GET 权限不足时返回 403', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      role: 'USER',
    });
    (canAccessDebateByCasePermission as jest.Mock).mockResolvedValue({
      allowed: false,
      reason: '您无权访问此辩论',
    });

    const response = await GET(
      createMockRequest(
        'http://localhost:3000/api/v1/debates/cmjtg7np100axc0zgwiwpwt1a'
      ),
      params
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error?.code).toBe('FORBIDDEN');
  });
});
