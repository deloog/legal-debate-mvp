/**
 * 会员等级列表API测试
 */

import { GET } from '@/app/api/memberships/tiers/route';
import { prisma } from '@/lib/db/prisma';
import type { MembershipTier } from '@/types/membership';
import { getAuthUser as getAuthUserImported } from '@/lib/middleware/auth';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    userMembership: {
      findFirst: jest.fn(),
    },
    membershipTier: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

describe('/api/memberships/tiers', () => {
  let mockGetAuthUser: jest.Mock;
  let mockFindFirst: jest.Mock;
  let mockFindMany: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser = getAuthUserImported as jest.Mock;
    mockFindFirst = prisma.userMembership.findFirst as jest.Mock;
    mockFindMany = prisma.membershipTier.findMany as jest.Mock;
  });

  /**
   * 测试用例 1：匿名用户查询
   */
  it('应该返回会员等级列表当用户未登录', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const tiers = [
      {
        id: 'tier-free-id',
        name: 'FREE',
        displayName: '免费版',
        tier: 'FREE' as MembershipTier,
        price: 0,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建', '文档分析'],
        permissions: {},
        isActive: true,
        sortOrder: 1,
        tierLimits: [],
      },
      {
        id: 'tier-basic-id',
        name: 'BASIC',
        displayName: '基础版',
        tier: 'BASIC' as MembershipTier,
        price: 99,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建', '文档分析', '法条搜索', '辩论生成'],
        permissions: {},
        isActive: true,
        sortOrder: 2,
        tierLimits: [],
      },
    ];

    mockFindMany.mockResolvedValue(tiers);

    const request = new Request('http://localhost:3000/api/memberships/tiers');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tiers).toHaveLength(2);
    expect(data.data.currentTier).toBeNull();
    expect(data.data.comparison).toBeDefined();
  });

  /**
   * 测试用例 2：已登录用户查询
   */
  it('应该返回会员等级列表和当前等级当用户已登录', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['案件创建', '文档分析', '法条搜索', '辩论生成'],
      permissions: {},
      isActive: true,
      sortOrder: 2,
      tierLimits: [],
    };

    const currentMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      tier: currentTier,
    };

    const tiers = [
      currentTier,
      {
        id: 'tier-pro-id',
        name: 'PROFESSIONAL',
        displayName: '专业版',
        tier: 'PROFESSIONAL' as MembershipTier,
        price: 299,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: [
          '案件创建',
          '文档分析',
          '法条搜索',
          '辩论生成',
          '数据导出',
          '批量处理',
        ],
        permissions: {},
        isActive: true,
        sortOrder: 3,
        tierLimits: [],
      },
    ];

    mockFindFirst.mockResolvedValue(currentMembership);
    mockFindMany.mockResolvedValue(tiers);

    const request = new Request('http://localhost:3000/api/memberships/tiers');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.tiers).toHaveLength(2);
    expect(data.data.currentTier).toBe('BASIC');
    expect(data.data.comparison).toBeDefined();
  });

  /**
   * 测试用例 3：只返回活跃的等级
   */
  it('应该只返回isActive为true的等级', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const tiers = [
      {
        id: 'tier-free-id',
        name: 'FREE',
        displayName: '免费版',
        tier: 'FREE' as MembershipTier,
        price: 0,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建'],
        permissions: {},
        isActive: true,
        sortOrder: 1,
        tierLimits: [],
      },
      {
        id: 'tier-basic-id',
        name: 'BASIC',
        displayName: '基础版',
        tier: 'BASIC' as MembershipTier,
        price: 99,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建', '文档分析'],
        permissions: {},
        isActive: true,
        sortOrder: 2,
        tierLimits: [],
      },
    ];

    mockFindMany.mockResolvedValue(tiers);

    const request = new Request('http://localhost:3000/api/memberships/tiers');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tiers).toHaveLength(2);
    expect(
      data.data.tiers.every((tier: unknown) => {
        if (typeof tier !== 'object' || tier === null) {
          return false;
        }
        const tierObj = tier as Record<string, unknown>;
        return tierObj.isActive === true;
      })
    ).toBe(true);
  });

  /**
   * 测试用例 4：按sortOrder排序
   */
  it('应该按sortOrder升序返回等级', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const tiers = [
      {
        id: 'tier-free-id',
        name: 'FREE',
        displayName: '免费版',
        tier: 'FREE' as MembershipTier,
        price: 0,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: [],
        permissions: {},
        isActive: true,
        sortOrder: 1,
        tierLimits: [],
      },
      {
        id: 'tier-basic-id',
        name: 'BASIC',
        displayName: '基础版',
        tier: 'BASIC' as MembershipTier,
        price: 99,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: [],
        permissions: {},
        isActive: true,
        sortOrder: 2,
        tierLimits: [],
      },
      {
        id: 'tier-pro-id',
        name: 'PROFESSIONAL',
        displayName: '专业版',
        tier: 'PROFESSIONAL' as MembershipTier,
        price: 299,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: [],
        permissions: {},
        isActive: true,
        sortOrder: 3,
        tierLimits: [],
      },
    ];

    mockFindMany.mockResolvedValue(tiers);

    const request = new Request('http://localhost:3000/api/memberships/tiers');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.tiers).toHaveLength(3);
    expect(data.data.tiers[0].tier).toBe('FREE');
    expect(data.data.tiers[1].tier).toBe('BASIC');
    expect(data.data.tiers[2].tier).toBe('PROFESSIONAL');
  });

  /**
   * 测试用例 5：功能对比矩阵
   */
  it('应该生成功能对比矩阵', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const tiers = [
      {
        id: 'tier-free-id',
        name: 'FREE',
        displayName: '免费版',
        tier: 'FREE' as MembershipTier,
        price: 0,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建', '文档分析'],
        permissions: {},
        isActive: true,
        sortOrder: 1,
        tierLimits: [],
      },
      {
        id: 'tier-basic-id',
        name: 'BASIC',
        displayName: '基础版',
        tier: 'BASIC' as MembershipTier,
        price: 99,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建', '文档分析', '法条搜索'],
        permissions: {},
        isActive: true,
        sortOrder: 2,
        tierLimits: [],
      },
    ];

    mockFindMany.mockResolvedValue(tiers);

    const request = new Request('http://localhost:3000/api/memberships/tiers');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.comparison).toBeDefined();
    expect(Array.isArray(data.data.comparison)).toBe(true);
    expect(data.data.comparison.length).toBeGreaterThan(0);
  });

  /**
   * 测试用例 6：服务器错误
   */
  it('应该返回500状态码当服务器发生错误', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    mockFindMany.mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost:3000/api/memberships/tiers');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain('查询失败');
  });

  /**
   * 测试用例 7：OPTIONS请求
   */
  it('应该返回204状态码当OPTIONS请求', async () => {
    const { OPTIONS } = await import('@/app/api/memberships/tiers/route');
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain(
      'GET'
    );
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain(
      'Authorization'
    );
  });
});
