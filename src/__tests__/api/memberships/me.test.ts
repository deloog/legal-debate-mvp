/**
 * 会员信息查询API测试
 */

import { GET } from '@/app/api/memberships/me/route';
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

jest.mock('@/lib/usage/record-usage', () => ({
  getUsageStats: jest.fn(),
}));

describe('/api/memberships/me', () => {
  let mockGetAuthUser: jest.Mock;
  let mockFindFirst: jest.Mock;
  let mockFindMany: jest.Mock;
  let mockGetUsageStats: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockGetAuthUser = getAuthUserImported as jest.Mock;
    mockFindFirst = prisma.userMembership.findFirst as jest.Mock;
    mockFindMany = prisma.membershipTier.findMany as jest.Mock;
    const usageModule = await import('@/lib/usage/record-usage');
    mockGetUsageStats = usageModule.getUsageStats as jest.Mock;
  });

  /**
   * 测试用例 1：未授权用户
   */
  it('应该返回401状态码当用户未登录', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.message).toContain('未授权');
  });

  /**
   * 测试用例 2：有活跃会员的用户
   */
  it('应该返回当前会员信息当用户有活跃会员', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
      id: 'tier-basic-id',
      name: 'BASIC',
      displayName: '基础版',
      tier: 'BASIC' as MembershipTier,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: ['案件创建', '文档分析', '法条搜索'],
      permissions: {
        canCreateCase: true,
        canCreateDebate: true,
      },
      isActive: true,
      sortOrder: 2,
    };

    const currentMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      autoRenew: true,
      user: {
        id: 'user-1',
        email: 'user@example.com',
        username: 'testuser',
        name: 'Test User',
      },
      tier: currentTier,
    };

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 5,
      debatesGenerated: 2,
      documentsAnalyzed: 8,
      lawArticleSearches: 15,
      aiTokensUsed: 5000,
      storageUsedMB: 25,
      limits: {
        tier: 'BASIC' as MembershipTier,
        limits: {},
      },
      remaining: {
        cases: 45,
        debates: 18,
        documents: 92,
        lawArticleSearches: -1,
        aiTokens: 95000,
        storageMB: 975,
      },
    };

    const availableTiers = [
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
        permissions: {
          canCreateCase: true,
          canCreateDebate: true,
          canExportData: true,
        },
        isActive: true,
        sortOrder: 3,
      },
    ];

    mockFindFirst.mockResolvedValue(currentMembership);
    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue(availableTiers);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.currentMembership).toBeDefined();
    expect(data.data.currentMembership.tier).toBe('BASIC');
    expect(data.data.currentMembership.tierName).toBe('基础版');
    expect(data.data.usageStats).toBeDefined();
    expect(data.data.availableTiers).toHaveLength(2);
    expect(data.data.canUpgrade).toBe(true);
    expect(data.data.upgradeOptions).toHaveLength(1);
    expect(data.data.upgradeOptions[0].tier.tier).toBe('PROFESSIONAL');
  });

  /**
   * 测试用例 3：无会员的用户
   */
  it('应该返回null当前会员当用户没有会员', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 0,
      debatesGenerated: 0,
      documentsAnalyzed: 0,
      lawArticleSearches: 0,
      aiTokensUsed: 0,
      storageUsedMB: 0,
      limits: {
        tier: 'FREE' as MembershipTier,
        limits: {},
      },
      remaining: {
        cases: 3,
        debates: 0,
        documents: 5,
        lawArticleSearches: 50,
        aiTokens: 10000,
        storageMB: 100,
      },
    };

    const availableTiers = [
      {
        id: 'tier-free-id',
        name: 'FREE',
        displayName: '免费版',
        tier: 'FREE' as MembershipTier,
        price: 0,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: ['案件创建', '文档分析'],
        permissions: {
          canCreateCase: true,
          canCreateDebate: false,
        },
        isActive: true,
        sortOrder: 1,
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
        permissions: {
          canCreateCase: true,
          canCreateDebate: true,
        },
        isActive: true,
        sortOrder: 2,
      },
    ];

    mockFindFirst.mockResolvedValue(null);
    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue(availableTiers);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.currentMembership).toBeNull();
    expect(data.data.usageStats).toBeDefined();
    expect(data.data.availableTiers).toHaveLength(2);
    expect(data.data.canUpgrade).toBe(true);
    expect(data.data.upgradeOptions).toHaveLength(2);
  });

  /**
   * 测试用例 4：企业版用户无法升级
   */
  it('应该设置canUpgrade为false当用户已是企业版', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
      id: 'tier-enterprise-id',
      name: 'ENTERPRISE',
      displayName: '企业版',
      tier: 'ENTERPRISE' as MembershipTier,
      price: 999,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
      features: [
        '案件创建',
        '文档分析',
        '法条搜索',
        '辩论生成',
        '数据导出',
        '批量处理',
        '自定义模型',
        'API访问',
      ],
      permissions: {
        canCreateCase: true,
        canCreateDebate: true,
        canExportData: true,
        canUseBatchProcessing: true,
        canUseCustomModel: true,
      },
      isActive: true,
      sortOrder: 4,
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

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 100,
      debatesGenerated: 50,
      documentsAnalyzed: 200,
      lawArticleSearches: 500,
      aiTokensUsed: 1000000,
      storageUsedMB: 5000,
      limits: {
        tier: 'ENTERPRISE' as MembershipTier,
        limits: {
          MAX_CASES: null,
          MAX_DEBATES: null,
          MAX_DOCUMENTS: null,
          MAX_AI_TOKENS_MONTHLY: null,
          MAX_STORAGE_MB: null,
          MAX_LAW_ARTICLE_SEARCHES: null,
          MAX_CONCURRENT_REQUESTS: null,
        },
      },
      remaining: {
        cases: -1,
        debates: -1,
        documents: -1,
        lawArticleSearches: -1,
        aiTokens: -1,
        storageMB: -1,
      },
    };

    mockFindFirst.mockResolvedValue(currentMembership);
    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue([currentTier]);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.currentMembership.tier).toBe('ENTERPRISE');
    expect(data.data.canUpgrade).toBe(false);
    expect(data.data.upgradeOptions).toHaveLength(0);
  });

  /**
   * 测试用例 5：服务器错误
   */
  it('应该返回500状态码当服务器发生错误', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockRejectedValue(new Error('Database error'));

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain('查询失败');
  });

  /**
   * 测试用例 6：使用量统计错误
   */
  it('应该返回500状态码当获取使用量统计失败', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);
    mockGetUsageStats.mockRejectedValue(new Error('Usage stats error'));

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toContain('查询失败');
  });

  /**
   * 测试用例 7：会员信息包含正确字段
   */
  it('应该返回完整的会员信息字段', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
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
    };

    const currentMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
      autoRenew: false,
      tier: currentTier,
    };

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 10,
      debatesGenerated: 5,
      documentsAnalyzed: 20,
      lawArticleSearches: 30,
      aiTokensUsed: 10000,
      storageUsedMB: 50,
      limits: {
        tier: 'BASIC' as MembershipTier,
        limits: {},
      },
      remaining: {
        cases: 40,
        debates: 15,
        documents: 80,
        lawArticleSearches: -1,
        aiTokens: 90000,
        storageMB: 950,
      },
    };

    mockFindFirst.mockResolvedValue(currentMembership);
    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue([currentTier]);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.currentMembership).toMatchObject({
      id: 'membership-1',
      userId: 'user-1',
      tierId: currentTier.id,
      tier: 'BASIC',
      tierName: '基础版',
      status: 'ACTIVE',
      autoRenew: false,
      price: 99,
      currency: 'CNY',
      billingCycle: 'MONTHLY',
    });
    expect(data.data.currentMembership.features).toEqual([
      '案件创建',
      '文档分析',
    ]);
  });

  /**
   * 测试用例 8：使用量统计包含正确字段
   */
  it('应该返回完整的使用量统计字段', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date('2024-01-01'),
      periodEnd: new Date('2024-01-31'),
      casesCreated: 5,
      debatesGenerated: 2,
      documentsAnalyzed: 10,
      lawArticleSearches: 20,
      aiTokensUsed: 5000,
      storageUsedMB: 25,
      limits: {
        tier: 'FREE' as MembershipTier,
        limits: {
          MAX_CASES: 3,
          MAX_DEBATES: 0,
          MAX_DOCUMENTS: 5,
          MAX_AI_TOKENS_MONTHLY: 10000,
          MAX_STORAGE_MB: 100,
          MAX_LAW_ARTICLE_SEARCHES: 50,
          MAX_CONCURRENT_REQUESTS: 2,
        },
      },
      remaining: {
        cases: 0,
        debates: 0,
        documents: 0,
        lawArticleSearches: 30,
        aiTokens: 5000,
        storageMB: 75,
      },
    };

    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue([]);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.usageStats).toMatchObject({
      casesCreated: 5,
      debatesGenerated: 2,
      documentsAnalyzed: 10,
      lawArticleSearches: 20,
      aiTokensUsed: 5000,
      storageUsedMB: 25,
    });
    expect(data.data.usageStats.remaining).toBeDefined();
    expect(data.data.usageStats.limits).toBeDefined();
  });

  /**
   * 测试用例 9：升级选项包含节省金额
   */
  it('应该计算升级选项的节省金额', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const currentTier = {
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
    };

    const currentMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: currentTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      tier: currentTier,
    };

    const targetTier = {
      id: 'tier-pro-id',
      name: 'PROFESSIONAL',
      displayName: '专业版',
      tier: 'PROFESSIONAL' as MembershipTier,
      price: 299,
      currency: 'CNY',
      billingCycle: 'YEARLY',
      features: [],
      permissions: {},
      isActive: true,
      sortOrder: 3,
    };

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 0,
      debatesGenerated: 0,
      documentsAnalyzed: 0,
      lawArticleSearches: 0,
      aiTokensUsed: 0,
      storageUsedMB: 0,
      limits: { tier: 'BASIC' as MembershipTier, limits: {} },
      remaining: {
        cases: 0,
        debates: 0,
        documents: 0,
        lawArticleSearches: 0,
        aiTokens: 0,
        storageMB: 0,
      },
    };

    mockFindFirst.mockResolvedValue(currentMembership);
    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue([currentTier, targetTier]);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.upgradeOptions).toHaveLength(1);
    expect(data.data.upgradeOptions[0].tier.tier).toBe('PROFESSIONAL');
    expect(data.data.upgradeOptions[0].price).toBe(299);
    expect(data.data.upgradeOptions[0].savings).toBe(99 - 299);
  });

  /**
   * 测试用例 10：OPTIONS请求
   */
  it('应该返回204状态码当OPTIONS请求', async () => {
    const { OPTIONS } = await import('@/app/api/memberships/me/route');
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
   * 测试用例 11：等级顺序正确
   */
  it('应该按等级排序返回可用等级', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });
    mockFindFirst.mockResolvedValue(null);

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 0,
      debatesGenerated: 0,
      documentsAnalyzed: 0,
      lawArticleSearches: 0,
      aiTokensUsed: 0,
      storageUsedMB: 0,
      limits: { tier: 'FREE' as MembershipTier, limits: {} },
      remaining: {
        cases: 0,
        debates: 0,
        documents: 0,
        lawArticleSearches: 0,
        aiTokens: 0,
        storageMB: 0,
      },
    };

    const availableTiers = [
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
      },
    ];

    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue(availableTiers);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(data.data.availableTiers).toHaveLength(3);
    expect(data.data.availableTiers[0].tier).toBe('FREE');
    expect(data.data.availableTiers[1].tier).toBe('BASIC');
    expect(data.data.availableTiers[2].tier).toBe('PROFESSIONAL');
  });

  /**
   * 测试用例 12：免费版用户可以升级
   */
  it('应该显示所有升级选项当用户是免费版', async () => {
    mockGetAuthUser.mockResolvedValue({ userId: 'user-1' });

    const freeTier = {
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
    };

    const currentMembership = {
      id: 'membership-1',
      userId: 'user-1',
      tierId: freeTier.id,
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      autoRenew: false,
      tier: freeTier,
    };

    const usageStats = {
      userId: 'user-1',
      periodStart: new Date(),
      periodEnd: new Date(),
      casesCreated: 0,
      debatesGenerated: 0,
      documentsAnalyzed: 0,
      lawArticleSearches: 0,
      aiTokensUsed: 0,
      storageUsedMB: 0,
      limits: { tier: 'FREE' as MembershipTier, limits: {} },
      remaining: {
        cases: 0,
        debates: 0,
        documents: 0,
        lawArticleSearches: 0,
        aiTokens: 0,
        storageMB: 0,
      },
    };

    const availableTiers = [
      freeTier,
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
      },
      {
        id: 'tier-enterprise-id',
        name: 'ENTERPRISE',
        displayName: '企业版',
        tier: 'ENTERPRISE' as MembershipTier,
        price: 999,
        currency: 'CNY',
        billingCycle: 'MONTHLY',
        features: [],
        permissions: {},
        isActive: true,
        sortOrder: 4,
      },
    ];

    mockFindFirst.mockResolvedValue(currentMembership);
    mockGetUsageStats.mockResolvedValue(usageStats);
    mockFindMany.mockResolvedValue(availableTiers);

    const request = new Request('http://localhost:3000/api/memberships/me');

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.canUpgrade).toBe(true);
    expect(data.data.upgradeOptions).toHaveLength(3);
  });
});
