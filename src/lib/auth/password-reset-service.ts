/**
 * 密码重置服务模块
 *
 * 处理密码找回和重置的核心逻辑，包括发送验证码和重置密码。
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from '@/types/password-reset';
import {
  PasswordResetErrorCode,
  VerificationCodeTypeEnum,
} from '@/types/password-reset';
import { getEmailService } from './email-service';
import { SECURITY } from '../constants/common';
import { getVerificationCodeService } from './verification-code-service';

// =============================================================================
// 验证 Schema
// =============================================================================

/**
 * 密码验证规则
 */
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/**
 * 验证密码复杂度
 */
function validatePasswordComplexity(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`密码长度至少 ${PASSWORD_MIN_LENGTH} 个字符`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`密码长度不能超过 ${PASSWORD_MAX_LENGTH} 个字符`);
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  }

  // 可选：特殊字符
  // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
  //   errors.push("密码必须包含至少一个特殊字符");
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 邮箱验证 schema
 */
const forgotPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

/**
 * 密码重置验证 schema
 */
const resetPasswordSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z
    .string()
    .length(6, '验证码必须是6位数字')
    .regex(/^\d+$/, '验证码必须是数字'),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  confirmPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

// =============================================================================
// 密码重置服务
// =============================================================================

/**
 * 密码重置服务类
 */
class PasswordResetService {
  private prisma: PrismaClient;
  private verificationCodeService = getVerificationCodeService();
  private emailService = getEmailService();

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * 忘记密码 - 发送验证码
   */
  async forgotPassword(
    request: ForgotPasswordRequest
  ): Promise<ForgotPasswordResponse> {
    try {
      // 验证请求参数
      const validatedData = forgotPasswordSchema.parse(request);

      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { email: validatedData.email },
      });

      // 即使用户不存在也返回成功，防止邮箱枚举攻击
      if (!user) {
        return {
          success: true,
          message: '如果该邮箱已注册，您将收到密码重置验证码',
          data: {
            expiresAt: new Date(Date.now() + SECURITY.PASSWORD_RESET_EXPIRY),
            attemptWindow: 60,
            maxAttempts: 5,
            remainingAttempts: 5,
          },
        };
      }

      // 创建验证码
      const codeResult = await this.verificationCodeService.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      if (!codeResult.success) {
        return {
          success: false,
          message: codeResult.error || '创建验证码失败',
          error: codeResult.error,
        };
      }

      // 发送邮件
      const emailResult = await this.emailService.sendPasswordResetEmail(
        user.email,
        codeResult.code,
        codeResult.expiresAt
      );

      if (!emailResult.success) {
        return {
          success: false,
          message: '发送邮件失败，请稍后重试',
          error: PasswordResetErrorCode.EMAIL_SEND_FAILED,
        };
      }

      return {
        success: true,
        message: '密码重置验证码已发送到您的邮箱',
        data: {
          expiresAt: codeResult.expiresAt,
          attemptWindow: 60,
          maxAttempts: 5,
          remainingAttempts: 5,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        return {
          success: false,
          message: firstError?.message || '输入验证失败',
          error: PasswordResetErrorCode.INVALID_EMAIL,
        };
      }

      console.error('密码找回失败:', error);
      return {
        success: false,
        message: '密码找回失败，请稍后重试',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 重置密码
   */
  async resetPassword(
    request: ResetPasswordRequest
  ): Promise<ResetPasswordResponse> {
    try {
      // 验证请求参数
      const validatedData = resetPasswordSchema.parse(request);

      // 检查两次密码是否一致
      if (validatedData.newPassword !== validatedData.confirmPassword) {
        return {
          success: false,
          message: '两次输入的密码不一致',
          error: PasswordResetErrorCode.PASSWORD_MISMATCH,
        };
      }

      // 验证密码复杂度
      const complexityCheck = validatePasswordComplexity(
        validatedData.newPassword
      );
      if (!complexityCheck.valid) {
        return {
          success: false,
          message: complexityCheck.errors[0],
          error: PasswordResetErrorCode.INVALID_PASSWORD,
        };
      }

      // 验证验证码
      const verifyResult = await this.verificationCodeService.verifyCode(
        validatedData.email,
        validatedData.code,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      if (!verifyResult.valid || !verifyResult.userId) {
        return {
          success: false,
          message: verifyResult.error || '验证码无效或已过期',
          error: PasswordResetErrorCode.INVALID_CODE,
        };
      }

      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { id: verifyResult.userId },
      });

      if (!user) {
        return {
          success: false,
          message: '用户不存在',
          error: PasswordResetErrorCode.USER_NOT_FOUND,
        };
      }

      // 哈希新密码
      const hashedPassword = await bcrypt.hash(validatedData.newPassword, 10);

      // 更新密码
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          updatedAt: new Date(),
        },
      });

      // 清除用户的密码重置令牌（如果有）
      if (user.passwordResetToken) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken: null,
            passwordResetExpires: null,
          },
        });
      }

      return {
        success: true,
        message: '密码重置成功，请使用新密码登录',
        data: {
          userId: user.id,
          email: user.email,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        return {
          success: false,
          message: firstError?.message || '输入验证失败',
          error: PasswordResetErrorCode.INVALID_EMAIL,
        };
      }

      console.error('密码重置失败:', error);
      return {
        success: false,
        message: '密码重置失败，请稍后重试',
        error: error instanceof Error ? error.message : '未知错误',
      };
    }
  }

  /**
   * 关闭数据库连接
   */
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// =============================================================================
// 单例实例
// =============================================================================

let instance: PasswordResetService | null = null;

/**
 * 获取密码重置服务实例
 */
export function getPasswordResetService(
  prisma?: PrismaClient
): PasswordResetService {
  if (!instance) {
    instance = new PasswordResetService(prisma);
  }
  return instance;
}

/**
 * 重置密码重置服务实例（主要用于测试）
 */
export function resetPasswordResetService(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}

// =============================================================================
// 导出
// =============================================================================

export { PasswordResetService, validatePasswordComplexity };
