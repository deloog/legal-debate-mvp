/**
 * 客户管理 E2E 测试
 *
 * 覆盖场景：
 * 1. 创建客户（个人/企业）
 * 2. 查询客户列表（分页/搜索）
 * 3. 查询客户详情
 * 4. 更新客户信息
 * 5. 删除客户
 * 6. 权限控制（未登录拒绝访问）
 * 7. 字段验证（必填项/格式）
 */

import { expect, test } from '@playwright/test';
import { createTestUser, loginUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface Client {
  id: string;
  name: string;
  clientType: string;
  phone?: string;
  email?: string;
  createdAt?: string;
}

interface ClientResponse {
  success: boolean;
  data?: Client;
  message?: string;
  error?: { code: string; message: string };
}

interface ClientListResponse {
  success: boolean;
  data?: {
    clients?: Client[];
    items?: Client[];
    total?: number;
    pagination?: { page: number; limit: number; total: number };
  };
  error?: { code: string; message: string };
}

// ── 测试套件：客户 CRUD ───────────────────────────────────────────────────────

test.describe('客户管理 CRUD', () => {
  let token: string;
  let createdClientId: string;
  const ts = Date.now();

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('应该成功创建个人客户', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
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
    const data: ClientResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.name).toBe(`测试客户_${ts}`);
    expect(data.data?.clientType).toBe('INDIVIDUAL');
    createdClientId = data.data?.id ?? '';
    expect(createdClientId).toBeTruthy();
  });

  test('应该成功创建企业客户', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        clientType: 'ENTERPRISE',
        name: `测试企业_${ts}`,
        phone: '02088888888',
        company: `科技有限公司_${ts}`,
        tags: ['企业客户'],
      },
    });

    expect(response.status()).toBe(201);
    const data: ClientResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.clientType).toBe('ENTERPRISE');
  });

  test('应该返回客户列表', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: '1', limit: '10' },
    });

    expect(response.status()).toBe(200);
    const data: ClientListResponse = await response.json();
    expect(data.success).toBe(true);
    const clients = data.data?.clients ?? data.data?.items ?? [];
    expect(Array.isArray(clients)).toBe(true);
  });

  test('搜索应能找到刚创建的客户', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { search: `测试客户_${ts}`, limit: '5' },
    });

    expect(response.status()).toBe(200);
    const data: ClientListResponse = await response.json();
    const clients = data.data?.clients ?? data.data?.items ?? [];
    const found = clients.find(c => c.name === `测试客户_${ts}`);
    expect(found).toBeDefined();
  });

  test('应该返回客户详情', async ({ request }) => {
    if (!createdClientId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/v1/clients/${createdClientId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect(response.status()).toBe(200);
    const data: ClientResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe(createdClientId);
    expect(data.data?.name).toBe(`测试客户_${ts}`);
  });

  test('应该成功更新客户信息', async ({ request }) => {
    if (!createdClientId) test.skip();

    const response = await request.put(
      `${BASE_URL}/api/v1/clients/${createdClientId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          notes: '已更新的备注',
          age: 36,
        },
      }
    );

    expect(response.status()).toBe(200);
    const data: ClientResponse = await response.json();
    expect(data.success).toBe(true);
  });

  test('不存在的客户 ID 应返回 404', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/clients/non-existent-client-id`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect([404, 400]).toContain(response.status());
  });

  test('应该成功删除客户', async ({ request }) => {
    if (!createdClientId) test.skip();

    const response = await request.delete(
      `${BASE_URL}/api/v1/clients/${createdClientId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect([200, 204]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.success).toBe(true);
    }

    // 验证已删除
    const checkRes = await request.get(
      `${BASE_URL}/api/v1/clients/${createdClientId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect([404, 400]).toContain(checkRes.status());
  });
});

// ── 测试套件：字段验证 ────────────────────────────────────────────────────────

test.describe('客户字段验证', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('缺少 name 字段应返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { clientType: 'INDIVIDUAL' },
    });
    expect(response.status()).toBe(400);
  });

  test('无效的 clientType 应返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/clients`, {
      headers: { Authorization: `Bearer ${token}` },
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
