/**
 * 会员等级列表 API
 * 提供所有可用会员等级的查询和对比功能
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { MembershipTier } from '@/types/membership';
import { logger } from '@/lib/logger';

// =============================================================================
// GET /api/memberships/tiers - 查询会员等级列表
// =============================================================================

export async function GET(request: NextRequest): Promise<Response> {
  try {
    // 获取认证用户（可选，用于显示当前等级）
    const authUser = await getAuthUser(request);
    let currentTier: MembershipTier | null = null;

    if (authUser) {
      // 查询用户当前会员信息
      const currentMembership = await prisma.userMembership.findFirst({
        where: {
          userId: authUser.userId,
          status: 'ACTIVE',
        },
        include: {
          tier: true,
        },
        orderBy: {
          endDate: 'desc',
        },
      });

      if (currentMembership) {
        currentTier = currentMembership.tier.tier as MembershipTier;
      }
    }

    // 查询所有可用的会员等级
    const tiers = await prisma.membershipTier.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        tierLimits: {
          orderBy: {
            limitType: 'asc',
          },
        },
      },
    });

    // 生成功能对比矩阵
    const comparison = generateFeatureComparison(tiers);

    // 返回成功响应
    return Response.json(
      {
        success: true,
        message: '查询成功',
        data: {
          tiers,
          currentTier,
          comparison,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[GET /api/memberships/tiers] 查询失败:', error);

    return Response.json(
      {
        success: false,
        message: '查询失败，请稍后重试',
        error: error instanceof Error ? error.message : 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// OPTIONS /api/memberships/tiers - CORS预检
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
 * 生成功能对比矩阵
 */
function generateFeatureComparison(tiers: unknown[]): Array<{
  feature: string;
  free: boolean | string;
  basic: boolean | string;
  professional: boolean | string;
  enterprise: boolean | string;
}> {
  // 基础功能列表
  const features = [
    '案件创建',
    '文档分析',
    '法条搜索',
    '辩论生成',
    '数据导出',
    '批量处理',
    '自定义模型',
    'API访问',
  ];

  // 为每个功能生成对比行
  return features.map(feature => ({
    feature,
    free: getFeatureStatus(tiers, 'FREE' as MembershipTier, feature),
    basic: getFeatureStatus(tiers, 'BASIC' as MembershipTier, feature),
    professional: getFeatureStatus(
      tiers,
      'PROFESSIONAL' as MembershipTier,
      feature
    ),
    enterprise: getFeatureStatus(
      tiers,
      'ENTERPRISE' as MembershipTier,
      feature
    ),
  }));
}

/**
 * 获取功能状态
 */
function getFeatureStatus(
  tiers: unknown[],
  tierType: MembershipTier,
  feature: string
): boolean | string {
  // 查找指定等级
  const tier = tiers.find((t): t is Record<string, unknown> => {
    if (typeof t !== 'object' || t === null) {
      return false;
    }
    const tierObj = t as Record<string, unknown>;
    return tierObj.tier === String(tierType);
  });

  if (!tier || typeof tier !== 'object') {
    return false;
  }

  // 检查功能是否在features中
  if (
    'features' in tier &&
    Array.isArray(tier.features) &&
    tier.features.includes(feature)
  ) {
    return true;
  }

  return false;
}
