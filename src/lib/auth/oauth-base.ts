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
  private readonly STATE_EXPIRY = 10 * 60 * 1000; // 10分钟

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
      console.error('OAuth authorize error:', error);
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
      console.error('OAuth callback error:', error);
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
   * 注意：生产环境应使用 Redis 或数据库
   */
  private saveState(stateData: OAuthState): void {
    const key = `${this.STATE_PREFIX}${stateData.state}`;
    const value = JSON.stringify(stateData);

    // 简单实现：使用 sessionStorage（前端）或 内存存储（后端）
    // 在实际应用中，应该使用 Redis 或数据库
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(key, value);
      setTimeout(() => {
        sessionStorage.removeItem(key);
      }, this.STATE_EXPIRY);
    }
  }

  /**
   * 验证 state
   */
  private validateState(state: string): StateValidationResult {
    try {
      const key = `${this.STATE_PREFIX}${state}`;
      let stateStr = '';
      if (typeof window !== 'undefined') {
        stateStr = sessionStorage.getItem(key) || '';
        sessionStorage.removeItem(key);
      }

      if (!stateStr) {
        return {
          valid: false,
          stateData: null,
          error: 'State not found or expired',
        };
      }

      const stateData: OAuthState = JSON.parse(stateStr);

      // 检查是否过期
      const now = Date.now();
      if (now - stateData.timestamp > this.STATE_EXPIRY) {
        return {
          valid: false,
          stateData: null,
          error: 'State expired',
        };
      }

      // 检查 provider 是否匹配
      if (stateData.provider !== this.getProviderName()) {
        return {
          valid: false,
          stateData: null,
          error: 'Provider mismatch',
        };
      }

      return {
        valid: true,
        stateData,
        error: null,
      };
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
