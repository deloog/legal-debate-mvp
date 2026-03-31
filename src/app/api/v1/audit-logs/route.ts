/**
 * 审计日志查询API
 * 仅管理员可访问
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { ActionLogType, ActionLogCategory } from '@prisma/client';

/**
 * GET /api/v1/audit-logs
 * 查询审计日志列表
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 获取认证用户
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 仅管理员可访问（DB 重查角色，避免 stale JWT）
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: '权限不足', message: '仅管理员可查看审计日志' },
      { status: 403 }
    );
  }

  // 处理查询参数
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const skip = (page - 1) * limit;

  // 筛选条件
  const userId = searchParams.get('userId');
  const actionType = searchParams.get('actionType') as ActionLogType | null;
  const actionCategory = searchParams.get(
    'actionCategory'
  ) as ActionLogCategory | null;
  const resourceType = searchParams.get('resourceType');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search');

  // 构建查询条件
  const where: Record<string, unknown> = {};

  if (userId) {
    where.userId = userId;
  }

  if (actionType) {
    where.actionType = actionType;
  }

  if (actionCategory) {
    where.actionCategory = actionCategory;
  }

  if (resourceType) {
    where.resourceType = resourceType;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt = {
        ...(where.createdAt as object),
        gte: new Date(startDate),
      };
    }
    if (endDate) {
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt as object), lte: endDateObj };
    }
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: 'insensitive' } },
      { resourceType: { contains: search, mode: 'insensitive' } },
      { resourceId: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 排序
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const orderBy: Record<string, 'asc' | 'desc'> = {};
  if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
    orderBy[sortBy] = sortOrder as 'asc' | 'desc';
  } else {
    orderBy.createdAt = 'desc';
  }

  // 查询审计日志
  const [logs, total] = await Promise.all([
    prisma.actionLog.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.actionLog.count({ where }),
  ]);

  return createSuccessResponse(
    { logs },
    {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrevious: page > 1,
      },
    }
  );
});

/**
 * OPTIONS /api/v1/audit-logs
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
