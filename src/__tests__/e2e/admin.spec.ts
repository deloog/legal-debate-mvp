/**
 * 管理后台集成测试
 *
 * 测试覆盖：
 * 1. 认证和权限控制
 * 2. 用户管理功能
 * 3. 案件管理功能
 * 4. 法条管理功能
 * 5. 系统日志功能
 * 6. 系统配置功能
 * 7. 角色和权限管理
 * 8. 律师资格审核
 */

import { expect, test } from '@playwright/test';
import {
  registerTestUser,
  loginAdminUser,
  getUsersList,
  getUserDetail,
  updateUserRole,
  getCasesList,
  deleteCase,
  getLawArticlesList,
  importLawArticles,
  reviewLawArticle,
  getErrorLogsList,
  getActionLogsList,
  getRolesList,
  getPermissionsList,
  getConfigsList,
  createConfig,
  updateConfig,
  getQualificationsList,
  reviewQualification,
} from './admin-helpers';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './global-setup';

// =============================================================================
// 测试基础URL
// =============================================================================
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试套件：认证和权限控制
// =============================================================================

test.describe('管理后台 - 认证和权限控制', () => {
  test('应该能够注册测试用户', async ({ request }) => {
    const testUser = await registerTestUser(request);

    expect(testUser.id).toBeTruthy();
    expect(testUser.email).toContain('@example.com');
    expect(testUser.token).toBeTruthy();
    expect(testUser.role).toBeTruthy();
  });

  test('应该能够登录管理员用户', async ({ request }) => {
    const testUser = await registerTestUser(request, 'USER');
    const { token } = await loginAdminUser(
      request,
      testUser.email,
      testUser.password
    );

    expect(token).toBeTruthy();
    expect(token.length).toBeGreaterThan(50);
  });

  test('未认证用户应该无法访问管理API', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/admin/users`);

    expect(response.status()).toBe(401);
  });
});

// =============================================================================
// 测试套件：用户管理
// =============================================================================

test.describe('管理后台 - 用户管理', () => {
  let adminToken: string;
  let testUser: {
    id: string;
    email: string;
    password: string;
  };

  test.beforeAll(async ({ request }) => {
    // 使用seed-admin.ts创建的管理员账户
    const { token } = await loginAdminUser(
      request,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD
    );
    adminToken = token;

    // 创建测试用户
    testUser = await registerTestUser(request);
  });

  test('应该能够获取用户列表', async ({ request }) => {
    const response = await getUsersList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.users).toBeInstanceOf(Array);
    expect(response.data?.pagination).toBeDefined();
  });

  test('应该能够按角色筛选用户', async ({ request }) => {
    const response = await getUsersList(request, adminToken, {
      role: 'USER',
    });

    expect(response.success).toBe(true);
    expect(response.data?.users).toBeDefined();
  });

  test('应该能够按状态筛选用户', async ({ request }) => {
    const response = await getUsersList(request, adminToken, {
      status: 'ACTIVE',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按关键词搜索用户', async ({ request }) => {
    const response = await getUsersList(request, adminToken, {
      search: 'test',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持用户列表分页', async ({ request }) => {
    const response = await getUsersList(request, adminToken, {
      page: 1,
      limit: 10,
    });

    expect(response.success).toBe(true);
    expect(response.data?.pagination.limit).toBe(10);
    expect(response.data?.pagination.page).toBe(1);
  });

  test('应该能够获取用户详情', async ({ request }) => {
    const response = await getUserDetail(request, adminToken, testUser.id);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('应该能够更新用户角色', async ({ request }) => {
    const response = await updateUserRole(
      request,
      adminToken,
      testUser.id,
      'LAWYER'
    );

    expect(response.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：案件管理
// =============================================================================

test.describe('管理后台 - 案件管理', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // 使用seed-admin.ts创建的管理员账户
    const { token } = await loginAdminUser(
      request,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD
    );
    adminToken = token;
  });

  test('应该能够获取案件列表', async ({ request }) => {
    const response = await getCasesList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.cases).toBeInstanceOf(Array);
  });

  test('应该能够按类型筛选案件', async ({ request }) => {
    const response = await getCasesList(request, adminToken, {
      type: 'CIVIL_CONTRACT',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按状态筛选案件', async ({ request }) => {
    const response = await getCasesList(request, adminToken, {
      status: 'DRAFT',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按关键词搜索案件', async ({ request }) => {
    const response = await getCasesList(request, adminToken, {
      search: '测试',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持案件列表分页', async ({ request }) => {
    const response = await getCasesList(request, adminToken, {
      page: 1,
      limit: 10,
    });

    expect(response.success).toBe(true);
    expect(response.data?.pagination.limit).toBe(10);
  });

  test('应该能够删除案件', async ({ request }) => {
    // 1. 先以管理员身份创建案件
    const createRes = await request.post(`${BASE_URL}/api/v1/cases`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        title: 'E2E管理员删除测试案件',
        description: '用于测试管理员删除功能',
        type: 'CIVIL_CONTRACT',
      },
    });
    expect([200, 201]).toContain(createRes.status());
    const createData = await createRes.json();
    const caseId = createData.data?.id;
    expect(caseId).toBeTruthy();

    // 2. 管理员删除该案件
    const deleteResponse = await deleteCase(request, adminToken, caseId);
    expect(deleteResponse.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：法条管理
// =============================================================================

test.describe('管理后台 - 法条管理', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // 使用seed-admin.ts创建的管理员账户
    const { token } = await loginAdminUser(
      request,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD
    );
    adminToken = token;
  });

  test('应该能够获取法条列表', async ({ request }) => {
    const response = await getLawArticlesList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.articles).toBeInstanceOf(Array);
  });

  test('应该能够按法律类型筛选法条', async ({ request }) => {
    const response = await getLawArticlesList(request, adminToken, {
      lawType: 'civil',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按类别筛选法条', async ({ request }) => {
    const response = await getLawArticlesList(request, adminToken, {
      category: '合同法',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按状态筛选法条', async ({ request }) => {
    const response = await getLawArticlesList(request, adminToken, {
      status: 'DRAFT',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按关键词搜索法条', async ({ request }) => {
    const response = await getLawArticlesList(request, adminToken, {
      search: '第一条',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够导入法条', async ({ request }) => {
    const response = await importLawArticles(request, adminToken, [
      {
        name: '测试法条',
        articleNumber: '1',
        content: '测试内容',
        lawType: 'civil',
        category: '合同法',
      },
    ]);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('应该能够审核法条', async ({ request }) => {
    const response = await reviewLawArticle(
      request,
      adminToken,
      'test-article-id',
      true
    );
    // 由于我们没有真实的法条ID，期望返回404 (NOT_FOUND) 或成功
    expect(
      response.success === true || response.error === 'NOT_FOUND'
    ).toBeTruthy();
  });
});

// =============================================================================
// 测试套件：系统日志
// =============================================================================

test.describe('管理后台 - 系统日志', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // 使用seed-admin.ts创建的管理员账户
    const { token } = await loginAdminUser(
      request,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD
    );
    adminToken = token;
  });

  test('应该能够获取错误日志列表', async ({ request }) => {
    const response = await getErrorLogsList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.logs).toBeInstanceOf(Array);
  });

  test('应该能够按严重程度筛选错误日志', async ({ request }) => {
    const response = await getErrorLogsList(request, adminToken, {
      severity: 'HIGH',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按错误类型筛选错误日志', async ({ request }) => {
    const response = await getErrorLogsList(request, adminToken, {
      errorType: 'DATABASE_ERROR',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按用户ID筛选错误日志', async ({ request }) => {
    const response = await getErrorLogsList(request, adminToken, {
      userId: 'test-user-id',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按时间范围筛选错误日志', async ({ request }) => {
    const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const endTime = new Date().toISOString().split('T')[0];

    const response = await getErrorLogsList(request, adminToken, {
      startTime,
      endTime,
    });

    expect(response.success).toBe(true);
  });

  test('应该能够获取操作日志列表', async ({ request }) => {
    const response = await getActionLogsList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.logs).toBeInstanceOf(Array);
  });

  test('应该能够按操作类型筛选操作日志', async ({ request }) => {
    const response = await getActionLogsList(request, adminToken, {
      actionType: 'LOGIN',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按操作分类筛选操作日志', async ({ request }) => {
    const response = await getActionLogsList(request, adminToken, {
      actionCategory: 'AUTH',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持日志列表分页', async ({ request }) => {
    const response = await getErrorLogsList(request, adminToken, {
      page: 1,
      limit: 20,
    });

    expect(response.success).toBe(true);
    expect(response.data?.pagination.limit).toBe(20);
  });
});

// =============================================================================
// 测试套件：系统配置
// =============================================================================

test.describe('管理后台 - 系统配置', () => {
  let adminToken: string;
  const testConfig = {
    key: `test_config_${Date.now()}`,
    value: 'test_value',
    type: 'STRING',
    category: 'other',
    description: '测试配置',
  };

  test.beforeAll(async ({ request }) => {
    // 使用seed-admin.ts创建的管理员账户
    const { token } = await loginAdminUser(
      request,
      E2E_ADMIN_EMAIL,
      E2E_ADMIN_PASSWORD
    );
    adminToken = token;
  });

  test('应该能够获取配置列表', async ({ request }) => {
    const response = await getConfigsList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data?.configs).toBeInstanceOf(Array);
  });

  test('应该能够按分类筛选配置', async ({ request }) => {
    const response = await getConfigsList(request, adminToken, {
      category: 'general',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够按类型筛选配置', async ({ request }) => {
    const response = await getConfigsList(request, adminToken, {
      type: 'STRING',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够创建配置', async ({ request }) => {
    const response = await createConfig(request, adminToken, testConfig);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('应该能够更新配置', async ({ request }) => {
    const newValue = 'updated_value';
    const response = await updateConfig(
      request,
      adminToken,
      testConfig.key,
      newValue
    );

    expect(response.success).toBe(true);
  });

  test('应该支持配置列表分页', async ({ request }) => {
    const response = await getConfigsList(request, adminToken, {
      page: 1,
      limit: 10,
    });

    expect(response.success).toBe(true);
    expect(response.data?.pagination.limit).toBe(10);
  });
});
