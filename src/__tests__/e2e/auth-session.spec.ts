/**
 * 用户会话管理测试
 */

import { expect, test } from '@playwright/test';
import { createTestUser, loginUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('用户会话管理', () => {
  test('应该成功刷新访问令牌', async ({ request }) => {
    const testUser = await createTestUser(request);
    // register 和 login 均已正确写入 session 记录，直接用 login 返回的 refreshToken
    const { token, refreshToken: refreshTokenValue } = await loginUser(
      request,
      testUser.email,
      testUser.password
    );
    void token; // 注册时已验证 token 可用，此处仅用 refreshToken

    const refreshResponse = await request.post(`${BASE_URL}/api/auth/refresh`, {
      data: { refreshToken: refreshTokenValue },
    });

    const refreshData = await refreshResponse.json();
    console.log('[TEST] Refresh API response:', {
      status: refreshResponse.status(),
      success: refreshData.success,
      message: refreshData.message,
      error: refreshData.error,
      hasToken: !!refreshData.data?.token,
      hasRefreshToken: !!refreshData.data?.refreshToken,
      expiresIn: refreshData.data?.expiresIn,
    });
    expect(refreshData.success).toBe(true);
    expect(refreshData.data?.token).toBeTruthy();
    expect(refreshData.data?.expiresIn).toBe(15 * 60);
  });

  test('应该支持登出当前设备', async ({ request }) => {
    const testUser = await createTestUser(request);
    const token = testUser.token || '';
    const refreshTokenValue = testUser.refreshToken || '';
    console.log('[TEST] Got tokens for logout current:', {
      hasRefreshToken: !!refreshTokenValue,
      refreshTokenLength: refreshTokenValue.length,
    });

    // 登出当前设备
    const logoutResponse = await request.post(`${BASE_URL}/api/auth/logout`, {
      data: { allDevices: false },
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `refreshToken=${refreshTokenValue}`,
      },
    });

    const logoutData = await logoutResponse.json();
    console.log('[TEST] Logout API response:', {
      status: logoutResponse.status(),
      success: logoutData.success,
      message: logoutData.message,
      error: logoutData.error,
    });
    expect(logoutResponse.ok()).toBeTruthy();
    expect(logoutData.success).toBe(true);
    expect(logoutData.message).toContain('登出');

    // 注意：登出后，access token在过期前仍然有效（JWT是无状态的）
    // 只有refresh token被删除，无法使用refresh token刷新
    const refreshResponse = await request.post(`${BASE_URL}/api/auth/refresh`, {
      data: { refreshToken: refreshTokenValue },
    });
    expect(refreshResponse.status()).toBe(401);
  });

  test('应该支持登出所有设备', async ({ request }) => {
    const testUser = await createTestUser(request);
    const token = testUser.token || '';
    const refreshTokenValue = testUser.refreshToken || '';
    console.log('[TEST] Got tokens for logout all:', {
      hasRefreshToken: !!refreshTokenValue,
      refreshTokenLength: refreshTokenValue.length,
    });

    // 登出所有设备
    const logoutResponse = await request.post(`${BASE_URL}/api/auth/logout`, {
      data: { allDevices: true },
      headers: {
        Authorization: `Bearer ${token}`,
        Cookie: `refreshToken=${refreshTokenValue}`,
      },
    });

    const logoutData = await logoutResponse.json();
    console.log('[TEST] Logout all devices API response:', {
      status: logoutResponse.status(),
      success: logoutData.success,
      message: logoutData.message,
      error: logoutData.error,
    });
    expect(logoutResponse.ok()).toBeTruthy();
    expect(logoutData.success).toBe(true);
    expect(logoutData.message).toContain('所有设备');
  });

  test('过期的令牌应该被拒绝', async ({ request }) => {
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJleGFtcGxlIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.invalid';

    const response = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    const data = await response.json();
    expect(response.status()).toBe(401);
    expect(data.success).toBe(false);
  });
});
