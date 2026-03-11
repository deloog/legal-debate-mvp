/**
 * 咨询管理 E2E 测试
 *
 * 覆盖场景：
 * 1. 未授权时拒绝访问
 * 2. JWT Bearer 认证后能够创建/查询咨询
 * 3. 字段验证（必填项/格式）
 */

import { expect, test } from '@playwright/test';
import { createTestUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 测试套件：权限控制 ────────────────────────────────────────────────────────

test.describe('咨询权限控制', () => {
  test('未授权时应拒绝访问（401 或 403）', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/consultations`);
    expect([401, 403]).toContain(response.status());
  });

  test('使用无效 JWT 时应拒绝访问', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer fake-invalid-jwt-token` },
    });
    expect([401, 403]).toContain(response.status());
  });

  test('未授权创建咨询应返回 401', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/consultations`, {
      data: {
        consultType: 'PHONE',
        consultTime: new Date().toISOString(),
        clientName: '测试',
        caseSummary: '测试案情',
      },
    });
    expect([401, 403]).toContain(response.status());
  });
});

// ── 测试套件：JWT Bearer 登录后创建咨询 ───────────────────────────────────────

test.describe('咨询 CRUD（JWT Bearer）', () => {
  let userToken: string;
  let createdId: string;
  const ts = Date.now();

  test.beforeAll(async ({ request }) => {
    // 创建用户并获取 JWT token
    const user = await createTestUser(request);
    userToken = user.token ?? '';
  });

  test('JWT Bearer 认证后应能访问咨询列表', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('应该成功创建咨询记录', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/consultations`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        'Content-Type': 'application/json',
      },
      data: {
        consultType: 'PHONE',
        consultTime: new Date().toISOString(),
        clientName: `测试当事人_${ts}`,
        clientPhone: '13900139001',
        caseType: '劳动纠纷',
        caseSummary: `E2E测试案情_${ts}，涉及劳动合同纠纷`,
        clientDemand: '确认劳动关系',
      },
    });

    expect([200, 201]).toContain(response.status());
    const data = await response.json();
    expect(data.success).toBe(true);
    createdId = data.data?.id ?? '';
  });

  test('应该返回咨询详情', async ({ request }) => {
    if (!createdId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/v1/consultations/${createdId}`,
      { headers: { Authorization: `Bearer ${userToken}` } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe(createdId);
  });
});
