/**
 * 案件类型分布统计API
 * 提供案件类型分布数据，支持多维度筛选
 */

import {
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  TimeRange,
  type CaseTypeDistributionData,
  type CaseTypeDistributionQueryParams,
} from '@/types/stats';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数：时间范围处理
// =============================================================================

/**
 * 根据时间范围类型计算起止日期
 */
function getDateRange(timeRange: TimeRange): {
  startDate: Date;
  endDate: Date;
} {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (timeRange) {
    case TimeRange.TODAY:
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.YESTERDAY:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate,
        endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1),
      };

    case TimeRange.LAST_7_DAYS:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_30_DAYS:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_90_DAYS:
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 89);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.THIS_WEEK:
      startDate = new Date(now);
      const dayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - dayOfWeek);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_WEEK:
      startDate = new Date(now);
      const lastWeekDayOfWeek = startDate.getDay();
      startDate.setDate(startDate.getDate() - lastWeekDayOfWeek - 7);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate,
        endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000 - 1),
      };

    case TimeRange.THIS_MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;

    case TimeRange.LAST_MONTH:
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      return {
        startDate,
        endDate: new Date(
          now.getFullYear(),
          now.getMonth(),
          0,
          23,
          59,
          59,
          999
        ),
      };

    case TimeRange.THIS_YEAR:
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      break;

    default:
      // 默认最近30天
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// =============================================================================
// 辅助函数：参数解析
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(
  request: NextRequest
): CaseTypeDistributionQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const status = url.searchParams.get('status');

  // 验证timeRange
  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  // 验证status
  const validStatuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];
  if (status && !validStatuses.includes(status)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    status: status ?? undefined,
  };
}

/**
 * 构建查询条件
 */
function buildWhereClause(params: CaseTypeDistributionQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.status) {
    where.status = params.status;
  }

  return where;
}

// =============================================================================
// 核心函数：统计案件类型分布
// =============================================================================

/**
 * 查询案件类型分布数据
 */
async function getCaseTypeDistribution(
  startDate: Date,
  endDate: Date,
  whereClause: Record<string, unknown>
): Promise<CaseTypeDistributionData> {
  // 构建WHERE条件
  const whereConditions = [
    `"createdAt" >= '${startDate.toISOString()}'`,
    `"createdAt" <= '${endDate.toISOString()}'`,
    `"deletedAt" IS NULL`,
  ];
  if (whereClause.status) {
    whereConditions.push(`"status" = '${whereClause.status}'`);
  }
  const whereSql = whereConditions.join(' AND ');

  // 使用原生SQL查询案件类型分布
  const rawResults = (await prisma.$queryRawUnsafe<
    Array<{ type: string; count: bigint }>
  >(
    `SELECT 
      type,
      COUNT(*) as count
    FROM "cases"
    WHERE ${whereSql}
    GROUP BY type
    ORDER BY count DESC`
  )) as Array<{ type: string; count: bigint }>;

  // 确保rawResults是数组
  const resultsArray = Array.isArray(rawResults) ? rawResults : [];

  // 计算总案件数
  const totalCases = resultsArray.reduce(
    (sum, row) => sum + Number(row.count),
    0
  );

  // 构建分布数据
  const distribution = resultsArray.map(row => ({
    type: row.type,
    count: Number(row.count),
    percentage:
      totalCases > 0
        ? Math.round((Number(row.count) / totalCases) * 10000) / 100
        : 0,
  }));

  // 查询汇总数据
  const completedCases = await prisma.case.count({
    where: {
      ...whereClause,
      status: 'COMPLETED',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    },
  });

  const activeCases = await prisma.case.count({
    where: {
      ...whereClause,
      status: 'ACTIVE',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      deletedAt: null,
    },
  });

  return {
    distribution,
    summary: {
      totalCases,
      completedCases,
      activeCases,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/stats/cases/type-distribution
 * 获取案件类型分布数据（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限（需要管理员权限）
  const permissionError = await validatePermissions(request, 'stats:read');
  if (permissionError) {
    return forbiddenResponse('无权限查看统计数据');
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    if (!params) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          message: '无效的查询参数',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { startDate, endDate } = getDateRange(params.timeRange);
    const whereClause = buildWhereClause(params);

    // 查询案件类型分布数据
    const data = await getCaseTypeDistribution(startDate, endDate, whereClause);

    return successResponse(data, '获取案件类型分布成功');
  } catch (error) {
    logger.error('获取案件类型分布失败:', error);
    return serverErrorResponse('获取案件类型分布失败');
  }
}
