/**
 * 会员取消 API
 * 用户可以取消当前的会员订阅
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { CancelRequestBody } from '@/types/admin-membership';
import { cancelMembership } from '@/lib/membership/membership-service';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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
        status: 'ACTIVE',
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

    // 产品契约：取消会员 = 仅取消续费，到期前仍可继续使用
    await cancelMembership({
      userId: authUser.userId,
      immediate: false,
      reason: reason || '用户主动取消续费',
      performedBy: authUser.userId,
    });

    // 重新查询最新会员信息，返回当前仍为 ACTIVE 的会员，但 autoRenew = false
    const updatedMembership = await prisma.userMembership.findFirst({
      where: {
        id: currentMembership.id,
      },
      include: {
        tier: true,
      },
    });

    if (!updatedMembership) {
      throw new Error('会员取消后重新查询失败');
    }

    // 返回成功响应
    return NextResponse.json(
      {
        success: true,
        message: '已取消自动续费，当前会员权益将在到期前继续有效',
        data: {
          membership: {
            id: updatedMembership.id,
            tier: updatedMembership.tier.tier,
            tierName: updatedMembership.tier.displayName,
            status: updatedMembership.status,
            startDate: updatedMembership.startDate,
            endDate: updatedMembership.endDate,
            cancelledAt: updatedMembership.cancelledAt,
            cancelledReason: updatedMembership.cancelledReason,
            autoRenew: updatedMembership.autoRenew,
            price: Number(updatedMembership.tier.price),
            billingCycle: updatedMembership.tier.billingCycle,
            features: updatedMembership.tier.features,
            permissions: updatedMembership.tier.permissions,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('会员取消失败:', {
      error: 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        success: false,
        message: '会员取消失败，请稍后重试',
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
