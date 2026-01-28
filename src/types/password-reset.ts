/**
 * 密码找回与重置相关类型定义
 */

// =============================================================================
// 验证码类型
// =============================================================================

/**
 * 验证码类型枚举
 */
export enum VerificationCodeTypeEnum {
  PASSWORD_RESET = 'PASSWORD_RESET',
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PHONE_VERIFICATION = 'PHONE_VERIFICATION',
}

// =============================================================================
// 验证码管理
// =============================================================================

/**
 * 验证码生成结果
 */
export interface VerificationCodeResult {
  success: boolean;
  code: string;
  expiresAt: Date;
  error?: string;
}

/**
 * 验证码验证结果
 */
export interface VerifyCodeResult {
  valid: boolean;
  userId: string | null;
  error: string | null;
}

/**
 * 验证码配置
 */
export interface VerificationCodeConfig {
  length: number;
  expiresIn: number; // 分钟
  maxAttempts: number;
  attemptWindow: number; // 尝试时间窗口（分钟）
}

// =============================================================================
// 请求/响应类型
// =============================================================================

/**
 * 密码找回请求
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * 密码找回响应
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    expiresAt: Date;
    attemptWindow: number;
    maxAttempts: number;
    remainingAttempts: number;
    nextAttemptAt?: Date; // 如果达到限制
  };
  error?: string;
}

/**
 * 密码重置请求
 */
export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 密码重置响应
 */
export interface ResetPasswordResponse {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    email: string;
  };
  error?: string;
}

// =============================================================================
// 邮件服务类型
// =============================================================================

/**
 * 邮件模板类型
 */
export interface EmailTemplate {
  subject: string;
  textContent: string;
  htmlContent?: string;
}

/**
 * 邮件发送选项
 */
export interface EmailSendOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * 邮件发送结果
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devMessage?: string; // 开发环境下的控制台消息
}

// =============================================================================
// 邮件服务接口
// =============================================================================

/**
 * 邮件服务接口
 */
export interface IEmailService {
  sendPasswordResetEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult>;
  sendVerificationEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult>;
  /**
   * 发送通用邮件
   */
  sendEmail?(options: EmailSendOptions): Promise<EmailSendResult>;
}

// =============================================================================
// 错误类型
// =============================================================================

/**
 * 密码重置错误代码
 */
export enum PasswordResetErrorCode {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INVALID_EMAIL = 'INVALID_EMAIL',
  CODE_EXPIRED = 'CODE_EXPIRED',
  CODE_ALREADY_USED = 'CODE_ALREADY_USED',
  INVALID_CODE = 'INVALID_CODE',
  PASSWORD_MISMATCH = 'PASSWORD_MISMATCH',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  TOO_MANY_ATTEMPTS = 'TOO_MANY_ATTEMPTS',
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',
}

/**
 * 密码重置错误
 */
export interface PasswordResetError {
  code: PasswordResetErrorCode;
  message: string;
  details?: unknown;
}
