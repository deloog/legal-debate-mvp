/**
 * 当前会员信息查询 API
 * 提供当前用户的会员信息、使用量统计和升级选项
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUsageStats } from '@/lib/usage/record-usage';
import { MembershipStatus } from '@prisma/client';
import type { MembershipTier } from '@/types/membership';
import { logger } from '@/lib/logger';

// =============================================================================
// GET /api/memberships/me - 查询当前会员信息
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // 获取认证用户
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return Response.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 查询用户当前会员信息
    const currentMembership = await prisma.userMembership.findFirst({
      where: {
        userId: authUser.userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        tier: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
      },
      orderBy: {
        endDate: 'desc',
      },
    });

    // 获取使用量统计（如果用户没有活跃会员，使用默认值）
    let usageStats;
    try {
      usageStats = await getUsageStats(authUser.userId);
    } catch (error) {
      // 如果用户没有活跃会员，使用默认的使用量统计
      if (error instanceof Error && error.message.includes('没有活跃的会员')) {
        usageStats = {
          userId: authUser.userId,
          periodStart: new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1
          ),
          periodEnd: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
            23,
            59,
            59
          ),
          casesCreated: 0,
          debatesGenerated: 0,
          documentsAnalyzed: 0,
          lawArticleSearches: 0,
          aiTokensUsed: 0,
          storageUsedMB: 0,
          limits: {
            tier: 'FREE' as unknown as MembershipTier,
            limits: {
              MAX_CASES: null,
              MAX_DEBATES: null,
              MAX_DOCUMENTS: null,
              MAX_AI_TOKENS_MONTHLY: null,
              MAX_STORAGE_MB: null,
              MAX_LAW_ARTICLE_SEARCHES: null,
              MAX_CONCURRENT_REQUESTS: null,
            },
          },
          remaining: {
            cases: Infinity,
            debates: Infinity,
            documents: Infinity,
            lawArticleSearches: Infinity,
            aiTokens: Infinity,
            storageMB: Infinity,
          },
        };
      } else {
        throw error;
      }
    }

    // 查询所有可用的会员等级
    const availableTiers = await prisma.membershipTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });

    // 计算升级选项
    const { canUpgrade, upgradeOptions } = calculateUpgradeOptions(
      currentMembership,
      availableTiers
    );

    // 返回成功响应
    return Response.json(
      {
        success: true,
        message: '查询成功',
        data: {
          currentMembership: currentMembership
            ? {
                id: currentMembership.id,
                userId: currentMembership.userId,
                tierId: currentMembership.tierId,
                tier: currentMembership.tier.tier,
                tierName: currentMembership.tier.displayName,
                status: currentMembership.status,
                startDate: currentMembership.startDate,
                endDate: currentMembership.endDate,
                autoRenew: currentMembership.autoRenew,
                price: Number(currentMembership.tier.price),
                currency: currentMembership.tier.currency,
                billingCycle: currentMembership.tier.billingCycle,
                features: currentMembership.tier.features,
                permissions: currentMembership.tier.permissions,
              }
            : null,
          usageStats,
          availableTiers,
          canUpgrade,
          upgradeOptions,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[GET /api/memberships/me] 查询失败:', error);

    return Response.json(
      {
        success: false,
        message: '查询失败，请稍后重试',
        error: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS /api/memberships/me - CORS预检
// =============================================================================

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 计算升级选项
 */
function calculateUpgradeOptions(
  currentMembership: unknown,
  availableTiers: unknown[]
): {
  canUpgrade: boolean;
  upgradeOptions: Array<{
    tier: unknown;
    price: number;
    savings?: number;
  }>;
} {
  // 定义等级顺序
  const tierOrder: Record<MembershipTier, number> = {
    FREE: 1,
    BASIC: 2,
    PROFESSIONAL: 3,
    ENTERPRISE: 4,
  };

  // 获取当前等级
  let currentTierLevel = 0;
  if (
    currentMembership &&
    typeof currentMembership === 'object' &&
    'tier' in currentMembership &&
    currentMembership.tier &&
    typeof currentMembership.tier === 'object' &&
    'tier' in currentMembership.tier
  ) {
    const tierValue = currentMembership.tier.tier as MembershipTier;
    currentTierLevel = tierOrder[tierValue] || 0;
  }

  // 筛选可升级的等级
  const higherTiers = availableTiers
    .filter((tier): tier is Record<string, unknown> => {
      if (typeof tier !== 'object' || tier === null) {
        return false;
      }
      const tierObj = tier as Record<string, unknown>;
      const tierValue = tierObj.tier as MembershipTier;
      const tierLevel = tierOrder[tierValue] || 0;
      return tierLevel > currentTierLevel;
    })
    .map(option => {
      const tierObj = option as Record<string, unknown>;
      return {
        tier: option,
        price: typeof tierObj.price === 'number' ? tierObj.price : 0,
      };
    });

  // 检查是否可以升级
  const canUpgrade = higherTiers.length > 0;

  // 计算节省金额（如果有年付选项）
  const upgradeOptions = higherTiers.map(option => {
    const savings = calculateSavings(option.price, currentMembership);
    return {
      tier: option.tier,
      price: option.price,
      savings,
    };
  });

  return {
    canUpgrade,
    upgradeOptions,
  };
}

/**
 * 计算节省金额
 */
function calculateSavings(
  newPrice: number,
  currentMembership: unknown
): number | undefined {
  // 如果没有当前会员，返回undefined
  if (
    !currentMembership ||
    typeof currentMembership !== 'object' ||
    !('tier' in currentMembership)
  ) {
    return undefined;
  }

  // 计算节省金额
  const membership = currentMembership as Record<string, unknown>;
  if (
    membership.tier &&
    typeof membership.tier === 'object' &&
    'price' in membership.tier &&
    typeof membership.tier.price === 'number'
  ) {
    const currentPrice = membership.tier.price;
    return currentPrice - newPrice;
  }

  return undefined;
}
