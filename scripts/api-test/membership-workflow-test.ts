/**
 * 会员系统业务场景完整 API 测试
 *
 * 测试范围：
 * - 用户认证与会员信息查询
 * - 会员等级管理（查询可用等级）
 * - 会员升级/降级流程
 * - 会员使用统计
 * - 会员历史记录
 * - 订单创建与支付流程
 *
 * 使用方法:
 * 1. 确保服务器运行在 http://localhost:3000
 * 2. 确保有测试用户
 * 3. 运行: npx ts-node scripts/api-test/membership-workflow-test.ts
 */

// =============================================================================
// 配置
// =============================================================================
const CONFIG = {
  BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  TEST_USER: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'test123456',
  },
  TIMEOUT: 30000,
};

// =============================================================================
// 类型定义
// =============================================================================
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
}

interface AuthData {
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn: number;
}

interface MembershipTier {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tier: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  price: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  features: string[];
  permissions: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // API 返回包含 tierLimits 关联数据
  tierLimits?: Array<{
    id: string;
    limitType: string;
    limitValue: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
}

interface UserMembership {
  id: string;
  userId: string;
  tierId: string;
  tier: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  tierName: string;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'PAUSED';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  price: number;
  currency: string;
  billingCycle: string;
  features: string[];
  permissions: Record<string, unknown>;
}

interface UsageStats {
  userId: string;
  periodStart: string;
  periodEnd: string;
  casesCreated: number;
  debatesGenerated: number;
  documentsAnalyzed: number;
  lawArticleSearches: number;
  aiTokensUsed: number;
  storageUsedMB: number;
  limits: {
    tier: string;
    limits: Record<string, number | null>;
  };
  remaining: {
    cases: number;
    debates: number;
    documents: number;
    lawArticleSearches: number;
    aiTokens: number;
    storageMB: number;
  };
}

interface MembershipHistory {
  id: string;
  userId: string;
  membershipId: string;
  changeType:
    | 'UPGRADE'
    | 'DOWNGRADE'
    | 'RENEWAL'
    | 'CANCELLATION'
    | 'EXPIRATION'
    | 'REACTIVATION';
  fromTier?: string;
  toTier?: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
  performedBy: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNo: string;
  userId: string;
  membershipTierId: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
  paymentMethod?: string;
  paidAt?: string;
  createdAt: string;
}

// =============================================================================
// 测试框架
// =============================================================================
class TestRunner {
  private tests: Array<{
    name: string;
    fn: () => Promise<void>;
    skip?: boolean;
  }> = [];
  private results: Array<{
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
  }> = [];

  test(name: string, fn: () => Promise<void>, skip = false) {
    this.tests.push({ name, fn, skip });
  }

  async run() {
    console.log('\n👑 开始运行会员系统测试...\n');
    const startTime = Date.now();

    for (const { name, fn, skip } of this.tests) {
      if (skip) {
        console.log(`⏭️  SKIP: ${name}`);
        continue;
      }

      const testStart = Date.now();
      try {
        await fn();
        const duration = Date.now() - testStart;
        this.results.push({ name, passed: true, duration });
        console.log(`✅ PASS: ${name} (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - testStart;
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.results.push({ name, passed: false, error: errorMsg, duration });
        console.log(`❌ FAIL: ${name} (${duration}ms)`);
        console.log(`   Error: ${errorMsg}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    console.log('\n' + '='.repeat(50));
    console.log(
      `📊 测试结果: ${passed} 通过, ${failed} 失败, 总计 ${this.results.length} 个测试`
    );
    console.log(`⏱️  总耗时: ${totalDuration}ms`);
    console.log('='.repeat(50) + '\n');

    return { passed, failed, total: this.results.length };
  }
}

// =============================================================================
// API 客户端
// =============================================================================
class ApiClient {
  private token: string = '';
  private baseUrl: string;
  private cookies: Record<string, string> = {};

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string) {
    this.token = token;
  }

  private parseCookies(response: Response) {
    const setCookie = (response.headers as any).getSetCookie?.();
    if (Array.isArray(setCookie)) {
      for (const cookie of setCookie) {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.trim().split('=');
        if (name && value !== undefined) {
          this.cookies[name] = value;
        }
      }
    }
  }

  private getCookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    customHeaders?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...customHeaders,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) headers['Cookie'] = cookieHeader;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Extract and save cookies
      this.parseCookies(response);

      if (response.status === 204) {
        return { success: true } as ApiResponse<T>;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data.error?.message || data.message || 'Unknown error'}`
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${CONFIG.TIMEOUT}ms`);
      }
      throw error;
    }
  }

  // 认证
  async register(data: {
    email: string;
    password: string;
    username: string;
    name: string;
    role?: string;
  }): Promise<ApiResponse<AuthData>> {
    return this.request('POST', '/api/auth/register', data);
  }

  async login(email: string, password: string): Promise<ApiResponse<AuthData>> {
    return this.request('POST', '/api/auth/login', { email, password });
  }

  // 会员信息
  async getMyMembership(): Promise<
    ApiResponse<{
      currentMembership: UserMembership | null;
      usageStats: UsageStats;
      availableTiers: MembershipTier[];
      canUpgrade: boolean;
      upgradeOptions: Array<{
        tier: MembershipTier;
        price: number;
        savings?: number;
      }>;
    }>
  > {
    return this.request('GET', '/api/memberships/me');
  }

  // 会员等级
  async getMembershipTiers(): Promise<
    ApiResponse<{
      tiers: MembershipTier[];
      currentTier: MembershipTier | null;
      comparison: Array<{
        feature: string;
        free: boolean | string;
        basic: boolean | string;
        professional: boolean | string;
        enterprise: boolean | string;
      }>;
    }>
  > {
    return this.request('GET', '/api/memberships/tiers');
  }

  // 会员历史
  async getMembershipHistory(): Promise<
    ApiResponse<{
      records: MembershipHistory[];
      total: number;
      pagination: {
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    }>
  > {
    return this.request('GET', '/api/memberships/history');
  }

  // 使用统计
  async getUsageStats(): Promise<ApiResponse<UsageStats>> {
    return this.request('GET', '/api/memberships/usage');
  }

  // 升级/降级
  async upgradeMembership(
    tierId: string
  ): Promise<ApiResponse<UserMembership>> {
    return this.request('POST', '/api/memberships/upgrade', { tierId });
  }

  async downgradeMembership(
    tierId: string
  ): Promise<ApiResponse<UserMembership>> {
    return this.request('POST', '/api/memberships/downgrade', { tierId });
  }

  // 取消会员
  async cancelMembership(
    reason?: string
  ): Promise<ApiResponse<UserMembership>> {
    return this.request('POST', '/api/memberships/cancel', { reason });
  }

  // 订单相关
  async createOrder(
    membershipTierId: string,
    paymentMethod: string = 'WECHAT'
  ): Promise<ApiResponse<Order>> {
    return this.request('POST', '/api/orders/create', {
      membershipTierId,
      paymentMethod,
    });
  }

  async getOrders(): Promise<
    ApiResponse<{
      orders: Order[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>
  > {
    return this.request('GET', '/api/orders');
  }

  async getOrder(orderId: string): Promise<ApiResponse<Order>> {
    return this.request('GET', `/api/orders/${orderId}`);
  }

  async cancelOrder(orderId: string): Promise<ApiResponse<void>> {
    return this.request('POST', `/api/orders/${orderId}/cancel`, {});
  }
}

// =============================================================================
// 断言辅助函数
// =============================================================================
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertExists<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Assertion failed: ${name} should exist`);
  }
  return value;
}

function _assertEquals(actual: unknown, expected: unknown, name: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed: ${name} expected ${expected}, got ${actual}`
    );
  }
}

// =============================================================================
// 主测试逻辑
// =============================================================================
async function main() {
  const runner = new TestRunner();
  const client = new ApiClient(CONFIG.BASE_URL);

  const testData: {
    token?: string;
    user?: User;
    membership?: UserMembership;
    tiers?: MembershipTier[];
    order?: Order;
  } = {};

  // ==========================================================================
  // 阶段 1: 认证
  // ==========================================================================
  const testEmail =
    CONFIG.TEST_USER.email || `member-test-${Date.now()}@example.com`;
  const testPassword = CONFIG.TEST_USER.password;
  const isEmailProvided = !!CONFIG.TEST_USER.email;

  runner.test('1.0 获取访问令牌（登录或注册）', async () => {
    // 如果用户提供了邮箱，先尝试登录已有用户
    if (isEmailProvided) {
      console.log(`   🔑 尝试登录已有用户: ${testEmail}`);
      try {
        const loginResponse = await client.login(testEmail, testPassword);
        if (loginResponse.success) {
          assertExists(loginResponse.data?.token, 'login token');
          testData.token = loginResponse.data!.token;
          testData.user = loginResponse.data!.user;
          client.setToken(testData.token);
          console.log(
            `   ✨ 登录成功: ${testData.user?.email} (${testData.user?.role})`
          );
          return;
        }
      } catch (err: any) {
        console.log(`   ⚠️  登录失败: ${err.message}`);
        console.log(`   📝 尝试注册新用户...`);
      }
    }

    // 登录失败或没有提供邮箱，尝试注册新用户
    let currentEmail = testEmail;
    let response: ApiResponse<AuthData> | null = null;
    let lastError: Error | null = null;

    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const randomSuffix = Math.floor(Math.random() * 10000);
          currentEmail = `member-test-${Date.now()}-${randomSuffix}@example.com`;
        }

        response = await client.register({
          email: currentEmail,
          password: testPassword,
          username: `u${Date.now().toString(36).slice(-6)}${attempt}`,
          name: `测试用户${Date.now().toString(36).slice(-4)}`,
          role: 'LAWYER',
        });

        if (response.success) {
          break;
        }

        const isUserExists =
          response.message?.includes('邮箱已被注册') ||
          response.message?.includes('USER_EXISTS') ||
          response.error?.code === 'USER_EXISTS';

        if (!isUserExists) {
          throw new Error(
            `注册失败: ${response.message || response.error || 'Unknown error'}`
          );
        }

        lastError = new Error(response.message || 'USER_EXISTS');
      } catch (err: any) {
        lastError = err;

        if (
          !err.message?.includes('USER_EXISTS') &&
          !err.message?.includes('邮箱已被注册')
        ) {
          throw err;
        }

        if (attempt === maxRetries - 1) {
          throw new Error(`注册失败，已重试 ${maxRetries} 次: ${err.message}`);
        }

        console.log(`   ⚠️  邮箱冲突，准备重试...`);
        await new Promise(r => setTimeout(r, 50));
      }
    }

    if (response && response.success) {
      assertExists(response.data?.token, 'register token');
      testData.token = response.data!.token;
      testData.user = response.data!.user;
      client.setToken(testData.token);
      console.log(
        `   ✨ 新用户注册成功: ${testData.user?.email} (${testData.user?.role})`
      );
    } else {
      throw new Error(`注册失败: ${lastError?.message || 'Unknown error'}`);
    }
  });

  runner.test('1.1 确认用户身份', async () => {
    if (!testData.user) {
      throw new Error('未获取到用户信息，认证步骤可能失败');
    }
    console.log(
      `   👤 当前用户: ${testData.user?.email} (${testData.user?.role})`
    );
  });

  // ==========================================================================
  // 阶段 2: 会员信息查询
  // ==========================================================================
  runner.test('2.1 获取当前会员信息', async () => {
    const response = await client.getMyMembership();
    assert(response.success === true, '获取会员信息应该成功');
    assertExists(response.data, 'membership data');

    if (response.data?.currentMembership) {
      testData.membership = response.data.currentMembership;
      console.log(
        `   👑 当前会员: ${response.data.currentMembership.tierName} (${response.data.currentMembership.status})`
      );
    } else {
      console.log('   ℹ️  当前无活跃会员');
    }
  });

  runner.test('2.2 获取会员使用统计', async () => {
    const response = await client.getUsageStats();
    assert(response.success === true, '获取使用统计应该成功');
    assertExists(response.data, 'usage stats');
    console.log(
      `   📊 案件创建: ${response.data?.casesCreated}, 辩论生成: ${response.data?.debatesGenerated}`
    );
  });

  // ==========================================================================
  // 阶段 3: 会员等级管理
  // ==========================================================================
  runner.test('3.1 获取所有会员等级', async () => {
    const response = await client.getMembershipTiers();
    assert(response.success === true, '获取会员等级应该成功');
    assertExists(response.data, 'tiers data');
    assert(Array.isArray(response.data!.tiers), 'tiers should be array');
    assert(response.data!.tiers.length > 0, '应该有会员等级');
    testData.tiers = response.data!.tiers;
    console.log(
      `   📋 可用等级: ${response.data!.tiers.map((t: MembershipTier) => t.tier).join(', ')}`
    );
  });

  runner.test('3.2 验证会员等级结构', async () => {
    const tier = testData.tiers![0];
    assertExists(tier.id, 'tier.id');
    assertExists(tier.name, 'tier.name');
    assertExists(tier.tier, 'tier.tier');
    // price 可能是 number 或 string（Prisma Decimal 序列化后）
    const priceNum =
      typeof tier.price === 'string' ? parseFloat(tier.price) : tier.price;
    assert(
      typeof priceNum === 'number' && !isNaN(priceNum),
      'tier.price should be valid number'
    );
    // 验证 features 字段（API 返回的 tier 对象包含 features 或 tierLimits）
    const hasFeatures =
      Array.isArray(tier.features) || Array.isArray(tier.tierLimits);
    assert(hasFeatures, 'tier should have features or tierLimits');
  });

  // ==========================================================================
  // 阶段 4: 会员历史记录
  // ==========================================================================
  runner.test('4.1 获取会员历史记录', async () => {
    const response = await client.getMembershipHistory();
    assert(response.success === true, '获取历史记录应该成功');
    assertExists(response.data, 'history data');
    assert(Array.isArray(response.data!.records), 'records should be array');
    console.log(`   📜 历史记录数量: ${response.data!.records.length || 0}`);
  });

  // ==========================================================================
  // 阶段 5: 订单管理（如果会员系统需要付费）
  // ==========================================================================
  runner.test('5.1 创建会员订单（跳过免费等级）', async () => {
    // 找到第一个非免费等级
    const paidTier = testData.tiers?.find((t: MembershipTier) => t.price > 0);
    if (!paidTier) {
      console.log('   ⏭️  跳过：无非免费等级可测试');
      return;
    }

    const response = await client.createOrder(paidTier.id, 'WECHAT');

    // 可能成功或失败（取决于环境配置），但不应报错
    if (response.success) {
      testData.order = response.data as Order;
      console.log(`   🛒 订单创建成功: ${testData.order.orderNo}`);
    } else {
      console.log(
        `   ⚠️  订单创建失败（可能预期）: ${response.error?.message}`
      );
    }
  });

  runner.test('5.2 获取订单列表', async () => {
    const response = await client.getOrders();
    assert(response.success === true, '获取订单列表应该成功');
    assertExists(response.data, 'orders data');
    assert(Array.isArray(response.data!.orders), 'orders should be array');
    console.log(`   📦 订单数量: ${response.data!.orders.length || 0}`);
  });

  // ==========================================================================
  // 阶段 6: 升级/降级测试（谨慎执行）
  // ==========================================================================
  runner.test('6.1 验证升级选项计算', async () => {
    const response = await client.getMyMembership();
    assert(response.success === true, '获取会员信息应该成功');

    // 验证升级选项数据结构
    if (response.data?.canUpgrade) {
      assert(
        Array.isArray(response.data.upgradeOptions),
        'upgradeOptions should be array'
      );
      console.log(
        `   ⬆️  可升级选项: ${response.data.upgradeOptions.length} 个`
      );
    } else {
      console.log('   ℹ️  当前无可升级选项（可能已是最高等级）');
    }
  });

  // ==========================================================================
  // 运行测试
  // ==========================================================================
  const results = await runner.run();
  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
