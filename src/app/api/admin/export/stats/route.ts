/**
 * 统计数据导出API
 * 提供统计数据的CSV和Excel导出功能
 */

import {
  errorResponse,
  forbiddenResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import {
  ExcelGenerator,
  generateExportFilename,
} from '@/lib/export/excel-generator';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type {
  CaseEfficiencyData,
  CaseTypeDistributionData,
  DebateGenerationCountData,
  DebateQualityScoreData,
  PerformanceErrorRateData,
  PerformanceResponseTimeData,
  StatsExportQueryParams,
  StatsExportType,
} from '@/types/stats';
import { DateGranularity, ExportFormat, TimeRange } from '@/types/stats';
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
function parseQueryParams(request: NextRequest): StatsExportQueryParams | null {
  const url = new URL(request.url);

  const exportType = url.searchParams.get('exportType') as StatsExportType;
  const format = url.searchParams.get('format');
  const timeRange = url.searchParams.get('timeRange') as TimeRange;

  const validExportTypes = [
    'USER_REGISTRATION',
    'USER_ACTIVITY',
    'CASE_TYPE_DISTRIBUTION',
    'CASE_EFFICIENCY',
    'DEBATE_GENERATION',
    'DEBATE_QUALITY',
    'PERFORMANCE_RESPONSE_TIME',
    'PERFORMANCE_ERROR_RATE',
  ];

  const validFormats = ['CSV', 'EXCEL', 'JSON', 'PDF'];

  if (!exportType || !validExportTypes.includes(exportType)) {
    return null;
  }

  if (format && !validFormats.includes(format)) {
    return null;
  }

  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  return {
    format: (format ?? 'CSV') as ExportFormat,
    exportType,
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
  };
}

// =============================================================================
// 核心函数：获取统计数据（真实 Prisma 查询）
// =============================================================================

/** 案件类型中文标签 */
const CASE_TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事诉讼',
  CRIMINAL: '刑事诉讼',
  ADMINISTRATIVE: '行政诉讼',
  COMMERCIAL: '商事诉讼',
  LABOR: '劳动争议',
  INTELLECTUAL: '知识产权',
  OTHER: '其他',
};

/** 计算数组中位数 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * 获取案件类型分布数据（真实查询）
 */
async function getCaseTypeDistributionData(
  startDate: Date,
  endDate: Date
): Promise<CaseTypeDistributionData> {
  const [grouped, totalCases, completedCases, activeCases] = await Promise.all([
    prisma.case.groupBy({
      by: ['type'],
      where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
      _count: { id: true },
    }),
    prisma.case.count({
      where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
    }),
    prisma.case.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null,
        status: 'COMPLETED',
      },
    }),
    prisma.case.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        deletedAt: null,
        status: 'ACTIVE',
      },
    }),
  ]);

  const distribution = grouped.map(
    (g: { type: string; _count: { id: number } }) => ({
      type: CASE_TYPE_LABELS[g.type] ?? g.type,
      count: g._count.id,
      percentage:
        totalCases > 0
          ? Math.round((g._count.id / totalCases) * 10000) / 100
          : 0,
    })
  );

  return {
    distribution,
    summary: { totalCases, completedCases, activeCases },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取案件效率数据（真实查询）
 */
async function getCaseEfficiencyData(
  startDate: Date,
  endDate: Date
): Promise<CaseEfficiencyData> {
  const completedCases = await prisma.case.findMany({
    where: {
      status: 'COMPLETED',
      updatedAt: { gte: startDate, lte: endDate },
      deletedAt: null,
    },
    select: { id: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'asc' },
  });

  const completionHours = completedCases.map(
    (c: { createdAt: Date; updatedAt: Date }) =>
      Math.round(
        ((c.updatedAt.getTime() - c.createdAt.getTime()) / 3_600_000) * 100
      ) / 100
  );

  const avg =
    completionHours.length > 0
      ? Math.round(
          (completionHours.reduce((s: number, v: number) => s + v, 0) /
            completionHours.length) *
            100
        ) / 100
      : 0;

  // 按天分组生成趋势
  const byDay = new Map<string, number[]>();
  completedCases.forEach((c: { updatedAt: Date }, i: number) => {
    const day = c.updatedAt.toISOString().slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(completionHours[i]);
    byDay.set(day, arr);
  });

  const trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, times]) => ({
      date,
      completedCases: times.length,
      averageCompletionTime:
        Math.round((times.reduce((s, v) => s + v, 0) / times.length) * 100) /
        100,
      medianCompletionTime: median(times),
    }));

  return {
    trend,
    summary: {
      totalCompletedCases: completionHours.length,
      averageCompletionTime: avg,
      medianCompletionTime: median(completionHours),
      fastestCompletionTime:
        completionHours.length > 0 ? Math.min(...completionHours) : 0,
      slowestCompletionTime:
        completionHours.length > 0 ? Math.max(...completionHours) : 0,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取辩论生成次数数据（真实查询）
 */
async function getDebateGenerationCountData(
  startDate: Date,
  endDate: Date
): Promise<DebateGenerationCountData> {
  const [debates, prevDebates] = await Promise.all([
    prisma.debate.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, deletedAt: null },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.debate.count({
      where: {
        createdAt: {
          gte: new Date(
            startDate.getTime() - (endDate.getTime() - startDate.getTime())
          ),
          lt: startDate,
        },
        deletedAt: null,
      },
    }),
  ]);

  const debateIds = debates.map((d: { id: string }) => d.id);
  // Count arguments via debate_rounds → argument chain
  let totalArguments = 0;
  if (debateIds.length > 0) {
    const rounds = await prisma.debateRound.findMany({
      where: { debateId: { in: debateIds } },
      select: { id: true },
    });
    const roundIds = rounds.map((r: { id: string }) => r.id);
    if (roundIds.length > 0) {
      totalArguments = await prisma.argument.count({
        where: { roundId: { in: roundIds } },
      });
    }
  }

  const totalDebates = debates.length;
  const avgArgs =
    totalDebates > 0
      ? Math.round((totalArguments / totalDebates) * 100) / 100
      : 0;
  const growthRate =
    prevDebates > 0
      ? Math.round(((totalDebates - prevDebates) / prevDebates) * 10000) / 100
      : 0;

  // 按天分组
  const byDay = new Map<string, Array<{ id: string; createdAt: Date }>>();
  debates.forEach((d: { id: string; createdAt: Date }) => {
    const day = d.createdAt.toISOString().slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), d]);
  });

  const trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayDebates]) => ({
      date,
      debatesCreated: dayDebates.length,
      argumentsGenerated: 0, // arguments 按天聚合需要 JOIN，此处简化
      averageArgumentsPerDebate: avgArgs,
    }));

  return {
    trend,
    summary: {
      totalDebates,
      totalArguments,
      averageArgumentsPerDebate: avgArgs,
      growthRate,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取辩论质量评分数据（真实查询）
 */
async function getDebateQualityScoreData(
  startDate: Date,
  endDate: Date
): Promise<DebateQualityScoreData> {
  const args = await prisma.argument.findMany({
    where: {
      legalScore: { not: null },
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { legalScore: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const scores = args.map(
    (a: { legalScore: number | null; createdAt: Date }) => a.legalScore ?? 0
  );
  const threshold = 0.8;
  const avg =
    scores.length > 0
      ? scores.reduce((s: number, v: number) => s + v, 0) / scores.length
      : 0;

  const distribution = {
    excellent: scores.filter((s: number) => s >= 0.9).length,
    good: scores.filter((s: number) => s >= 0.75 && s < 0.9).length,
    average: scores.filter((s: number) => s >= 0.6 && s < 0.75).length,
    poor: scores.filter((s: number) => s < 0.6).length,
    totalCount: scores.length,
  };

  // 按天分组趋势
  const byDay = new Map<string, number[]>();
  args.forEach((a: { legalScore: number | null; createdAt: Date }) => {
    const day = a.createdAt.toISOString().slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(a.legalScore ?? 0);
    byDay.set(day, arr);
  });

  const trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayScores]) => ({
      date,
      averageScore:
        Math.round(
          (dayScores.reduce((s: number, v: number) => s + v, 0) /
            dayScores.length) *
            1000
        ) / 1000,
      minScore: Math.min(...dayScores),
      maxScore: Math.max(...dayScores),
      medianScore: median(dayScores),
      argumentsCount: dayScores.length,
    }));

  return {
    trend,
    distribution,
    summary: {
      averageScore: Math.round(avg * 1000) / 1000,
      medianScore: median(scores),
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      scoreAboveThreshold: scores.filter((s: number) => s >= threshold).length,
      threshold,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取性能响应时间数据（真实查询）
 */
async function getPerformanceResponseTimeData(
  startDate: Date,
  endDate: Date
): Promise<PerformanceResponseTimeData> {
  const interactions = await prisma.aIInteraction.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      duration: { not: null },
    },
    select: { duration: true, provider: true, model: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  type AIRow = {
    duration: number | null;
    provider: string;
    model: string | null;
    createdAt: Date;
  };
  const durations = interactions.map((i: AIRow) => i.duration ?? 0);
  const total = interactions.length;

  const sortedDurations = [...durations].sort((a: number, b: number) => a - b);
  const p95Idx = Math.floor(total * 0.95);
  const p99Idx = Math.floor(total * 0.99);

  // 按天分组趋势
  const byDay = new Map<string, number[]>();
  interactions.forEach((i: AIRow) => {
    const day = i.createdAt.toISOString().slice(0, 10);
    const arr = byDay.get(day) ?? [];
    arr.push(i.duration ?? 0);
    byDay.set(day, arr);
  });

  const trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => {
      const sorted = [...d].sort((a: number, b: number) => a - b);
      return {
        date,
        count: d.length,
        averageResponseTime: Math.round(
          d.reduce((s: number, v: number) => s + v, 0) / d.length
        ),
        p50ResponseTime: sorted[Math.floor(d.length * 0.5)] ?? 0,
        p95ResponseTime: sorted[Math.floor(d.length * 0.95)] ?? 0,
        p99ResponseTime: sorted[Math.floor(d.length * 0.99)] ?? 0,
        minResponseTime: Math.min(...d),
        maxResponseTime: Math.max(...d),
      };
    });

  // 按 provider 聚合
  const providerMap = new Map<string, number[]>();
  interactions.forEach((i: AIRow) => {
    const arr = providerMap.get(i.provider) ?? [];
    arr.push(i.duration ?? 0);
    providerMap.set(i.provider, arr);
  });
  const byProvider = Array.from(providerMap.entries()).map(([provider, d]) => ({
    provider,
    averageResponseTime: Math.round(
      d.reduce((s: number, v: number) => s + v, 0) / d.length
    ),
    totalRequests: d.length,
  }));

  // 按 model 聚合
  const modelMap = new Map<string, number[]>();
  interactions.forEach((i: AIRow) => {
    if (!i.model) return;
    const arr = modelMap.get(i.model) ?? [];
    arr.push(i.duration ?? 0);
    modelMap.set(i.model, arr);
  });
  const byModel = Array.from(modelMap.entries()).map(([model, d]) => ({
    model,
    averageResponseTime: Math.round(
      d.reduce((s: number, v: number) => s + v, 0) / d.length
    ),
    totalRequests: d.length,
  }));

  return {
    trend,
    summary: {
      totalRequests: total,
      averageResponseTime:
        total > 0
          ? Math.round(
              durations.reduce((s: number, v: number) => s + v, 0) / total
            )
          : 0,
      p95ResponseTime: sortedDurations[p95Idx] ?? 0,
      p99ResponseTime: sortedDurations[p99Idx] ?? 0,
      minResponseTime: total > 0 ? Math.min(...durations) : 0,
      maxResponseTime: total > 0 ? Math.max(...durations) : 0,
    },
    byProvider,
    byModel,
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取性能错误率数据（真实查询）
 */
async function getPerformanceErrorRateData(
  startDate: Date,
  endDate: Date
): Promise<PerformanceErrorRateData> {
  const interactions = await prisma.aIInteraction.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    select: { success: true, error: true, provider: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const total = interactions.length;
  const successCount = interactions.filter(i => i.success).length;
  const errorCount = total - successCount;
  const errorRate =
    total > 0 ? Math.round((errorCount / total) * 10000) / 100 : 0;

  // 错误类型分析（根据 error 字段关键词分类）
  const errorItems = interactions.filter(i => !i.success && i.error);
  const typeMap = new Map<string, number>();
  errorItems.forEach(i => {
    const msg = (i.error ?? '').toLowerCase();
    let type = 'other';
    if (msg.includes('timeout') || msg.includes('超时')) type = 'timeout';
    else if (
      msg.includes('rate') ||
      msg.includes('限流') ||
      msg.includes('quota')
    )
      type = 'rate_limit';
    else if (msg.includes('auth') || msg.includes('401') || msg.includes('403'))
      type = 'auth_error';
    else if (msg.includes('network') || msg.includes('connect'))
      type = 'network_error';
    else type = 'api_error';
    typeMap.set(type, (typeMap.get(type) ?? 0) + 1);
  });
  const byErrorType = Array.from(typeMap.entries()).map(
    ([errorType, count]) => ({
      errorType,
      count,
      percentage:
        errorCount > 0 ? Math.round((count / errorCount) * 10000) / 100 : 0,
      recovered: 0,
      recoveryRate: 0,
    })
  );

  // 按 provider 聚合
  const providerMap = new Map<string, { total: number; errors: number }>();
  interactions.forEach(i => {
    const entry = providerMap.get(i.provider) ?? { total: 0, errors: 0 };
    entry.total++;
    if (!i.success) entry.errors++;
    providerMap.set(i.provider, entry);
  });
  const byProvider = Array.from(providerMap.entries()).map(([provider, v]) => ({
    provider,
    totalRequests: v.total,
    errorCount: v.errors,
    errorRate: v.total > 0 ? Math.round((v.errors / v.total) * 10000) / 100 : 0,
  }));

  // 按天分组趋势
  const byDay = new Map<string, { total: number; success: number }>();
  interactions.forEach(i => {
    const day = i.createdAt.toISOString().slice(0, 10);
    const entry = byDay.get(day) ?? { total: 0, success: 0 };
    entry.total++;
    if (i.success) entry.success++;
    byDay.set(day, entry);
  });

  const trend = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      totalRequests: v.total,
      successCount: v.success,
      errorCount: v.total - v.success,
      errorRate:
        v.total > 0
          ? Math.round(((v.total - v.success) / v.total) * 10000) / 100
          : 0,
      recoveredCount: 0,
      recoveryRate: 0,
    }));

  // 严重程度分布（按错误率分段）
  const bySeverity = [
    {
      severity: 'high',
      count: byProvider
        .filter(p => p.errorRate >= 10)
        .reduce((s, p) => s + p.errorCount, 0),
      percentage: 0,
    },
    {
      severity: 'medium',
      count: byProvider
        .filter(p => p.errorRate >= 3 && p.errorRate < 10)
        .reduce((s, p) => s + p.errorCount, 0),
      percentage: 0,
    },
    {
      severity: 'low',
      count: byProvider
        .filter(p => p.errorRate < 3)
        .reduce((s, p) => s + p.errorCount, 0),
      percentage: 0,
    },
  ].map(s => ({
    ...s,
    percentage:
      errorCount > 0 ? Math.round((s.count / errorCount) * 10000) / 100 : 0,
  }));

  return {
    trend,
    summary: {
      totalRequests: total,
      successCount,
      errorCount,
      errorRate,
      recoveredCount: 0,
      recoveryRate: 0,
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

/**
 * 获取用户注册趋势数据（用于导出）
 */
async function getUserRegistrationData(
  startDate: Date,
  endDate: Date
): Promise<unknown> {
  const [total, newUsers, byDay] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: startDate, lte: endDate } },
    }),
    prisma.user.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: startDate, lte: endDate } },
      _count: { id: true },
    }),
  ]);

  const dayMap = new Map<string, number>();
  byDay.forEach((row: { createdAt: Date; _count: { id: number } }) => {
    const day = row.createdAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + row._count.id);
  });

  const days = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
  );

  return {
    trend: Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, newUsers: count })),
    summary: {
      totalUsers: total,
      newUsers,
      growthRate:
        total > newUsers
          ? Math.round(((newUsers / (total - newUsers)) * 10000) / 100)
          : 0,
      averageDaily: Math.round(newUsers / days),
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 获取用户活跃度数据（用于导出）
 */
async function getUserActivityData(
  startDate: Date,
  endDate: Date
): Promise<unknown> {
  const now = new Date();
  const dayMs = 86400000;
  const weekMs = 7 * dayMs;
  const monthMs = 30 * dayMs;

  const [total, veryActive, active, inactive] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: { lastLoginAt: { gte: new Date(now.getTime() - dayMs) } },
    }),
    prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(now.getTime() - weekMs),
          lt: new Date(now.getTime() - dayMs),
        },
      },
    }),
    prisma.user.count({
      where: {
        lastLoginAt: {
          gte: new Date(now.getTime() - monthMs),
          lt: new Date(now.getTime() - weekMs),
        },
      },
    }),
  ]);

  const dormant = Math.max(0, total - veryActive - active - inactive);
  const activeUsers = veryActive + active;

  return {
    distribution: { veryActive, active, inactive, dormant },
    summary: {
      totalUsers: total,
      activeUsers,
      activeRate: total > 0 ? Math.round((activeUsers / total) * 10000) / 100 : 0,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

/**
 * 根据导出类型获取统计数据
 */
async function getStatsDataByType(
  exportType: StatsExportType,
  startDate: Date,
  endDate: Date
): Promise<unknown> {
  switch (exportType) {
    case 'USER_REGISTRATION':
      return await getUserRegistrationData(startDate, endDate);
    case 'USER_ACTIVITY':
      return await getUserActivityData(startDate, endDate);
    case 'CASE_TYPE_DISTRIBUTION':
      return await getCaseTypeDistributionData(startDate, endDate);
    case 'CASE_EFFICIENCY':
      return await getCaseEfficiencyData(startDate, endDate);
    case 'DEBATE_GENERATION':
      return await getDebateGenerationCountData(startDate, endDate);
    case 'DEBATE_QUALITY':
      return await getDebateQualityScoreData(startDate, endDate);
    case 'PERFORMANCE_RESPONSE_TIME':
      return await getPerformanceResponseTimeData(startDate, endDate);
    case 'PERFORMANCE_ERROR_RATE':
      return await getPerformanceErrorRateData(startDate, endDate);
    default:
      throw new Error(`不支持的导出类型: ${exportType}`);
  }
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/export/stats
 * 导出统计数据（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  const permissionError = await validatePermissions(request, 'export:stats');
  if (permissionError) {
    return forbiddenResponse('无权限导出数据');
  }

  try {
    const params = parseQueryParams(request);
    if (!params) {
      return errorResponse('无效的查询参数', 400);
    }

    const { startDate, endDate } = getDateRange(
      params.timeRange ?? TimeRange.LAST_30_DAYS
    );

    const data = await getStatsDataByType(
      params.exportType,
      startDate,
      endDate
    );

    const headers = ['key', 'value'];
    const rows: Array<Record<string, unknown>> = [];

    const flattenData = (obj: unknown, prefix: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key];
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (
          typeof value === 'object' &&
          value !== null &&
          !Array.isArray(value)
        ) {
          flattenData(value, newKey);
        } else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            rows.push({
              key: `${newKey}[${i}]`,
              value:
                typeof value[i] === 'object' && value[i] !== null
                  ? JSON.stringify(value[i])
                  : String(value[i]),
            });
          }
        } else {
          rows.push({
            key: newKey,
            value: String(value),
          });
        }
      }
    };

    flattenData(data);

    const generator = ExcelGenerator.fromArray(rows, headers, '统计数据');
    const blob = generator.toBlob();

    const filename = generateExportFilename(params.exportType, params.format);

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': blob.type,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('导出统计数据失败:', error);
    return serverErrorResponse('导出统计数据失败');
  }
}
