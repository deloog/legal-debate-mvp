/**
 * 使用量记录模块
 * 用于记录和查询用户的使用量
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import type { UsageStats, UsageType } from '@/types/membership';
import { LimitType, MembershipStatus } from '@prisma/client';

// =============================================================================
// 使用量记录接口
// =============================================================================

/**
 * 使用量记录参数
 */
export interface RecordUsageParams {
  userId: string;
  usageType: UsageType;
  quantity: number;
  unit?: string;
  resourceId?: string;
  resourceType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// 核心函数
// =============================================================================

/**
 * 记录用户使用量
 * @param params 使用量记录参数
 * @returns 使用量记录ID
 * @throws Error 如果记录失败
 */
export async function recordUsage(params: RecordUsageParams): Promise<string> {
  const {
    userId,
    usageType,
    quantity,
    unit = 'count',
    resourceId,
    resourceType,
    description,
    metadata,
  } = params;

  try {
    // 获取用户当前活跃会员
    const activeMembership = await prisma.userMembership.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        endDate: {
          gte: new Date(),
        },
      },
      include: {
        tier: true,
      },
      orderBy: {
        endDate: 'desc',
      },
    });

    if (!activeMembership) {
      throw new Error('用户没有活跃的会员');
    }

    // 计算月度周期
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    // 记录使用量
    const usageRecord = await prisma.usageRecord.create({
      data: {
        userId,
        membershipId: activeMembership.id,
        usageType,
        quantity,
        unit,
        resourceId,
        resourceType,
        description,
        metadata: metadata as never,
        periodStart,
        periodEnd,
      },
    });

    return usageRecord.id;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[recordUsage] 记录使用量失败: ${error.message}`);
      throw new Error(`记录使用量失败: ${error.message}`);
    }
    logger.error('[recordUsage] 记录使用量失败: 未知错误');
    throw new Error('记录使用量失败: 未知错误');
  }
}

/**
 * 批量记录使用量
 * @param records 使用量记录数组
 * @returns 成功记录的数量
 * @throws Error 如果批量记录失败
 */
export async function batchRecordUsage(
  records: RecordUsageParams[]
): Promise<number> {
  try {
    const results = await Promise.all(
      records.map(record => recordUsage(record))
    );
    return results.length;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[batchRecordUsage] 批量记录失败: ${error.message}`);
      throw new Error(`批量记录失败: ${error.message}`);
    }
    logger.error('[batchRecordUsage] 批量记录失败: 未知错误');
    throw new Error('批量记录失败: 未知错误');
  }
}

/**
 * 获取用户使用量统计
 * @param userId 用户ID
 * @param periodStart 周期开始时间（可选）
 * @param periodEnd 周期结束时间（可选）
 * @returns 使用量统计
 * @throws Error 如果查询失败
 */
export async function getUsageStats(
  userId: string,
  periodStart?: Date,
  periodEnd?: Date
): Promise<UsageStats> {
  try {
    // 如果没有指定周期，使用当前月度
    const now = new Date();
    const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const end =
      periodEnd ??
      new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // 获取用户当前会员
    const activeMembership = await prisma.userMembership.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        endDate: {
          gte: new Date(),
        },
      },
      include: {
        tier: {
          include: {
            tierLimits: true,
          },
        },
      },
      orderBy: {
        endDate: 'desc',
      },
    });

    if (!activeMembership) {
      throw new Error('用户没有活跃的会员');
    }

    // 查询使用量记录
    const usageRecords = await prisma.usageRecord.findMany({
      where: {
        userId,
        periodStart: {
          gte: start,
        },
        periodEnd: {
          lte: end,
        },
      },
    });

    // 统计各类型使用量
    const stats = {
      casesCreated: 0,
      debatesGenerated: 0,
      documentsAnalyzed: 0,
      lawArticleSearches: 0,
      aiTokensUsed: 0,
      storageUsedMB: 0,
    };

    for (const record of usageRecords) {
      switch (record.usageType) {
        case 'CASE_CREATED':
          stats.casesCreated += record.quantity;
          break;
        case 'DEBATE_GENERATED':
          stats.debatesGenerated += record.quantity;
          break;
        case 'DOCUMENT_ANALYZED':
          stats.documentsAnalyzed += record.quantity;
          break;
        case 'LAW_ARTICLE_SEARCHED':
          stats.lawArticleSearches += record.quantity;
          break;
        case 'AI_TOKEN_USED':
          stats.aiTokensUsed += record.quantity;
          break;
        case 'STORAGE_USED':
          stats.storageUsedMB += record.quantity;
          break;
      }
    }

    // 获取限制配置
    const limits: Record<LimitType, number | null> = {
      MAX_CASES: null,
      MAX_DEBATES: null,
      MAX_DOCUMENTS: null,
      MAX_AI_TOKENS_MONTHLY: null,
      MAX_STORAGE_MB: null,
      MAX_LAW_ARTICLE_SEARCHES: null,
      MAX_CONCURRENT_REQUESTS: null,
    };

    for (const limit of activeMembership.tier.tierLimits) {
      limits[limit.limitType] = limit.limitValue;
    }

    // 计算剩余额度
    // null: 无限制（Infinity）, 0: 禁用（0）, 正数: 有限制
    const remaining = {
      cases:
        limits.MAX_CASES === null
          ? Infinity
          : Math.max(0, limits.MAX_CASES - stats.casesCreated),
      debates:
        limits.MAX_DEBATES === null
          ? Infinity
          : Math.max(0, limits.MAX_DEBATES - stats.debatesGenerated),
      documents:
        limits.MAX_DOCUMENTS === null
          ? Infinity
          : Math.max(0, limits.MAX_DOCUMENTS - stats.documentsAnalyzed),
      lawArticleSearches:
        limits.MAX_LAW_ARTICLE_SEARCHES === null
          ? Infinity
          : Math.max(
              0,
              limits.MAX_LAW_ARTICLE_SEARCHES - stats.lawArticleSearches
            ),
      aiTokens:
        limits.MAX_AI_TOKENS_MONTHLY === null
          ? Infinity
          : Math.max(0, limits.MAX_AI_TOKENS_MONTHLY - stats.aiTokensUsed),
      storageMB:
        limits.MAX_STORAGE_MB === null
          ? Infinity
          : Math.max(0, limits.MAX_STORAGE_MB - stats.storageUsedMB),
    };

    return {
      // 基础字段（兼容旧接口）
      used:
        stats.casesCreated + stats.debatesGenerated + stats.documentsAnalyzed,
      limit: limits.MAX_CASES ?? 0,
      resetAt: end,
      // 扩展字段
      userId,
      periodStart: start,
      periodEnd: end,
      casesCreated: stats.casesCreated,
      debatesGenerated: stats.debatesGenerated,
      documentsAnalyzed: stats.documentsAnalyzed,
      lawArticleSearches: stats.lawArticleSearches,
      aiTokensUsed: stats.aiTokensUsed,
      storageUsedMB: stats.storageUsedMB,
      limits: {
        MAX_CASES: limits.MAX_CASES ?? undefined,
        MAX_DEBATES: limits.MAX_DEBATES ?? undefined,
        MAX_DOCUMENTS: limits.MAX_DOCUMENTS ?? undefined,
        MAX_AI_TOKENS_MONTHLY: limits.MAX_AI_TOKENS_MONTHLY ?? undefined,
        MAX_STORAGE_MB: limits.MAX_STORAGE_MB ?? undefined,
        MAX_LAW_ARTICLE_SEARCHES: limits.MAX_LAW_ARTICLE_SEARCHES ?? undefined,
        MAX_CONCURRENT_REQUESTS: limits.MAX_CONCURRENT_REQUESTS ?? undefined,
      },
      remaining,
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[getUsageStats] 获取使用量统计失败: ${error.message}`);
      throw error;
    }
    logger.error('[getUsageStats] 获取使用量统计失败: 未知错误');
    throw new Error('获取使用量统计失败: 未知错误');
  }
}

/**
 * 检查用户使用量是否超过限制
 * @param userId 用户ID
 * @param usageType 使用量类型
 * @param quantity 要增加的数量（默认1）
 * @returns 是否超过限制及详细信息
 * @throws Error 如果检查失败
 */
export async function checkUsageLimit(
  userId: string,
  usageType: UsageType,
  quantity: number = 1
): Promise<{
  exceeded: boolean;
  currentUsage: number;
  limit: number | null;
  remaining: number | null;
}> {
  try {
    // 获取用户使用量统计
    const stats = await getUsageStats(userId);

    // 根据使用量类型获取限制
    let limit: number | null = null;
    let currentUsage = 0;

    switch (usageType) {
      case 'CASE_CREATED':
        limit = stats.limits?.MAX_CASES ?? null;
        currentUsage = stats.casesCreated ?? 0;
        break;
      case 'DEBATE_GENERATED':
        limit = stats.limits?.MAX_DEBATES ?? null;
        currentUsage = stats.debatesGenerated ?? 0;
        break;
      case 'DOCUMENT_ANALYZED':
        limit = stats.limits?.MAX_DOCUMENTS ?? null;
        currentUsage = stats.documentsAnalyzed ?? 0;
        break;
      case 'LAW_ARTICLE_SEARCHED':
        limit = stats.limits?.MAX_LAW_ARTICLE_SEARCHES ?? null;
        currentUsage = stats.lawArticleSearches ?? 0;
        break;
      case 'AI_TOKEN_USED':
        limit = stats.limits?.MAX_AI_TOKENS_MONTHLY ?? null;
        currentUsage = stats.aiTokensUsed ?? 0;
        break;
      case 'STORAGE_USED':
        limit = stats.limits?.MAX_STORAGE_MB ?? null;
        currentUsage = stats.storageUsedMB ?? 0;
        break;
    }

    // 如果没有限制，则未超过
    if (limit === null) {
      return {
        exceeded: false,
        currentUsage,
        limit: null,
        remaining: null,
      };
    }

    const newUsage = currentUsage + quantity;
    const remaining = Math.max(0, limit - newUsage);
    const exceeded = newUsage > limit;

    return {
      exceeded,
      currentUsage,
      limit,
      remaining: exceeded ? 0 : remaining,
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[checkUsageLimit] 检查使用量限制失败: ${error.message}`);
      throw error;
    }
    logger.error('[checkUsageLimit] 检查使用量限制失败: 未知错误');
    throw new Error('检查使用量限制失败: 未知错误');
  }
}
