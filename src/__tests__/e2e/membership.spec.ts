/**
 * 会员系统集成测试
 *
 * 测试覆盖完整的会员系统功能：
 * 1. 会员信息查询
 * 2. 会员升级流程
 * 3. 使用量限制
 * 4. 会员降级和取消
 * 5. 权限检查中间件
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据类型定义
// =============================================================================

interface TestUser {
  id: string;
  email: string;
  password: string;
  token?: string;
}

interface MembershipInfoResponse {
  success: boolean;
  message: string;
  data?: {
    currentMembership: unknown | null;
    usageStats: Record<string, unknown>;
    availableTiers: unknown[];
    canUpgrade: boolean;
    upgradeOptions: unknown[];
  };
}

interface UpgradeResponse {
  success: boolean;
  message: string;
  data?: {
    membership: Record<string, unknown>;
    order?: Record<string, unknown>;
  };
  error?: string;
}

interface UsageResponse {
  success: boolean;
  message: string;
  data?: {
    records: unknown[];
    total: number;
    summary: Record<string, unknown>;
  };
}

interface HistoryResponse {
  success: boolean;
  message: string;
  data?: {
    records: unknown[];
    total: number;
    pagination: Record<string, unknown>;
  };
}

// =============================================================================
// 测试辅助函数
// =============================================================================

async function createTestUser(apiContext: any): Promise<TestUser> {
  const timestamp = Date.now();
  const email = `membership-test-${timestamp}@example.com`;
  const password = 'MembershipTest123';

  const response = await apiContext.post(`${BASE_URL}/api/auth/register`, {
    data: { email, password },
  });

  const data = await response.json();
  return {
    id: data.data?.user.id || '',
    email,
    password,
    token: data.data?.token,
  };
}

async function loginUser(
  apiContext: any,
  email: string,
  password: string
): Promise<string> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const data = await response.json();
  expect(response.ok()).toBeTruthy();
  return data.data?.token || '';
}

async function getAvailableTiers(apiContext: any): Promise<unknown[]> {
  const response = await apiContext.get(`${BASE_URL}/api/memberships/tiers`);
  const data = await response.json();

  if (!data.success || !data.data || !Array.isArray(data.data.tiers)) {
    console.error('获取会员等级列表失败:', data);
    return [];
  }

  return data.data.tiers;
}

// =============================================================================
// 测试套件1：会员信息查询
// =============================================================================

test.describe('会员信息查询', () => {
  test('应该获取无会员用户的信息', async ({ request }) => {
    const user = await createTestUser(request);

    const response = await request.get(`${BASE_URL}/api/memberships/me`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });

    const data: MembershipInfoResponse = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.currentMembership).toBeNull();
  });

  test('应该获取会员等级列表', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/memberships/tiers`);

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data?.tiers)).toBe(true);
    expect(data.data?.tiers.length).toBeGreaterThanOrEqual(2);
  });

  test('应该获取会员变更历史', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);

    const response = await request.get(`${BASE_URL}/api/memberships/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data: HistoryResponse = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.records).toBeDefined();
    expect(Array.isArray(data.data?.records)).toBe(true);
  });

  test('未认证用户无法访问会员信息', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/memberships/me`);

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// 测试套件2：会员升级流程
// =============================================================================

test.describe('会员升级流程', () => {
  test('应该成功升级免费用户到基础版', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    const basicTier = tiers.find((t: any) => t.tier === 'BASIC');
    expect(basicTier).toBeDefined();

    const response = await request.post(`${BASE_URL}/api/memberships/upgrade`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tierId: (basicTier as Record<string, unknown>).id,
        billingCycle: 'MONTHLY',
      },
    });

    const data: UpgradeResponse = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.membership).toBeDefined();
  });

  test('应该验证升级目标等级必须高于当前等级', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    const freeTier = tiers.find((t: any) => t.tier === 'FREE');
    expect(freeTier).toBeDefined();

    const response = await request.post(`${BASE_URL}/api/memberships/upgrade`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tierId: (freeTier as Record<string, unknown>).id,
        billingCycle: 'MONTHLY',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('应该拒绝不存在的等级ID', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);

    const response = await request.post(`${BASE_URL}/api/memberships/upgrade`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tierId: 'non-existent-id',
        billingCycle: 'MONTHLY',
      },
    });

    expect(response.status()).toBe(404);
  });

  test('应该验证计费周期参数', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    const basicTier = tiers.find((t: any) => t.tier === 'BASIC');
    expect(basicTier).toBeDefined();

    const response = await request.post(`${BASE_URL}/api/memberships/upgrade`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tierId: (basicTier as Record<string, unknown>).id,
        billingCycle: 'INVALID_CYCLE',
      },
    });

    expect(response.status()).toBe(400);
  });
});

// =============================================================================
// 测试套件3：使用量限制
// =============================================================================

test.describe('使用量限制', () => {
  test('应该成功获取使用量统计', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);

    const response = await request.get(`${BASE_URL}/api/memberships/usage`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data: UsageResponse = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.summary).toBeDefined();
  });

  test('应该支持自定义时间范围查询', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);

    const periodStart = new Date('2024-01-01').toISOString();
    const periodEnd = new Date('2024-12-31').toISOString();

    const response = await request.get(
      `${BASE_URL}/api/memberships/usage?periodStart=${periodStart}&periodEnd=${periodEnd}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data: UsageResponse = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('未认证用户无法访问使用量统计', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/memberships/usage`);

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// 测试套件4：会员降级和取消
// =============================================================================

test.describe('会员降级和取消', () => {
  test('应该成功降级会员', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    // 先升级到专业版
    const proTier = tiers.find((t: any) => t.tier === 'PROFESSIONAL');
    if (proTier) {
      await request.post(`${BASE_URL}/api/memberships/upgrade`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tierId: (proTier as Record<string, unknown>).id,
          billingCycle: 'MONTHLY',
        },
      });
    }

    // 降级到基础版
    const basicTier = tiers.find((t: any) => t.tier === 'BASIC');
    expect(basicTier).toBeDefined();

    const response = await request.post(
      `${BASE_URL}/api/memberships/downgrade`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tierId: (basicTier as Record<string, unknown>).id,
        },
      }
    );

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('应该成功取消会员', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    // 先升级到基础版
    const basicTier = tiers.find((t: any) => t.tier === 'BASIC');
    if (basicTier) {
      await request.post(`${BASE_URL}/api/memberships/upgrade`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tierId: (basicTier as Record<string, unknown>).id,
          billingCycle: 'MONTHLY',
        },
      });
    }

    // 取消会员
    const response = await request.post(`${BASE_URL}/api/memberships/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { reason: '测试取消' },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('免费版会员无法取消', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);

    const response = await request.post(`${BASE_URL}/api/memberships/cancel`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { reason: '测试取消' },
    });

    expect(response.status()).toBe(400);
  });

  test('应该验证降级目标等级必须低于当前等级', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    // 尝试从免费版降级到企业版（无效）
    const enterpriseTier = tiers.find((t: any) => t.tier === 'ENTERPRISE');
    expect(enterpriseTier).toBeDefined();

    const response = await request.post(
      `${BASE_URL}/api/memberships/downgrade`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tierId: (enterpriseTier as Record<string, unknown>).id,
        },
      }
    );

    expect(response.status()).toBe(400);
  });
});

// =============================================================================
// 测试套件5：综合测试 - 完整会员流程
// =============================================================================

test.describe('综合测试 - 完整会员生命周期', () => {
  test('完整会员流程：注册、升级、降级、取消', async ({ request }) => {
    // 1. 注册用户
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    // 2. 查询初始会员状态（应该是无会员）
    const meResponse1 = await request.get(`${BASE_URL}/api/memberships/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const meData1: MembershipInfoResponse = await meResponse1.json();
    expect(meData1.data?.currentMembership).toBeNull();

    // 3. 升级到基础版
    const basicTier = tiers.find((t: any) => t.tier === 'BASIC');
    if (basicTier) {
      const upgradeResponse = await request.post(
        `${BASE_URL}/api/memberships/upgrade`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            tierId: (basicTier as Record<string, unknown>).id,
            billingCycle: 'MONTHLY',
          },
        }
      );

      expect(upgradeResponse.ok()).toBeTruthy();
    }

    // 4. 查询会员状态（应该有会员）
    const meResponse2 = await request.get(`${BASE_URL}/api/memberships/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const meData2: MembershipInfoResponse = await meResponse2.json();
    expect(meData2.data?.currentMembership).not.toBeNull();

    // 5. 查询使用量
    const usageResponse = await request.get(
      `${BASE_URL}/api/memberships/usage`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const usageData: UsageResponse = await usageResponse.json();
    expect(usageResponse.ok()).toBeTruthy();
    expect(usageData.success).toBe(true);

    // 6. 查询会员历史
    const historyResponse = await request.get(
      `${BASE_URL}/api/memberships/history`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const historyData: HistoryResponse = await historyResponse.json();
    expect(historyResponse.ok()).toBeTruthy();
    expect(historyData.success).toBe(true);
    expect(historyData.data?.records.length).toBeGreaterThanOrEqual(1);
  });

  test('应该正确处理并发会员操作', async ({ request }) => {
    const user = await createTestUser(request);
    const token = await loginUser(request, user.email, user.password);
    const tiers = await getAvailableTiers(request);

    const basicTier = tiers.find((t: any) => t.tier === 'BASIC');
    if (!basicTier) return;

    // 并发执行多个会员操作
    const [upgradeResult, meResult, usageResult] = await Promise.all([
      request.post(`${BASE_URL}/api/memberships/upgrade`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          tierId: (basicTier as Record<string, unknown>).id,
          billingCycle: 'MONTHLY',
        },
      }),
      request.get(`${BASE_URL}/api/memberships/me`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      request.get(`${BASE_URL}/api/memberships/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    expect(upgradeResult.ok()).toBeTruthy();
    expect(meResult.ok()).toBeTruthy();
    expect(usageResult.ok()).toBeTruthy();
  });
});
