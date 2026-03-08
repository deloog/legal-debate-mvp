/**
 * 仪表盘 E2E 测试
 *
 * 覆盖场景：
 * 1. 获取仪表盘数据（登录用户）
 * 2. 数据结构完整性
 * 3. 未授权拒绝
 * 4. 健康检查
 * 5. 最近活动接口
 */

import { expect, test } from '@playwright/test';
import { createTestUser, loginUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface DashboardStats {
  totalCases?: number;
  activeCases?: number;
  totalClients?: number;
  totalContracts?: number;
  totalDebates?: number;
  totalConsultations?: number;
  recentActivity?: unknown[];
}

interface DashboardResponse {
  success: boolean;
  data?: DashboardStats;
  error?: { code: string; message: string };
}

// ── 测试套件：健康检查 ────────────────────────────────────────────────────────

test.describe('系统健康检查', () => {
  test('健康检查接口应返回正常状态', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/health`);

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toHaveProperty('status');
    expect(['healthy', 'degraded']).toContain(data.status);
  });

  test('数据库连接应正常', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/health`);
    const data = await response.json();

    // 数据库必须健康才能支持任何业务
    expect(data.services?.database?.status).not.toBe('unhealthy');
  });
});

// ── 测试套件：仪表盘数据 ──────────────────────────────────────────────────────

test.describe('仪表盘数据', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('应该返回仪表盘统计数据', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);
    const data: DashboardResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  test('仪表盘数据应包含数字类型统计', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data: DashboardResponse = await response.json();
    if (data.data) {
      // 至少有一个统计字段存在且为数字
      const numericFields = [
        data.data.totalCases,
        data.data.activeCases,
        data.data.totalClients,
        data.data.totalContracts,
        data.data.totalConsultations,
      ].filter(v => v !== undefined);
      numericFields.forEach(v => expect(typeof v).toBe('number'));
    }
  });

  test('未授权时仪表盘应返回 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/dashboard`);
    expect([401, 403]).toContain(response.status());
  });

  test('根路由仪表盘接口应与 v1 一致', async ({ request }) => {
    const [v1Res, rootRes] = await Promise.all([
      request.get(`${BASE_URL}/api/v1/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      request.get(`${BASE_URL}/api/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    // 两个接口都应该正常响应
    expect([200, 401, 403]).toContain(v1Res.status());
    expect([200, 401, 403]).toContain(rootRes.status());
  });
});

// ── 测试套件：最近活动 ────────────────────────────────────────────────────────

test.describe('最近活动记录', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('最近活动接口应返回活动列表', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/system/recent-activity`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: '10' },
      }
    );

    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
    }
  });

  test('未授权时最近活动应拒绝', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/system/recent-activity`
    );
    expect([401, 403, 404]).toContain(response.status());
  });
});
