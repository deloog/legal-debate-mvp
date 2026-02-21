/**
 * 操作日志API - 管理员专用
 * 支持分页、筛选、搜索
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type { ActionLogQueryParams, ActionLogResponse } from '@/types/log';
import { isValidActionType, isValidActionCategory } from '@/types/log';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): ActionLogQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    limit: url.searchParams.get('limit') ?? '20',
    actionType: url.searchParams.get('actionType') ?? undefined,
    actionCategory: url.searchParams.get('actionCategory') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    resourceType: url.searchParams.get('resourceType') ?? undefined,
    startTime: url.searchParams.get('startTime') ?? undefined,
    endTime: url.searchParams.get('endTime') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: ActionLogQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.actionType && isValidActionType(params.actionType)) {
    where.actionType = params.actionType;
  }

  if (params.actionCategory && isValidActionCategory(params.actionCategory)) {
    where.actionCategory = params.actionCategory;
  }

  if (params.userId && params.userId.trim() !== '') {
    where.userId = params.userId;
  }

  if (params.resourceType && params.resourceType.trim() !== '') {
    where.resourceType = params.resourceType;
  }

  // 时间范围筛选
  if (params.startTime || params.endTime) {
    const createdAtFilter: { gte?: Date; lte?: Date } = {};
    if (params.startTime) {
      createdAtFilter.gte = new Date(params.startTime);
    }
    if (params.endTime) {
      createdAtFilter.lte = new Date(params.endTime);
    }
    where.createdAt = createdAtFilter;
  }

  // 关键词搜索
  if (params.search && params.search.trim() !== '') {
    where.OR = [
      { description: { contains: params.search, mode: 'insensitive' } },
      { requestPath: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

/**
 * 格式化操作日志项
 */
function formatActionLogItem(log: unknown): unknown {
  return log;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/action-logs
 * 获取操作日志列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'log:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(params.limit ?? '20', 10))
    );
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询操作日志总数
    const total = await prisma.actionLog.count({ where });

    // 查询操作日志列表
    const logs = await prisma.actionLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        userId: true,
        actionType: true,
        actionCategory: true,
        description: true,
        resourceType: true,
        resourceId: true,
        ipAddress: true,
        userAgent: true,
        requestMethod: true,
        requestPath: true,
        requestParams: true,
        responseStatus: true,
        executionTime: true,
        metadata: true,
        createdAt: true,
      },
    });

    // 构建响应数据
    const responseData: ActionLogResponse = {
      logs: logs.map(formatActionLogItem) as ActionLogResponse['logs'],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return successResponse(responseData, '获取操作日志列表成功');
  } catch (error) {
    logger.error('获取操作日志列表失败:', error);
    return serverErrorResponse('获取操作日志列表失败');
  }
}
