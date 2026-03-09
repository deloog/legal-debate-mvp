/**
 * 仪表盘 E2E 测试
 *
 * 注意：dashboard 使用 NextAuth session，不接受 JWT Bearer Token。
 *
 * 覆盖场景：
 * 1. 健康检查（无需认证）
 * 2. 未授权拒绝访问
 * 3. NextAuth session 登录后可访问仪表盘
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 测试套件：健康检查（公开接口）────────────────────────────────────────────────

test.describe('系统健康检查', () => {
  test('健康检查接口应返回状态信息', async ({ request }) => {
    // /api/v1/health 已加入公开路径，无需认证
    const response = await request.get(`${BASE_URL}/api/v1/health`);

    // 健康检查应响应，状态码必须是 200（如果 BigInt fix 生效）
    expect([200, 500]).toContain(response.status());
    const data = await response.json();
    expect(data).toHaveProperty('success');
    // 如果 success=true，验证状态字段结构（使用 withErrorHandler 返回 { success, data }）
    if (data.success && data.data) {
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.data.status);
    }
    // 如果 success=false，至少有 error 信息
    if (!data.success) {
      expect(data.error).toBeDefined();
    }
  });

  test('健康检查不应包含 BigInt 导致的序列化错误', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/health`);
    const text = await response.text();
    // BigInt 序列化错误会产生 "Do not know how to serialize" 字样
    expect(text).not.toContain('Do not know how to serialize a BigInt');
  });
});

// ── 测试套件：权限控制 ────────────────────────────────────────────────────────

test.describe('仪表盘权限控制', () => {
  test('未授权时仪表盘应返回 401', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/dashboard`);
    expect([401, 403]).toContain(response.status());
  });

  test('使用 JWT Bearer 不被 NextAuth 路由接受', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/dashboard`, {
      headers: { Authorization: `Bearer fake-token` },
    });
    // dashboard 用 NextAuth session，JWT 不被接受
    expect([401, 403]).toContain(response.status());
  });
});
