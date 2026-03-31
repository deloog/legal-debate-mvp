/**
 * 会员升级 API
 * 用户可以升级到更高级别的会员等级
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { UpgradeRequestBody } from '@/types/admin-membership';
import { MembershipStatus } from '@prisma/client';
import { MembershipChangeType, MembershipTier } from '@/types/membership';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/memberships/upgrade
 * 会员升级
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
    if (!isValidUpgradeRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          message: '请求参数无效',
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const {
      tierId,
      billingCycle = 'MONTHLY',
      autoRenew = false,
      orderId,
    } = body;

    // 查询用户当前会员信息（包括已过期的会员）
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

    logger.info('[UPGRADE] 当前会员信息:', {
      userId: authUser.userId,
      currentMembership: currentMembership
        ? {
            id: currentMembership.id,
            tier: currentMembership.tier.tier,
            status: currentMembership.status,
            endDate: currentMembership.endDate,
          }
        : null,
    });

    // 查询目标等级配置（需要先查询才能验证升级逻辑）
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

    // 付费套餐必须提供已完成支付的订单，防止绕过支付直接激活
    if (targetTier.tier !== 'FREE') {
      if (!orderId || typeof orderId !== 'string') {
        return NextResponse.json(
          {
            success: false,
            message: '付费会员升级需要提供有效的支付订单',
            error: 'ORDER_REQUIRED',
          },
          { status: 400 }
        );
      }
      const paidOrder = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: authUser.userId,
          membershipTierId: targetTier.id,
          status: 'PAID',
        },
        select: { id: true },
      });
      if (!paidOrder) {
        return NextResponse.json(
          {
            success: false,
            message: '未找到对应的已支付订单，请先完成支付',
            error: 'PAYMENT_REQUIRED',
          },
          { status: 402 }
        );
      }
    }

    // 定义等级顺序
    const tierOrder: Record<MembershipTier, number> = {
      FREE: 1,
      BASIC: 2,
      PROFESSIONAL: 3,
      ENTERPRISE: 4,
    };

    // 如果用户已有会员，需要检查是否可以升级
    if (currentMembership) {
      const currentTierOrder = tierOrder[currentMembership.tier.tier];
      const newTierOrder = tierOrder[targetTier.tier];

      // 不能升级到同等级或更低等级
      if (newTierOrder <= currentTierOrder) {
        return NextResponse.json(
          {
            success: false,
            message: `当前已是${currentMembership.tier.displayName}等级，无法升级到同等级或更低等级`,
            error: 'INVALID_UPGRADE',
          },
          { status: 400 }
        );
      }

      // 如果当前会员未到期，需要先结束当前会员
      if (new Date(currentMembership.endDate) > new Date()) {
        await prisma.userMembership.update({
          where: { id: currentMembership.id },
          data: {
            status: MembershipStatus.EXPIRED,
          },
        });
      }
    } else {
      // 用户没有活跃会员，检查目标等级是否为FREE
      if (targetTier.tier === 'FREE') {
        return NextResponse.json(
          {
            success: false,
            message: '免费版是默认等级，无需升级',
            error: 'INVALID_UPGRADE',
          },
          { status: 400 }
        );
      }
    }

    // 计算会员到期时间
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, billingCycle);

    logger.info('[UPGRADE] 准备创建会员:', {
      userId: authUser.userId,
      targetTier: targetTier.tier,
      startDate,
      endDate,
      billingCycle,
    });

    // 使用事务创建新会员记录
    const result = await prisma.$transaction(async tx => {
      // 创建新会员记录
      const newMembership = await tx.userMembership.create({
        data: {
          userId: authUser.userId,
          tierId: targetTier.id,
          status: MembershipStatus.ACTIVE,
          startDate,
          endDate,
          autoRenew,
          notes: `从${currentMembership?.tier.displayName || '无会员'}升级到${targetTier.displayName}`,
        },
        include: {
          tier: true,
        },
      });

      // 只有在有当前会员时才记录变更历史
      if (currentMembership) {
        await tx.membershipHistory.create({
          data: {
            userId: authUser.userId,
            membershipId: newMembership.id,
            changeType: 'UPGRADE' as MembershipChangeType,
            fromTier: currentMembership.tier.tier,
            toTier: targetTier.tier,
            fromStatus: currentMembership.status,
            toStatus: MembershipStatus.ACTIVE,
            reason: `会员升级：从${currentMembership.tier.displayName}升级到${targetTier.displayName}`,
            performedBy: authUser.userId,
            metadata: {
              billingCycle,
              autoRenew,
              price: Number(targetTier.price),
              previousMembershipId: currentMembership.id,
            },
          },
        });
      } else {
        // 没有当前会员时，记录为首次开通会员
        await tx.membershipHistory.create({
          data: {
            userId: authUser.userId,
            membershipId: newMembership.id,
            changeType: 'UPGRADE' as MembershipChangeType,
            fromTier: 'FREE' as MembershipTier,
            toTier: targetTier.tier,
            fromStatus: MembershipStatus.EXPIRED,
            toStatus: MembershipStatus.ACTIVE,
            reason: `首次开通会员：${targetTier.displayName}`,
            performedBy: authUser.userId,
            metadata: {
              billingCycle,
              autoRenew,
              price: Number(targetTier.price),
              isFirstMembership: true,
            },
          },
        });
      }

      return newMembership;
    });

    // 返回成功响应
    logger.info('[UPGRADE] 会员升级成功:', {
      membershipId: result.id,
      tier: result.tier.tier,
      status: result.status,
    });

    return NextResponse.json(
      {
        success: true,
        message: '会员升级成功',
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
          order: {
            id: result.id,
            amount: Number(result.tier.price),
            currency: result.tier.currency,
            paymentUrl: `/payment/${result.id}`, // 预留支付页面URL
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('会员升级失败:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ...(process.env.NODE_ENV !== 'production' && {
        stack: error instanceof Error ? error.stack : undefined,
      }),
    });

    return NextResponse.json(
      {
        success: false,
        message: '会员升级失败，请稍后重试',
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
 * 类型守卫：验证升级请求
 */
function isValidUpgradeRequest(data: unknown): data is UpgradeRequestBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const body = data as Record<string, unknown>;

  if (typeof body.tierId !== 'string' || body.tierId.trim() === '') {
    return false;
  }

  // 验证billingCycle必须是有效的枚举值
  if (
    body.billingCycle !== undefined &&
    typeof body.billingCycle === 'string'
  ) {
    const validCycles = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME'];
    if (!validCycles.includes(body.billingCycle)) {
      return false;
    }
  }

  if (body.autoRenew !== undefined && typeof body.autoRenew !== 'boolean') {
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
