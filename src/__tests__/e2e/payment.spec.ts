/**
 * 支付系统集成测试
 *
 * 测试覆盖完整的支付流程：
 * 1. 创建支付订单（微信支付、支付宝支付）
 * 2. 查询支付订单状态
 * 3. 支付回调处理（模拟第三方支付回调）
 * 4. 支付安全与权限验证
 * 5. 错误场景处理
 */

import { APIRequestContext, expect, test } from '@playwright/test';

// 测试基础URL
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据类型定义
// =============================================================================

interface TestUser {
  id: string;
  email: string;
  password: string;
  username?: string;
  name?: string;
  role: string;
  token?: string;
  refreshToken?: string;
}

interface AuthResponseData {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      createdAt: Date | string;
    };
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: string;
}

interface MembershipTierResponseData {
  success: boolean;
  data?: {
    tiers: Array<{
      id: string;
      name: string;
      displayName: string;
      tier: string;
      price: number;
      currency: string;
      isActive: boolean;
    }>;
  };
  error?: string;
}

interface CreateOrderResponseData {
  success: boolean;
  message: string;
  data?: {
    orderId: string;
    orderNo: string;
    amount: number;
    currency: string;
    status: string;
    expiredAt: string | Date;
    paymentMethod: string;
    codeUrl?: string;
    prepayId?: string;
    qrCode?: string;
    tradeNo?: string;
  };
  error?: string;
}

interface QueryPaymentResponseData {
  success: boolean;
  message: string;
  data?: {
    order: {
      id: string;
      orderNo: string;
      userId: string;
      membershipTierId: string;
      paymentMethod: string;
      status: string;
      amount: number;
      currency: string;
      description: string;
      expiredAt: string | Date;
      createdAt: string | Date;
      updatedAt: string | Date;
    };
    paymentStatus: string;
  };
  error?: string;
}

interface PaymentCallbackData {
  id: string;
  resource_type: string;
  event_type: string;
  resource: {
    algorithm: string;
    ciphertext: string;
    nonce: string;
    associated_data: string;
  };
  create_time: string;
  summary: string;
}

interface WechatCallbackResponseData {
  code: string;
  message: string;
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用户
 */
async function createTestUser(
  apiContext: APIRequestContext
): Promise<TestUser> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);
  const email = `payment-test-${timestamp}@example.com`;
  const password = 'PaymentTest123';

  const response = await apiContext.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `payment${shortId}`,
      name: `PaymentUser${shortId}`,
    },
  });

  const data: AuthResponseData = await response.json();

  return {
    id: data.data?.user.id || '',
    email,
    password,
    username: `payment${shortId}`,
    name: `PaymentUser${shortId}`,
    role: data.data?.user.role || 'USER',
    token: data.data?.token,
    refreshToken: data.data?.refreshToken,
  };
}

/**
 * 用户登录
 */
async function loginUser(
  apiContext: APIRequestContext,
  email: string,
  password: string
): Promise<{ token: string; refreshToken: string }> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const data: AuthResponseData = await response.json();
  expect(response.ok()).toBeTruthy();
  expect(data.success).toBe(true);

  return {
    token: data.data?.token || '',
    refreshToken: data.data?.refreshToken || '',
  };
}

/**
 * 获取会员等级列表
 */
async function getMembershipTiers(
  apiContext: APIRequestContext,
  token: string
): Promise<MembershipTierResponseData> {
  const response = await apiContext.get(`${BASE_URL}/api/memberships/tiers`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await response.json();
}

/**
 * 创建支付订单
 */
async function createPaymentOrder(
  apiContext: APIRequestContext,
  token: string,
  membershipTierId: string,
  paymentMethod: 'WECHAT' | 'ALIPAY'
): Promise<CreateOrderResponseData> {
  const response = await apiContext.post(`${BASE_URL}/api/payments/create`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      membershipTierId,
      paymentMethod,
      billingCycle: 'MONTHLY',
      autoRenew: false,
      description: 'E2E测试订单',
    },
  });

  return await response.json();
}

/**
 * 查询支付订单
 */
async function queryPaymentOrder(
  apiContext: APIRequestContext,
  token: string,
  orderId: string
): Promise<QueryPaymentResponseData> {
  const response = await apiContext.get(
    `${BASE_URL}/api/payments/query?orderId=${orderId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return await response.json();
}

/**
 * 生成唯一的订单号前缀
 */
function generateOrderPrefix(): string {
  return `TEST${Date.now()}`;
}

// =============================================================================
// 测试套件：创建支付订单
// =============================================================================

test.describe('创建支付订单流程', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;

  test.beforeAll(async ({ request }) => {
    // 创建测试用户
    testUser = await createTestUser(request);
    const { token, refreshToken } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );
    testUser.token = token;
    testUser.refreshToken = refreshToken;

    // 获取会员等级列表
    tiers = await getMembershipTiers(request, token);
    expect(tiers.success).toBe(true);

    // 找到第一个活跃的会员等级
    const activeTier = tiers.data?.tiers?.find(tier => tier.isActive);
    expect(activeTier).toBeDefined();
    validTierId = activeTier?.id || '';
  });

  test('应该成功创建微信支付订单', async ({ request }) => {
    const responseData: CreateOrderResponseData = await createPaymentOrder(
      request,
      testUser.token || '',
      validTierId,
      'WECHAT'
    );

    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe('订单创建成功');
    expect(responseData.data).toBeDefined();
    expect(responseData.data?.orderId).toBeDefined();
    expect(responseData.data?.orderNo).toBeDefined();
    expect(responseData.data?.paymentMethod).toBe('WECHAT');
    expect(responseData.data?.amount).toBeGreaterThan(0);
    expect(responseData.data?.codeUrl).toBeDefined(); // 微信支付返回二维码链接
  });

  test('应该成功创建支付宝支付订单', async ({ request }) => {
    const responseData: CreateOrderResponseData = await createPaymentOrder(
      request,
      testUser.token || '',
      validTierId,
      'ALIPAY'
    );

    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe('订单创建成功');
    expect(responseData.data).toBeDefined();
    expect(responseData.data?.orderId).toBeDefined();
    expect(responseData.data?.orderNo).toBeDefined();
    expect(responseData.data?.paymentMethod).toBe('ALIPAY');
    expect(responseData.data?.amount).toBeGreaterThan(0);
    expect(responseData.data?.qrCode).toBeDefined(); // 支付宝支付返回二维码
  });

  test('应该拒绝未授权的订单创建请求', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      data: {
        membershipTierId: validTierId,
        paymentMethod: 'WECHAT',
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(response.status()).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  test('应该拒绝缺少会员等级ID的请求', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        paymentMethod: 'WECHAT',
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('MISSING_TIER_ID');
  });

  test('应该拒绝无效的支付方式', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        membershipTierId: validTierId,
        paymentMethod: 'INVALID_METHOD' as 'WECHAT',
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_PAYMENT_METHOD');
  });

  test('应该拒绝无效的计费周期', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        membershipTierId: validTierId,
        paymentMethod: 'WECHAT',
        billingCycle: 'INVALID_CYCLE',
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('INVALID_BILLING_CYCLE');
  });

  test('应该拒绝不存在的会员等级', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        membershipTierId: 'non-existent-tier-id',
        paymentMethod: 'WECHAT',
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(response.status()).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toBe('TIER_NOT_FOUND');
  });
});

// =============================================================================
// 测试套件：查询支付订单
// =============================================================================

test.describe('查询支付订单流程', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;
  let createdOrderId: string;
  let createdOrderNo: string;

  test.beforeAll(async ({ request }) => {
    // 创建测试用户
    testUser = await createTestUser(request);
    const { token, refreshToken } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );
    testUser.token = token;
    testUser.refreshToken = refreshToken;

    // 获取会员等级列表
    tiers = await getMembershipTiers(request, token);
    const activeTier = tiers.data?.tiers?.find(tier => tier.isActive);
    validTierId = activeTier?.id || '';

    // 创建测试订单
    const createResponse: CreateOrderResponseData = await createPaymentOrder(
      request,
      token,
      validTierId,
      'WECHAT'
    );
    createdOrderId = createResponse.data?.orderId || '';
    createdOrderNo = createResponse.data?.orderNo || '';
  });

  test('应该成功查询订单信息', async ({ request }) => {
    const responseData: QueryPaymentResponseData = await queryPaymentOrder(
      request,
      testUser.token || '',
      createdOrderId
    );

    expect(responseData.success).toBe(true);
    expect(responseData.message).toBe('查询成功');
    expect(responseData.data).toBeDefined();
    expect(responseData.data?.order).toBeDefined();
    expect(responseData.data?.order.id).toBe(createdOrderId);
    expect(responseData.data?.order.orderNo).toBe(createdOrderNo);
  });

  test('应该返回订单状态', async ({ request }) => {
    const responseData: QueryPaymentResponseData = await queryPaymentOrder(
      request,
      testUser.token || '',
      createdOrderId
    );

    expect(responseData.data?.paymentStatus).toBeDefined();
    expect([
      'PENDING',
      'PROCESSING',
      'SUCCESS',
      'FAILED',
      'CANCELLED',
      'EXPIRED',
    ]).toContain(responseData.data?.paymentStatus);
  });

  test('应该拒绝未授权的查询请求', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/payments/query?orderId=${createdOrderId}`
    );

    const data: QueryPaymentResponseData = await response.json();
    expect(response.status()).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('UNAUTHORIZED');
  });

  test('应该拒绝缺少查询参数的请求', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/payments/query`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
    });

    const data: QueryPaymentResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('MISSING_PARAMETER');
  });

  test('应该返回订单不存在错误', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/payments/query?orderId=non-existent-order-id`,
      {
        headers: {
          Authorization: `Bearer ${testUser.token}`,
        },
      }
    );

    expect(response.status()).toBe(404);
    const data: QueryPaymentResponseData = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('ORDER_NOT_FOUND');
  });

  test('应该支持通过orderNo查询订单', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/payments/query?orderNo=${createdOrderNo}`,
      {
        headers: {
          Authorization: `Bearer ${testUser.token}`,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data: QueryPaymentResponseData = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.order.orderNo).toBe(createdOrderNo);
  });
});

// =============================================================================
// 测试套件：支付回调处理（模拟）
// =============================================================================

test.describe('支付回调处理（模拟）', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;
  let _createdOrderId: string;

  test.beforeAll(async ({ request }) => {
    // 创建测试用户
    testUser = await createTestUser(request);
    const { token, refreshToken } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );
    testUser.token = token;
    testUser.refreshToken = refreshToken;

    // 获取会员等级列表
    tiers = await getMembershipTiers(request, token);
    const activeTier = tiers.data?.tiers?.find(tier => tier.isActive);
    validTierId = activeTier?.id || '';

    // 创建测试订单
    const createResponse: CreateOrderResponseData = await createPaymentOrder(
      request,
      token,
      validTierId,
      'WECHAT'
    );
    createdOrderId = createResponse.data?.orderId || '';
  });

  test('微信支付回调端点应该可访问', async ({ request }) => {
    // 模拟微信支付回调请求
    const mockCallbackData: PaymentCallbackData = {
      id: 'test-callback-id',
      resource_type: 'encrypt-resource',
      event_type: 'TRANSACTION.SUCCESS',
      resource: {
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext: 'mock-ciphertext',
        nonce: 'mock-nonce',
        associated_data: 'mock-associated-data',
      },
      create_time: new Date().toISOString(),
      summary: '测试回调',
    };

    const response = await request.post(
      `${BASE_URL}/api/payments/wechat/callback`,
      {
        data: mockCallbackData,
      }
    );

    // 即使验证失败，端点也应该可访问
    expect([200, 400, 401]).toContain(response.status());
  });

  test('支付宝回调端点应该可访问', async ({ request }) => {
    // 模拟支付宝回调请求
    const mockCallbackData = {
      trade_status: 'TRADE_SUCCESS',
      trade_no: `TEST${Date.now()}`,
      out_trade_no: `ORDER${Date.now()}`,
      total_amount: '99.00',
      buyer_id: 'test-buyer-id',
      buyer_logon_id: 'test-buyer@example.com',
      notify_time: new Date().toISOString(),
      subject: 'E2E测试订单',
      app_id: 'test-app-id',
    };

    const response = await request.post(
      `${BASE_URL}/api/payments/alipay/callback`,
      {
        form: mockCallbackData,
      }
    );

    // 即使验证失败，端点也应该可访问
    expect([200, 400, 401]).toContain(response.status());
  });

  test('应该验证回调签名的完整性', async ({ request }) => {
    // 发送没有签名的回调请求
    const response = await request.post(
      `${BASE_URL}/api/payments/wechat/callback`,
      {
        data: {
          id: 'test-callback-id',
          event_type: 'TRANSACTION.SUCCESS',
        },
      }
    );

    // 应该返回验证失败
    const data: WechatCallbackResponseData = await response.json();
    expect([400, 401]).toContain(response.status());
    if (response.status() === 400) {
      expect(data.code).toBe('FAIL');
    }
  });
});

// =============================================================================
// 测试套件：支付安全与权限验证
// =============================================================================

test.describe('支付安全与权限验证', () => {
  let testUser: TestUser;
  let anotherUser: TestUser;
  let tiers: MembershipTierResponseData;
  let validTierId: string;
  let testUserOrderId: string;

  test.beforeAll(async ({ request }) => {
    // 创建第一个测试用户
    testUser = await createTestUser(request);
    const { token: token1, refreshToken: rt1 } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );
    testUser.token = token1;
    testUser.refreshToken = rt1;

    // 创建第二个测试用户
    anotherUser = await createTestUser(request);
    const { token: token2, refreshToken: rt2 } = await loginUser(
      request,
      anotherUser.email,
      anotherUser.password
    );
    anotherUser.token = token2;
    anotherUser.refreshToken = rt2;

    // 获取会员等级列表
    tiers = await getMembershipTiers(request, testUser.token || '');
    const activeTier = tiers.data?.tiers?.find(tier => tier.isActive);
    validTierId = activeTier?.id || '';

    // 为第一个用户创建订单
    const createResponse: CreateOrderResponseData = await createPaymentOrder(
      request,
      testUser.token || '',
      validTierId,
      'WECHAT'
    );
    testUserOrderId = createResponse.data?.orderId || '';
  });

  test('应该拒绝用户查询其他用户的订单', async ({ request }) => {
    const responseData: QueryPaymentResponseData = await queryPaymentOrder(
      request,
      anotherUser.token || '',
      testUserOrderId
    );

    expect(responseData.success).toBe(false);
    const queryResponse = await request.get(
      `${BASE_URL}/api/payments/query?orderId=${testUserOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${anotherUser.token}`,
        },
      }
    );
    expect(queryResponse.status()).toBe(403); // 禁止访问
  });

  test('应该拒绝无效的JWT令牌', async ({ request }) => {
    const invalidToken = 'invalid.jwt.token';
    const response = await request.get(
      `${BASE_URL}/api/payments/query?orderId=${testUserOrderId}`,
      {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      }
    );

    expect(response.status()).toBe(401);
  });

  test('应该拒绝缺少Authorization头的请求', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/payments/query?orderId=${testUserOrderId}`
    );

    expect(response.status()).toBe(401);
  });

  test('应该拒绝格式错误的Authorization头', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/payments/query?orderId=${testUserOrderId}`,
      {
        headers: {
          Authorization: 'InvalidFormat token',
        },
      }
    );

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// 测试套件：订单金额与计费周期验证
// =============================================================================

test.describe('订单金额与计费周期验证', () => {
  let testUser: TestUser;
  let tiers: MembershipTierResponseData;

  test.beforeAll(async ({ request }) => {
    // 创建测试用户
    testUser = await createTestUser(request);
    const { token, refreshToken } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );
    testUser.token = token;
    testUser.refreshToken = refreshToken;

    // 获取会员等级列表
    tiers = await getMembershipTiers(request, token);
  });

  test('应该为月度计费计算正确金额', async ({ request }) => {
    const tier = tiers.data?.tiers?.find(t => t.isActive);
    expect(tier).toBeDefined();

    const responseData: CreateOrderResponseData = await createPaymentOrder(
      request,
      testUser.token || '',
      tier?.id || '',
      'WECHAT'
    );

    expect(responseData.data?.amount).toBe(tier?.price);
  });

  test('应该为季度计费计算正确金额', async ({ request }) => {
    const tier = tiers.data?.tiers?.find(t => t.isActive);
    expect(tier).toBeDefined();

    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        membershipTierId: tier?.id,
        paymentMethod: 'WECHAT',
        billingCycle: 'QUARTERLY',
        autoRenew: false,
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.amount).toBe((tier?.price || 0) * 3);
  });

  test('应该为年度计费计算正确金额', async ({ request }) => {
    const tier = tiers.data?.tiers?.find(t => t.isActive);
    expect(tier).toBeDefined();

    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        membershipTierId: tier?.id,
        paymentMethod: 'WECHAT',
        billingCycle: 'YEARLY',
        autoRenew: false,
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.amount).toBe((tier?.price || 0) * 12);
  });

  test('应该为终身会员计算正确金额', async ({ request }) => {
    const tier = tiers.data?.tiers?.find(tier => tier.tier === 'LIFETIME');
    if (!tier || !tier.isActive) {
      // 终身会员等级不存在或未启用，跳过测试
      return;
    }

    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${testUser.token}`,
      },
      data: {
        membershipTierId: tier.id,
        paymentMethod: 'WECHAT',
        billingCycle: 'LIFETIME',
        autoRenew: false,
      },
    });

    const data: CreateOrderResponseData = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.amount).toBe(tier.price);
  });
});

// =============================================================================
// 测试套件：综合测试 - 完整支付流程
// =============================================================================

test.describe('综合测试 - 完整支付流程', () => {
  test('完整支付流程：从创建订单到查询', async ({ request }) => {
    // 1. 创建测试用户
    const testUser = await createTestUser(request);
    const { token, refreshToken } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    // 2. 获取会员等级列表
    const tiers = await getMembershipTiers(request, token);
    expect(tiers.success).toBe(true);
    const activeTier = tiers.data?.tiers?.find(tier => tier.isActive);
    expect(activeTier).toBeDefined();
    const validTierId = activeTier?.id || '';

    // 3. 创建微信支付订单
    const createResponseData: CreateOrderResponseData =
      await createPaymentOrder(request, token, validTierId, 'WECHAT');
    expect(createResponseData.success).toBe(true);
    const orderId = createResponseData.data?.orderId || '';
    const orderNo = createResponseData.data?.orderNo || '';

    // 4. 查询订单信息（通过orderId）
    const queryResponse1: QueryPaymentResponseData = await queryPaymentOrder(
      request,
      token,
      orderId
    );
    expect(queryResponse1.success).toBe(true);
    expect(queryResponse1.data?.order.id).toBe(orderId);

    // 5. 查询订单信息（通过orderNo）
    const queryResponse2 = await request.get(
      `${BASE_URL}/api/payments/query?orderNo=${orderNo}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    expect(queryResponse2.ok()).toBeTruthy();
    const queryData2 = await queryResponse2.json();
    expect(queryData2.data?.order.orderNo).toBe(orderNo);

    // 6. 验证订单金额正确
    expect(queryResponse1.data?.order.amount).toBe(activeTier?.price);
  });

  test('完整支付流程：双支付方式测试', async ({ request }) => {
    // 1. 创建测试用户
    const testUser = await createTestUser(request);
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    // 2. 获取会员等级列表
    const tiers = await getMembershipTiers(request, token);
    const activeTier = tiers.data?.tiers?.find(tier => tier.isActive);
    const validTierId = activeTier?.id || '';

    // 3. 创建微信支付订单
    const wechatResponseData: CreateOrderResponseData =
      await createPaymentOrder(request, token, validTierId, 'WECHAT');
    expect(wechatResponseData.success).toBe(true);
    expect(wechatResponseData.data?.paymentMethod).toBe('WECHAT');
    expect(wechatResponseData.data?.codeUrl).toBeDefined();

    // 4. 创建支付宝支付订单
    const alipayResponseData: CreateOrderResponseData =
      await createPaymentOrder(request, token, validTierId, 'ALIPAY');
    expect(alipayResponseData.success).toBe(true);
    expect(alipayResponseData.data?.paymentMethod).toBe('ALIPAY');
    expect(alipayResponseData.data?.qrCode).toBeDefined();

    // 5. 验证两个订单的金额相同
    expect(wechatResponseData.data?.amount).toBe(
      alipayResponseData.data?.amount
    );
  });
});

// =============================================================================
// 测试套件：错误处理与边界情况
// =============================================================================

test.describe('错误处理与边界情况', () => {
  test('应该处理空请求体', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {},
    });

    const data: CreateOrderResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
  });

  test('应该处理超长的会员等级ID', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const longId = 'a'.repeat(1000); // 超长ID

    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        membershipTierId: longId,
        paymentMethod: 'WECHAT',
      },
    });

    // 应该返回404（不存在）或400（格式错误）
    expect([400, 404]).toContain(response.status());
  });

  test('应该处理特殊字符的订单描述', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const tiers = await getMembershipTiers(request, token);
    const activeTier = tiers.data?.tiers?.find(t => t.isActive);

    const response = await request.post(`${BASE_URL}/api/payments/create`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        membershipTierId: activeTier?.id,
        paymentMethod: 'WECHAT',
        description: '测试<>&"\'订单',
      },
    });

    const data: CreateOrderResponseData = await response.json();
    // 应该成功处理或拒绝特殊字符
    expect([200, 400]).toContain(response.status());
    if (response.status() === 200) {
      expect(data.success).toBe(true);
    }
  });
});
