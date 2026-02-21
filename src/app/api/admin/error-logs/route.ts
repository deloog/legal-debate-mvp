/**
 * 错误日志API - 管理员专用
 * 支持分页、筛选、搜索
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type { ErrorLogQueryParams, ErrorLogResponse } from '@/types/log';
import { isValidSeverity, isValidErrorType } from '@/types/log';
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
function parseQueryParams(request: NextRequest): ErrorLogQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    limit: url.searchParams.get('limit') ?? '20',
    errorType: url.searchParams.get('errorType') ?? undefined,
    severity: url.searchParams.get('severity') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    caseId: url.searchParams.get('caseId') ?? undefined,
    startTime: url.searchParams.get('startTime') ?? undefined,
    endTime: url.searchParams.get('endTime') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: ErrorLogQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.severity && isValidSeverity(params.severity)) {
    where.severity = params.severity;
  }

  if (params.errorType && isValidErrorType(params.errorType)) {
    where.errorType = params.errorType;
  }

  if (params.userId && params.userId.trim() !== '') {
    where.userId = params.userId;
  }

  if (params.caseId && params.caseId.trim() !== '') {
    where.caseId = params.caseId;
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
      { errorMessage: { contains: params.search, mode: 'insensitive' } },
      { errorCode: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

/**
 * 格式化错误日志项
 */
function formatErrorLogItem(log: unknown): unknown {
  return log;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/error-logs
 * 获取错误日志列表（管理员权限）
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

    // 查询错误日志总数
    const total = await prisma.errorLog.count({ where });

    // 查询错误日志列表
    const logs = await prisma.errorLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        userId: true,
        caseId: true,
        errorType: true,
        errorCode: true,
        errorMessage: true,
        stackTrace: true,
        context: true,
        attemptedAction: true,
        recoveryAttempts: true,
        recovered: true,
        recoveryMethod: true,
        recoveryTime: true,
        learned: true,
        learningNotes: true,
        severity: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 构建响应数据
    const responseData: ErrorLogResponse = {
      logs: logs.map(formatErrorLogItem) as ErrorLogResponse['logs'],
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return successResponse(responseData, '获取错误日志列表成功');
  } catch (error) {
    logger.error('获取错误日志列表失败:', error);
    return serverErrorResponse('获取错误日志列表失败');
  }
}
