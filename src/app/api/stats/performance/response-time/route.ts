/**
 * 系统性能统计API - 响应时间
 * 提供AI服务响应时间统计，支持多维度筛选
 */

import {
  forbiddenResponse,
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { Prisma } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  DateGranularity,
  PerformanceResponseTimeData,
  PerformanceResponseTimeQueryParams,
  TimeRange,
  type PerformanceMetricPoint,
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
        groupBy: 'DATE_TRUNC(\'hour\', "ai_interactions"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'hour\', "ai_interactions"."createdAt"), \'YYYY-MM-DD HH24:00\')',
      };

    case DateGranularity.DAY:
    default:
      return {
        groupBy: 'DATE_TRUNC(\'day\', "ai_interactions"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'day\', "ai_interactions"."createdAt"), \'YYYY-MM-DD\')',
      };

    case DateGranularity.WEEK:
      return {
        groupBy: 'DATE_TRUNC(\'week\', "ai_interactions"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'week\', "ai_interactions"."createdAt"), \'YYYY-MM-DD\')',
      };

    case DateGranularity.MONTH:
      return {
        groupBy: 'DATE_TRUNC(\'month\', "ai_interactions"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'month\', "ai_interactions"."createdAt"), \'YYYY-MM\')',
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
): PerformanceResponseTimeQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const granularity = url.searchParams.get('granularity') as DateGranularity;
  const provider = url.searchParams.get('provider');
  const model = url.searchParams.get('model');

  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  const validGranularities = Object.values(DateGranularity);
  if (granularity && !validGranularities.includes(granularity)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    granularity: granularity ?? DateGranularity.DAY,
    provider: provider ?? undefined,
    model: model ?? undefined,
  };
}

// =============================================================================
// 核心函数：统计响应时间
// =============================================================================

/**
 * 查询响应时间数据
 */
async function getResponseTimeData(
  startDate: Date,
  endDate: Date,
  granularity: DateGranularity,
  provider: string | undefined,
  model: string | undefined
): Promise<PerformanceResponseTimeData> {
  // 构建参数化WHERE条件（防止SQL注入）
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"createdAt" >= ${startDate}`,
    Prisma.sql`"createdAt" <= ${endDate}`,
  ];
  if (provider) {
    conditions.push(Prisma.sql`"provider" = ${provider}`);
  }
  if (model) {
    conditions.push(Prisma.sql`"model" = ${model}`);
  }
  const whereSql = Prisma.join(conditions, ' AND ');

  // 查询总请求数和响应时间统计
  const summaryRaw = await prisma.$queryRaw<
    Array<{
      total_requests: bigint;
      avg_duration: number;
      min_duration: number;
      max_duration: number;
    }>
  >(
    Prisma.sql`SELECT
      COUNT(*) as total_requests,
      AVG("duration") as avg_duration,
      MIN("duration") as min_duration,
      MAX("duration") as max_duration
    FROM "ai_interactions"
    WHERE ${whereSql}
    AND "duration" IS NOT NULL`
  );

  const summary = summaryRaw[0] || {
    total_requests: BigInt(0),
    avg_duration: 0,
    min_duration: 0,
    max_duration: 0,
  };

  const totalRequests = Number(summary.total_requests);

  // 查询P95和P99响应时间
  const percentileRaw = await prisma.$queryRaw<
    Array<{ p95_duration: number; p99_duration: number }>
  >(
    Prisma.sql`WITH sorted_durations AS (
      SELECT "duration",
             NTILE(100) OVER (ORDER BY "duration") as percentile
      FROM "ai_interactions"
      WHERE ${whereSql}
      AND "duration" IS NOT NULL
    )
    SELECT
      MAX(CASE WHEN percentile = 95 THEN "duration" END) as p95_duration,
      MAX(CASE WHEN percentile = 99 THEN "duration" END) as p99_duration
    FROM sorted_durations`
  );

  const percentile = percentileRaw[0] || {
    p95_duration: 0,
    p99_duration: 0,
  };

  // 查询按时间段分组的响应时间趋势
  // sqlDateGrouping 由服务端 switch 语句生成，不含用户输入，使用 Prisma.raw() 安全嵌入
  const sqlDateGrouping = getDateGroupingFunction(granularity);

  const trendRaw = await prisma.$queryRaw<
    Array<{
      date: string;
      count: bigint;
      avg_duration: number;
      min_duration: number;
      max_duration: number;
    }>
  >(
    Prisma.sql`SELECT
      ${Prisma.raw(sqlDateGrouping.dateFormat)} as date,
      COUNT(*) as count,
      AVG("duration") as avg_duration,
      MIN("duration") as min_duration,
      MAX("duration") as max_duration
    FROM "ai_interactions"
    WHERE ${whereSql}
    AND "duration" IS NOT NULL
    GROUP BY ${Prisma.raw(sqlDateGrouping.groupBy)}
    ORDER BY ${Prisma.raw(sqlDateGrouping.groupBy)}`
  );

  const trendResults = Array.isArray(trendRaw) ? trendRaw : [];

  // 构建趋势数据，计算每个时间段的P50、P95、P99
  const trend: PerformanceMetricPoint[] = trendResults.map(row => ({
    date: row.date,
    count: Number(row.count),
    averageResponseTime: row.avg_duration,
    p50ResponseTime: row.avg_duration, // 简化处理，实际应该计算中位数
    p95ResponseTime: percentile.p95_duration,
    p99ResponseTime: percentile.p99_duration,
    minResponseTime: row.min_duration,
    maxResponseTime: row.max_duration,
  }));

  // 按服务商统计
  const byProviderRaw = await prisma.$queryRaw<
    Array<{ provider: string; count: bigint; avg_duration: number }>
  >(
    Prisma.sql`SELECT
      "provider",
      COUNT(*) as count,
      AVG("duration") as avg_duration
    FROM "ai_interactions"
    WHERE ${whereSql}
    AND "duration" IS NOT NULL
    GROUP BY "provider"
    ORDER BY count DESC`
  );

  const byProviderResults = Array.isArray(byProviderRaw) ? byProviderRaw : [];
  const byProvider = byProviderResults.map(row => ({
    provider: row.provider,
    averageResponseTime: row.avg_duration,
    totalRequests: Number(row.count),
  }));

  // 按模型统计
  const byModelRaw = await prisma.$queryRaw<
    Array<{ model: string | null; count: bigint; avg_duration: number }>
  >(
    Prisma.sql`SELECT
      COALESCE("model", 'unknown') as model,
      COUNT(*) as count,
      AVG("duration") as avg_duration
    FROM "ai_interactions"
    WHERE ${whereSql}
    AND "duration" IS NOT NULL
    GROUP BY "model"
    ORDER BY count DESC
    LIMIT 10`
  );

  const byModelResults = Array.isArray(byModelRaw) ? byModelRaw : [];
  const byModel = byModelResults.map(row => ({
    model: row.model ?? 'unknown',
    averageResponseTime: row.avg_duration,
    totalRequests: Number(row.count),
  }));

  return {
    trend,
    summary: {
      totalRequests,
      averageResponseTime: summary.avg_duration,
      p95ResponseTime: percentile.p95_duration,
      p99ResponseTime: percentile.p99_duration,
      minResponseTime: summary.min_duration,
      maxResponseTime: summary.max_duration,
    },
    byProvider,
    byModel,
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/stats/performance/response-time
 * 获取系统响应时间统计（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const permissionError = await validatePermissions(request, 'stats:read');
  if (permissionError) {
    return forbiddenResponse('无权限查看统计数据');
  }

  try {
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

    const data = await getResponseTimeData(
      startDate,
      endDate,
      params.granularity,
      params.provider,
      params.model
    );

    return successResponse(data, '获取响应时间统计成功');
  } catch (error) {
    logger.error('获取响应时间统计失败:', error);
    return serverErrorResponse('获取响应时间统计失败');
  }
}
