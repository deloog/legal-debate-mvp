/**
 * 验证码服务模块
 *
 * 处理验证码的生成、验证和管理，支持密码重置、邮箱验证等场景。
 */

import { PrismaClient } from "@prisma/client";
import type {
  VerifyCodeResult,
  VerificationCodeConfig,
  VerificationCodeResult,
  VerificationCodeTypeEnum,
} from "@/types/password-reset";

// =============================================================================
// 配置常量
// =============================================================================

/**
 * 默认验证码配置
 */
const DEFAULT_CONFIG: VerificationCodeConfig = {
  length: 6, // 6位数字验证码
  expiresIn: 15, // 15分钟后过期
  maxAttempts: 5, // 最大尝试次数
  attemptWindow: 60, // 1小时内最多尝试次数
};

/**
 * 验证码类型到枚举的映射
 */
const TYPE_MAPPING: Record<
  VerificationCodeTypeEnum,
  "PASSWORD_RESET" | "EMAIL_VERIFICATION" | "PHONE_VERIFICATION"
> = {
  PASSWORD_RESET: "PASSWORD_RESET",
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PHONE_VERIFICATION: "PHONE_VERIFICATION",
};

// =============================================================================
// 验证码服务
// =============================================================================

/**
 * 验证码服务类
 */
class VerificationCodeService {
  private prisma: PrismaClient;
  private config: VerificationCodeConfig;

  constructor(prisma?: PrismaClient, config?: Partial<VerificationCodeConfig>) {
    this.prisma = prisma || new PrismaClient();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 生成随机数字验证码
   */
  private generateCode(): string {
    const code = Array.from({ length: this.config.length }, () =>
      Math.floor(Math.random() * 10).toString(),
    ).join("");
    return code;
  }

  /**
   * 获取过期时间
   */
  private getExpirationTime(): Date {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.config.expiresIn);
    return expiresAt;
  }

  /**
   * 检查用户是否在限制时间内尝试次数过多
   */
  private async checkAttemptLimit(
    userId: string,
    type: VerificationCodeTypeEnum,
  ): Promise<{
    allowed: boolean;
    nextAttemptAt?: Date;
    remainingAttempts: number;
  }> {
    const windowStart = new Date();
    windowStart.setMinutes(
      windowStart.getMinutes() - this.config.attemptWindow,
    );

    const recentAttempts = await this.prisma.verificationCode.count({
      where: {
        userId,
        type: TYPE_MAPPING[type],
        createdAt: {
          gte: windowStart,
        },
      },
    });

    if (recentAttempts >= this.config.maxAttempts) {
      // 计算下一次可尝试的时间
      const lastAttempt = await this.prisma.verificationCode.findFirst({
        where: {
          userId,
          type: TYPE_MAPPING[type],
          createdAt: {
            gte: windowStart,
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      if (lastAttempt) {
        const nextAttemptAt = new Date(lastAttempt.createdAt);
        nextAttemptAt.setMinutes(
          nextAttemptAt.getMinutes() + this.config.attemptWindow,
        );

        return {
          allowed: false,
          nextAttemptAt,
          remainingAttempts: 0,
        };
      }
    }

    return {
      allowed: true,
      remainingAttempts: this.config.maxAttempts - recentAttempts,
    };
  }

  /**
   * 创建验证码
   */
  async createCode(
    userId: string,
    type: VerificationCodeTypeEnum,
  ): Promise<VerificationCodeResult> {
    try {
      // 检查尝试限制
      const limitCheck = await this.checkAttemptLimit(userId, type);
      if (!limitCheck.allowed) {
        return {
          success: false,
          code: "",
          expiresAt: new Date(),
          error: `尝试次数过多，请 ${this.formatTimeRemaining(limitCheck.nextAttemptAt!)} 后再试`,
        };
      }

      // 生成验证码
      const code = this.generateCode();
      const expiresAt = this.getExpirationTime();

      // 保存到数据库
      await this.prisma.verificationCode.create({
        data: {
          userId,
          code,
          type: TYPE_MAPPING[type],
          expiresAt,
        },
      });

      return {
        success: true,
        code,
        expiresAt,
      };
    } catch (error) {
      console.error("创建验证码失败:", error);
      return {
        success: false,
        code: "",
        expiresAt: new Date(),
        error: error instanceof Error ? error.message : "未知错误",
      };
    }
  }

  /**
   * 验证验证码
   */
  async verifyCode(
    email: string,
    code: string,
    type: VerificationCodeTypeEnum,
  ): Promise<VerifyCodeResult> {
    try {
      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (!user) {
        return {
          valid: false,
          userId: null,
          error: "用户不存在",
        };
      }

      // 查找验证码
      const verificationCode = await this.prisma.verificationCode.findFirst({
        where: {
          userId: user.id,
          code,
          type: TYPE_MAPPING[type],
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!verificationCode) {
        return {
          valid: false,
          userId: null,
          error: "验证码无效或已过期",
        };
      }

      // 标记为已使用
      await this.prisma.verificationCode.update({
        where: { id: verificationCode.id },
        data: { usedAt: new Date() },
      });

      return {
        valid: true,
        userId: user.id,
        error: null,
      };
    } catch (error) {
      console.error("验证验证码失败:", error);
      return {
        valid: false,
        userId: null,
        error: error instanceof Error ? error.message : "验证失败",
      };
    }
  }

  /**
   * 清理过期验证码
   */
  async cleanupExpiredCodes(): Promise<number> {
    try {
      const result = await this.prisma.verificationCode.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return result.count;
    } catch (error) {
      console.error("清理过期验证码失败:", error);
      return 0;
    }
  }

  /**
   * 格式化剩余时间
   */
  private formatTimeRemaining(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.ceil(diffMs / 60000);

    if (diffMins < 60) {
      return `${diffMins}分钟`;
    }

    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;

    if (remainingMins === 0) {
      return `${diffHours}小时`;
    }

    return `${diffHours}小时${remainingMins}分钟`;
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

let instance: VerificationCodeService | null = null;

/**
 * 获取验证码服务实例
 */
export function getVerificationCodeService(
  prisma?: PrismaClient,
  config?: Partial<VerificationCodeConfig>,
): VerificationCodeService {
  if (!instance) {
    instance = new VerificationCodeService(prisma, config);
  }
  return instance;
}

/**
 * 重置验证码服务实例（主要用于测试）
 */
export function resetVerificationCodeService(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}

// =============================================================================
// 导出
// =============================================================================

export { VerificationCodeService, DEFAULT_CONFIG };
export type { VerificationCodeConfig };
