/**
 * 案件效率统计API
 * 提供案件处理效率数据，支持多维度筛选
 */

import {
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  DateGranularity,
  TimeRange,
  type CaseEfficiencyData,
  type CaseEfficiencyQueryParams,
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

/**
 * 根据粒度生成分组键
 */
function getDateGroupingFunction(granularity: DateGranularity): {
  groupBy: string;
  dateFormat: string;
} {
  switch (granularity) {
    case DateGranularity.HOUR:
      return {
        groupBy: 'DATE_TRUNC(\'hour\', "cases"."updatedAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'hour\', "cases"."updatedAt"), \'YYYY-MM-DD HH24:00\')',
      };

    case DateGranularity.DAY:
    default:
      return {
        groupBy: 'DATE_TRUNC(\'day\', "cases"."updatedAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'day\', "cases"."updatedAt"), \'YYYY-MM-DD\')',
      };

    case DateGranularity.WEEK:
      return {
        groupBy: 'DATE_TRUNC(\'week\', "cases"."updatedAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'week\', "cases"."updatedAt"), \'YYYY-MM-DD\')',
      };

    case DateGranularity.MONTH:
      return {
        groupBy: 'DATE_TRUNC(\'month\', "cases"."updatedAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'month\', "cases"."updatedAt"), \'YYYY-MM\')',
      };
  }
}

// =============================================================================
// 辅助函数：参数解析
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(
  request: NextRequest
): CaseEfficiencyQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const caseType = url.searchParams.get('caseType');

  // 验证timeRange
  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  // 验证caseType
  const validCaseTypes = [
    'CIVIL',
    'CRIMINAL',
    'ADMINISTRATIVE',
    'COMMERCIAL',
    'LABOR',
    'INTELLECTUAL',
    'OTHER',
  ];
  if (caseType && !validCaseTypes.includes(caseType)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    caseType: caseType ?? undefined,
  };
}

/**
 * 构建查询条件
 */
function buildWhereClause(params: CaseEfficiencyQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.caseType) {
    where.type = params.caseType;
  }

  return where;
}

/**
 * 计算中位数
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

// =============================================================================
// 核心函数：统计案件效率
// =============================================================================

/**
 * 查询案件效率数据
 */
async function getCaseEfficiency(
  startDate: Date,
  endDate: Date,
  granularity: DateGranularity,
  whereClause: Record<string, unknown>
): Promise<CaseEfficiencyData> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"status" = 'COMPLETED'`,
    Prisma.sql`"updatedAt" >= ${startDate}`,
    Prisma.sql`"updatedAt" <= ${endDate}`,
    Prisma.sql`"deletedAt" IS NULL`,
  ];
  if (whereClause.type) {
    conditions.push(Prisma.sql`"type"::text = ${whereClause.type as string}`);
  }

  // 查询所有已完成案件的完成时间
  const cases = await prisma.$queryRaw<
    Array<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
    }>
  >(
    Prisma.sql`SELECT
      id,
      "createdAt",
      "updatedAt"
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')}`
  );

  // 计算每个案件的完成时间（小时）
  const completionTimes = (Array.isArray(cases) ? cases : []).map(c => {
    const diffMs = c.updatedAt.getTime() - c.createdAt.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  });

  // 查询汇总数据
  const totalCompletedCases = completionTimes.length;
  const averageCompletionTime =
    completionTimes.length > 0
      ? Math.round(
          (completionTimes.reduce((sum, time) => sum + time, 0) /
            completionTimes.length) *
            100
        ) / 100
      : 0;
  const medianCompletionTime = calculateMedian(completionTimes);
  const fastestCompletionTime =
    completionTimes.length > 0 ? Math.min(...completionTimes) : 0;
  const slowestCompletionTime =
    completionTimes.length > 0 ? Math.max(...completionTimes) : 0;

  // 按时间段分组统计趋势
  const sqlDateGrouping = getDateGroupingFunction(granularity);

  const rawResults = await prisma.$queryRaw<
    Array<{
      date: string;
      completedCases: bigint;
      avgCompletionTime: string;
    }>
  >(
    Prisma.sql`SELECT
      ${Prisma.raw(sqlDateGrouping.dateFormat)} as date,
      COUNT(*) as "completedCases",
      ROUND(AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600), 2) as "avgCompletionTime"
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY ${Prisma.raw(sqlDateGrouping.groupBy)}
    ORDER BY ${Prisma.raw(sqlDateGrouping.groupBy)}`
  );

  // 构建趋势数据
  const trend = (Array.isArray(rawResults) ? rawResults : []).map(row => ({
    date: row.date,
    completedCases: Number(row.completedCases),
    averageCompletionTime: Number(row.avgCompletionTime),
    medianCompletionTime: 0, // 中位数需要额外计算，这里简化为0
  }));

  return {
    trend,
    summary: {
      totalCompletedCases,
      averageCompletionTime,
      medianCompletionTime,
      fastestCompletionTime,
      slowestCompletionTime,
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
 * GET /api/stats/cases/efficiency
 * 获取案件效率统计数据（管理员权限）
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

    const { startDate, endDate } = getDateRange(
      params.timeRange ?? TimeRange.LAST_30_DAYS
    );
    const whereClause = buildWhereClause(params);

    // 查询案件效率数据
    const data = await getCaseEfficiency(
      startDate,
      endDate,
      DateGranularity.DAY,
      whereClause
    );

    return successResponse(data, '获取案件效率统计成功');
  } catch (error) {
    logger.error('获取案件效率统计失败:', error);
    return serverErrorResponse('获取案件效率统计失败');
  }
}
