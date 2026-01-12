/**
 * 微信 OAuth2.0 实现
 */

import { OAuthBaseProvider } from './oauth-base';
import type { OAuthTokenResponse, OAuthUserInfo } from '../../types/oauth';
import type { WechatUserInfo } from '../../types/oauth';

/**
 * 微信 OAuth 提供商
 */
export class WechatOAuthProvider extends OAuthBaseProvider {
  constructor() {
    const appId = process.env.WECHAT_APP_ID || '';
    const appSecret = process.env.WECHAT_APP_SECRET || '';
    const redirectUri = process.env.WECHAT_REDIRECT_URI || '';

    if (!appId || !appSecret) {
      throw new Error('WECHAT_APP_ID and WECHAT_APP_SECRET are required');
    }

    super({
      appId,
      appSecret,
      redirectUri,
      scope: 'snsapi_userinfo',
      authorizeUrl: 'https://open.weixin.qq.com/connect/oauth2/authorize',
      tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      userInfoUrl: 'https://api.weixin.qq.com/sns/userinfo',
    });
  }

  /**
   * 获取提供商名称
   */
  protected getProviderName(): string {
    return 'wechat';
  }

  /**
   * 构建授权 URL
   */
  buildAuthorizeUrl(state: string, redirectUri?: string): string {
    const params = {
      appid: this.config.appId,
      redirect_uri: redirectUri || this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scope,
      state,
    };

    // 微信授权URL需要 #wechat_redirect 后缀
    return this.buildUrl(this.config.authorizeUrl, params) + '#wechat_redirect';
  }

  /**
   * 交换访问令牌
   */
  async exchangeToken(code: string): Promise<OAuthTokenResponse> {
    const params = {
      appid: this.config.appId,
      secret: this.config.appSecret,
      code,
      grant_type: 'authorization_code',
    };

    try {
      const response = (await this.post(
        this.config.tokenUrl,
        params
      )) as WechatTokenResponse;

      // 检查错误码
      if ('errcode' in response && response.errcode !== 0) {
        const errmsg = (response as { errmsg?: string }).errmsg;
        throw new Error(`Wechat API error: ${response.errcode} - ${errmsg}`);
      }

      return {
        access_token: response.access_token,
        expires_in: response.expires_in,
        refresh_token: response.refresh_token,
        openid: response.openid,
        scope: response.scope,
        unionid: response.unionid,
      };
    } catch (error) {
      console.error('Wechat exchangeToken error:', error);
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
      throw new Error('OpenID is required for WeChat user info');
    }

    const url = `${this.config.userInfoUrl}?access_token=${accessToken}&openid=${openid}`;

    try {
      const response = (await this.get(url)) as WechatUserInfo;

      // 检查错误码
      if ('errcode' in response && response.errcode !== 0) {
        const errmsg = (response as { errmsg?: string }).errmsg;
        throw new Error(`Wechat API error: ${response.errcode} - ${errmsg}`);
      }

      return {
        id: response.openid,
        nickname: response.nickname,
        avatar: response.headimgurl,
        gender: this.mapGender(response.sex),
        country: response.country,
        province: response.province,
        city: response.city,
        rawUserInfo: response,
      };
    } catch (error) {
      console.error('Wechat getUserInfo error:', error);
      throw new Error(
        `Failed to get user info: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 刷新访问令牌
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const params = {
      appid: this.config.appId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };

    try {
      const response = (await this.post(
        this.config.tokenUrl,
        params
      )) as WechatTokenResponse;

      // 检查错误码
      if ('errcode' in response && response.errcode !== 0) {
        const errmsg = (response as { errmsg?: string }).errmsg;
        throw new Error(`Wechat API error: ${response.errcode} - ${errmsg}`);
      }

      return {
        access_token: response.access_token,
        expires_in: response.expires_in,
        refresh_token: response.refresh_token,
        openid: response.openid,
        scope: response.scope,
        unionid: response.unionid,
      };
    } catch (error) {
      console.error('Wechat refreshAccessToken error:', error);
      throw new Error(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * 映射性别
   */
  private mapGender(sex: number): 'male' | 'female' | 'unknown' {
    switch (sex) {
      case 1:
        return 'male';
      case 2:
        return 'female';
      default:
        return 'unknown';
    }
  }
}

/**
 * 微信令牌响应
 */
interface WechatTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
  errcode?: number;
}

// 导出单例
export const wechatOAuth = new WechatOAuthProvider();
