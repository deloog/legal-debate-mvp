/**
 * 系统性能统计API - 错误率
 * 提供系统错误率统计，支持多维度筛选
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
  PerformanceErrorRateData,
  PerformanceErrorRateQueryParams,
  TimeRange,
  type ErrorRatePoint,
  type ErrorTypeDistribution,
  type SeverityDistribution,
} from '@/types/stats';
import { NextRequest, NextResponse } from 'next/server';

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

// =============================================================================
// 辅助函数：参数解析
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(
  request: NextRequest
): PerformanceErrorRateQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const provider = url.searchParams.get('provider');
  const model = url.searchParams.get('model');
  const errorType = url.searchParams.get('errorType');
  const minSeverity = url.searchParams.get('minSeverity');
  const includeRecovered = url.searchParams.get('includeRecovered');

  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    provider: provider ?? undefined,
    model: model ?? undefined,
    errorType: errorType ?? undefined,
    minSeverity: minSeverity ?? undefined,
    includeRecovered: includeRecovered === 'true',
  };
}

// =============================================================================
// 核心函数：统计错误率
// =============================================================================

/**
 * 查询错误率数据
 */
async function getErrorRateData(
  startDate: Date,
  endDate: Date,
  provider: string | undefined,
  model: string | undefined,
  errorType: string | undefined
): Promise<PerformanceErrorRateData> {
  // 构建WHERE条件
  const whereConditions = [
    `"createdAt" >= '${startDate.toISOString()}'`,
    `"createdAt" <= '${endDate.toISOString()}'`,
  ];
  if (provider) {
    whereConditions.push(`"provider" = '${provider}'`);
  }
  if (model) {
    whereConditions.push(`"model" = '${model}'`);
  }
  const whereSql = whereConditions.join(' AND ');

  // 查询AI交互统计
  const aiStatsRaw = (await prisma.$queryRawUnsafe<
    Array<{
      total_requests: bigint;
      success_count: bigint;
      error_count: bigint;
    }>
  >(
    `SELECT 
      COUNT(*) as total_requests,
      SUM(CASE WHEN "success" = true THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) as error_count
    FROM "ai_interactions"
    WHERE ${whereSql}`
  )) as Array<{
    total_requests: bigint;
    success_count: bigint;
    error_count: bigint;
  }>;

  const aiStats = aiStatsRaw[0] || {
    total_requests: BigInt(0),
    success_count: BigInt(0),
    error_count: BigInt(0),
  };

  const totalRequests = Number(aiStats.total_requests);
  const successCount = Number(aiStats.success_count);
  const errorCount = Number(aiStats.error_count);
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;

  // 查询错误日志统计
  const errorLogsWhereConditions = [
    `"createdAt" >= '${startDate.toISOString()}'`,
    `"createdAt" <= '${endDate.toISOString()}'`,
  ];
  if (errorType) {
    errorLogsWhereConditions.push(`"errorType" = '${errorType}'`);
  }
  const errorLogsWhereSql = errorLogsWhereConditions.join(' AND ');

  const errorLogsRaw = (await prisma.$queryRawUnsafe<
    Array<{
      total_errors: bigint;
      recovered_errors: bigint;
    }>
  >(
    `SELECT 
      COUNT(*) as total_errors,
      SUM(CASE WHEN "recovered" = true THEN 1 ELSE 0 END) as recovered_errors
    FROM "error_logs"
    WHERE ${errorLogsWhereSql}`
  )) as Array<{
    total_errors: bigint;
    recovered_errors: bigint;
  }>;

  const errorLogs = errorLogsRaw[0] || {
    total_errors: BigInt(0),
    recovered_errors: BigInt(0),
  };

  const totalErrors = Number(errorLogs.total_errors);
  const recoveredCount = Number(errorLogs.recovered_errors);
  const recoveryRate =
    totalErrors > 0 ? (recoveredCount / totalErrors) * 100 : 0;

  // 按服务商统计错误率
  const byProviderRaw = (await prisma.$queryRawUnsafe<
    Array<{
      provider: string;
      total_requests: bigint;
      error_count: bigint;
    }>
  >(
    `SELECT 
      "provider",
      COUNT(*) as total_requests,
      SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) as error_count
    FROM "ai_interactions"
    WHERE ${whereSql}
    GROUP BY "provider"
    ORDER BY total_requests DESC`
  )) as Array<{
    provider: string;
    total_requests: bigint;
    error_count: bigint;
  }>;

  const byProviderResults = Array.isArray(byProviderRaw) ? byProviderRaw : [];
  const byProvider = byProviderResults.map(row => ({
    provider: row.provider,
    totalRequests: Number(row.total_requests),
    errorCount: Number(row.error_count),
    errorRate:
      Number(row.total_requests) > 0
        ? (Number(row.error_count) / Number(row.total_requests)) * 100
        : 0,
  }));

  // 按错误类型分布
  const byErrorTypeRaw = (await prisma.$queryRawUnsafe<
    Array<{ error_type: string; count: bigint; recovered: bigint }>
  >(
    `SELECT 
      "errorType" as error_type,
      COUNT(*) as count,
      SUM(CASE WHEN "recovered" = true THEN 1 ELSE 0 END) as recovered
    FROM "error_logs"
    WHERE ${errorLogsWhereSql}
    GROUP BY "errorType"
    ORDER BY count DESC`
  )) as Array<{ error_type: string; count: bigint; recovered: bigint }>;

  const byErrorTypeResults = Array.isArray(byErrorTypeRaw)
    ? byErrorTypeRaw
    : [];
  const byErrorType: ErrorTypeDistribution[] = byErrorTypeResults.map(row => ({
    errorType: row.error_type,
    count: Number(row.count),
    percentage: totalErrors > 0 ? (Number(row.count) / totalErrors) * 100 : 0,
    recovered: Number(row.recovered),
    recoveryRate:
      Number(row.count) > 0
        ? (Number(row.recovered) / Number(row.count)) * 100
        : 0,
  }));

  // 按严重程度分布
  const bySeverityRaw = (await prisma.$queryRawUnsafe<
    Array<{ severity: string; count: bigint }>
  >(
    `SELECT 
      "severity" as severity,
      COUNT(*) as count
    FROM "error_logs"
    WHERE ${errorLogsWhereSql}
    GROUP BY "severity"
    ORDER BY count DESC`
  )) as Array<{ severity: string; count: bigint }>;

  const bySeverityResults = Array.isArray(bySeverityRaw) ? bySeverityRaw : [];
  const bySeverity: SeverityDistribution[] = bySeverityResults.map(row => ({
    severity: row.severity,
    count: Number(row.count),
    percentage: totalErrors > 0 ? (Number(row.count) / totalErrors) * 100 : 0,
  }));

  // 按天统计错误率趋势
  const trendRaw = (await prisma.$queryRawUnsafe<
    Array<{
      date: string;
      total_requests: bigint;
      success_count: bigint;
      error_count: bigint;
      recovered_count: bigint;
    }>
  >(
    `SELECT 
      TO_CHAR(DATE_TRUNC('day', "ai_interactions"."createdAt"), 'YYYY-MM-DD') as date,
      COUNT(*) as total_requests,
      SUM(CASE WHEN "success" = true THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN "success" = false THEN 1 ELSE 0 END) as error_count,
      0 as recovered_count
    FROM "ai_interactions"
    WHERE ${whereSql}
    GROUP BY TO_CHAR(DATE_TRUNC('day', "ai_interactions"."createdAt"), 'YYYY-MM-DD')
    ORDER BY TO_CHAR(DATE_TRUNC('day', "ai_interactions"."createdAt"), 'YYYY-MM-DD')`
  )) as Array<{
    date: string;
    total_requests: bigint;
    success_count: bigint;
    error_count: bigint;
    recovered_count: bigint;
  }>;

  const trendResults = Array.isArray(trendRaw) ? trendRaw : [];
  const trend: ErrorRatePoint[] = trendResults.map(row => {
    const total = Number(row.total_requests);
    const errors = Number(row.error_count);
    const recovered = Number(row.recovered_count);
    return {
      date: row.date,
      totalRequests: total,
      successCount: Number(row.success_count),
      errorCount: errors,
      errorRate: total > 0 ? (errors / total) * 100 : 0,
      recoveredCount: recovered,
      recoveryRate: errors > 0 ? (recovered / errors) * 100 : 0,
    };
  });

  return {
    trend,
    summary: {
      totalRequests,
      successCount,
      errorCount,
      errorRate,
      recoveredCount,
      recoveryRate,
    },
    byErrorType,
    bySeverity,
    byProvider,
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
 * GET /api/stats/performance/error-rate
 * 获取系统错误率统计（管理员权限）
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

    const data = await getErrorRateData(
      startDate,
      endDate,
      params.provider,
      params.model,
      params.errorType
    );

    return successResponse(data, '获取错误率统计成功');
  } catch (error) {
    console.error('获取错误率统计失败:', error);
    return serverErrorResponse('获取错误率统计失败');
  }
}
