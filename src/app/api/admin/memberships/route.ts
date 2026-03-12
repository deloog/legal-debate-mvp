/**
 * 会员管理API - 管理员专用
 * 支持分页、筛选、搜索
 */

import {
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type {
  MembershipListQueryParams,
  MembershipListResponse,
} from '@/types/admin-membership';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证等级枚举值
 */
function isValidTier(tier: string): boolean {
  const validTiers = ['FREE', 'BASIC', 'PROFESSIONAL', 'ENTERPRISE'];
  return validTiers.includes(tier);
}

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
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): MembershipListQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    pageSize:
      url.searchParams.get('pageSize') ?? url.searchParams.get('limit') ?? '20',
    tier:
      url.searchParams.get('tier') ??
      url.searchParams.get('tierId') ??
      undefined,
    status: url.searchParams.get('status') ?? undefined,
    search:
      url.searchParams.get('search') ??
      url.searchParams.get('keyword') ??
      undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: MembershipListQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.tier && isValidTier(params.tier)) {
    where.tier = {
      tier: params.tier,
    };
  }

  if (params.status && isValidStatus(params.status)) {
    where.status = params.status;
  }

  if (params.search && params.search.trim() !== '') {
    where.user = {
      OR: [
        { email: { contains: params.search, mode: 'insensitive' } },
        { username: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
      ],
    };
  }

  return where;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/memberships
 * 获取会员列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限 - 使用 membership:read 权限
  const permissionError = await validatePermissions(request, 'membership:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(params.pageSize ?? '20', 10))
    );
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询会员总数
    const total = await prisma.userMembership.count({ where });

    // 查询会员列表
    const memberships = await prisma.userMembership.findMany({
      where,
      skip,
      take: pageSize,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 构建响应数据
    const responseData: MembershipListResponse = {
      memberships: memberships.map(membership => ({
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
        createdAt: membership.createdAt,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    return successResponse(responseData, '获取会员列表成功');
  } catch (error) {
    logger.error('获取会员列表失败:', error);
    return serverErrorResponse('获取会员列表失败');
  }
}
