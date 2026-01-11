/**
 * 认证系统类型定义
 */

// =============================================================================
// JWT 相关类型
// =============================================================================

/**
 * JWT Payload 结构
 */
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT 选项
 */
export interface JwtOptions {
  expiresIn: string;
  issuer?: string;
  audience?: string;
}

/**
 * JWT 验证结果
 */
export interface JwtVerifyResult {
  valid: boolean;
  payload: JwtPayload | null;
  error: string | null;
}

// =============================================================================
// 请求/响应类型
// =============================================================================

/**
 * 用户注册请求
 */
export interface RegisterRequest {
  email: string;
  password: string;
  username?: string;
  name?: string;
}

/**
 * 用户登录请求
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 认证响应
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
      role: string;
      createdAt: Date;
    };
    token: string;
  };
  error?: string;
}

/**
 * 当前用户信息
 */
export interface CurrentUser {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
  role: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// 验证错误类型
// =============================================================================

/**
 * 密码验证错误
 */
export interface PasswordValidationError {
  valid: boolean;
  errors: string[];
}

/**
 * 邮箱验证错误
 */
export interface EmailValidationError {
  valid: boolean;
  error: string | null;
}

// =============================================================================
// 认证错误类型
// =============================================================================

/**
 * 认证错误代码
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_EXISTS = "USER_EXISTS",
  INVALID_PASSWORD = "INVALID_PASSWORD",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",
}

/**
 * 认证错误
 */
export interface AuthError {
  code: AuthErrorCode;
  message: string;
  details?: unknown;
}

// =============================================================================
// 用户状态枚举（与 Prisma 对应）
// =============================================================================

export enum UserStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  BANNED = "BANNED",
  INACTIVE = "INACTIVE",
}

// =============================================================================
// 用户角色枚举（与 Prisma 对应）
// =============================================================================

export enum UserRole {
  USER = "USER",
  LAWYER = "LAWYER",
  ADMIN = "ADMIN",
  SUPER_ADMIN = "SUPER_ADMIN",
}

// =============================================================================
// 会话管理相关类型
// =============================================================================

/**
 * 刷新令牌请求
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * 刷新令牌响应
 */
export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken?: string;
    expiresIn: number;
  };
  error?: string;
}

/**
 * 登出请求
 */
export interface LogoutRequest {
  allDevices?: boolean;
}

/**
 * 登出响应
 */
export interface LogoutResponse {
  success: boolean;
  message: string;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  id: string;
  sessionToken: string;
  userId: string;
  expires: Date;
  deviceInfo?: string;
  ipAddress?: string;
  lastActive?: Date;
  createdAt: Date;
}

/**
 * 会话清理配置
 */
export interface SessionCleanupConfig {
  inactiveDays: number;
  batchLimit: number;
}
