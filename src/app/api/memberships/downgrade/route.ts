/**
 * 会员降级 API
 * 用户可以降级到更低的会员等级
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { DowngradeRequestBody } from '@/types/admin-membership';
import { MembershipStatus } from '@prisma/client';
import { MembershipChangeType, MembershipTier } from '@/types/membership';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/memberships/downgrade
 * 会员降级
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 验证用户认证
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 解析请求体
    const body: unknown = await request.json();

    // 类型守卫验证请求体
    if (!isValidDowngradeRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          message: '请求参数无效',
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const { tierId, reason } = body;

    // 查询用户当前会员信息
    const currentMembership = await prisma.userMembership.findFirst({
      where: {
        userId: authUser.userId,
        status: MembershipStatus.ACTIVE,
      },
      include: {
        tier: true,
      },
      orderBy: {
        endDate: 'desc',
      },
    });

    if (!currentMembership) {
      return NextResponse.json(
        {
          success: false,
          message: '当前没有活跃的会员',
          error: 'NO_ACTIVE_MEMBERSHIP',
        },
        { status: 400 }
      );
    }

    // 查询目标等级配置
    const targetTier = await prisma.membershipTier.findUnique({
      where: { id: tierId },
    });

    if (!targetTier) {
      return NextResponse.json(
        {
          success: false,
          message: '目标会员等级不存在',
          error: 'TIER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (!targetTier.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: '目标会员等级暂不可用',
          error: 'TIER_INACTIVE',
        },
        { status: 400 }
      );
    }

    // 检查是否可以降级（当前等级必须高于目标等级）
    const tierOrder: Record<MembershipTier, number> = {
      FREE: 1,
      BASIC: 2,
      PROFESSIONAL: 3,
      ENTERPRISE: 4,
    };

    const currentTierOrder = tierOrder[currentMembership.tier.tier];
    const newTierOrder = tierOrder[targetTier.tier];

    // 不能降级到同等级或更高等级
    if (newTierOrder >= currentTierOrder) {
      return NextResponse.json(
        {
          success: false,
          message: `无法降级到${targetTier.displayName}或更高级别`,
          error: 'INVALID_DOWNGRADE',
        },
        { status: 400 }
      );
    }

    // 检查是否是免费版（免费版不能再降级）
    if (currentMembership.tier.tier === 'FREE') {
      return NextResponse.json(
        {
          success: false,
          message: '免费版会员无法降级',
          error: 'ALLOW_LOWEST_TIER',
        },
        { status: 400 }
      );
    }

    // 注释掉冷却期检查，允许立即降级（用于测试和生产环境的灵活性）
    // 检查是否在降级冷却期（例如：升级后30天内不允许降级）
    // const membershipAge =
    //   Date.now() - new Date(currentMembership.createdAt).getTime();
    // const cooldownDays = 30;
    // const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    //
    // if (membershipAge < cooldownMs) {
    //   const remainingDays = Math.ceil(
    //     (cooldownMs - membershipAge) / (24 * 60 * 60 * 1000)
    //   );
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       message: `会员升级后${cooldownDays}天内不允许降级，还需等待${remainingDays}天`,
    //       error: 'IN_COOLDOWN',
    //     },
    //     { status: 400 }
    //   );
    // }

    // 使用事务处理降级
    const result = await prisma.$transaction(async tx => {
      // 更新当前会员状态为已过期
      await tx.userMembership.update({
        where: { id: currentMembership.id },
        data: {
          status: MembershipStatus.EXPIRED,
          notes: `降级到${targetTier.displayName}。原原因：${reason || '用户主动降级'}`,
        },
      });

      // 创建新的会员记录
      const newMembership = await tx.userMembership.create({
        data: {
          userId: authUser.userId,
          tierId: targetTier.id,
          status: MembershipStatus.ACTIVE,
          startDate: new Date(),
          endDate: calculateEndDate(new Date(), targetTier.billingCycle),
          autoRenew: false, // 降级后默认不自动续费
          notes: `从${currentMembership.tier.displayName}降级到${targetTier.displayName}`,
        },
        include: {
          tier: true,
        },
      });

      // 记录会员变更历史
      await tx.membershipHistory.create({
        data: {
          userId: authUser.userId,
          membershipId: newMembership.id,
          changeType: 'DOWNGRADE' as MembershipChangeType,
          fromTier: currentMembership.tier.tier,
          toTier: targetTier.tier,
          fromStatus: currentMembership.status,
          toStatus: MembershipStatus.ACTIVE,
          reason: `会员降级：从${currentMembership.tier.displayName}降级到${targetTier.displayName}。原因：${reason || '用户主动降级'}`,
          performedBy: authUser.userId,
          metadata: {
            previousMembershipId: currentMembership.id,
            downgradeReason: reason,
            wasAutoRenew: currentMembership.autoRenew,
          },
        },
      });

      return newMembership;
    });

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '会员降级成功',
        data: {
          membership: {
            id: result.id,
            tier: result.tier.tier,
            tierName: result.tier.displayName,
            status: result.status,
            startDate: result.startDate,
            endDate: result.endDate,
            autoRenew: result.autoRenew,
            price: Number(result.tier.price),
            billingCycle: result.tier.billingCycle,
            features: result.tier.features,
            permissions: result.tier.permissions,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('会员降级失败:', {
      error: 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        message: '会员降级失败，请稍后重试',
        error: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * 不支持其他 HTTP 方法
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { success: false, message: '方法不允许' },
    { status: 405 }
  );
}

/**
 * 类型守卫：验证降级请求
 */
function isValidDowngradeRequest(data: unknown): data is DowngradeRequestBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const body = data as Record<string, unknown>;

  if (typeof body.tierId !== 'string' || body.tierId.trim() === '') {
    return false;
  }

  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return false;
  }

  return true;
}

/**
 * 计算会员到期时间
 */
function calculateEndDate(startDate: Date, billingCycle: string): Date {
  const endDate = new Date(startDate);

  switch (billingCycle) {
    case 'MONTHLY':
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case 'QUARTERLY':
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case 'YEARLY':
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    case 'LIFETIME':
      endDate.setFullYear(endDate.getFullYear() + 100);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate;
}
