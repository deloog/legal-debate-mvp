/**
 * 会员详情API - 管理员专用
 * 支持获取和更新单个会员的详细信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import {
  MembershipChangeType,
  MembershipTierType,
  MembershipStatus,
} from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 会员详情响应数据
 */
interface MembershipDetailResponse {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  tierName: string;
  tierDisplayName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  pausedAt: Date | null;
  pausedReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 会员编辑请求体
 */
interface UpdateMembershipRequest {
  tierId?: string;
  status?: string;
  endDate?: string;
  autoRenew?: boolean;
  notes?: string;
  pausedReason?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证状态枚举值
 */
function isValidStatus(status: string): boolean {
  const validStatuses = [
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'SUSPENDED',
    'PENDING',
  ];
  return validStatuses.includes(status);
}

/**
 * 验证等级ID是否存在
 */
async function isValidTierId(tierId: string): Promise<boolean> {
  const tier = await prisma.membershipTier.findUnique({
    where: { id: tierId },
    select: { id: true },
  });
  return tier !== null;
}

/**
 * 记录会员变更历史
 */
async function recordMembershipHistory(
  membershipId: string,
  userId: string,
  changeType: MembershipChangeType,
  fromTier: MembershipTierType | null,
  toTier: MembershipTierType | null,
  fromStatus: MembershipStatus,
  toStatus: MembershipStatus,
  reason: string | undefined,
  performedBy: string
): Promise<void> {
  await prisma.membershipHistory.create({
    data: {
      membershipId,
      userId,
      changeType,
      fromTier,
      toTier,
      fromStatus,
      toStatus,
      reason,
      performedBy,
    },
  });
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/memberships/[id]
 * 获取会员详情（管理员权限）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:read');
  if (permissionError) {
    return permissionError;
  }

  const { id } = params;

  try {
    // 查询会员详情
    const membership = await prisma.userMembership.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
        tier: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    });

    if (!membership) {
      return notFoundResponse('会员不存在');
    }

    // 构建响应数据
    const responseData: MembershipDetailResponse = {
      id: membership.id,
      userId: membership.userId,
      userEmail: membership.user.email,
      userName: membership.user.name ?? membership.user.username,
      tierName: membership.tier.name,
      tierDisplayName: membership.tier.displayName,
      status: membership.status,
      startDate: membership.startDate,
      endDate: membership.endDate,
      autoRenew: membership.autoRenew,
      cancelledAt: membership.cancelledAt,
      cancelledReason: membership.cancelledReason,
      pausedAt: membership.pausedAt,
      pausedReason: membership.pausedReason,
      notes: membership.notes,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
    };

    return successResponse(responseData, '获取会员详情成功');
  } catch (error) {
    console.error('获取会员详情失败:', error);
    return serverErrorResponse('获取会员详情失败');
  }
}

/**
 * PATCH /api/admin/memberships/[id]
 * 更新会员信息（管理员权限）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // 验证用户身份
  const adminUser = await getAuthUser(request);
  if (!adminUser) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:write');
  if (permissionError) {
    return permissionError;
  }

  const { id } = params;

  try {
    // 解析请求体
    const body: UpdateMembershipRequest = await request.json();

    // 查询当前会员
    const currentMembership = await prisma.userMembership.findUnique({
      where: { id },
      include: {
        user: { select: { email: true } },
        tier: { select: { name: true, tier: true } },
      },
    });

    if (!currentMembership) {
      return notFoundResponse('会员不存在');
    }

    // 验证状态值
    if (body.status && !isValidStatus(body.status)) {
      return errorResponse('无效的会员状态', 400);
    }

    // 验证等级ID
    if (body.tierId && !(await isValidTierId(body.tierId))) {
      return errorResponse('无效的会员等级', 400);
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {};

    // 等级变更
    if (body.tierId && body.tierId !== currentMembership.tierId) {
      updateData.tierId = body.tierId;
    }

    // 状态变更
    if (body.status && body.status !== currentMembership.status) {
      updateData.status = body.status;

      // 暂停状态处理
      if (body.status === 'SUSPENDED') {
        updateData.pausedAt = new Date();
        updateData.pausedReason = body.pausedReason || '管理员暂停';
      } else {
        // 从暂停状态恢复，清除暂停时间
        updateData.pausedAt = null;
        updateData.pausedReason = null;
      }
    }

    // 结束日期变更
    if (body.endDate) {
      updateData.endDate = new Date(body.endDate);
    }

    // 自动续费变更
    if (typeof body.autoRenew === 'boolean') {
      updateData.autoRenew = body.autoRenew;
    }

    // 备注变更
    if (typeof body.notes === 'string') {
      updateData.notes = body.notes;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse('没有任何需要更新的字段', 400);
    }

    // 更新会员信息
    const updatedMembership = await prisma.userMembership.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
        tier: {
          select: {
            id: true,
            name: true,
            displayName: true,
            tier: true,
          },
        },
      },
    });

    // 记录变更历史
    const changes: Array<{
      type: MembershipChangeType;
      fromTier: MembershipTierType | null;
      toTier: MembershipTierType | null;
      fromStatus: MembershipStatus;
      toStatus: MembershipStatus;
      reason?: string;
    }> = [];

    if (updateData.tierId) {
      changes.push({
        type: MembershipChangeType.UPGRADE,
        fromTier: currentMembership.tier.tier,
        toTier: updatedMembership.tier.tier,
        fromStatus: currentMembership.status,
        toStatus: updatedMembership.status,
        reason: '管理员调整等级',
      });
    }

    if (updateData.status) {
      let changeType: MembershipChangeType;
      if (body.status === 'SUSPENDED') {
        changeType = MembershipChangeType.PAUSE;
      } else if (currentMembership.status === 'SUSPENDED') {
        changeType = MembershipChangeType.RESUME;
      } else {
        changeType = MembershipChangeType.EXPIRE;
      }

      changes.push({
        type: changeType,
        fromTier: currentMembership.tier.tier,
        toTier: updatedMembership.tier.tier,
        fromStatus: currentMembership.status,
        toStatus: body.status as MembershipStatus,
        reason: updateData.pausedReason as string | undefined,
      });
    }

    // 批量记录变更历史
    await Promise.all(
      changes.map(change =>
        recordMembershipHistory(
          id,
          currentMembership.userId,
          change.type,
          change.fromTier,
          change.toTier,
          change.fromStatus,
          change.toStatus,
          change.reason,
          adminUser.userId
        )
      )
    );

    // 构建响应数据
    const responseData: MembershipDetailResponse = {
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      userEmail: updatedMembership.user.email,
      userName: updatedMembership.user.name ?? updatedMembership.user.username,
      tierName: updatedMembership.tier.name,
      tierDisplayName: updatedMembership.tier.displayName,
      status: updatedMembership.status,
      startDate: updatedMembership.startDate,
      endDate: updatedMembership.endDate,
      autoRenew: updatedMembership.autoRenew,
      cancelledAt: updatedMembership.cancelledAt,
      cancelledReason: updatedMembership.cancelledReason,
      pausedAt: updatedMembership.pausedAt,
      pausedReason: updatedMembership.pausedReason,
      notes: updatedMembership.notes,
      createdAt: updatedMembership.createdAt,
      updatedAt: updatedMembership.updatedAt,
    };

    return successResponse(responseData, '更新会员信息成功');
  } catch (error) {
    console.error('更新会员信息失败:', error);
    return serverErrorResponse('更新会员信息失败');
  }
}
