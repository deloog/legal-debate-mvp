/**
 * 会员取消 API
 * 用户可以取消当前的会员订阅
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { MembershipStatus } from '@/types/membership';
import { MembershipChangeType } from '@/types/membership';

/**
 * POST /api/memberships/cancel
 * 会员取消
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
    if (!isValidCancelRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          message: '请求参数无效',
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    const { reason } = body;

    // 查询用户当前会员信息
    const currentMembership = await prisma.userMembership.findFirst({
      where: {
        userId: authUser.userId,
        status: 'ACTIVE' as MembershipStatus,
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

    // 检查是否是免费版（免费版无法取消）
    if (currentMembership.tier.tier === 'FREE') {
      return NextResponse.json(
        {
          success: false,
          message: '免费版会员无法取消',
          error: 'CANNOT_CANCEL_FREE_TIER',
        },
        { status: 400 }
      );
    }

    // 检查会员是否已经被取消
    if (currentMembership.status === 'CANCELLED') {
      return NextResponse.json(
        {
          success: false,
          message: '会员已经被取消',
          error: 'ALREADY_CANCELLED',
        },
        { status: 400 }
      );
    }

    // 检查会员是否已过期
    if (currentMembership.status === 'EXPIRED') {
      return NextResponse.json(
        {
          success: false,
          message: '会员已过期，无需取消',
          error: 'MEMBERSHIP_EXPIRED',
        },
        { status: 400 }
      );
    }

    // 计算取消后的到期时间
    const cancelledMembership = await prisma.$transaction(async tx => {
      // 更新会员状态为已取消
      const updatedMembership = await tx.userMembership.update({
        where: { id: currentMembership.id },
        data: {
          status: 'CANCELLED' as MembershipStatus,
          cancelledAt: new Date(),
          cancelledReason: reason || '用户主动取消',
          notes: `会员取消：${reason || '用户主动取消'}`,
          autoRenew: false, // 取消后关闭自动续费
        },
        include: {
          tier: true,
        },
      });

      // 记录会员变更历史
      await tx.membershipHistory.create({
        data: {
          userId: authUser.userId,
          membershipId: currentMembership.id,
          changeType: 'CANCEL' as MembershipChangeType,
          fromTier: currentMembership.tier.tier,
          toTier: undefined,
          fromStatus: currentMembership.status,
          toStatus: 'CANCELLED' as MembershipStatus,
          reason: `会员取消：${reason || '用户主动取消'}`,
          performedBy: authUser.userId,
          metadata: {
            cancelReason: reason,
            wasAutoRenew: currentMembership.autoRenew,
            remainingDays: Math.ceil(
              (new Date(updatedMembership.endDate).getTime() - Date.now()) /
                (24 * 60 * 60 * 1000)
            ),
          },
        },
      });

      return updatedMembership;
    });

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '会员取消成功',
        data: {
          membership: {
            id: cancelledMembership.id,
            tier: cancelledMembership.tier.tier,
            tierName: cancelledMembership.tier.displayName,
            status: cancelledMembership.status,
            startDate: cancelledMembership.startDate,
            endDate: cancelledMembership.endDate,
            cancelledAt: cancelledMembership.cancelledAt,
            cancelledReason: cancelledMembership.cancelledReason,
            autoRenew: cancelledMembership.autoRenew,
            price: Number(cancelledMembership.tier.price),
            billingCycle: cancelledMembership.tier.billingCycle,
            features: cancelledMembership.tier.features,
            permissions: cancelledMembership.tier.permissions,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('会员取消失败:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        message: '会员取消失败，请稍后重试',
        error: error instanceof Error ? error.message : 'SERVER_ERROR',
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
 * 类型守卫：验证取消请求
 */
function isValidCancelRequest(data: unknown): data is CancelRequestBody {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const body = data as Record<string, unknown>;

  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return false;
  }

  return true;
}

/**
 * 取消请求体类型
 */
interface CancelRequestBody {
  reason?: string;
}
