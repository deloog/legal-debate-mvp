/**
 * AI配额管理系统
 * 用于控制用户AI调用次数，防止成本失控
 */

import { prisma } from '@/lib/db/prisma';
import { MembershipStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getNumberConfig } from '@/lib/config/system-config';

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

export interface EffectiveQuotaIdentity {
  role: string;
  quotaKey: string;
  source: 'role' | 'membership';
}

// =============================================================================
// 配额配置
// =============================================================================

/**
 * 不同角色的默认配额配置
 */
const DEFAULT_QUOTA_CONFIGS: Record<string, QuotaConfig> = {
  USER: {
    dailyLimit: 10,
    monthlyLimit: 100,
    perRequestLimit: 1000,
  },
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

const quotaConfigCache = new Map<string, QuotaConfig>();

/**
 * 从系统配置读取配额配置
 */
async function loadQuotaConfig(role: string): Promise<QuotaConfig> {
  const normalizedRole = role.toUpperCase();

  if (quotaConfigCache.has(normalizedRole)) {
    return quotaConfigCache.get(normalizedRole)!;
  }

  const defaults =
    DEFAULT_QUOTA_CONFIGS[normalizedRole] ?? DEFAULT_QUOTA_CONFIGS.FREE;

  const config = await (async (): Promise<QuotaConfig> => {
    if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN') {
      return {
        dailyLimit: -1,
        monthlyLimit: -1,
        perRequestLimit: -1,
      };
    }

    const monthlyKeyMap: Record<string, string> = {
      USER: 'business.ai_quota_free_monthly',
      FREE: 'business.ai_quota_free_monthly',
      BASIC: 'business.ai_quota_basic_monthly',
      PROFESSIONAL: 'business.ai_quota_professional_monthly',
      ENTERPRISE: 'business.ai_quota_enterprise_monthly',
      LAWYER: 'business.ai_quota_lawyer_monthly',
    };

    const monthlyLimitKey = monthlyKeyMap[normalizedRole];
    const monthlyLimit = monthlyLimitKey
      ? await getNumberConfig(monthlyLimitKey, defaults.monthlyLimit)
      : defaults.monthlyLimit;

    const perRequestLimit = await getNumberConfig(
      `business.ai_quota_${normalizedRole.toLowerCase()}_per_request`,
      defaults.perRequestLimit
    );

    const dailyLimit = await getNumberConfig(
      `business.ai_quota_${normalizedRole.toLowerCase()}_daily`,
      defaults.dailyLimit
    );

    return {
      dailyLimit,
      monthlyLimit,
      perRequestLimit,
    };
  })();

  quotaConfigCache.set(normalizedRole, config);
  return config;
}

/**
 * 解析用户当前真正生效的配额身份：
 * - 管理员/超管：直接按角色
 * - 其他用户：优先按活跃会员等级；若无活跃会员，则按角色兜底
 */
export async function getEffectiveQuotaIdentity(
  userId: string,
  role: string
): Promise<EffectiveQuotaIdentity> {
  const normalizedRole = role.toUpperCase();

  if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPER_ADMIN') {
    return {
      role: normalizedRole,
      quotaKey: normalizedRole,
      source: 'role',
    };
  }

  const membershipModel = (
    prisma as typeof prisma & {
      userMembership?: {
        findFirst: (args: unknown) => Promise<{
          tier?: { tier?: string | null } | null;
        } | null>;
      };
    }
  ).userMembership;

  const activeMembership = membershipModel?.findFirst
    ? await membershipModel.findFirst({
        where: {
          userId,
          status: MembershipStatus.ACTIVE,
          endDate: {
            gt: new Date(),
          },
        },
        orderBy: {
          endDate: 'desc',
        },
        select: {
          tier: {
            select: {
              tier: true,
            },
          },
        },
      })
    : null;

  const membershipTier = activeMembership?.tier?.tier?.toUpperCase();
  if (membershipTier && DEFAULT_QUOTA_CONFIGS[membershipTier]) {
    return {
      role: normalizedRole,
      quotaKey: membershipTier,
      source: 'membership',
    };
  }

  const fallbackQuotaKey = normalizedRole === 'USER' ? 'FREE' : normalizedRole;

  return {
    role: normalizedRole,
    quotaKey: fallbackQuotaKey,
    source: 'role',
  };
}

/**
 * 获取用户配额配置（兼容同步调用场景）
 *
 * 注意：如果需要读取数据库系统配置，请使用 `getUserQuotaConfigAsync()`
 */
export function getUserQuotaConfig(role: string): QuotaConfig {
  return (
    DEFAULT_QUOTA_CONFIGS[role.toUpperCase()] || DEFAULT_QUOTA_CONFIGS.FREE
  );
}

/**
 * 读取用户配额配置（优先系统配置）
 */
export async function getUserQuotaConfigAsync(
  role: string
): Promise<QuotaConfig> {
  return loadQuotaConfig(role);
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
    const identity = await getEffectiveQuotaIdentity(userId, role);
    const config = await loadQuotaConfig(identity.quotaKey);

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

    const dailyUsed = await prisma.aIInteraction.count({
      where: {
        userId: userId,
        createdAt: { gte: today },
        success: true,
      } as Prisma.AIInteractionWhereInput,
    });

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

    const monthlyUsed = await prisma.aIInteraction.count({
      where: {
        userId: userId,
        createdAt: { gte: monthStart },
        success: true,
      } as Prisma.AIInteractionWhereInput,
    });

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
    logger.error('检查AI配额失败:', error);
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
    logger.error('记录AI使用失败:', error);
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
    const identity = await getEffectiveQuotaIdentity(userId, role);
    const config = await loadQuotaConfig(identity.quotaKey);

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
    const [dailyUsed, monthlyUsed] = await Promise.all([
      prisma.aIInteraction.count({
        where: {
          userId: userId,
          createdAt: { gte: today },
          success: true,
        } as Prisma.AIInteractionWhereInput,
      }),
      prisma.aIInteraction.count({
        where: {
          userId: userId,
          createdAt: { gte: monthStart },
          success: true,
        } as Prisma.AIInteractionWhereInput,
      }),
    ]);

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
    logger.error('获取用户配额使用情况失败:', error);
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
  const config =
    DEFAULT_QUOTA_CONFIGS[role.toUpperCase()] || DEFAULT_QUOTA_CONFIGS.FREE;
  return config.dailyLimit === -1;
}

/**
 * 异步判断用户是否有无限配额
 */
export async function hasUnlimitedQuotaAsync(role: string): Promise<boolean> {
  const config = await loadQuotaConfig(role);
  return config.dailyLimit === -1;
}

/**
 * 清除配额配置缓存（管理员更新系统配置后可调用）
 */
export function clearQuotaConfigCache(): void {
  quotaConfigCache.clear();
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
