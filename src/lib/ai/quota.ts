/**
 * AI配额管理系统
 * 用于控制用户AI调用次数，防止成本失控
 */

import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 配额配置接口
 */
export interface QuotaConfig {
  dailyLimit: number;
  monthlyLimit: number;
  perRequestLimit: number;
}

/**
 * 配额检查结果
 */
export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remaining?: number;
  dailyUsed?: number;
  dailyLimit?: number;
  monthlyUsed?: number;
  monthlyLimit?: number;
}

/**
 * AI使用记录数据
 */
export interface AIUsageRecord {
  userId: string;
  type: string;
  provider: string;
  model?: string;
  tokensUsed: number;
  duration: number;
  success: boolean;
  error?: string;
}

// =============================================================================
// 配额配置
// =============================================================================

/**
 * 不同角色的配额配置
 */
const QUOTA_CONFIGS: Record<string, QuotaConfig> = {
  FREE: {
    dailyLimit: 10,
    monthlyLimit: 100,
    perRequestLimit: 1000,
  },
  BASIC: {
    dailyLimit: 50,
    monthlyLimit: 1000,
    perRequestLimit: 2000,
  },
  PROFESSIONAL: {
    dailyLimit: 200,
    monthlyLimit: 5000,
    perRequestLimit: 4000,
  },
  ENTERPRISE: {
    dailyLimit: 500,
    monthlyLimit: 10000,
    perRequestLimit: 8000,
  },
  ADMIN: {
    dailyLimit: -1,
    monthlyLimit: -1,
    perRequestLimit: -1,
  },
  SUPER_ADMIN: {
    dailyLimit: -1,
    monthlyLimit: -1,
    perRequestLimit: -1,
  },
  LAWYER: {
    dailyLimit: 100,
    monthlyLimit: 2000,
    perRequestLimit: 3000,
  },
};

/**
 * 获取用户配额配置
 */
export function getUserQuotaConfig(role: string): QuotaConfig {
  return QUOTA_CONFIGS[role] || QUOTA_CONFIGS.FREE;
}

// =============================================================================
// 配额检查
// =============================================================================

/**
 * 检查用户AI配额
 *
 * @param userId - 用户ID
 * @param role - 用户角色
 * @param tokensToUse - 本次请求使用的token数量（可选）
 * @returns 配额检查结果
 */
export async function checkAIQuota(
  userId: string,
  role: string,
  tokensToUse: number = 0
): Promise<QuotaCheckResult> {
  try {
    // 获取用户配额配置
    const config = getUserQuotaConfig(role);

    // 管理员无限制
    if (config.dailyLimit === -1) {
      return {
        allowed: true,
        reason: '管理员无配额限制',
      };
    }

    // 检查单次请求token数量
    if (tokensToUse > config.perRequestLimit) {
      return {
        allowed: false,
        reason: `单次请求超过限制（${config.perRequestLimit} tokens）`,
      };
    }

    // 获取今日使用量
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyInteractions = await prisma.aIInteraction.findMany({
      where: {
        userId: userId,
        createdAt: { gte: today },
        success: true,
      } as Prisma.AIInteractionFindManyArgs['where'],
      select: { id: true },
    });

    const dailyUsed = dailyInteractions.length;
    const dailyRemaining = config.dailyLimit - dailyUsed;

    // 检查每日配额
    if (dailyUsed >= config.dailyLimit) {
      return {
        allowed: false,
        reason: `今日配额已用完（${config.dailyLimit}次）`,
        remaining: 0,
        dailyUsed,
        dailyLimit: config.dailyLimit,
      };
    }

    // 检查本月使用量
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthInteractions = await prisma.aIInteraction.findMany({
      where: {
        userId: userId,
        createdAt: { gte: monthStart },
        success: true,
      } as Prisma.AIInteractionFindManyArgs['where'],
      select: { id: true },
    });

    const monthlyUsed = monthInteractions.length;

    // 检查每月配额
    if (monthlyUsed >= config.monthlyLimit) {
      return {
        allowed: false,
        reason: `本月配额已用完（${config.monthlyLimit}次）`,
        remaining: 0,
        dailyUsed,
        dailyLimit: config.dailyLimit,
        monthlyUsed,
        monthlyLimit: config.monthlyLimit,
      };
    }

    // 配额充足
    return {
      allowed: true,
      remaining: dailyRemaining,
      dailyUsed,
      dailyLimit: config.dailyLimit,
      monthlyUsed,
      monthlyLimit: config.monthlyLimit,
    };
  } catch (error) {
    console.error('检查AI配额失败:', error);
    // 出错时默认允许，但不记录错误
    return {
      allowed: false,
      reason: '配额检查失败，请稍后重试',
    };
  }
}

// =============================================================================
// 使用记录
// =============================================================================

/**
 * 记录AI使用
 *
 * @param data - AI使用记录数据
 */
export async function recordAIUsage(data: AIUsageRecord): Promise<void> {
  try {
    await prisma.aIInteraction.create({
      data: {
        type: data.type,
        provider: data.provider,
        model: data.model,
        userId: data.userId,
        request: {
          timestamp: new Date().toISOString(),
          userId: data.userId,
        } as Prisma.InputJsonValue,
        response: {} as Prisma.InputJsonValue,
        tokensUsed: data.tokensUsed,
        duration: data.duration,
        success: data.success,
        error: data.error,
      } as Prisma.AIInteractionCreateArgs['data'],
    });
  } catch (error) {
    console.error('记录AI使用失败:', error);
    // 不抛出错误，避免影响主流程
  }
}

// =============================================================================
// 配额查询
// =============================================================================

/**
 * 获取用户配额使用情况
 *
 * @param userId - 用户ID
 * @param role - 用户角色
 * @returns 配额使用情况
 */
export async function getUserQuotaUsage(
  userId: string,
  role: string
): Promise<{
  daily: { used: number; limit: number; remaining: number };
  monthly: { used: number; limit: number; remaining: number };
}> {
  try {
    const config = getUserQuotaConfig(role);

    // 管理员返回无限制
    if (config.dailyLimit === -1) {
      return {
        daily: { used: 0, limit: -1, remaining: -1 },
        monthly: { used: 0, limit: -1, remaining: -1 },
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // 并行查询每日和每月使用量
    const [dailyInteractions, monthInteractions] = await Promise.all([
      prisma.aIInteraction.findMany({
        where: {
          userId: userId,
          createdAt: { gte: today },
          success: true,
        } as Prisma.AIInteractionFindManyArgs['where'],
        select: { id: true },
      }),
      prisma.aIInteraction.findMany({
        where: {
          userId: userId,
          createdAt: { gte: monthStart },
          success: true,
        } as Prisma.AIInteractionFindManyArgs['where'],
        select: { id: true },
      }),
    ]);

    const dailyUsed = dailyInteractions.length;
    const monthlyUsed = monthInteractions.length;

    return {
      daily: {
        used: dailyUsed,
        limit: config.dailyLimit,
        remaining: Math.max(0, config.dailyLimit - dailyUsed),
      },
      monthly: {
        used: monthlyUsed,
        limit: config.monthlyLimit,
        remaining: Math.max(0, config.monthlyLimit - monthlyUsed),
      },
    };
  } catch (error) {
    console.error('获取用户配额使用情况失败:', error);
    throw new Error('获取配额使用情况失败');
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 检查用户是否有管理员权限（无配额限制）
 */
export function hasUnlimitedQuota(role: string): boolean {
  const config = getUserQuotaConfig(role);
  return config.dailyLimit === -1;
}

/**
 * 计算配额使用百分比
 */
export function calculateQuotaPercentage(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

/**
 * 获取配额状态描述
 */
export function getQuotaStatusMessage(
  percentage: number
): 'low' | 'medium' | 'high' | 'exceeded' {
  if (percentage >= 100) return 'exceeded';
  if (percentage >= 80) return 'high';
  if (percentage >= 50) return 'medium';
  return 'low';
}
