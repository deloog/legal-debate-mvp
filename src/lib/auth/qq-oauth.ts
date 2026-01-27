/**
 * QQ OAuth2.0 实现
 */

import { OAuthBaseProvider } from './oauth-base';
import type { OAuthTokenResponse, OAuthUserInfo } from '../../types/oauth';
import type { QqUserInfo } from '../../types/oauth';

/**
 * QQ OAuth 提供商
 */
export class QqOAuthProvider extends OAuthBaseProvider {
  private static instance: QqOAuthProvider | null = null;

  private constructor() {
    const appId = process.env.QQ_APP_ID || '';
    const appKey = process.env.QQ_APP_KEY || '';
    const redirectUri = process.env.QQ_REDIRECT_URI || '';

    super({
      appId,
      appSecret: appKey,
      redirectUri,
      scope: 'get_user_info',
      authorizeUrl: 'https://graph.qq.com/oauth2.0/authorize',
      tokenUrl: 'https://graph.qq.com/oauth2.0/token',
      userInfoUrl: 'https://graph.qq.com/user/get_user_info',
    });
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): QqOAuthProvider {
    if (!QqOAuthProvider.instance) {
      const appId = process.env.QQ_APP_ID || '';
      const appKey = process.env.QQ_APP_KEY || '';

      if (!appId || !appKey) {
        throw new Error('QQ_APP_ID and QQ_APP_KEY are required');
      }

      QqOAuthProvider.instance = new QqOAuthProvider();
    }
    return QqOAuthProvider.instance;
  }

  /**
   * 获取提供商名称
   */
  protected getProviderName(): string {
    return 'qq';
  }

  /**
   * 构建授权 URL
   */
  buildAuthorizeUrl(state: string, redirectUri?: string): string {
    const params = {
      response_type: 'code',
      client_id: this.config.appId,
      redirect_uri: redirectUri || this.config.redirectUri,
      state,
      scope: this.config.scope,
    };

    return this.buildUrl(this.config.authorizeUrl, params);
  }

  /**
   * 交换访问令牌
   */
  async exchangeToken(code: string): Promise<OAuthTokenResponse> {
    const params = {
      grant_type: 'authorization_code',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      code,
      redirect_uri: this.config.redirectUri,
    };

    try {
      const responseText = await this.post(this.config.tokenUrl, params);
      const response = this.parseQqTokenResponse(
        responseText as string
      ) as QqTokenResponse;

      return {
        access_token: response.access_token,
        expires_in: Number.parseInt(response.expires_in, 10),
        refresh_token: response.refresh_token,
        openid: '', // QQ需要单独获取openid
        scope: response.scope,
      };
    } catch (error) {
      console.error('QQ exchangeToken error:', error);
      throw new Error(
        `Failed to exchange token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(
    accessToken: string,
    openid?: string
  ): Promise<OAuthUserInfo> {
    if (!openid) {
      throw new Error('OpenID is required for QQ user info');
    }

    const params = {
      access_token: accessToken,
      oauth_consumer_key: this.config.appId,
      openid,
    };

    try {
      const response = (await this.get(
        this.buildUrl(this.config.userInfoUrl, params)
      )) as QqUserInfo;

      return {
        id: openid,
        nickname: response.nickname,
        avatar: response.figureurl_qq_1,
        gender: this.mapGender(response.gender),
        province: response.province,
        city: response.city,
        rawUserInfo: response,
      };
    } catch (error) {
      console.error('QQ getUserInfo error:', error);
      throw new Error(
        `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 解析QQ令牌响应
   */
  private parseQqTokenResponse(responseText: string): unknown {
    // QQ返回格式为：access_token=...&expires_in=...&refresh_token=...
    const params = new URLSearchParams(responseText);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  /**
   * 获取QQ OpenID
   */
  async getQqOpenId(accessToken: string): Promise<string> {
    const url = `https://graph.qq.com/oauth2.0/me?access_token=${accessToken}`;

    try {
      const responseText = await this.get(url);
      const match = (responseText as string).match(/"openid":"([^"]+)"/);

      if (!match) {
        throw new Error('Failed to parse OpenID from QQ response');
      }

      return match[1];
    } catch (error) {
      console.error('QQ getQqOpenId error:', error);
      throw new Error(
        `Failed to get OpenID: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const params = {
      grant_type: 'refresh_token',
      client_id: this.config.appId,
      client_secret: this.config.appSecret,
      refresh_token: refreshToken,
    };

    try {
      const responseText = await this.post(this.config.tokenUrl, params);
      const response = this.parseQqTokenResponse(
        responseText as string
      ) as QqTokenResponse;

      return {
        access_token: response.access_token,
        expires_in: Number.parseInt(response.expires_in, 10),
        refresh_token: response.refresh_token,
        openid: '',
        scope: response.scope,
      };
    } catch (error) {
      console.error('QQ refreshAccessToken error:', error);
      throw new Error(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 映射性别
   */
  private mapGender(gender: string): 'male' | 'female' | 'unknown' {
    if (gender === '男') {
      return 'male';
    }
    if (gender === '女') {
      return 'female';
    }
    return 'unknown';
  }
}

/**
 * QQ令牌响应
 */
interface QqTokenResponse {
  access_token: string;
  expires_in: string;
  refresh_token: string;
  scope: string;
}

/**
 * 获取 QQ OAuth 实例
 * 使用延迟初始化，避免构建时验证环境变量
 */
export const getQqOAuth = (): QqOAuthProvider => {
  return QqOAuthProvider.getInstance();
};
