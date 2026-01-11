/**
 * OAuth 认证系统类型定义
 */

// =============================================================================
// OAuth 提供商枚举
// =============================================================================

/**
 * 支持的 OAuth 提供商
 */
export enum OAuthProvider {
  WECHAT = "wechat",
  QQ = "qq",
}

/**
 * OAuth 提供商配置
 */
export interface OAuthProviderConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  scope: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

// =============================================================================
// OAuth 用户信息类型
// =============================================================================

/**
 * 通用 OAuth 用户信息
 */
export interface OAuthUserInfo {
  id: string;
  nickname: string;
  avatar?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "unknown";
  country?: string;
  province?: string;
  city?: string;
  rawUserInfo?: unknown;
}

/**
 * 微信用户信息
 */
export interface WechatUserInfo {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

/**
 * QQ 用户信息
 */
export interface QqUserInfo {
  openid: string;
  nickname: string;
  gender: string;
  figureurl_qq_1: string;
  figureurl_qq_2: string;
  province: string;
  city: string;
  year: string;
}

// =============================================================================
// OAuth 授权流程类型
// =============================================================================

/**
 * OAuth 授权请求
 */
export interface OAuthAuthorizeRequest {
  state: string;
  redirectUri?: string;
}

/**
 * OAuth 授权响应
 */
export interface OAuthAuthorizeResponse {
  success: boolean;
  authorizeUrl: string;
  state: string;
  error?: string;
}

/**
 * OAuth 回调请求
 */
export interface OAuthCallbackRequest {
  code: string;
  state: string;
}

/**
 * OAuth 回调响应
 */
export interface OAuthCallbackResponse {
  success: boolean;
  isNewUser: boolean;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    role: string;
    createdAt: Date;
  };
  token: string;
  refreshToken?: string;
  error?: string;
}

// =============================================================================
// OAuth Token 类型
// =============================================================================

/**
 * OAuth 访问令牌响应
 */
export interface OAuthTokenResponse {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  openid?: string;
  unionid?: string;
}

// =============================================================================
// 账号绑定类型
// =============================================================================

/**
 * OAuth 账号信息
 */
export interface OAuthAccount {
  id: string;
  provider: OAuthProvider;
  providerAccountId: string;
  userId: string;
  nickname?: string;
  avatar?: string;
  createdAt: Date;
}

/**
 * 绑定账号请求
 */
export interface BindOAuthAccountRequest {
  provider: OAuthProvider;
  code: string;
  state: string;
}

/**
 * 绑定账号响应
 */
export interface BindOAuthAccountResponse {
  success: boolean;
  message: string;
  account?: OAuthAccount;
  error?: string;
}

/**
 * 解绑账号请求
 */
export interface UnbindOAuthAccountRequest {
  provider: OAuthProvider;
}

/**
 * 解绑账号响应
 */
export interface UnbindOAuthAccountResponse {
  success: boolean;
  message: string;
  error?: string;
}

/**
 * 用户 OAuth 账号列表
 */
export interface UserOAuthAccountsResponse {
  success: boolean;
  accounts: OAuthAccount[];
  canUnbind: boolean; // 是否允许解绑（至少保留一种登录方式）
}

// =============================================================================
// OAuth 错误类型
// =============================================================================

/**
 * OAuth 错误代码
 */
export enum OAuthErrorCode {
  INVALID_REQUEST = "INVALID_REQUEST",
  INVALID_CLIENT = "INVALID_CLIENT",
  INVALID_GRANT = "INVALID_GRANT",
  INVALID_SCOPE = "INVALID_SCOPE",
  UNAUTHORIZED_CLIENT = "UNAUTHORIZED_CLIENT",
  ACCESS_DENIED = "ACCESS_DENIED",
  UNSUPPORTED_RESPONSE_TYPE = "UNSUPPORTED_RESPONSE_TYPE",
  SERVER_ERROR = "SERVER_ERROR",
  TEMPORARILY_UNAVAILABLE = "TEMPORARILY_UNAVAILABLE",
  INVALID_STATE = "INVALID_STATE",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  USER_CANCELLED = "USER_CANCELLED",
  ACCOUNT_EXISTS = "ACCOUNT_EXISTS",
  ACCOUNT_NOT_FOUND = "ACCOUNT_NOT_FOUND",
}

/**
 * OAuth 错误
 */
export interface OAuthError {
  code: OAuthErrorCode;
  message: string;
  details?: unknown;
}

// =============================================================================
// State 管理类型
// =============================================================================

/**
 * OAuth State 数据
 */
export interface OAuthState {
  state: string;
  provider: OAuthProvider;
  redirectUri: string;
  timestamp: number;
  userId?: string; // 可选：用于账号绑定
}

/**
 * State 验证结果
 */
export interface StateValidationResult {
  valid: boolean;
  stateData: OAuthState | null;
  error: string | null;
}
