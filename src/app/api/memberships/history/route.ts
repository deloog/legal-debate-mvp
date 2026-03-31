/**
 * 会员变更历史 API
 * 提供用户会员变更历史记录的查询功能
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { MembershipChangeType } from '@/types/membership';
import { logger } from '@/lib/logger';

// =============================================================================
// GET /api/memberships/history - 查询会员变更历史
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

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const changeTypeParam = searchParams.get('changeType');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 验证分页参数
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    if (isNaN(page) || page < 1) {
      return Response.json(
        {
          success: false,
          message: 'page参数无效',
          error: 'INVALID_PAGE',
        },
        { status: 400 }
      );
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return Response.json(
        {
          success: false,
          message: 'limit参数无效（1-100）',
          error: 'INVALID_LIMIT',
        },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: Record<string, unknown> = {
      userId: authUser.userId,
    };

    // 过滤变更类型
    if (changeTypeParam && isValidChangeType(changeTypeParam)) {
      where.changeType = changeTypeParam as MembershipChangeType;
    }

    // 过滤日期范围
    const dateFilter: Record<string, unknown> = {};
    if (startDateParam) {
      const startDate = new Date(startDateParam);
      if (!isNaN(startDate.getTime())) {
        dateFilter.gte = startDate;
      }
    }
    if (endDateParam) {
      const endDate = new Date(endDateParam);
      if (!isNaN(endDate.getTime())) {
        dateFilter.lte = endDate;
      }
    }
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }

    // 查询总数
    const total = await prisma.membershipHistory.count({ where });

    // 计算分页
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    // 查询变更历史记录
    const records = await prisma.membershipHistory.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        membership: {
          include: {
            tier: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
      },
    });

    // 返回成功响应
    return Response.json(
      {
        success: true,
        message: '查询成功',
        data: {
          records,
          total,
          pagination: {
            page,
            limit,
            totalPages,
            hasNext,
            hasPrev,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('[GET /api/memberships/history] 查询失败:', error);

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
// OPTIONS /api/memberships/history - CORS预检
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
 * 验证变更类型是否有效
 */
function isValidChangeType(value: string): boolean {
  const validTypes: string[] = [
    'UPGRADE',
    'DOWNGRADE',
    'CANCEL',
    'RENEW',
    'PAUSE',
    'RESUME',
    'EXPIRE',
  ];

  return validTypes.includes(value);
}
