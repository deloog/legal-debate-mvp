/**
 * 使用量限制检查中间件
 * 用于在API请求前检查用户使用量是否超过限制
 */

import { logger } from '@/lib/logger';
import type { UsageType } from '@/types/membership';
import type { NextRequest, NextResponse } from 'next/server';
import { checkUsageLimit, recordUsage } from '../usage/record-usage';
import { getAuthUser } from './auth';

// =============================================================================
// 使用量限制检查结果
// =============================================================================

/**
 * 使用量限制检查结果
 */
export interface UsageLimitCheckResult {
  allowed: boolean;
  currentUsage: number;
  limit: number | null;
  remaining: number | null;
  reason?: string;
}

// =============================================================================
// 使用量限制检查函数
// =============================================================================

/**
 * 检查用户使用量限制
 * @param request NextRequest对象
 * @param usageType 使用量类型
 * @param quantity 要增加的数量（默认1）
 * @returns 检查结果
 */
export async function checkUsageLimitForRequest(
  request: NextRequest,
  usageType: UsageType,
  quantity: number = 1
): Promise<UsageLimitCheckResult> {
  try {
    // 获取认证用户
    const user = await getAuthUser(request);

    if (!user) {
      return {
        allowed: false,
        currentUsage: 0,
        limit: null,
        remaining: null,
        reason: '未认证',
      };
    }

    // 检查使用量限制
    const limitCheck = await checkUsageLimit(user.userId, usageType, quantity);

    if (limitCheck.exceeded) {
      return {
        allowed: false,
        currentUsage: limitCheck.currentUsage,
        limit: limitCheck.limit,
        remaining: 0,
        reason: '使用量已超过限制',
      };
    }

    return {
      allowed: true,
      currentUsage: limitCheck.currentUsage,
      limit: limitCheck.limit,
      remaining: limitCheck.remaining,
    };
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`[checkUsageLimitForRequest] 检查失败: ${error.message}`);
      return {
        allowed: false,
        currentUsage: 0,
        limit: null,
        remaining: null,
        reason: `检查使用量限制失败: ${error.message}`,
      };
    }
    logger.error('[checkUsageLimitForRequest] 检查失败: 未知错误');
    return {
      allowed: false,
      currentUsage: 0,
      limit: null,
      remaining: null,
      reason: '检查使用量限制失败: 未知错误',
    };
  }
}

// =============================================================================
// 使用量限制检查中间件
// =============================================================================

/**
 * 创建使用量限制检查中间件
 * @param usageType 使用量类型
 * @param quantity 要增加的数量（默认1）
 * @param recordAfterCheck 是否在检查通过后自动记录使用量（默认false）
 * @returns 中间件函数
 */
export function enforceUsageLimit(
  usageType: UsageType,
  quantity: number = 1,
  recordAfterCheck: boolean = false
) {
  return async function (
    request: NextRequest,
    userId?: string
  ): Promise<NextResponse | null> {
    // 如果传入了userId，直接使用，否则从请求中获取
    const targetUserId = userId ?? (await getAuthUser(request))?.userId;

    if (!targetUserId) {
      return Response.json(
        {
          error: '未认证',
          message: '请先登录',
        },
        { status: 401 }
      ) as unknown as NextResponse;
    }

    // 检查使用量限制
    const limitCheck = await checkUsageLimit(targetUserId, usageType, quantity);

    if (limitCheck.exceeded) {
      return Response.json(
        {
          error: '使用量已超过限制',
          message: `您已超过${getUsageTypeName(usageType)}的使用限制`,
          usageType,
          currentUsage: limitCheck.currentUsage,
          limit: limitCheck.limit,
          remaining: 0,
        },
        { status: 429 }
      ) as unknown as NextResponse;
    }

    // 如果需要在检查通过后自动记录使用量
    if (recordAfterCheck) {
      try {
        await recordUsage({
          userId: targetUserId,
          usageType,
          quantity,
        });
      } catch (error) {
        logger.error(`[enforceUsageLimit] 记录使用量失败: ${error}`);
        // 记录失败不影响请求继续
      }
    }

    // 检查通过，返回null继续执行
    return null;
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取使用量类型的中文名称
 * @param usageType 使用量类型
 * @returns 中文名称
 */
function getUsageTypeName(usageType: UsageType): string {
  const names: Record<UsageType, string> = {
    CASE_CREATED: '案件创建',
    DEBATE_GENERATED: '辩论生成',
    DOCUMENT_ANALYZED: '文档分析',
    LAW_ARTICLE_SEARCHED: '法条搜索',
    AI_TOKEN_USED: 'AI令牌',
    STORAGE_USED: '存储空间',
  };
  return names[usageType] ?? usageType;
}

/**
 * 创建使用量限制错误响应
 * @param usageType 使用量类型
 * @param limitCheck 限制检查结果
 * @returns 429错误响应
 */
export function createUsageLimitErrorResponse(
  usageType: UsageType,
  limitCheck: {
    currentUsage: number;
    limit: number | null;
    remaining: number | null;
  }
): NextResponse {
  return Response.json(
    {
      error: '使用量已超过限制',
      message: `您已超过${getUsageTypeName(usageType)}的使用限制`,
      usageType,
      currentUsage: limitCheck.currentUsage,
      limit: limitCheck.limit,
      remaining: limitCheck.remaining ?? 0,
    },
    { status: 429 }
  ) as unknown as NextResponse;
}

/**
 * 简化的使用量检查函数
 * @param request NextRequest对象
 * @param usageType 使用量类型
 * @param quantity 要增加的数量（默认1）
 * @returns NextResponse或null
 */
export async function validateUsageLimit(
  request: NextRequest,
  usageType: UsageType,
  quantity: number = 1
): Promise<NextResponse | null> {
  const middleware = enforceUsageLimit(usageType, quantity, false);
  return middleware(request);
}

/**
 * 检查并记录使用量
 * @param request NextRequest对象
 * @param usageType 使用量类型
 * @param quantity 要增加的数量（默认1）
 * @param resourceId 关联的资源ID
 * @param resourceType 资源类型
 * @returns NextResponse或null
 */
export async function checkAndRecordUsage(
  request: NextRequest,
  usageType: UsageType,
  quantity: number = 1,
  resourceId?: string,
  resourceType?: string
): Promise<NextResponse | null> {
  // 获取用户
  const user = await getAuthUser(request);

  if (!user) {
    return Response.json(
      {
        error: '未认证',
        message: '请先登录',
      },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查使用量限制
  const limitCheck = await checkUsageLimit(user.userId, usageType, quantity);

  if (limitCheck.exceeded) {
    return createUsageLimitErrorResponse(usageType, limitCheck);
  }

  // 记录使用量
  try {
    await recordUsage({
      userId: user.userId,
      usageType,
      quantity,
      resourceId,
      resourceType,
    });
  } catch (error) {
    logger.error(`[checkAndRecordUsage] 记录使用量失败: ${error}`);
    // 记录失败不影响请求继续
  }

  return null;
}
