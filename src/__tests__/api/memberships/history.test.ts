/**
 * 会员变更历史API测试
 */

import { GET } from '@/app/api/memberships/history/route';
import { prisma } from '@/lib/db/prisma';
import type { MembershipChangeType } from '@/types/membership';
import { getAuthUser as getAuthUserImported } from '@/lib/middleware/auth';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    membershipHistory: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

describe('/api/memberships/history', () => {
  let mockGetAuthUser: jest.Mock;
  let mockCount: jest.Mock;
  let mockFindMany: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser = getAuthUserImported as jest.Mock;
    mockCount = prisma.membershipHistory.count as jest.Mock;
    mockFindMany = prisma.membershipHistory.findMany as jest.Mock;
  });

  /**
   * 测试用例 1：未授权用户
   */
  it('应该返回401状态码当用户未登录', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/memberships/history'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toContain('未授权');
  });

  /**
   * 测试用例 2：获取历史记录
   */
  it('应该返回会员变更历史记录', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const records = [
      {
        id: 'history-1',
        userId: 'user-1',
        membershipId: 'membership-1',
        changeType: 'UPGRADE' as MembershipChangeType,
        fromTier: 'FREE',
        toTier: 'BASIC',
        fromStatus: 'ACTIVE',
        toStatus: 'ACTIVE',
        reason: '用户主动升级',
        performedBy: 'user-1',
        createdAt: new Date('2024-01-01'),
        membership: {
          id: 'membership-1',
          tier: {
            id: 'tier-basic-id',
            name: 'BASIC',
            displayName: '基础版',
            tier: 'BASIC',
          },
        },
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
      },
    ];

    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(records);

    const request = new Request(
      'http://localhost:3000/api/memberships/history'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.records).toHaveLength(1);
    expect(data.data.total).toBe(1);
    expect(data.data.pagination).toBeDefined();
  });

  /**
   * 测试用例 3：分页参数
   */
  it('应该正确处理分页参数', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    mockCount.mockResolvedValue(25);
    mockFindMany.mockResolvedValue([]);

    const request = new Request(
      'http://localhost:3000/api/memberships/history?page=2&limit=10'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pagination.page).toBe(2);
    expect(data.data.pagination.limit).toBe(10);
    expect(data.data.pagination.totalPages).toBe(3);
    expect(data.data.pagination.hasNext).toBe(true);
    expect(data.data.pagination.hasPrev).toBe(true);
  });

  /**
   * 测试用例 4：无效分页参数
   */
  it('应该返回400状态码当page参数无效', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const request = new Request(
      'http://localhost:3000/api/memberships/history?page=-1'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_PAGE');
  });

  /**
   * 测试用例 5：limit参数超出范围
   */
  it('应该返回400状态码当limit参数超出范围', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const request = new Request(
      'http://localhost:3000/api/memberships/history?limit=101'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_LIMIT');
  });

  /**
   * 测试用例 6：过滤变更类型
   */
  it('应该支持按变更类型过滤', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    mockCount.mockResolvedValue(10);
    mockFindMany.mockResolvedValue([]);

    const request = new Request(
      'http://localhost:3000/api/memberships/history?changeType=UPGRADE'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  /**
   * 测试用例 7：日期范围过滤
   */
  it('应该支持按日期范围过滤', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    mockCount.mockResolvedValue(5);
    mockFindMany.mockResolvedValue([]);

    const request = new Request(
      'http://localhost:3000/api/memberships/history?startDate=2024-01-01&endDate=2024-01-31'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  /**
   * 测试用例 8：按时间倒序排列
   */
  it('应该按创建时间倒序返回记录', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const records = [
      {
        id: 'history-2',
        userId: 'user-1',
        createdAt: new Date('2024-01-20').toISOString(),
      },
      {
        id: 'history-1',
        userId: 'user-1',
        createdAt: new Date('2024-01-10').toISOString(),
      },
    ];

    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue(records);

    const request = new Request(
      'http://localhost:3000/api/memberships/history'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.records).toHaveLength(2);
    expect(new Date(data.data.records[0].createdAt).getTime()).toBeGreaterThan(
      new Date(data.data.records[1].createdAt).getTime()
    );
  });

  /**
   * 测试用例 9：服务器错误
   */
  it('应该返回500状态码当服务器发生错误', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockCount.mockRejectedValue(new Error('Database error'));

    const request = new Request(
      'http://localhost:3000/api/memberships/history'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain('查询失败');
  });

  /**
   * 测试用例 10：默认分页参数
   */
  it('应该使用默认分页参数当未提供', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    mockCount.mockResolvedValue(0);
    mockFindMany.mockResolvedValue([]);

    const request = new Request(
      'http://localhost:3000/api/memberships/history'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.pagination.page).toBe(1);
    expect(data.data.pagination.limit).toBe(20);
  });

  /**
   * 测试用例 11：OPTIONS请求
   */
  it('应该返回204状态码当OPTIONS请求', async () => {
    const { OPTIONS } = await import('@/app/api/memberships/history/route');
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'GET'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'Authorization'
    );
  });

  /**
   * 测试用例 12：包含关联数据
   */
  it('应该返回包含关联数据的历史记录', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const records = [
      {
        id: 'history-1',
        userId: 'user-1',
        membershipId: 'membership-1',
        changeType: 'UPGRADE' as MembershipChangeType,
        fromTier: 'FREE',
        toTier: 'BASIC',
        fromStatus: 'ACTIVE',
        toStatus: 'ACTIVE',
        performedBy: 'user-1',
        createdAt: new Date(),
        membership: {
          id: 'membership-1',
          tier: {
            id: 'tier-basic-id',
            name: 'BASIC',
            displayName: '基础版',
            tier: 'BASIC',
          },
        },
        user: {
          id: 'user-1',
          email: 'user@example.com',
          username: 'testuser',
          name: 'Test User',
        },
      },
    ];

    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue(records);

    const request = new Request(
      'http://localhost:3000/api/memberships/history'
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.records[0].membership).toBeDefined();
    expect(data.data.records[0].membership.tier).toBeDefined();
  });
});
