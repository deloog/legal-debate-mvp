/**
 * 咨询管理 E2E 测试
 *
 * 覆盖场景：
 * 1. 创建咨询记录
 * 2. 查询咨询列表（分页/过滤）
 * 3. 查询咨询详情
 * 4. 更新咨询记录
 * 5. 咨询转化（跟进/转案件）
 * 6. 字段验证
 * 7. 权限控制
 */

import { expect, test } from '@playwright/test';
import { createTestUser, loginUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

interface Consultation {
  id: string;
  consultType: string;
  consultTime: string;
  clientName: string;
  caseSummary: string;
  status?: string;
  createdAt?: string;
}

interface ConsultationResponse {
  success: boolean;
  data?: Consultation;
  message?: string;
  error?: { code: string; message: string };
}

interface ConsultationListResponse {
  success: boolean;
  data?: {
    consultations?: Consultation[];
    items?: Consultation[];
    total?: number;
    pagination?: { page: number; limit: number; total: number };
    statistics?: {
      totalConsultations: number;
    };
  };
  error?: { code: string; message: string };
}

// ── 测试套件：咨询 CRUD ───────────────────────────────────────────────────────

test.describe('咨询记录 CRUD', () => {
  let token: string;
  let createdConsultationId: string;
  const ts = Date.now();

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('应该成功创建咨询记录', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        consultType: 'PHONE',
        consultTime: new Date().toISOString(),
        clientName: `测试当事人_${ts}`,
        clientPhone: '13900139001',
        caseType: '劳动纠纷',
        caseSummary: `E2E测试案情摘要_${ts}，涉及劳动合同纠纷，当事人请求确认劳动关系。`,
        clientDemand: '确认劳动关系，追讨欠薪',
      },
    });

    expect(response.status()).toBe(201);
    const data: ConsultationResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.clientName).toBe(`测试当事人_${ts}`);
    expect(data.data?.consultType).toBe('PHONE');
    createdConsultationId = data.data?.id ?? '';
    expect(createdConsultationId).toBeTruthy();
  });

  test('应该返回咨询列表', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { page: '1', limit: '10' },
    });

    expect(response.status()).toBe(200);
    const data: ConsultationListResponse = await response.json();
    expect(data.success).toBe(true);
    const items = data.data?.consultations ?? data.data?.items ?? [];
    expect(Array.isArray(items)).toBe(true);
  });

  test('按咨询类型过滤应该生效', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { consultType: 'PHONE', limit: '10' },
    });

    expect(response.status()).toBe(200);
    const data: ConsultationListResponse = await response.json();
    const items = data.data?.consultations ?? data.data?.items ?? [];
    items.forEach(c => expect(c.consultType).toBe('PHONE'));
  });

  test('应该返回咨询详情', async ({ request }) => {
    if (!createdConsultationId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/v1/consultations/${createdConsultationId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect(response.status()).toBe(200);
    const data: ConsultationResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.id).toBe(createdConsultationId);
    expect(data.data?.caseSummary).toContain(`E2E测试案情摘要_${ts}`);
  });

  test('应该成功更新咨询记录', async ({ request }) => {
    if (!createdConsultationId) test.skip();

    const response = await request.put(
      `${BASE_URL}/api/v1/consultations/${createdConsultationId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          followUpNotes: '已初步评估，准备进一步跟进',
          followUpDate: new Date(
            Date.now() + 7 * 24 * 3600 * 1000
          ).toISOString(),
        },
      }
    );

    expect([200, 204]).toContain(response.status());
    if (response.status() === 200) {
      const data: ConsultationResponse = await response.json();
      expect(data.success).toBe(true);
    }
  });

  test('不存在的咨询 ID 应返回 404', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/consultations/non-existent-consult-id`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect([404, 400]).toContain(response.status());
  });
});

// ── 测试套件：字段验证 ────────────────────────────────────────────────────────

test.describe('咨询字段验证', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('缺少 caseSummary 应返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        consultType: 'PHONE',
        consultTime: new Date().toISOString(),
        clientName: '测试',
        // 缺少 caseSummary
      },
    });
    expect(response.status()).toBe(400);
  });

  test('无效的 consultType 应返回 400', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/consultations`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        consultType: 'INVALID',
        consultTime: new Date().toISOString(),
        clientName: '测试',
        caseSummary: '测试案情',
      },
    });
    expect(response.status()).toBe(400);
  });

  test('未授权时应拒绝访问', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/consultations`);
    expect([401, 403]).toContain(response.status());
  });
});
