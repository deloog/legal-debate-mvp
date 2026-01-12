/**
 * Refresh Token 诊断测试
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test('诊断：refresh token流程', async ({ request }) => {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);
  const email = `refresh-debug-${timestamp}@example.com`;
  const password = 'TestPass123';

  // 1. 注册用户
  console.log('[DEBUG] 步骤1：注册用户');
  const registerResponse = await request.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `debug${shortId}`,
      name: `DebugUser${shortId}`,
    },
  });

  const registerData = await registerResponse.json();
  console.log('[DEBUG] 注册响应:', {
    status: registerResponse.status(),
    success: registerData.success,
    hasRefreshToken: !!registerData.data?.refreshToken,
    refreshTokenLength: registerData.data?.refreshToken?.length,
  });

  expect(registerResponse.ok()).toBe(true);
  expect(registerData.success).toBe(true);
  const registerRefreshToken = registerData.data?.refreshToken || '';

  // 2. 登录用户
  console.log('[DEBUG] 步骤2：登录用户');
  const loginResponse = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const loginData = await loginResponse.json();
  console.log('[DEBUG] 登录响应:', {
    status: loginResponse.status(),
    success: loginData.success,
    hasRefreshToken: !!loginData.data?.refreshToken,
    refreshTokenLength: loginData.data?.refreshToken?.length,
  });

  expect(loginResponse.ok()).toBe(true);
  expect(loginData.success).toBe(true);
  const loginRefreshToken = loginData.data?.refreshToken || '';

  console.log('[DEBUG] RefreshToken对比:', {
    sameToken: registerRefreshToken === loginRefreshToken,
    registerToken: registerRefreshToken.substring(0, 50) + '...',
    loginToken: loginRefreshToken.substring(0, 50) + '...',
  });

  // 3. 尝试使用login的refreshToken刷新
  console.log('[DEBUG] 步骤3：刷新令牌');
  const refreshResponse = await request.post(`${BASE_URL}/api/auth/refresh`, {
    data: { refreshToken: loginRefreshToken },
  });

  console.log('[DEBUG] 刷新响应:', {
    status: refreshResponse.status(),
    ok: refreshResponse.ok(),
  });

  const refreshBody = await refreshResponse.json();
  console.log('[DEBUG] 刷新响应数据:', refreshBody);

  expect(refreshResponse.ok()).toBe(true);
  expect(refreshBody.success).toBe(true);
});
