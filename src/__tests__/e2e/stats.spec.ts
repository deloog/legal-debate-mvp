/**
 * 统计系统集成测试
 *
 * 测试覆盖：
 * 1. 用户统计API（注册趋势、活跃度）
 * 2. 案件统计API（类型分布、效率）
 * 3. 辩论统计API（生成次数、质量评分）
 * 4. 性能统计API（响应时间、错误率）
 * 5. 数据导出功能
 * 6. 报告系统
 * 7. 权限控制
 */

import { expect, test } from '@playwright/test';
import {
  registerTestUser,
  getAdminToken,
  getUserRegistrationTrend,
  getUserActivity,
  getCaseTypeDistribution,
  getCaseEfficiency,
  getDebateGenerationCount,
  getDebateQualityScore,
  getPerformanceResponseTime,
  getPerformanceErrorRate,
  exportCaseData,
  exportStatsData,
  getReportsList,
  createReport,
  getReportDetail,
  deleteReport,
} from './stats-helpers';

// =============================================================================
// 测试套件：用户统计API
// =============================================================================

test.describe('统计系统 - 用户统计API', () => {
  let adminToken: string;
  let testUserToken: string;

  test.beforeAll(async ({ request }) => {
    // 登录管理员用户（使用getAdminToken，包含备用方案）
    const { token: adminUserToken } = await getAdminToken(request);
    adminToken = adminUserToken;
    // 注册普通测试用户
    const { token: userToken } = await registerTestUser(request);
    testUserToken = userToken;
  });

  test('应该能够获取用户注册趋势', async ({ request }) => {
    const response = await getUserRegistrationTrend(request, adminToken);

    console.log('=== 用户注册趋势API响应 ===');
    console.log('success:', response.success);
    console.log('message:', response.message);
    console.log('error:', response.error);
    console.log('data:', response.data);
    console.log('==================');

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('trend');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该支持不同的时间范围', async ({ request }) => {
    const response = await getUserRegistrationTrend(request, adminToken, {
      timeRange: 'LAST_7_DAYS',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持不同的时间粒度', async ({ request }) => {
    const response = await getUserRegistrationTrend(request, adminToken, {
      timeRange: 'LAST_30_DAYS',
      granularity: 'DAY',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够获取用户活跃度', async ({ request }) => {
    const response = await getUserActivity(request, adminToken);

    console.log('=== 用户活跃度API响应 ===');
    console.log('success:', response.success);
    console.log('message:', response.message);
    console.log('error:', response.error);
    console.log('data:', response.data);
    console.log('==================');

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('distribution');
    expect(response.data).toHaveProperty('trend');
  });

  test('普通用户无法访问统计API', async ({ request }) => {
    const response = await getUserRegistrationTrend(request, testUserToken);

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
  });
});

// =============================================================================
// 测试套件：案件统计API
// =============================================================================

test.describe('统计系统 - 案件统计API', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // 登录管理员用户（使用getAdminToken，包含备用方案）
    const { token: adminUserToken } = await getAdminToken(request);
    adminToken = adminUserToken;
  });

  test('应该能够获取案件类型分布', async ({ request }) => {
    const response = await getCaseTypeDistribution(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('distribution');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该能够按状态筛选案件', async ({ request }) => {
    const response = await getCaseTypeDistribution(request, adminToken, {
      status: 'COMPLETED',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够获取案件效率统计', async ({ request }) => {
    const response = await getCaseEfficiency(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('trend');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该能够按案件类型筛选', async ({ request }) => {
    const response = await getCaseEfficiency(request, adminToken, {
      caseType: 'CIVIL',
    });

    expect(response.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：辩论统计API
// =============================================================================

test.describe('统计系统 - 辩论统计API', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // 登录管理员用户（使用getAdminToken，包含备用方案）
    const { token: adminUserToken } = await getAdminToken(request);
    adminToken = adminUserToken;
  });

  test('应该能够获取辩论生成次数', async ({ request }) => {
    const response = await getDebateGenerationCount(request, adminToken);

    console.log('=== 辩论生成次数API响应 ===');
    console.log('success:', response.success);
    console.log('message:', response.message);
    console.log('error:', response.error);
    console.log('data:', response.data);
    console.log('==================');

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('trend');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该支持按辩论状态筛选', async ({ request }) => {
    const response = await getDebateGenerationCount(request, adminToken, {
      status: 'COMPLETED',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够获取辩论质量评分', async ({ request }) => {
    const response = await getDebateQualityScore(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('trend');
    expect(response.data).toHaveProperty('distribution');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该支持置信度范围筛选', async ({ request }) => {
    const response = await getDebateQualityScore(request, adminToken, {
      minConfidence: 0.7,
      maxConfidence: 1.0,
    });

    expect(response.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：性能统计API
// =============================================================================

test.describe('统计系统 - 性能统计API', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    // 登录管理员用户（使用getAdminToken，包含备用方案）
    const { token: adminUserToken } = await getAdminToken(request);
    adminToken = adminUserToken;
  });

  test('应该能够获取响应时间统计', async ({ request }) => {
    const response = await getPerformanceResponseTime(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('trend');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该支持按服务商筛选', async ({ request }) => {
    const response = await getPerformanceResponseTime(request, adminToken, {
      provider: 'deepseek',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够获取错误率统计', async ({ request }) => {
    const response = await getPerformanceErrorRate(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
    expect(response.data).toHaveProperty('trend');
    expect(response.data).toHaveProperty('summary');
  });

  test('应该支持包含已恢复错误', async ({ request }) => {
    const response = await getPerformanceErrorRate(request, adminToken, {
      includeRecovered: true,
    });

    expect(response.success).toBe(true);
  });
});

// =============================================================================
// 测试套件：数据导出功能
// =============================================================================

test.describe('统计系统 - 数据导出功能', () => {
  let adminToken: string;
  let testUserToken: string;

  test.beforeAll(async ({ request }) => {
    // 登录管理员用户（使用getAdminToken，包含备用方案）
    const { token: adminUserToken } = await getAdminToken(request);
    adminToken = adminUserToken;
    // 注册普通测试用户
    const { token: userToken } = await registerTestUser(request);
    testUserToken = userToken;
  });

  test('应该能够导出案件数据为CSV', async ({ request }) => {
    const response = await exportCaseData(request, adminToken, {
      format: 'CSV',
      timeRange: 'LAST_30_DAYS',
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('应该能够导出案件数据为EXCEL', async ({ request }) => {
    const response = await exportCaseData(request, adminToken, {
      format: 'EXCEL',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够导出统计数据', async ({ request }) => {
    const response = await exportStatsData(request, adminToken, {
      exportType: 'USER_REGISTRATION',
      format: 'CSV',
      timeRange: 'LAST_7_DAYS',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持导出不同类型的统计数据', async ({ request }) => {
    const types = [
      'CASE_EFFICIENCY',
      'DEBATE_GENERATION',
      'PERFORMANCE_RESPONSE_TIME',
    ];
    for (const type of types) {
      const response = await exportStatsData(request, adminToken, {
        exportType: type,
        format: 'JSON',
      });
      expect(response.success).toBe(true);
    }
  });

  test('普通用户无法导出数据', async ({ request }) => {
    const response = await exportCaseData(request, testUserToken, {
      format: 'CSV',
    });

    expect(response.success).toBe(false);
  });
});

// =============================================================================
// 测试套件：报告系统
// =============================================================================

test.describe('统计系统 - 报告系统', () => {
  let adminToken: string;
  let testUserToken: string;

  test.beforeAll(async ({ request }) => {
    // 登录管理员用户（使用getAdminToken，包含备用方案）
    const { token: adminUserToken } = await getAdminToken(request);
    adminToken = adminUserToken;
    // 注册普通测试用户
    const { token: userToken } = await registerTestUser(request);
    testUserToken = userToken;
  });

  test('应该能够获取报告列表', async ({ request }) => {
    const response = await getReportsList(request, adminToken);

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('应该支持按类型筛选报告', async ({ request }) => {
    const response = await getReportsList(request, adminToken, {
      type: 'WEEKLY',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持按状态筛选报告', async ({ request }) => {
    const response = await getReportsList(request, adminToken, {
      status: 'COMPLETED',
    });

    expect(response.success).toBe(true);
  });

  test('应该支持报告列表分页', async ({ request }) => {
    const response = await getReportsList(request, adminToken, {
      page: 1,
      limit: 10,
    });

    expect(response.success).toBe(true);
  });

  test('应该能够创建周报', async ({ request }) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const response = await createReport(request, adminToken, {
      type: 'WEEKLY',
      periodStart: weekAgo.toISOString().split('T')[0],
      periodEnd: now.toISOString().split('T')[0],
      format: 'HTML',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够创建月报', async ({ request }) => {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const response = await createReport(request, adminToken, {
      type: 'MONTHLY',
      periodStart: monthAgo.toISOString().split('T')[0],
      periodEnd: now.toISOString().split('T')[0],
      format: 'HTML',
    });

    expect(response.success).toBe(true);
  });

  test('应该能够创建自定义报告', async ({ request }) => {
    const now = new Date();
    const daysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const response = await createReport(request, adminToken, {
      type: 'CUSTOM',
      periodStart: daysAgo.toISOString().split('T')[0],
      periodEnd: now.toISOString().split('T')[0],
      format: 'HTML',
    });

    expect(response.success).toBe(true);
  });

  test('普通用户无法创建报告', async ({ request }) => {
    const now = new Date();
    const daysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const response = await createReport(request, testUserToken, {
      type: 'WEEKLY',
      periodStart: daysAgo.toISOString().split('T')[0],
      periodEnd: now.toISOString().split('T')[0],
      format: 'HTML',
    });

    expect(response.success).toBe(false);
  });
});
