/**
 * 案件分析API
 * 提供案件综合分析数据：类型分布、效率、成功率、收益分析
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
  TimeRange,
  type ActiveCasesOverview,
  type CaseAnalyticsData,
  type CaseAnalyticsMetadata,
  type CaseAnalyticsQueryParams,
  type CaseEfficiencyData,
  type CaseRevenueAnalysisData,
  type CaseSuccessRateData,
  type CaseTypeDistributionData,
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
): CaseAnalyticsQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const caseType = url.searchParams.get('caseType');
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
    caseType: caseType ?? undefined,
    status: status ?? undefined,
  };
}

// =============================================================================
// 核心函数：获取案件成功率分析
// =============================================================================

/**
 * 获取案件成功率数据
 */
async function getCaseSuccessRate(
  startDate: Date,
  endDate: Date,
  whereClause: Record<string, unknown>
): Promise<CaseSuccessRateData> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"createdAt" >= ${startDate}`,
    Prisma.sql`"createdAt" <= ${endDate}`,
    Prisma.sql`"deletedAt" IS NULL`,
  ];
  if (whereClause.status) {
    conditions.push(Prisma.sql`"status" = ${whereClause.status as string}`);
  }

  const totalCasesResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*) as count FROM "cases" WHERE ${Prisma.join(conditions, ' AND ')}`
  );

  const totalCases = Number(totalCasesResult[0]?.count ?? 0);

  const successConditions = [...conditions, Prisma.sql`"status" = 'COMPLETED'`];
  const successfulCasesResult = await prisma.$queryRaw<
    Array<{ count: bigint }>
  >(
    Prisma.sql`SELECT COUNT(*) as count FROM "cases" WHERE ${Prisma.join(successConditions, ' AND ')}`
  );

  const successfulCases = Number(successfulCasesResult[0]?.count ?? 0);

  const successRate = totalCases > 0 ? (successfulCases / totalCases) * 100 : 0;

  // 按案件类型统计成功率
  const byTypeResults = await prisma.$queryRaw<
    Array<{ type: string; total: bigint; successful: bigint }>
  >(
    Prisma.sql`SELECT
      type,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE "status" = 'COMPLETED') as successful
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY type
    ORDER BY type`
  );

  const byType = (Array.isArray(byTypeResults) ? byTypeResults : []).map(
    row => ({
      type: row.type,
      totalCases: Number(row.total),
      successfulCases: Number(row.successful),
      successRate:
        Number(row.total) > 0
          ? (Number(row.successful) / Number(row.total)) * 100
          : 0,
    })
  );

  // 按案由统计成功率
  const byCauseResults = await prisma.$queryRaw<
    Array<{ cause: string; total: bigint; successful: bigint }>
  >(
    Prisma.sql`SELECT
      COALESCE(cause, '未分类') as cause,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE "status" = 'COMPLETED') as successful
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY cause
    ORDER BY total DESC
    LIMIT 10`
  );

  const byCause = (Array.isArray(byCauseResults) ? byCauseResults : []).map(
    row => ({
      cause: row.cause,
      totalCases: Number(row.total),
      successfulCases: Number(row.successful),
      successRate:
        Number(row.total) > 0
          ? (Number(row.successful) / Number(row.total)) * 100
          : 0,
    })
  );

  // 趋势数据（按天）
  const trendResults = await prisma.$queryRaw<
    Array<{ date: string; total: bigint; successful: bigint }>
  >(
    Prisma.sql`SELECT
      TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE "status" = 'COMPLETED') as successful
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC`
  );

  const trend = (Array.isArray(trendResults) ? trendResults : []).map(row => ({
    date: row.date,
    totalCases: Number(row.total),
    successfulCases: Number(row.successful),
    successRate:
      Number(row.total) > 0
        ? (Number(row.successful) / Number(row.total)) * 100
        : 0,
  }));

  return {
    totalCases,
    successfulCases,
    successRate,
    byType,
    byCause,
    trend,
  };
}

// =============================================================================
// 核心函数：获取案件收益分析
// =============================================================================

/**
 * 获取案件收益分析数据
 */
async function getCaseRevenueAnalysis(
  startDate: Date,
  endDate: Date,
  whereClause: Record<string, unknown>
): Promise<CaseRevenueAnalysisData> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"createdAt" >= ${startDate}`,
    Prisma.sql`"createdAt" <= ${endDate}`,
    Prisma.sql`"deletedAt" IS NULL`,
  ];
  if (whereClause.status) {
    conditions.push(Prisma.sql`"status" = ${whereClause.status as string}`);
  }

  // 查询总体收益
  const revenueResults = await prisma.$queryRaw<
    Array<{ total: bigint; avg: string; max: string; min: string }>
  >(
    Prisma.sql`SELECT
      SUM(amount) as total,
      ROUND(AVG(amount), 2) as avg,
      ROUND(MAX(amount), 2) as max,
      ROUND(MIN(amount), 2) as min
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')} AND amount IS NOT NULL`
  );

  const totalRevenue = Number(revenueResults[0]?.total ?? 0);
  const averageRevenue = Number(revenueResults[0]?.avg ?? 0);
  const maxRevenue = Number(revenueResults[0]?.max ?? 0);
  const minRevenue = Number(revenueResults[0]?.min ?? 0);

  // 按案件类型统计收益
  const byTypeResults = await prisma.$queryRaw<
    Array<{ type: string; total: bigint; count: bigint }>
  >(
    Prisma.sql`SELECT
      type,
      SUM(amount) as total,
      COUNT(*) as count
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')} AND amount IS NOT NULL
    GROUP BY type
    ORDER BY total DESC`
  );

  const byType = (Array.isArray(byTypeResults) ? byTypeResults : []).map(
    row => ({
      type: row.type,
      totalRevenue: Number(row.total),
      averageRevenue:
        Number(row.count) > 0 ? Number(row.total) / Number(row.count) : 0,
      caseCount: Number(row.count),
      percentage:
        totalRevenue > 0 ? (Number(row.total) / totalRevenue) * 100 : 0,
    })
  );

  // 趋势数据（按天）
  const trendResults = await prisma.$queryRaw<
    Array<{
      date: string;
      revenue: bigint;
      count: bigint;
      avg: string;
    }>
  >(
    Prisma.sql`SELECT
      TO_CHAR(DATE_TRUNC('day', "createdAt"), 'YYYY-MM-DD') as date,
      SUM(amount) as revenue,
      COUNT(*) as count,
      ROUND(AVG(amount), 2) as avg
    FROM "cases"
    WHERE ${Prisma.join(conditions, ' AND ')} AND amount IS NOT NULL
    GROUP BY DATE_TRUNC('day', "createdAt")
    ORDER BY date ASC`
  );

  const trend = (Array.isArray(trendResults) ? trendResults : []).map(row => ({
    date: row.date,
    revenue: Number(row.revenue),
    caseCount: Number(row.count),
    averageRevenue: Number(row.avg),
  }));

  return {
    totalRevenue,
    averageRevenue,
    maxRevenue,
    minRevenue,
    byType,
    trend,
  };
}

// =============================================================================
// 核心函数：获取案件类型分布
// =============================================================================

/**
 * 获取案件类型分布数据
 */
async function getCaseTypeDistribution(
  startDate: Date,
  endDate: Date
): Promise<CaseTypeDistributionData> {
  const rawResults = await prisma.$queryRaw<
    Array<{ type: string; count: bigint }>
  >(
    Prisma.sql`SELECT
      type,
      COUNT(*) as count
    FROM "cases"
    WHERE "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
      AND "deletedAt" IS NULL
    GROUP BY type
    ORDER BY count DESC`
  );

  const resultsArray = Array.isArray(rawResults) ? rawResults : [];
  const totalCases = resultsArray.reduce(
    (sum, row) => sum + Number(row.count),
    0
  );

  const distribution = resultsArray.map(row => ({
    type: row.type,
    count: Number(row.count),
    percentage:
      totalCases > 0
        ? Math.round((Number(row.count) / totalCases) * 10000) / 100
        : 0,
  }));

  const completedCases = await prisma.case.count({
    where: {
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
// 核心函数：获取活跃案件概览
// =============================================================================

/**
 * 获取活跃案件概览数据
 */
async function getActiveCasesOverview(): Promise<ActiveCasesOverview> {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 查询活跃案件数
  const totalActiveCases = await prisma.case.count({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
    },
  });

  // 查询平均审理周期（已完成案件）
  const completedCases = await prisma.$queryRaw<Array<{ avgDuration: string }>>(
    Prisma.sql`SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / (24 * 3600)), 2) as "avgDuration"
    FROM "cases"
    WHERE "status" = 'COMPLETED' AND "deletedAt" IS NULL`
  );

  const averageDuration =
    Array.isArray(completedCases) && completedCases.length > 0
      ? Math.round(Number(completedCases[0]?.avgDuration ?? 0) * 100) / 100
      : 0;

  // 查询即将到期案件（30天内）
  const expiringSoon = await prisma.case.count({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      createdAt: {
        lte: thirtyDaysFromNow,
      },
    },
  });

  // 查询本月新增案件
  const newThisMonth = await prisma.case.count({
    where: {
      createdAt: {
        gte: monthStart,
      },
      deletedAt: null,
    },
  });

  return {
    totalActiveCases,
    averageDuration,
    expiringSoon,
    newThisMonth,
  };
}

// =============================================================================
// 核心函数：获取案件效率数据
// =============================================================================

/**
 * 获取案件效率数据
 */
async function getCaseEfficiency(
  startDate: Date,
  endDate: Date
): Promise<CaseEfficiencyData> {
  const cases = await prisma.$queryRaw<
    Array<{ id: string; createdAt: Date; updatedAt: Date }>
  >(
    Prisma.sql`SELECT id, "createdAt", "updatedAt" FROM "cases"
    WHERE "status" = 'COMPLETED'
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
      AND "deletedAt" IS NULL`
  );

  const casesArray = Array.isArray(cases) ? cases : [];

  const completionTimes = casesArray.map(c => {
    const diffMs = c.updatedAt.getTime() - c.createdAt.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  });

  const totalCompletedCases = completionTimes.length;
  const averageCompletionTime =
    completionTimes.length > 0
      ? Math.round(
          (completionTimes.reduce((sum, time) => sum + time, 0) /
            completionTimes.length) *
            100
        ) / 100
      : 0;

  const sortedTimes = [...completionTimes].sort((a, b) => a - b);
  const mid = Math.floor(sortedTimes.length / 2);
  const medianCompletionTime =
    sortedTimes.length > 0
      ? sortedTimes.length % 2 === 0
        ? (sortedTimes[mid - 1] + sortedTimes[mid]) / 2
        : sortedTimes[mid]
      : 0;

  const fastestCompletionTime =
    completionTimes.length > 0 ? Math.min(...completionTimes) : 0;
  const slowestCompletionTime =
    completionTimes.length > 0 ? Math.max(...completionTimes) : 0;

  // 趋势数据（按天）
  const trendResults = await prisma.$queryRaw<
    Array<{ date: string; completedCases: bigint; avgTime: string }>
  >(
    Prisma.sql`SELECT
      TO_CHAR(DATE_TRUNC('day', "updatedAt"), 'YYYY-MM-DD') as date,
      COUNT(*) as "completedCases",
      ROUND(AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 3600), 2) as "avgTime"
    FROM "cases"
    WHERE "status" = 'COMPLETED'
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
      AND "deletedAt" IS NULL
    GROUP BY DATE_TRUNC('day', "updatedAt")
    ORDER BY date ASC`
  );

  const trend = (Array.isArray(trendResults) ? trendResults : []).map(row => ({
    date: row.date,
    completedCases: Number(row.completedCases),
    averageCompletionTime: Number(row.avgTime),
    medianCompletionTime: 0,
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
 * GET /api/analytics/cases
 * 获取案件分析数据（管理员权限）
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

    // 并行查询所有分析数据
    const [
      typeDistribution,
      efficiency,
      successRate,
      revenueAnalysis,
      activeCasesOverview,
    ] = await Promise.all([
      getCaseTypeDistribution(startDate, endDate),
      getCaseEfficiency(startDate, endDate),
      getCaseSuccessRate(startDate, endDate, {
        status: params.status,
      }),
      getCaseRevenueAnalysis(startDate, endDate, {
        status: params.status,
      }),
      getActiveCasesOverview(),
    ]);

    // 构建元数据
    const metadata: CaseAnalyticsMetadata = {
      timeRange: params.timeRange ?? TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
      dataPoints:
        typeDistribution.distribution.length +
        efficiency.trend.length +
        successRate.trend.length +
        revenueAnalysis.trend.length,
    };

    // 构建响应数据
    const data: CaseAnalyticsData = {
      typeDistribution,
      efficiency,
      successRate,
      revenueAnalysis,
      activeCasesOverview,
      metadata,
    };

    return successResponse(data, '获取案件分析数据成功');
  } catch (error) {
    logger.error('获取案件分析数据失败:', error);
    return serverErrorResponse('获取案件分析数据失败');
  }
}
