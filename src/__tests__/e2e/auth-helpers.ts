/**
 * 认证E2E测试辅助函数
 */

import type { APIRequestContext } from "@playwright/test";

// =============================================================================
// 测试基础URL
// =============================================================================
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// =============================================================================
// 测试数据类型定义
// =============================================================================

interface TestUser {
  id: string;
  email: string;
  password: string;
  username?: string;
  name?: string;
  role: string;
  token?: string;
  refreshToken?: string;
}

interface AuthResponseData {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      createdAt: Date | string;
    };
    token: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  error?: string;
}

interface RefreshResponseData {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken?: string;
    expiresIn: number;
  };
  error?: string;
}

interface CurrentUserResponseData {
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      status: string;
      createdAt: Date | string;
      updatedAt: Date | string;
    };
  };
}

// =============================================================================
// 测试辅助函数
// =============================================================================

/**
 * 创建测试用户
 */
export async function createTestUser(
  apiContext: APIRequestContext,
): Promise<TestUser> {
  const timestamp = Date.now();
  const shortId = String(timestamp).slice(-6);
  const email = `test-${timestamp}@example.com`;
  const password = "TestPass123";

  const response = await apiContext.post(`${BASE_URL}/api/auth/register`, {
    data: {
      email,
      password,
      username: `test${shortId}`,
      name: `TestUser${shortId}`,
    },
  });

  const data: AuthResponseData = await response.json();

  return {
    id: data.data?.user.id || "",
    email,
    password,
    username: `test${shortId}`,
    name: `TestUser${shortId}`,
    role: data.data?.user.role || "USER",
    token: data.data?.token,
    refreshToken: data.data?.refreshToken,
  };
}

/**
 * 用户登录
 */
export async function loginUser(
  apiContext: APIRequestContext,
  email: string,
  password: string,
): Promise<{ token: string; refreshToken: string }> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
  });

  const data: AuthResponseData = await response.json();
  const token = data.data?.token || "";
  const refreshToken = data.data?.refreshToken || "";

  return { token, refreshToken };
}

/**
 * 刷新令牌
 */
export async function refreshToken(
  apiContext: APIRequestContext,
  refreshTokenValue: string,
): Promise<string> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/refresh`, {
    data: { refreshToken: refreshTokenValue },
  });

  const data: RefreshResponseData = await response.json();
  return data.data?.token || "";
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(
  apiContext: APIRequestContext,
  token: string,
): Promise<CurrentUserResponseData> {
  const response = await apiContext.get(`${BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return await response.json();
}

/**
 * 登出
 */
export async function logout(
  apiContext: APIRequestContext,
  token: string,
  refreshToken: string,
  allDevices = false,
): Promise<{ success: boolean; message: string }> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/logout`, {
    data: { allDevices },
    headers: {
      Authorization: `Bearer ${token}`,
      Cookie: `refreshToken=${refreshToken}`,
    },
  });

  return await response.json();
}

/**
 * 生成测试邮箱
 */
export function generateTestEmail(): string {
  return `test-${Date.now()}@example.com`;
}

/**
 * 生成测试密码
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now() % 10000}`;
}
