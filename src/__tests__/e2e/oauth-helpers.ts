/**
 * OAuth测试辅助函数
 */

import type { APIRequestContext } from '@playwright/test';

// =============================================================================
// 测试基础URL
// =============================================================================

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// =============================================================================
// 测试数据类型定义
// =============================================================================

interface OAuthAuthorizeResponse {
  authorizeUrl: string;
  state: string;
}

interface OAuthCallbackResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    createdAt: Date | string;
  };
  token?: string;
  isNewUser?: boolean;
  error?: string;
}

interface BindAccountResponse {
  success: boolean;
  account?: {
    id: string;
    provider: string;
    providerAccountId: string;
    userId: string;
  };
  error?: string;
}

interface UnbindAccountResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface GetAccountsResponse {
  success: boolean;
  accounts: Array<{
    id: string;
    provider: string;
    providerAccountId: string;
  }>;
}

// =============================================================================
// OAuth 测试辅助函数
// =============================================================================

/**
 * 生成Mock OAuth授权码
 * 用于模拟OAuth提供商返回的授权码
 */
export function generateMockAuthCode(): string {
  return `mock_auth_code_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 生成Mock OAuth用户信息
 */
export function generateMockUserInfo(provider: 'wechat' | 'qq'): {
  id: string;
  nickname: string;
  avatar: string;
  email?: string;
  gender?: 'male' | 'female' | 'unknown';
} {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 10);

  if (provider === 'wechat') {
    return {
      id: `wx_openid_${timestamp}`,
      nickname: `微信用户${randomId}`,
      avatar: `https://thirdwx.qlogo.cn/avatar_${randomId}`,
      email: undefined,
      gender: 'unknown',
    };
  }

  return {
    id: `qq_openid_${timestamp}`,
    nickname: `QQ用户${randomId}`,
    avatar: `https://q1.qlogo.cn/avatar_${randomId}`,
    email: undefined,
    gender: 'unknown',
  };
}

/**
 * 请求OAuth授权URL（微信）
 */
export async function requestWechatAuthorize(
  apiContext: APIRequestContext,
  redirectUri: string = 'http://localhost:3000/callback'
): Promise<OAuthAuthorizeResponse> {
  const response = await apiContext.get(
    `${BASE_URL}/api/auth/oauth/wechat?redirect_uri=${encodeURIComponent(redirectUri)}`
  );

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Failed to request WeChat authorize: ${error}`);
  }

  return response.json() as Promise<OAuthAuthorizeResponse>;
}

/**
 * 请求OAuth授权URL（QQ）
 */
export async function requestQqAuthorize(
  apiContext: APIRequestContext,
  redirectUri: string = 'http://localhost:3000/callback'
): Promise<OAuthAuthorizeResponse> {
  const response = await apiContext.get(
    `${BASE_URL}/api/auth/oauth/qq?redirect_uri=${encodeURIComponent(redirectUri)}`
  );

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Failed to request QQ authorize: ${error}`);
  }

  return response.json() as Promise<OAuthAuthorizeResponse>;
}

/**
 * 处理OAuth回调（微信）
 * 注意：真实环境需要实际的授权码和state
 */
export async function handleWechatCallback(
  apiContext: APIRequestContext,
  code: string,
  state: string
): Promise<OAuthCallbackResponse> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/oauth/wechat`, {
    data: { code, state },
  });

  // 测试环境中，API会返回400（参数验证失败）
  if (response.status() >= 400) {
    return {
      success: false,
      error: `OAuth callback failed with status ${response.status()}`,
    };
  }

  const data = (await response.json()) as OAuthCallbackResponse;
  return data;
}

/**
 * 处理OAuth回调（QQ）
 * 注意：真实环境需要实际的授权码和state
 */
export async function handleQqCallback(
  apiContext: APIRequestContext,
  code: string,
  state: string
): Promise<OAuthCallbackResponse> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/oauth/qq`, {
    data: { code, state },
  });

  // 测试环境中，API会返回400（参数验证失败）
  if (response.status() >= 400) {
    return {
      success: false,
      error: `OAuth callback failed with status ${response.status()}`,
    };
  }

  const data = (await response.json()) as OAuthCallbackResponse;
  return data;
}

/**
 * 绑定OAuth账号
 */
export async function bindOAuthAccount(
  apiContext: APIRequestContext,
  token: string,
  provider: string,
  providerAccountId: string,
  userInfo: {
    id: string;
    nickname: string;
    avatar: string;
  }
): Promise<BindAccountResponse> {
  const response = await apiContext.post(`${BASE_URL}/api/auth/oauth/bind`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: {
      provider,
      providerAccountId,
      userInfo,
    },
  });

  if (!response.ok()) {
    const data = (await response.json()) as BindAccountResponse;
    return {
      success: false,
      error: data.error || 'Failed to bind account',
    };
  }

  return response.json() as Promise<BindAccountResponse>;
}

/**
 * 解绑OAuth账号
 */
export async function unbindOAuthAccount(
  apiContext: APIRequestContext,
  token: string,
  provider: string
): Promise<UnbindAccountResponse> {
  const response = await apiContext.delete(
    `${BASE_URL}/api/auth/oauth/unbind/${provider}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok()) {
    const data = (await response.json()) as UnbindAccountResponse;
    return {
      success: false,
      error: data.error || 'Failed to unbind account',
    };
  }

  return response.json() as Promise<UnbindAccountResponse>;
}

/**
 * 获取用户的OAuth账号列表
 */
export async function getUserOAuthAccounts(
  apiContext: APIRequestContext,
  token: string
): Promise<GetAccountsResponse> {
  const response = await apiContext.get(`${BASE_URL}/api/auth/oauth/bind`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok()) {
    return {
      success: false,
      accounts: [],
    };
  }

  return response.json() as Promise<GetAccountsResponse>;
}

/**
 * 验证OAuth授权URL格式
 */
export function validateAuthorizeUrl(
  authorizeUrl: string,
  provider: 'wechat' | 'qq'
): boolean {
  if (!authorizeUrl) {
    return false;
  }

  const wechatPattern = /open\.weixin\.qq\.com\/connect\/oauth2\/authorize/;
  const qqPattern = /graph\.qq\.com\/oauth2\.0\/authorize/;

  if (provider === 'wechat') {
    return wechatPattern.test(authorizeUrl);
  }

  return qqPattern.test(authorizeUrl);
}

/**
 * 验证State格式
 * State应该是时间戳_随机字符串的格式
 */
export function validateState(state: string): boolean {
  const pattern = /^\d+_[a-z0-9]+$/i;
  return pattern.test(state);
}

// =============================================================================
// 测试工具函数
// =============================================================================

/**
 * 等待指定毫秒数
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成随机用户ID
 */
export function generateRandomUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
