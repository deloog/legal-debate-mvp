/**
 * 会员升级API测试
 */

import { POST } from '@/app/api/memberships/upgrade/route';
import { prisma } from '@/lib/db/prisma';
import type { MembershipTier } from '@/types/membership';
import { getAuthUser as getAuthUserImported } from '@/lib/middleware/auth';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userMembership: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    membershipTier: {
      findUnique: jest.fn(),
    },
    membershipHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

describe('/api/memberships/upgrade', () => {
  let mockGetAuthUser: jest.Mock;
  let mockFindFirst: jest.Mock;
  let __mockUpdate: jest.Mock;
  let mockFindUnique: jest.Mock;
  let mockCreateHistory: jest.Mock;
  let mockTransaction: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser = getAuthUserImported as jest.Mock;
    mockFindFirst = prisma.userMembership.findFirst as jest.Mock;
    mockUpdate = prisma.userMembership.update as jest.Mock;
    mockFindUnique = prisma.membershipTier.findUnique as jest.Mock;
    mockCreateHistory = prisma.membershipHistory.create as jest.Mock;
    mockTransaction = prisma.$transaction as jest.Mock;

    // 默认transaction实现：直接执行回调
    mockTransaction.mockImplementation(callback =>
      Promise.resolve(callback(prisma))
    );
  });

  /**
   * 测试用例 1：未授权用户
   */
  it('应该返回401状态码当用户未登录', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({ tierId: 'test-tier-id' }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toContain('未授权');
  });

  /**
   * 测试用例 2：请求参数无效
   */
  it('应该返回400状态码当请求参数无效', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({}), // 缺少tierId
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_REQUEST');
  });

  /**
   * 测试用例 3：成功升级（无当前会员）
   */
  it('应该成功升级当用户没有当前会员', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };

    // 设置mock的调用顺序
    mockFindFirst.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(targetTier);

    const newMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: targetTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      notes: '从无会员升级到基础版',
      tier: targetTier,
    };

    // transaction已经在beforeEach中设置了默认实现
    (prisma.userMembership.create as jest.Mock).mockResolvedValue(
      newMembership
    );
    mockCreateHistory.mockResolvedValue({});

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.membership.tier).toBe('BASIC');
    expect(data.data.membership.tierName).toBe('基础版');
    expect(mockCreateHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: 'UPGRADE',
          toTier: 'BASIC',
          fromTier: undefined,
        }),
      })
    );
  });

  /**
   * 测试用例 4：成功升级（有当前会员）
   */
  it('应该成功升级当用户有当前会员', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
      id: 'tier-free-id',
      name: 'FREE',
      displayName: '免费版',
      tier: 'FREE' as MembershipTier,
      price: 0,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1'],
      permissions: {},
      isActive: true,
      sortOrder: 1,
    };

    const currentMembership = {
      id: 'membership-0',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      tier: currentTier,
    };

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };

    // 设置mock的调用顺序
    mockFindFirst.mockResolvedValue(currentMembership);
    mockFindUnique.mockResolvedValue(targetTier);

    const newMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: targetTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      notes: '从免费版升级到基础版',
      tier: targetTier,
    };

    mockTransaction.mockImplementation(callback =>
      Promise.resolve(callback(prisma))
    );
    (prisma.userMembership.create as jest.Mock).mockResolvedValue(
      newMembership
    );
    mockCreateHistory.mockResolvedValue({});

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
          autoRenew: true,
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.membership.tier).toBe('BASIC');
    expect(mockCreateHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          changeType: 'UPGRADE',
          fromTier: 'FREE',
          toTier: 'BASIC',
          fromStatus: 'ACTIVE',
        }),
      })
    );
  });

  /**
   * 测试用例 5：不能升级到同等级
   */
  it('应该返回400状态码当尝试升级到同等级', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };

    const currentMembership = {
      id: 'membership-0',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      tier: currentTier,
    };

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };

    // 设置mock的调用顺序
    mockFindFirst.mockResolvedValue(currentMembership);
    mockFindUnique.mockResolvedValue(targetTier);

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_UPGRADE');
  });

  /**
   * 测试用例 6：不能降级到更低等级
   */
  it('应该返回400状态码当尝试升级到更低等级', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
      id: 'tier-pro-id',
      name: 'PROFESSIONAL',
      displayName: '专业版',
      tier: 'PROFESSIONAL' as MembershipTier,
      price: 299,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2', 'feature3'],
      permissions: {},
      isActive: true,
      sortOrder: 3,
    };

    const currentMembership = {
      id: 'membership-0',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      tier: currentTier,
    };

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };

    // 设置mock的调用顺序
    mockFindFirst.mockResolvedValue(currentMembership);
    mockFindUnique.mockResolvedValue(targetTier);

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_UPGRADE');
  });

  /**
   * 测试用例 7：目标等级不存在
   */
  it('应该返回404状态码当目标等级不存在', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);
    mockFindUnique.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'non-existent-tier',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('TIER_NOT_FOUND');
  });

  /**
   * 测试用例 8：目标等级不可用
   */
  it('应该返回400状态码当目标等级不可用', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);

    const inactiveTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: false,
      sortOrder: 2,
    };
    mockFindUnique.mockResolvedValue(inactiveTier);

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('TIER_INACTIVE');
  });

  /**
   * 测试用例 9：计算正确的到期时间（月付）
   */
  it('应该计算正确的到期时间当选择月付', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };
    mockFindUnique.mockResolvedValue(targetTier);

    let capturedEndDate: Date | null = null;
    let capturedStartDate: Date | null = null;

    mockTransaction.mockImplementation(callback =>
      Promise.resolve(callback(prisma))
    );

    (prisma.userMembership.create as jest.Mock).mockImplementation(
      (data: any) => {
        capturedStartDate = data.data.startDate;
        capturedEndDate = data.data.endDate;
        return Promise.resolve({
          id: 'membership-1',
          ...data.data,
          tier: targetTier,
        });
      }
    );
    mockCreateHistory.mockResolvedValue({});

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    await POST(request as any);

    expect(capturedEndDate).not.toBeNull();
    expect(capturedStartDate).not.toBeNull();
    const diffMs =
      (capturedEndDate as Date).getTime() -
      (capturedStartDate as Date).getTime();
    const expectedDiffMs = 31 * 24 * 60 * 60 * 1000; // 约31天（一个月）
    expect(diffMs).toBeGreaterThan(expectedDiffMs - 1000 * 60 * 60); // 允许1小时误差
    expect(diffMs).toBeLessThan(expectedDiffMs + 1000 * 60 * 60);
  });

  /**
   * 测试用例 10：计算正确的到期时间（年付）
   */
  it('应该计算正确的到期时间当选择年付', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'YEARLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };
    mockFindUnique.mockResolvedValue(targetTier);

    let capturedEndDate: Date | null = null;
    let capturedStartDate: Date | null = null;

    mockTransaction.mockImplementation(callback =>
      Promise.resolve(callback(prisma))
    );

    (prisma.userMembership.create as jest.Mock).mockImplementation(
      (data: any) => {
        capturedStartDate = data.data.startDate;
        capturedEndDate = data.data.endDate;
        return Promise.resolve({
          id: 'membership-1',
          ...data.data,
          tier: targetTier,
        });
      }
    );
    mockCreateHistory.mockResolvedValue({});

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'YEARLY',
        }),
      }
    );

    await POST(request as any);

    expect(capturedEndDate).not.toBeNull();
    expect(capturedStartDate).not.toBeNull();
    const diffMs =
      (capturedEndDate as Date).getTime() -
      (capturedStartDate as Date).getTime();
    const expectedDiffMs = 365 * 24 * 60 * 60 * 1000; // 365天
    expect(diffMs).toBeGreaterThan(expectedDiffMs - 1000 * 60 * 60); // 允许1小时误差
    expect(diffMs).toBeLessThan(expectedDiffMs + 1000 * 60 * 60);
  });

  /**
   * 测试用例 11：服务器错误
   */
  it('应该返回500状态码当服务器发生错误', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockRejectedValue(new Error('Database error'));

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain('会员升级失败');
  });

  /**
   * 测试用例 12：不支持的HTTP方法
   */
  it('应该返回405状态码当使用GET方法', async () => {
    const { GET } = await import('@/app/api/memberships/upgrade/route');
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(405);
    expect(data.success).toBe(false);
    expect(data.message).toContain('方法不允许');
  });

  /**
   * 测试用例 13：类型守卫测试 - tierId为空字符串
   */
  it('应该拒绝请求当tierId为空字符串', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: '  ',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_REQUEST');
  });

  /**
   * 测试用例 14：类型守卫测试 - billingCycle类型错误
   */
  it('应该拒绝请求当billingCycle类型错误', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 123,
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_REQUEST');
  });

  /**
   * 测试用例 15：类型守卫测试 - autoRenew类型错误
   */
  it('应该拒绝请求当autoRenew类型错误', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
          autoRenew: 'true',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('INVALID_REQUEST');
  });

  /**
   * 测试用例 16：返回订单信息
   */
  it('应该返回订单信息用于支付', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);

    const targetTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['feature1', 'feature2'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
    };
    mockFindUnique.mockResolvedValue(targetTier);

    const newMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: targetTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      notes: '从无会员升级到基础版',
      tier: targetTier,
    };

    mockTransaction.mockImplementation(callback =>
      Promise.resolve(callback(prisma))
    );
    (prisma.userMembership.create as jest.Mock).mockResolvedValue(
      newMembership
    );
    mockCreateHistory.mockResolvedValue({});

    const request = new Request(
      'http://localhost:3000/api/memberships/upgrade',
      {
        method: 'POST',
        body: JSON.stringify({
          tierId: 'tier-basic-id',
          billingCycle: 'MONTHLY',
        }),
      }
    );

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.order).toBeDefined();
    expect(data.data.order.id).toBe('membership-1');
    expect(data.data.order.amount).toBe(99);
    expect(data.data.order.currency).toBe('CNY');
    expect(data.data.order.paymentUrl).toBe('/payment/membership-1');
  });
});
