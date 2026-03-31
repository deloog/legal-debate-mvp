/**
 * OAuth 基础类 - 抽象基类
 */

import type {
  OAuthAuthorizeRequest,
  OAuthAuthorizeResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  OAuthError,
  OAuthState,
  OAuthTokenResponse,
  OAuthUserInfo,
  StateValidationResult,
} from '../../types/oauth';
import { SECURITY } from '../constants/common';
import { logger } from '@/lib/logger';

/**
 * 服务端 OAuth State 内存存储（单实例部署）
 * 多实例部署时应替换为 Redis 实现
 */
const _serverStateStore = new Map<
  string,
  { data: OAuthState; expiresAt: number }
>();
// 定期清理过期 state，避免内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _serverStateStore.entries()) {
    if (entry.expiresAt < now) _serverStateStore.delete(key);
  }
}, 60_000);

/**
 * OAuth 基础类
 */
export abstract class OAuthBaseProvider {
  protected config: {
    appId: string;
    appSecret: string;
    redirectUri: string;
    scope: string;
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
  };

  // State 存储键前缀
  private readonly STATE_PREFIX = 'oauth_state_';
  private readonly STATE_EXPIRY = SECURITY.OAUTH_STATE_EXPIRY;

  constructor(config: {
    appId: string;
    appSecret: string;
    redirectUri: string;
    scope: string;
    authorizeUrl: string;
    tokenUrl: string;
    userInfoUrl: string;
  }) {
    this.config = config;
  }

  /**
   * 生成授权URL
   */
  abstract buildAuthorizeUrl(state: string, redirectUri?: string): string;

  /**
   * 交换访问令牌
   */
  abstract exchangeToken(code: string): Promise<OAuthTokenResponse>;

  /**
   * 获取用户信息
   */
  abstract getUserInfo(
    accessToken: string,
    openid?: string
  ): Promise<OAuthUserInfo>;

  /**
   * 初始化授权流程
   */
  async authorize(
    request: OAuthAuthorizeRequest
  ): Promise<OAuthAuthorizeResponse> {
    try {
      const stateData: OAuthState = {
        state: request.state,
        provider: this.getProviderName() as never, // 类型断言，子类会实现正确的枚举值
        redirectUri: request.redirectUri || this.config.redirectUri,
        timestamp: Date.now(),
      };

      // 存储 state
      this.saveState(stateData);

      // 生成授权URL
      const authorizeUrl = this.buildAuthorizeUrl(
        stateData.state,
        stateData.redirectUri
      );

      return {
        success: true,
        authorizeUrl,
        state: stateData.state,
      };
    } catch (error) {
      logger.error('OAuth authorize error:', error);
      return {
        success: false,
        authorizeUrl: '',
        state: '',
        error: error instanceof Error ? error.message : '授权失败',
      };
    }
  }

  /**
   * 处理回调
   */
  async callback(
    request: OAuthCallbackRequest
  ): Promise<OAuthCallbackResponse> {
    try {
      // 验证 state
      const stateValidation = this.validateState(request.state);
      if (!stateValidation.valid || !stateValidation.stateData) {
        throw new Error(stateValidation.error || 'Invalid state');
      }

      // 交换访问令牌
      const tokenResponse = await this.exchangeToken(request.code);

      // 获取用户信息
      const userInfo = await this.getUserInfo(
        tokenResponse.access_token,
        tokenResponse.openid
      );

      // 这里应该调用用户服务处理登录逻辑
      // 由于这是基础类，具体实现由子类或调用方处理
      // 返回格式化后的响应
      return {
        success: true,
        isNewUser: false,
        user: {
          id: userInfo.id,
          email:
            userInfo.email || `${userInfo.id}@${this.getProviderName()}.oauth`,
          username: userInfo.nickname,
          name: userInfo.nickname,
          role: 'USER',
          createdAt: new Date(),
        },
        token: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
      };
    } catch (error) {
      logger.error('OAuth callback error:', error);
      return {
        success: false,
        isNewUser: false,
        user: {
          id: '',
          email: '',
          username: null,
          name: null,
          role: 'USER',
          createdAt: new Date(),
        },
        token: '',
        error: error instanceof Error ? error.message : '回调处理失败',
      };
    }
  }

  /**
   * 创建 OAuth 错误
   */
  protected createOAuthError(
    code: string,
    message: string,
    details?: unknown
  ): OAuthError {
    return {
      code: code as never,
      message,
      details,
    };
  }

  /**
   * 生成随机 state
   */
  protected generateState(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 保存 state 到存储
   * 服务端使用模块级内存 Map（单实例部署），浏览器端使用 sessionStorage（前端 OAuth 场景）。
   * 多实例部署时应替换为 Redis 实现。
   */
  private saveState(stateData: OAuthState): void {
    const key = `${this.STATE_PREFIX}${stateData.state}`;
    if (typeof window === 'undefined') {
      // 服务端：写入模块级内存存储
      _serverStateStore.set(key, {
        data: stateData,
        expiresAt: Date.now() + this.STATE_EXPIRY,
      });
    } else {
      // 浏览器端：使用 sessionStorage
      sessionStorage.setItem(key, JSON.stringify(stateData));
      setTimeout(() => {
        sessionStorage.removeItem(key);
      }, this.STATE_EXPIRY);
    }
  }

  /**
   * 验证 state（一次性消费，防 CSRF）
   */
  private validateState(state: string): StateValidationResult {
    try {
      const key = `${this.STATE_PREFIX}${state}`;

      if (typeof window === 'undefined') {
        // 服务端：从内存存储中读取并立即删除（one-time use）
        const entry = _serverStateStore.get(key);
        _serverStateStore.delete(key);

        if (!entry) {
          return {
            valid: false,
            stateData: null,
            error: 'State not found or expired',
          };
        }

        if (Date.now() > entry.expiresAt) {
          return {
            valid: false,
            stateData: null,
            error: 'State expired',
          };
        }

        if (entry.data.provider !== this.getProviderName()) {
          return {
            valid: false,
            stateData: null,
            error: 'Provider mismatch',
          };
        }

        return { valid: true, stateData: entry.data, error: null };
      }

      // 浏览器端：从 sessionStorage 读取
      const stateStr = sessionStorage.getItem(key) || '';
      sessionStorage.removeItem(key);

      if (!stateStr) {
        return {
          valid: false,
          stateData: null,
          error: 'State not found or expired',
        };
      }

      const stateData: OAuthState = JSON.parse(stateStr);

      if (Date.now() - stateData.timestamp > this.STATE_EXPIRY) {
        return {
          valid: false,
          stateData: null,
          error: 'State expired',
        };
      }

      if (stateData.provider !== this.getProviderName()) {
        return {
          valid: false,
          stateData: null,
          error: 'Provider mismatch',
        };
      }

      return { valid: true, stateData, error: null };
    } catch (error) {
      return {
        valid: false,
        stateData: null,
        error:
          error instanceof Error ? error.message : 'State validation failed',
      };
    }
  }

  /**
   * 获取提供商名称
   */
  protected abstract getProviderName(): string;

  /**
   * 构建 URL 查询参数
   */
  protected buildUrl(base: string, params: Record<string, string>): string {
    const query = new URLSearchParams(params).toString();
    return query ? `${base}?${query}` : base;
  }

  /**
   * 解析 URL 查询参数
   */
  protected parseQuery(url: string): Record<string, string> {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  /**
   * GET 请求
   */
  protected async get(
    url: string,
    headers?: Record<string, string>
  ): Promise<unknown> {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * POST 请求
   */
  protected async post(
    url: string,
    data: Record<string, string>,
    headers?: Record<string, string>
  ): Promise<unknown> {
    const formData = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...headers,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 刷新令牌（如果提供商支持）
   */
  async refreshAccessToken(refreshToken?: string): Promise<OAuthTokenResponse> {
    // 默认实现，子类可以覆盖
    throw new Error(
      `Token refresh not implemented for this provider${
        refreshToken ? ` (token: ${refreshToken.slice(0, 8)}...)` : ''
      }`
    );
  }
}
