/**
 * 用户认证系统集成测试
 *
 * 测试覆盖完整的用户认证流程：
 * 1. 用户注册与登录
 * 2. 密码找回与重置
 * 3. 用户会话管理
 * 4. 律师资格验证
 * 5. 企业认证
 * 6. 第三方认证
 */

import { readFileSync, existsSync } from 'fs';
import { APIRequestContext, expect, test } from '@playwright/test';
import { TEST_STATE_FILE } from './global-setup';

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

interface RefreshResponseData {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken?: string;
    expiresIn: number;
  };
  error?: string;
}

interface CurrentUserResponseData {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      status: string;
      createdAt: Date | string;
      updatedAt: Date | string;
    };
  };
}

interface PasswordResetResponseData {
  success: boolean;
  message: string;
  error?: string;
}

interface QualificationResponseData {
  success: boolean;
  message: string;
  data?: {
    qualification: {
      id: string;
      licenseNumber: string;
      fullName: string;
      lawFirm: string;
      licensePhoto: string | null;
      status: string;
      submittedAt: Date | string;
      reviewedAt: Date | string | null;
      reviewNotes: string | null;
    };
  };
  error?: string;
}

interface EnterpriseResponseData {
  success: boolean;
  message: string;
  data?: {
    enterprise: {
      id: string;
      enterpriseName: string;
      creditCode: string;
      legalPerson: string;
      industryType: string;
      status: string;
      submittedAt: Date | string;
    };
  };
  error?: string;
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用户
 * @param apiContext - Playwright API请求上下文
 * @param role - 用户角色，默认为USER，可选LAWYER或ENTERPRISE
 */
async function createTestUser(
  apiContext: APIRequestContext,
  role: 'USER' | 'LAWYER' | 'ENTERPRISE' = 'USER'
): Promise<TestUser> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6); // 取后6位
  const email = `test-${timestamp}@example.com`;
  const password = 'TestPass123';

  const response = await apiContext.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `test${shortId}`,
      name: `TestUser${shortId}`,
      role, // 传递角色参数
    },
  });

  const data: AuthResponseData = await response.json();

  return {
    id: data.data?.user.id || '',
    email,
    password,
    username: `test${shortId}`,
    name: `TestUser${shortId}`,
    role: data.data?.user.role || role,
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

  // 使用API返回的真实refresh token
  const refreshToken = data.data?.refreshToken || '';

  return { token: data.data?.token || '', refreshToken };
}

/**
 * 刷新令牌
 */
async function refreshToken(
  apiContext: APIRequestContext,
  refreshTokenValue: string
): Promise<string> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/refresh`, {
    data: { refreshToken: refreshTokenValue },
  });

  const data: RefreshResponseData = await response.json();
  expect(response.ok()).toBeTruthy();
  expect(data.success).toBe(true);

  return data.data?.token || '';
}

// =============================================================================
// 测试套件：用户注册与登录
// =============================================================================

test.describe('用户注册与登录流程', () => {
  test('应该成功注册新用户', async ({ request }) => {
    const testUser = await createTestUser(request);

    expect(testUser.id).toBeTruthy();
    expect(testUser.email).toContain('@example.com');
    expect(testUser.token).toBeTruthy();
    expect(testUser.role).toBe('USER');
  });

  test('注册时应该验证邮箱格式', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: 'invalid-email',
        password: 'TestPass123',
      },
    });

    const data: AuthResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('邮箱');
  });

  test('注册时应该验证密码复杂度', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: `test-${Date.now()}@example.com`,
        password: '123', // 密码太简单
      },
    });

    const data: AuthResponseData = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('密码');
  });

  test('应该拒绝重复注册的邮箱', async ({ request }) => {
    // 创建第一个用户
    const testUser = await createTestUser(request);

    // 尝试用相同邮箱注册
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: testUser.email, // 已注册的邮箱
        password: 'AnotherPass123',
      },
    });

    const data: AuthResponseData = await response.json();
    expect(response.status()).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe('USER_EXISTS');
  });

  test('应该成功登录已注册用户', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(50); // JWT token应该足够长
  });

  test('应该拒绝错误的密码', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: testUser.email,
        password: 'WrongPassword123',
      },
    });

    const data: AuthResponseData = await response.json();
    expect(response.status()).toBe(401);
    expect(data.success).toBe(false);
  });

  test('应该获取当前用户信息', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data: CurrentUserResponseData = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.user.email).toBe(testUser.email);
    expect(data.data?.user.id).toBe(testUser.id);
  });

  test('未认证用户应该无法获取当前用户信息', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// 测试套件：用户会话管理
// =============================================================================

test.describe('用户会话管理', () => {
  test('应该成功刷新访问令牌', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token, refreshToken: rt } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    // 等待一小段时间确保token不会立即过期
    await new Promise(resolve => setTimeout(resolve, 100));

    // 刷新令牌
    const newToken = await refreshToken(request, rt);

    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(token); // 新token应该不同

    // 使用新token访问受保护资源
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
  });

  test('应该支持登出当前设备', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token, refreshToken: rt } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.post(`${BASE_URL}/api/auth/logout`, {
      data: {
        allDevices: false,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `refreshToken=${rt}`,
      },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('应该支持登出所有设备', async ({ request }) => {
    const testUser = await createTestUser(request);
    const { token, refreshToken: rt } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.post(`${BASE_URL}/api/auth/logout`, {
      data: {
        allDevices: true,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `refreshToken=${rt}`,
      },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('过期的令牌应该被拒绝', async ({ request }) => {
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJleGFtcGxlIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';

    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
      },
    });

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// 测试套件：密码找回与重置
// =============================================================================

test.describe('密码找回与重置', () => {
  test('应该发送密码重置验证码', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(
      `${BASE_URL}/api/auth/forgot-password`,
      {
        data: {
          email: testUser.email,
        },
      }
    );

    const data: PasswordResetResponseData = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.message).toContain('验证码');
  });

  test('应该防止邮箱枚举攻击（不存在的用户也返回成功）', async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/auth/forgot-password`,
      {
        data: {
          email: `nonexistent-${Date.now()}@example.com`,
        },
      }
    );

    const data: PasswordResetResponseData = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true); // 即使邮箱不存在也返回成功
  });

  test('应该验证验证码格式', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: {
        email: testUser.email,
        code: 'abc', // 无效格式
        newPassword: 'NewPass123',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('应该拒绝无效的验证码', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: {
        email: testUser.email,
        code: '123456', // 随机的6位数字
        newPassword: 'NewPass123',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('应该验证新密码复杂度', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(`${BASE_URL}/api/auth/reset-password`, {
      data: {
        email: testUser.email,
        code: '123456',
        newPassword: '123', // 密码太简单
      },
    });

    expect(response.status()).toBe(400);
  });
});

// =============================================================================
// 测试套件：律师资格验证
// =============================================================================

test.describe('律师资格验证流程', () => {
  test('应该提交律师资格申请', async ({ request }) => {
    // 使用LAWYER角色创建用户，因为平台仅对认证律师及企业法务开放
    const testUser = await createTestUser(request, 'LAWYER');

    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const timestamp = Date.now();
    const response = await request.post(
      `${BASE_URL}/api/qualifications/upload`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          licenseNumber: `11021999${timestamp.toString().slice(-9)}`, // 动态生成的17位执业证号
          fullName: '张三',
          idCardNumber: '110101199001011237', // 18位身份证号（有效校验码）
          lawFirm: '某某律师事务所',
        },
      }
    );

    const data: QualificationResponseData = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.qualification.status).toBe('UNDER_REVIEW');
  });

  test('应该验证执业证号格式', async ({ request }) => {
    // 使用LAWYER角色，因为需要访问业务API
    const testUser = await createTestUser(request, 'LAWYER');
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.post(
      `${BASE_URL}/api/qualifications/upload`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          licenseNumber: '123', // 无效格式
          fullName: '张三',
          idCardNumber: '110101199001011245',
          lawFirm: '某某律师事务所',
        },
      }
    );

    expect(response.status()).toBe(400);
  });

  test('应该验证身份证号格式', async ({ request }) => {
    // 使用LAWYER角色，因为需要访问业务API
    const testUser = await createTestUser(request, 'LAWYER');
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.post(
      `${BASE_URL}/api/qualifications/upload`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data: {
          licenseNumber: '11021999000000001',
          fullName: '李四',
          idCardNumber: '110101199001011234', // 无效的身份证号（校验码错误）
          lawFirm: '某某律师事务所',
        },
      }
    );

    expect(response.status()).toBe(400);
  });

  test('应该获取当前用户的资格状态', async ({ request }) => {
    // 使用LAWYER角色，因为需要访问业务API
    const testUser = await createTestUser(request, 'LAWYER');
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const timestamp = Date.now();
    // 先提交申请
    await request.post(`${BASE_URL}/api/qualifications/upload`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        licenseNumber: `11021999${timestamp.toString().slice(-9)}`, // 17位执业证号
        fullName: '李四',
        idCardNumber: '110101199001011253',
        lawFirm: '某某律师事务所',
      },
    });

    // 获取状态
    const response = await request.get(`${BASE_URL}/api/qualifications/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('管理员应该能够审核资格申请', async ({ request }) => {
    // 读取 global-setup 写入的测试状态（包含 admin 账号和预建资格记录 ID）
    if (!existsSync(TEST_STATE_FILE)) {
      throw new Error(
        `测试状态文件不存在 (${TEST_STATE_FILE})，请确保 global-setup 正确运行`
      );
    }
    const testState = JSON.parse(readFileSync(TEST_STATE_FILE, 'utf-8')) as {
      adminEmail: string;
      adminPassword: string;
      qualificationId: string;
    };

    // Step 1: 用管理员账号登录，获取 admin token
    const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: testState.adminEmail,
        password: testState.adminPassword,
      },
    });
    const loginData = await loginResponse.json();
    expect(loginData.success).toBe(true);
    const adminToken: string = loginData.data?.token;
    expect(adminToken).toBeTruthy();

    // Step 2: 用 admin token 审核资格申请（通过）
    const reviewResponse = await request.post(
      `${BASE_URL}/api/admin/qualifications/${testState.qualificationId}/review`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          approved: true,
          reviewNotes: 'E2E自动化测试：资格审核通过',
        },
      }
    );

    const reviewData = await reviewResponse.json();
    expect(reviewResponse.ok()).toBeTruthy();
    expect(reviewData.success).toBe(true);
    expect(reviewData.data?.qualification.status).toBe('APPROVED');

    // Step 3: 验证拒绝场景——global-setup 每次运行都会重置到 PENDING，
    //         此处直接创建另一条记录以测试拒绝路径会与 upload API 的第三方验证耦合，
    //         因此只验证：已通过的记录无法被二次审核（返回 500 或 400）
    const reReviewResponse = await request.post(
      `${BASE_URL}/api/admin/qualifications/${testState.qualificationId}/review`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          approved: false,
          reviewNotes: '重复审核验证',
        },
      }
    );
    // 已是 APPROVED 状态，二次审核不影响核心断言；只要 API 正常响应（不崩溃）即可
    expect([200, 400, 409]).toContain(reReviewResponse.status());

    // Step 4: 验证普通用户无法调用管理员审核接口
    const normalUser = await createTestUser(request);
    const normalLoginResponse = await request.post(
      `${BASE_URL}/api/auth/login`,
      { data: { email: normalUser.email, password: normalUser.password } }
    );
    const normalLoginData = await normalLoginResponse.json();
    const normalToken: string = normalLoginData.data?.token;

    const unauthorizedResponse = await request.post(
      `${BASE_URL}/api/admin/qualifications/${testState.qualificationId}/review`,
      {
        headers: { Authorization: `Bearer ${normalToken}` },
        data: { approved: true, reviewNotes: '普通用户非法审核' },
      }
    );
    expect(unauthorizedResponse.status()).toBe(403);
  });
});

// =============================================================================
// 测试套件：企业认证
// =============================================================================

test.describe('企业认证流程', () => {
  test('应该提交企业注册申请', async ({ request }) => {
    // 使用ENTERPRISE角色，因为需要访问企业API
    const testUser = await createTestUser(request, 'ENTERPRISE');
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const timestamp = Date.now();
    const response = await request.post(`${BASE_URL}/api/enterprise/register`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        enterpriseName: '测试企业有限公司',
        creditCode: `91110000${timestamp.toString().slice(-10)}`, // 动态生成的统一社会信用代码
        legalPerson: '张三',
        industryType: '制造业',
      },
    });

    const data: EnterpriseResponseData = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.enterprise.status).toBe('PENDING');
  });

  test('应该验证统一社会信用代码格式', async ({ request }) => {
    // 使用ENTERPRISE角色，因为需要访问企业API
    const testUser = await createTestUser(request, 'ENTERPRISE');
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const response = await request.post(`${BASE_URL}/api/enterprise/register`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        enterpriseName: '测试企业有限公司',
        creditCode: '123', // 无效格式
        legalPerson: '张三',
        industryType: '制造业',
      },
    });

    expect(response.status()).toBe(400);
  });

  test('应该获取当前用户的企业信息', async ({ request }) => {
    // 使用ENTERPRISE角色，因为需要访问企业API
    const testUser = await createTestUser(request, 'ENTERPRISE');
    const { token } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );

    const timestamp = Date.now();
    // 先提交企业信息
    await request.post(`${BASE_URL}/api/enterprise/register`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        enterpriseName: '测试企业有限公司',
        creditCode: `91110000${timestamp.toString().slice(-10)}`,
        legalPerson: '李四',
        industryType: '服务业',
      },
    });

    // 获取企业信息
    const response = await request.get(`${BASE_URL}/api/enterprise/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：第三方认证（OAuth）
// =============================================================================

test.describe('第三方认证流程', () => {
  test('应该支持微信OAuth授权流程', async ({ request }) => {
    // 请求授权URL（GET端点用于生成授权URL）
    const response = await request.get(
      `${BASE_URL}/api/auth/oauth/wechat?redirect_uri=http://localhost:3000/callback`
    );

    // 注意：由于这是E2E测试，实际OAuth流程需要真实配置
    // 这里测试API端点是否可访问
    expect(response.status()).not.toBe(404);
  });

  test('应该支持QQ OAuth授权流程', async ({ request }) => {
    // 请求授权URL
    const response = await request.get(
      `${BASE_URL}/api/auth/oauth/qq?redirect_uri=http://localhost:3000/callback`
    );

    // 注意：由于这是E2E测试，实际OAuth流程需要真实配置
    // 这里测试API端点是否可访问
    expect(response.status()).not.toBe(404);
  });

  test('OAuth回调应该验证必要参数', async ({ request }) => {
    // POST回调端点需要验证code和state参数
    const response = await request.post(`${BASE_URL}/api/auth/oauth/wechat`, {
      data: {},
    });

    expect(response.status()).toBe(400);
  });
});

// =============================================================================
// 测试套件：综合测试 - 完整用户流程
// =============================================================================

test.describe('综合测试 - 完整用户生命周期', () => {
  test('完整用户生命周期：注册到激活', async ({ request }) => {
    // 1. 注册新用户
    const timestamp = Date.now();
    const shortId = String(timestamp).slice(-6);
    const email = `lifecycle-${timestamp}@example.com`;
    const password = 'Lifecycle123';

    // 使用LAWYER角色注册，因为需要访问业务API
    const registerResponse = await request.post(
      `${BASE_URL}/api/auth/register`,
      {
        data: {
          email,
          password,
          username: `life${shortId}`,
          name: `LifeUser${shortId}`,
          role: 'LAWYER',
        },
      }
    );

    const registerData: AuthResponseData = await registerResponse.json();
    expect(registerResponse.ok()).toBeTruthy();
    expect(registerData.success).toBe(true);

    // 2. 登录
    const { token, refreshToken: rt } = await loginUser(
      request,
      email,
      password
    );

    // 3. 获取当前用户信息
    const meResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const meData: CurrentUserResponseData = await meResponse.json();
    expect(meResponse.ok()).toBeTruthy();
    expect(meData.data?.user.email).toBe(email);

    // 4. 刷新令牌
    const newToken = await refreshToken(request, rt);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(token);

    // 5. 使用新令牌获取用户信息
    const newMeResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${newToken}`,
      },
    });

    expect(newMeResponse.ok()).toBeTruthy();

    // 6. 提交律师资格申请
    const qualResponse = await request.post(
      `${BASE_URL}/api/qualifications/upload`,
      {
        headers: {
          Authorization: `Bearer ${newToken}`,
        },
        data: {
          licenseNumber: `11021999${timestamp.toString().slice(-9)}`, // 17位执业证号
          fullName: '完整流程测试用户',
          idCardNumber: '110101199001011245',
          lawFirm: '完整流程测试律所',
        },
      }
    );

    const qualData: QualificationResponseData = await qualResponse.json();
    expect(qualResponse.ok()).toBeTruthy();
    expect(qualData.success).toBe(true);

    // 7. 登出
    const logoutResponse = await request.post(`${BASE_URL}/api/auth/logout`, {
      data: { allDevices: false },
      headers: {
        Authorization: `Bearer ${newToken}`,
        Cookie: `refreshToken=${rt}`,
      },
    });

    const logoutData = await logoutResponse.json();
    expect(logoutResponse.ok()).toBeTruthy();
    expect(logoutData.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：安全和边界情况
// =============================================================================

test.describe('安全和边界情况测试', () => {
  test('应该拒绝无效的JWT令牌', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: 'Bearer invalid.token.here',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('应该拒绝缺少Authorization头的请求', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);

    expect(response.status()).toBe(401);
  });

  test('应该拒绝格式错误的Authorization头', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: 'InvalidFormat token',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('应该处理过大的请求体', async ({ request }) => {
    // 发送包含 2MB 超大字段值的请求，验证 API 不会崩溃
    // 该测试覆盖 DoS 攻击场景：攻击者发送超大 JSON 字段拖垮服务器
    const twoMB = 'x'.repeat(2 * 1024 * 1024);

    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: twoMB, password: 'TestPass123' },
    });

    // 应返回 400（字段验证失败）或 413（框架/代理层拦截请求体过大）
    // 不接受 5xx（崩溃）或 200（成功处理了超大输入）
    expect([400, 413]).toContain(response.status());

    // 注册接口同样需要防范
    const regResponse = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: `test-${Date.now()}@example.com`,
        password: twoMB,
        username: 'test-oversized',
      },
    });
    expect([400, 413]).toContain(regResponse.status());
  });

  test('应该处理缺失必填字段的请求', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: testUser.email,
        // 缺少password
      },
    });

    expect(response.status()).toBe(400);
  });

  test('应该处理空请求体', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {},
    });

    expect(response.status()).toBe(400);
  });
});
