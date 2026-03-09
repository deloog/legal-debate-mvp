/**
 * 客户管理 E2E 测试
 *
 * 注意：全文件共享一个测试用户，避免多次注册触发限流（5次/分钟）。
 */

import { expect, test } from '@playwright/test';
import { createTestUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 文件级共享用户（只注册一次） ───────────────────────────────────────────────
let sharedToken = '';

test.beforeAll(async ({ request }) => {
  const user = await createTestUser(request);
  sharedToken = user.token ?? '';
});

// ── 测试套件：客户 CRUD ───────────────────────────────────────────────────────

test.describe('客户管理 CRUD', () => {
  let createdClientId = '';
  const ts = Date.now();

  test('应该成功创建个人客户', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      data: {
        clientType: 'INDIVIDUAL',
        name: `测试客户_${ts}`,
        phone: '13800138001',
        email: `client_${ts}@test.com`,
        gender: '男',
        age: 35,
        profession: '工程师',
        tags: ['重要客户'],
        notes: 'E2E测试创建',
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe(`测试客户_${ts}`);
    createdClientId = data.data?.id ?? '';
    expect(createdClientId).toBeTruthy();
  });

  test('应该成功创建企业客户', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      data: {
        clientType: 'ENTERPRISE',
        name: `测试企业_${ts}`,
        phone: '02088888888',
        company: `科技有限公司_${ts}`,
        tags: ['企业客户'],
      },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.clientType).toBe('ENTERPRISE');
  });

  test('应该返回客户列表', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      params: { page: '1', limit: '10' },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    const clients = data.data?.clients ?? data.data?.items ?? [];
    expect(Array.isArray(clients)).toBe(true);
  });

  test('搜索应能找到刚创建的客户', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      params: { search: `测试客户_${ts}`, limit: '5' },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    const clients = data.data?.clients ?? data.data?.items ?? [];
    const found = clients.find(
      (c: { name: string }) => c.name === `测试客户_${ts}`
    );
    expect(found).toBeDefined();
  });

  test('应该返回客户详情', async ({ request }) => {
    if (!createdClientId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/clients/${createdClientId}`,
      { headers: { Authorization: `Bearer ${sharedToken}` } }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe(createdClientId);
  });

  test('应该成功更新客户信息', async ({ request }) => {
    if (!createdClientId) test.skip();

    const response = await request.patch(
      `${BASE_URL}/api/clients/${createdClientId}`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { notes: '已更新的备注', age: 36 },
      }
    );

    expect([200, 204]).toContain(response.status());
  });

  test('不存在的客户 ID 应返回 404', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/clients/non-existent-client-id`,
      { headers: { Authorization: `Bearer ${sharedToken}` } }
    );
    expect([404, 400]).toContain(response.status());
  });

  test('应该成功删除客户', async ({ request }) => {
    if (!createdClientId) test.skip();

    const response = await request.delete(
      `${BASE_URL}/api/clients/${createdClientId}`,
      { headers: { Authorization: `Bearer ${sharedToken}` } }
    );

    expect([200, 204]).toContain(response.status());

    const checkRes = await request.get(
      `${BASE_URL}/api/clients/${createdClientId}`,
      { headers: { Authorization: `Bearer ${sharedToken}` } }
    );
    expect([404, 400]).toContain(checkRes.status());
  });
});

// ── 测试套件：字段验证 ────────────────────────────────────────────────────────

test.describe('客户字段验证', () => {
  test('缺少 name 字段应返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      data: { clientType: 'INDIVIDUAL' },
    });
    expect(response.status()).toBe(400);
  });

  test('无效的 clientType 应返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      data: { clientType: 'INVALID_TYPE', name: '测试' },
    });
    expect(response.status()).toBe(400);
  });

  test('未授权时应拒绝所有操作', async ({ request }) => {
    const [listRes, createRes] = await Promise.all([
      request.get(`${BASE_URL}/api/v1/clients`),
      request.post(`${BASE_URL}/api/v1/clients`, {
        data: { clientType: 'INDIVIDUAL', name: '测试' },
      }),
    ]);

    expect([401, 403]).toContain(listRes.status());
    expect([401, 403]).toContain(createRes.status());
  });
});
