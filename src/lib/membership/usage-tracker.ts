/**
 * 使用量追踪模块
 * 整合使用量记录、统计、限制检查逻辑
 * 从 src/lib/usage/record-usage.ts 迁移并重构
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { MembershipStatus, LimitType } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

export type UsageType =
  | 'CASE_CREATED'
  | 'DEBATE_GENERATED'
  | 'DOCUMENT_ANALYZED'
  | 'LAW_ARTICLE_SEARCHED'
  | 'AI_TOKEN_USED'
  | 'STORAGE_USED';

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

export interface UsageStats {
  // 基础统计
  casesCreated: number;
  debatesGenerated: number;
  documentsAnalyzed: number;
  lawArticleSearches: number;
  aiTokensUsed: number;
  storageUsedMB: number;

  // 限制配置
  limits: {
    MAX_CASES?: number;
    MAX_DEBATES?: number;
    MAX_DOCUMENTS?: number;
    MAX_AI_TOKENS_MONTHLY?: number;
    MAX_STORAGE_MB?: number;
    MAX_LAW_ARTICLE_SEARCHES?: number;
    MAX_CONCURRENT_REQUESTS?: number;
  };

  // 剩余额度
  remaining: {
    cases: number | typeof Infinity;
    debates: number | typeof Infinity;
    documents: number | typeof Infinity;
    lawArticleSearches: number | typeof Infinity;
    aiTokens: number | typeof Infinity;
    storageMB: number | typeof Infinity;
  };

  // 时间范围
  periodStart: Date;
  periodEnd: Date;
}

export interface UsageHistoryOptions {
  page: number;
  pageSize: number;
  usageType?: UsageType;
  startDate?: Date;
  endDate?: Date;
}

// =============================================================================
// 常量定义
// =============================================================================

const USAGE_TYPE_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 500;
const MAX_QUANTITY = 1000000;
const MIN_QUANTITY = 1;

// =============================================================================
// 输入校验
// =============================================================================

/**
 * 校验使用量记录参数
 */
function validateRecordUsageParams(params: RecordUsageParams): void {
  // 校验 userId
  if (!params.userId || params.userId.trim() === '') {
    throw new Error('userId 不能为空');
  }

  // 校验 usageType
  if (!params.usageType || params.usageType.trim() === '') {
    throw new Error('usageType 不能为空');
  }
  if (params.usageType.length > USAGE_TYPE_MAX_LENGTH) {
    throw new Error(`usageType 超出最大长度 ${USAGE_TYPE_MAX_LENGTH}`);
  }

  // 校验 quantity
  if (
    typeof params.quantity !== 'number' ||
    isNaN(params.quantity) ||
    params.quantity < MIN_QUANTITY ||
    params.quantity > MAX_QUANTITY
  ) {
    throw new Error(`quantity 必须在 ${MIN_QUANTITY}-${MAX_QUANTITY} 之间`);
  }

  // 校验 description
  if (
    params.description &&
    params.description.length > DESCRIPTION_MAX_LENGTH
  ) {
    throw new Error(`description 超出最大长度 ${DESCRIPTION_MAX_LENGTH}`);
  }

  // 校验 resourceType
  if (
    params.resourceType &&
    params.resourceType.length > USAGE_TYPE_MAX_LENGTH
  ) {
    throw new Error(`resourceType 超出最大长度 ${USAGE_TYPE_MAX_LENGTH}`);
  }
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
  // 输入校验
  validateRecordUsageParams(params);

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

    logger.debug('[UsageTracker] 使用量记录成功:', {
      userId,
      usageType,
      quantity,
      recordId: usageRecord.id,
    });

    return usageRecord.id;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[UsageTracker] 记录使用量失败: ${error.message}`);
      throw new Error(`记录使用量失败: ${error.message}`);
    }
    logger.error('[UsageTracker] 记录使用量失败: 未知错误');
    throw new Error('记录使用量失败: 未知错误');
  }
}

/**
 * 批量记录使用量（优化版）
 * 使用 createMany 批量插入，避免 N+1 查询问题
 * @param records 使用量记录数组
 * @returns 成功记录的数量
 * @throws Error 如果批量记录失败
 */
export async function batchRecordUsage(
  records: Array<
    Omit<
      RecordUsageParams,
      'unit' | 'resourceId' | 'resourceType' | 'description' | 'metadata'
    > &
      Partial<
        Pick<
          RecordUsageParams,
          'unit' | 'resourceId' | 'resourceType' | 'description' | 'metadata'
        >
      >
  >
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  // 校验所有记录
  for (const record of records) {
    validateRecordUsageParams(record as RecordUsageParams);
  }

  try {
    // 提取所有用户ID并去重
    const userIds = [...new Set(records.map(r => r.userId))];

    // 一次性查询所有用户的活跃会员状态（避免 N+1）
    const memberships = await prisma.userMembership.findMany({
      where: {
        userId: { in: userIds },
        status: MembershipStatus.ACTIVE,
        endDate: {
          gte: new Date(),
        },
      },
      include: {
        tier: true,
      },
    });

    // 构建用户ID到会员的映射
    const membershipMap = new Map(memberships.map(m => [m.userId, m]));

    // 检查所有用户是否有活跃会员
    for (const userId of userIds) {
      if (!membershipMap.has(userId)) {
        throw new Error('用户没有活跃的会员');
      }
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

    // 构建批量插入数据
    const usageData = records.map(record => {
      const membership = membershipMap.get(record.userId)!;
      return {
        userId: record.userId,
        membershipId: membership.id,
        usageType: record.usageType,
        quantity: record.quantity,
        unit: record.unit || 'count',
        resourceId: record.resourceId || null,
        resourceType: record.resourceType || null,
        description: record.description || null,
        metadata: (record.metadata as never) || null,
        periodStart,
        periodEnd,
      };
    });

    // 使用 createMany 批量插入（性能优化）
    const result = await prisma.usageRecord.createMany({
      data: usageData,
      skipDuplicates: false,
    });

    logger.info('[UsageTracker] 批量记录使用量成功:', {
      count: result.count,
      userCount: userIds.length,
    });

    return result.count;
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[UsageTracker] 批量记录失败: ${error.message}`);
      throw new Error(`批量记录失败: ${error.message}`);
    }
    logger.error('[UsageTracker] 批量记录失败: 未知错误');
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
      ...stats,
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
      periodStart: start,
      periodEnd: end,
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[UsageTracker] 获取使用量统计失败: ${error.message}`);
      throw error;
    }
    logger.error('[UsageTracker] 获取使用量统计失败: 未知错误');
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
      logger.error(`[UsageTracker] 检查使用量限制失败: ${error.message}`);
      throw error;
    }
    logger.error('[UsageTracker] 检查使用量限制失败: 未知错误');
    throw new Error('检查使用量限制失败: 未知错误');
  }
}

/**
 * 获取用户使用历史
 * @param userId 用户ID
 * @param options 查询选项
 * @returns 使用量记录列表
 */
export async function getUsageHistory(
  userId: string,
  options: UsageHistoryOptions
): Promise<
  Array<{
    id: string;
    usageType: UsageType;
    quantity: number;
    unit: string;
    description: string | null;
    resourceId: string | null;
    resourceType: string | null;
    createdAt: Date;
  }>
> {
  const { page, pageSize, usageType, startDate, endDate } = options;

  const where: Record<string, unknown> = { userId };

  if (usageType) {
    where.usageType = usageType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.createdAt as Record<string, Date>).lte = endDate;
    }
  }

  const records = await prisma.usageRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: pageSize,
    skip: (page - 1) * pageSize,
  });

  return records.map(record => ({
    id: record.id,
    usageType: record.usageType as UsageType,
    quantity: record.quantity,
    unit: record.unit,
    description: record.description,
    resourceId: record.resourceId,
    resourceType: record.resourceType,
    createdAt: record.createdAt,
  }));
}

/**
 * 重置用户使用量
 * 用于测试或新周期开始
 * @param userId 用户ID
 * @param startDate 开始日期（可选，只删除指定范围内的记录）
 * @param endDate 结束日期（可选）
 * @returns 删除的记录数
 */
export async function resetUsagePeriod(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const where: Record<string, unknown> = { userId };

  if (startDate || endDate) {
    where.periodStart = {};
    where.periodEnd = {};

    if (startDate) {
      (where.periodStart as Record<string, Date>).gte = startDate;
    }
    if (endDate) {
      (where.periodEnd as Record<string, Date>).lte = endDate;
    }
  }

  const result = await prisma.usageRecord.deleteMany({ where });

  logger.info('[UsageTracker] 重置使用量记录:', {
    userId,
    deletedCount: result.count,
  });

  return result.count;
}
