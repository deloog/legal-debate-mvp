/**
 * 用户注册与登录流程测试
 */

import { expect, test } from '@playwright/test';
import {
  createTestUser,
  generateTestEmail,
  generateTestPassword,
} from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

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

    const data = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('邮箱');
  });

  test('注册时应该验证密码复杂度', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: generateTestEmail(),
        password: '123', // 密码太简单
      },
    });

    const data = await response.json();
    expect(response.status()).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('密码');
  });

  test('应该拒绝重复注册的邮箱', async ({ request }) => {
    const testUser = await createTestUser(request);

    const response = await request.post(`${BASE_URL}/api/auth/register`, {
      data: {
        email: testUser.email,
        password: generateTestPassword(),
      },
    });

    const data = await response.json();
    expect(response.status()).toBe(409);
    expect(data.success).toBe(false);
    expect(data.error).toBe('USER_EXISTS');
  });

  test('应该成功登录已注册用户', async ({ request }) => {
    const testUser = await createTestUser(request);
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });

    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data?.token).toBeTruthy();
    expect(data.data?.token.length).toBeGreaterThan(50);
  });

  test('应该拒绝错误的密码', async ({ request }) => {
    const testUser = await createTestUser(request);
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: testUser.email,
        password: 'WrongPassword123',
      },
    });

    const data = await response.json();
    expect(response.status()).toBe(401);
    expect(data.success).toBe(false);
  });

  test('应该获取当前用户信息', async ({ request }) => {
    const testUser = await createTestUser(request);
    const response = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { email: testUser.email, password: testUser.password },
    });
    const loginData = await response.json();
    const token = loginData.data?.token || '';

    const meResponse = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const meData = await meResponse.json();
    expect(meResponse.ok()).toBeTruthy();
    expect(meData.success).toBe(true);
    expect(meData.data?.user.email).toBe(testUser.email);
    expect(meData.data?.user.id).toBe(testUser.id);
  });

  test('未认证用户应该无法获取当前用户信息', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/me`);
    expect(response.status()).toBe(401);
  });
});
