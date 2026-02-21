/**
 * 律师绩效分析API
 * 提供律师绩效数据：案件量、胜诉率、创收、工作时长
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
  type LawyerCaseVolumeData,
  type LawyerEfficiencyData,
  type LawyerPerformanceData,
  type LawyerPerformanceQueryParams,
  type LawyerRevenueData,
  type LawyerSuccessRateData,
  type LawyerWorkHoursData,
} from '@/types/stats';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数：参数解析
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
 * 解析查询参数
 */
function parseQueryParams(
  request: NextRequest
): LawyerPerformanceQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const teamId = url.searchParams.get('teamId');
  const role = url.searchParams.get('role');
  const sortBy = url.searchParams.get('sortBy') as
    | 'caseVolume'
    | 'successRate'
    | 'revenue'
    | 'efficiency'
    | null;
  const sortOrder = url.searchParams.get('sortOrder') as 'asc' | 'desc' | null;
  const page = url.searchParams.get('page');
  const limit = url.searchParams.get('limit');

  // 验证timeRange
  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  // 验证sortBy
  const validSortBy = ['caseVolume', 'successRate', 'revenue', 'efficiency'];
  if (sortBy && !validSortBy.includes(sortBy)) {
    return null;
  }

  // 验证sortOrder
  const validSortOrder = ['asc', 'desc'];
  if (sortOrder && !validSortOrder.includes(sortOrder)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    teamId: teamId ?? undefined,
    role: role ?? undefined,
    sortBy: sortBy ?? 'caseVolume',
    sortOrder: sortOrder ?? 'desc',
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 50,
  };
}

// =============================================================================
// 核心函数：获取律师案件量统计
// =============================================================================

/**
 * 获取律师案件量数据
 */
async function getLawyerCaseVolume(
  startDate: Date,
  endDate: Date,
  teamId?: string,
  role?: string
): Promise<LawyerCaseVolumeData[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"c"."createdAt" >= ${startDate}`,
    Prisma.sql`"c"."createdAt" <= ${endDate}`,
    Prisma.sql`"c"."deletedAt" IS NULL`,
  ];

  if (teamId) {
    conditions.push(
      Prisma.sql`"u"."id" IN (
        SELECT "userId" FROM "team_members"
        WHERE "teamId" = ${teamId} AND "status" = 'ACTIVE'
      )`
    );
  }

  if (role) {
    conditions.push(Prisma.sql`"u"."role" = ${role}`);
  }

  const results = await prisma.$queryRaw<
    Array<{
      lawyerId: string;
      lawyerName: string | null;
      lawyerRole: string;
      totalCases: bigint;
      activeCases: bigint;
      completedCases: bigint;
      archivedCases: bigint;
    }>
  >(
    Prisma.sql`SELECT
      "u"."id" as "lawyerId",
      "u"."name" as "lawyerName",
      "u"."role" as "lawyerRole",
      COUNT("c"."id") as "totalCases",
      COUNT(*) FILTER (WHERE "c"."status" = 'ACTIVE') as "activeCases",
      COUNT(*) FILTER (WHERE "c"."status" = 'COMPLETED') as "completedCases",
      COUNT(*) FILTER (WHERE "c"."status" = 'ARCHIVED') as "archivedCases"
    FROM "users" u
    INNER JOIN "cases" c ON "c"."createdBy" = "u"."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY "u"."id", "u"."name", "u"."role"
    ORDER BY "totalCases" DESC`
  );

  return (Array.isArray(results) ? results : []).map(row => ({
    lawyerId: row.lawyerId,
    lawyerName: row.lawyerName ?? '',
    lawyerRole: row.lawyerRole,
    totalCases: Number(row.totalCases),
    activeCases: Number(row.activeCases),
    completedCases: Number(row.completedCases),
    archivedCases: Number(row.archivedCases),
  }));
}

// =============================================================================
// 核心函数：获取律师胜诉率统计
// =============================================================================

/**
 * 获取律师胜诉率数据
 */
async function getLawyerSuccessRate(
  startDate: Date,
  endDate: Date,
  teamId?: string,
  role?: string
): Promise<LawyerSuccessRateData[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"c"."createdAt" >= ${startDate}`,
    Prisma.sql`"c"."createdAt" <= ${endDate}`,
    Prisma.sql`"c"."deletedAt" IS NULL`,
  ];

  if (teamId) {
    conditions.push(
      Prisma.sql`"u"."id" IN (
        SELECT "userId" FROM "team_members"
        WHERE "teamId" = ${teamId} AND "status" = 'ACTIVE'
      )`
    );
  }

  if (role) {
    conditions.push(Prisma.sql`"u"."role" = ${role}`);
  }

  const results = await prisma.$queryRaw<
    Array<{
      lawyerId: string;
      lawyerName: string | null;
      lawyerRole: string;
      totalCases: bigint;
      successfulCases: bigint;
    }>
  >(
    Prisma.sql`SELECT
      "u"."id" as "lawyerId",
      "u"."name" as "lawyerName",
      "u"."role" as "lawyerRole",
      COUNT("c"."id") as "totalCases",
      COUNT(*) FILTER (WHERE "c"."status" = 'COMPLETED') as "successfulCases"
    FROM "users" u
    INNER JOIN "cases" c ON "c"."createdBy" = "u"."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY "u"."id", "u"."name", "u"."role"
    HAVING COUNT("c"."id") > 0
    ORDER BY "successfulCases" DESC`
  );

  const lawyerSuccessRates = (Array.isArray(results) ? results : []).map(
    row => ({
      lawyerId: row.lawyerId,
      lawyerName: row.lawyerName ?? '',
      lawyerRole: row.lawyerRole,
      totalCases: Number(row.totalCases),
      successfulCases: Number(row.successfulCases),
      successRate:
        Number(row.totalCases) > 0
          ? (Number(row.successfulCases) / Number(row.totalCases)) * 100
          : 0,
      byType: [],
    })
  );

  // 按案件类型统计胜诉率
  for (const lawyer of lawyerSuccessRates) {
    const byTypeResults = await prisma.$queryRaw<
      Array<{
        type: string;
        totalCases: bigint;
        successfulCases: bigint;
      }>
    >(
      Prisma.sql`SELECT
        "c"."type",
        COUNT("c"."id") as "totalCases",
        COUNT(*) FILTER (WHERE "c"."status" = 'COMPLETED') as "successfulCases"
      FROM "cases" c
      WHERE "c"."createdBy" = ${lawyer.lawyerId}
        AND "c"."createdAt" >= ${startDate}
        AND "c"."createdAt" <= ${endDate}
        AND "c"."deletedAt" IS NULL
      GROUP BY "c"."type"
      ORDER BY "totalCases" DESC
      LIMIT 5`
    );

    lawyer.byType = (Array.isArray(byTypeResults) ? byTypeResults : []).map(
      row => ({
        type: row.type,
        totalCases: Number(row.totalCases),
        successfulCases: Number(row.successfulCases),
        successRate:
          Number(row.totalCases) > 0
            ? (Number(row.successfulCases) / Number(row.totalCases)) * 100
            : 0,
      })
    );
  }

  return lawyerSuccessRates;
}

// =============================================================================
// 核心函数：获取律师创收统计
// =============================================================================

/**
 * 获取律师创收数据
 */
async function getLawyerRevenue(
  startDate: Date,
  endDate: Date,
  teamId?: string,
  role?: string
): Promise<LawyerRevenueData[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"c"."createdAt" >= ${startDate}`,
    Prisma.sql`"c"."createdAt" <= ${endDate}`,
    Prisma.sql`"c"."deletedAt" IS NULL`,
    Prisma.sql`"c"."amount" IS NOT NULL`,
  ];

  if (teamId) {
    conditions.push(
      Prisma.sql`"u"."id" IN (
        SELECT "userId" FROM "team_members"
        WHERE "teamId" = ${teamId} AND "status" = 'ACTIVE'
      )`
    );
  }

  if (role) {
    conditions.push(Prisma.sql`"u"."role" = ${role}`);
  }

  const results = await prisma.$queryRaw<
    Array<{
      lawyerId: string;
      lawyerName: string | null;
      lawyerRole: string;
      totalRevenue: string;
      avg: string;
      max: string;
      min: string;
    }>
  >(
    Prisma.sql`SELECT
      "u"."id" as "lawyerId",
      "u"."name" as "lawyerName",
      "u"."role" as "lawyerRole",
      ROUND(SUM("c"."amount"), 2) as "totalRevenue",
      ROUND(AVG("c"."amount"), 2) as "avg",
      ROUND(MAX("c"."amount"), 2) as "max",
      ROUND(MIN("c"."amount"), 2) as "min"
    FROM "users" u
    INNER JOIN "cases" c ON "c"."createdBy" = "u"."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY "u"."id", "u"."name", "u"."role"
    HAVING SUM("c"."amount") IS NOT NULL
    ORDER BY "totalRevenue" DESC`
  );

  const lawyerRevenues = (Array.isArray(results) ? results : []).map(row => ({
    lawyerId: row.lawyerId,
    lawyerName: row.lawyerName ?? '',
    lawyerRole: row.lawyerRole,
    totalRevenue: Number(row.totalRevenue),
    averageRevenue: Number(row.avg),
    maxRevenue: Number(row.max),
    minRevenue: Number(row.min),
    revenueByType: [],
  }));

  // 按案件类型统计创收
  for (const lawyer of lawyerRevenues) {
    const revenueByTypeResults = await prisma.$queryRaw<
      Array<{
        type: string;
        totalRevenue: string;
        count: bigint;
      }>
    >(
      Prisma.sql`SELECT
        "c"."type",
        ROUND(SUM("c"."amount"), 2) as "totalRevenue",
        COUNT("c"."id") as "count"
      FROM "cases" c
      WHERE "c"."createdBy" = ${lawyer.lawyerId}
        AND "c"."createdAt" >= ${startDate}
        AND "c"."createdAt" <= ${endDate}
        AND "c"."deletedAt" IS NULL
        AND "c"."amount" IS NOT NULL
      GROUP BY "c"."type"
      ORDER BY "totalRevenue" DESC
      LIMIT 5`
    );

    lawyer.revenueByType = (
      Array.isArray(revenueByTypeResults) ? revenueByTypeResults : []
    ).map(row => ({
      type: row.type,
      totalRevenue: Number(row.totalRevenue),
      caseCount: Number(row.count),
      percentage:
        lawyer.totalRevenue > 0
          ? (Number(row.totalRevenue) / lawyer.totalRevenue) * 100
          : 0,
    }));
  }

  return lawyerRevenues;
}

// =============================================================================
// 核心函数：获取律师效率统计
// =============================================================================

/**
 * 获取律师效率数据
 */
async function getLawyerEfficiency(
  startDate: Date,
  endDate: Date,
  teamId?: string,
  role?: string
): Promise<LawyerEfficiencyData[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"c"."status" = 'COMPLETED'`,
    Prisma.sql`"c"."createdAt" >= ${startDate}`,
    Prisma.sql`"c"."createdAt" <= ${endDate}`,
    Prisma.sql`"c"."deletedAt" IS NULL`,
  ];

  if (teamId) {
    conditions.push(
      Prisma.sql`"u"."id" IN (
        SELECT "userId" FROM "team_members"
        WHERE "teamId" = ${teamId} AND "status" = 'ACTIVE'
      )`
    );
  }

  if (role) {
    conditions.push(Prisma.sql`"u"."role" = ${role}`);
  }

  const results = await prisma.$queryRaw<
    Array<{
      lawyerId: string;
      lawyerName: string | null;
      lawyerRole: string;
      completedCases: bigint;
      avgDuration: string;
      medianDuration: string;
      fastestDuration: string;
      slowestDuration: string;
    }>
  >(
    Prisma.sql`SELECT
      "u"."id" as "lawyerId",
      "u"."name" as "lawyerName",
      "u"."role" as "lawyerRole",
      COUNT("c"."id") as "completedCases",
      ROUND(AVG(EXTRACT(EPOCH FROM ("c"."updatedAt" - "c"."createdAt")) / 86400), 2) as "avgDuration",
      ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("c"."updatedAt" - "c"."createdAt")) / 86400), 2) as "medianDuration",
      ROUND(MIN(EXTRACT(EPOCH FROM ("c"."updatedAt" - "c"."createdAt")) / 86400), 2) as "fastestDuration",
      ROUND(MAX(EXTRACT(EPOCH FROM ("c"."updatedAt" - "c"."createdAt")) / 86400), 2) as "slowestDuration"
    FROM "users" u
    INNER JOIN "cases" c ON "c"."createdBy" = "u"."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY "u"."id", "u"."name", "u"."role"
    HAVING COUNT("c"."id") > 0
    ORDER BY "avgDuration" ASC`
  );

  return (Array.isArray(results) ? results : []).map(row => {
    const avgDays = Number(row.avgDuration);
    const efficiencyRating: LawyerEfficiencyData['efficiencyRating'] =
      avgDays <= 7
        ? 'EXCELLENT'
        : avgDays <= 14
          ? 'GOOD'
          : avgDays <= 30
            ? 'AVERAGE'
            : 'POOR';

    return {
      lawyerId: row.lawyerId,
      lawyerName: row.lawyerName ?? '',
      lawyerRole: row.lawyerRole,
      completedCases: Number(row.completedCases),
      averageCompletionTime: avgDays,
      medianCompletionTime: Number(row.medianDuration),
      fastestCompletionTime: Number(row.fastestDuration),
      slowestCompletionTime: Number(row.slowestDuration),
      efficiencyRating,
    };
  });
}

// =============================================================================
// 核心函数：获取律师工作时长统计
// =============================================================================

/**
 * 获取律师工作时长数据（基于案件处理时长估算）
 */
async function getLawyerWorkHours(
  startDate: Date,
  endDate: Date,
  teamId?: string,
  role?: string
): Promise<LawyerWorkHoursData[]> {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"c"."status" = 'COMPLETED'`,
    Prisma.sql`"c"."createdAt" >= ${startDate}`,
    Prisma.sql`"c"."createdAt" <= ${endDate}`,
    Prisma.sql`"c"."deletedAt" IS NULL`,
  ];

  if (teamId) {
    conditions.push(
      Prisma.sql`"u"."id" IN (
        SELECT "userId" FROM "team_members"
        WHERE "teamId" = ${teamId} AND "status" = 'ACTIVE'
      )`
    );
  }

  if (role) {
    conditions.push(Prisma.sql`"u"."role" = ${role}`);
  }

  const results = await prisma.$queryRaw<
    Array<{
      lawyerId: string;
      lawyerName: string | null;
      lawyerRole: string;
      completedCases: bigint;
      avgDurationDays: string;
      workDays: bigint;
    }>
  >(
    Prisma.sql`SELECT
      "u"."id" as "lawyerId",
      "u"."name" as "lawyerName",
      "u"."role" as "lawyerRole",
      COUNT("c"."id") as "completedCases",
      ROUND(AVG(EXTRACT(EPOCH FROM ("c"."updatedAt" - "c"."createdAt")) / 86400), 2) as "avgDurationDays",
      COUNT(DISTINCT DATE("c"."createdAt")) as "workDays"
    FROM "users" u
    INNER JOIN "cases" c ON "c"."createdBy" = "u"."id"
    WHERE ${Prisma.join(conditions, ' AND ')}
    GROUP BY "u"."id", "u"."name", "u"."role"
    HAVING COUNT("c"."id") > 0
    ORDER BY "workDays" DESC`
  );

  return (Array.isArray(results) ? results : []).map(row => {
    const avgDays = Number(row.avgDurationDays);
    const completedCases = Number(row.completedCases);
    const workDays = Number(row.workDays);

    return {
      lawyerId: row.lawyerId,
      lawyerName: row.lawyerName ?? '',
      lawyerRole: row.lawyerRole,
      totalHours: avgDays * 8 * completedCases, // 估算每天工作8小时
      averageHoursPerCase: avgDays * 8,
      averageHoursPerDay:
        workDays > 0 ? (avgDays * 8 * completedCases) / workDays : 0,
      workDays,
    };
  });
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/analytics/lawyers
 * 获取律师绩效数据（管理员权限）
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

    // 并行查询所有绩效数据
    const [caseVolume, successRate, revenue, efficiency, workHours] =
      await Promise.all([
        getLawyerCaseVolume(startDate, endDate, params.teamId, params.role),
        getLawyerSuccessRate(startDate, endDate, params.teamId, params.role),
        getLawyerRevenue(startDate, endDate, params.teamId, params.role),
        getLawyerEfficiency(startDate, endDate, params.teamId, params.role),
        getLawyerWorkHours(startDate, endDate, params.teamId, params.role),
      ]);

    // 根据sortBy和sortOrder排序
    let sortedCaseVolume = caseVolume;
    let sortedSuccessRate = successRate;
    let sortedRevenue = revenue;
    let sortedEfficiency = efficiency;
    const sortedWorkHours = workHours;

    switch (params.sortBy) {
      case 'caseVolume':
        sortedCaseVolume = [...caseVolume].sort((a, b) =>
          params.sortOrder === 'asc'
            ? a.totalCases - b.totalCases
            : b.totalCases - a.totalCases
        );
        break;

      case 'successRate':
        sortedSuccessRate = [...successRate].sort((a, b) =>
          params.sortOrder === 'asc'
            ? a.successRate - b.successRate
            : b.successRate - a.successRate
        );
        break;

      case 'revenue':
        sortedRevenue = [...revenue].sort((a, b) =>
          params.sortOrder === 'asc'
            ? a.totalRevenue - b.totalRevenue
            : b.totalRevenue - a.totalRevenue
        );
        break;

      case 'efficiency':
        sortedEfficiency = [...efficiency].sort((a, b) =>
          params.sortOrder === 'asc'
            ? a.averageCompletionTime - b.averageCompletionTime
            : b.averageCompletionTime - a.averageCompletionTime
        );
        break;
    }

    // 分页处理
    const startIndex = (params.page - 1) * params.limit;
    const endIndex = startIndex + params.limit;

    const pagedCaseVolume = sortedCaseVolume.slice(startIndex, endIndex);
    const pagedSuccessRate = sortedSuccessRate.slice(startIndex, endIndex);
    const pagedRevenue = sortedRevenue.slice(startIndex, endIndex);
    const pagedEfficiency = sortedEfficiency.slice(startIndex, endIndex);
    const pagedWorkHours = sortedWorkHours.slice(startIndex, endIndex);

    // 计算摘要统计
    const totalLawyers = caseVolume.length;
    const averageCasesPerLawyer =
      totalLawyers > 0
        ? caseVolume.reduce((sum, item) => sum + item.totalCases, 0) /
          totalLawyers
        : 0;
    const averageSuccessRate =
      successRate.length > 0
        ? successRate.reduce((sum, item) => sum + item.successRate, 0) /
          successRate.length
        : 0;
    const totalRevenueValue =
      revenue.length > 0
        ? revenue.reduce((sum, item) => sum + item.totalRevenue, 0)
        : 0;
    const averageEfficiency =
      efficiency.length > 0
        ? efficiency.reduce(
            (sum, item) => sum + item.averageCompletionTime,
            0
          ) / efficiency.length
        : 0;

    // 构建元数据
    const metadata = {
      timeRange: params.timeRange ?? TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
      dataPoints:
        pagedCaseVolume.length +
        pagedSuccessRate.length +
        pagedRevenue.length +
        pagedEfficiency.length +
        pagedWorkHours.length,
    };

    // 构建响应数据
    const data: LawyerPerformanceData = {
      caseVolume: pagedCaseVolume,
      successRate: pagedSuccessRate,
      revenue: pagedRevenue,
      efficiency: pagedEfficiency,
      workHours: pagedWorkHours,
      summary: {
        totalLawyers,
        averageCasesPerLawyer: Math.round(averageCasesPerLawyer * 100) / 100,
        averageSuccessRate: Math.round(averageSuccessRate * 100) / 100,
        totalRevenue: Math.round(totalRevenueValue * 100) / 100,
        averageEfficiency: Math.round(averageEfficiency * 100) / 100,
      },
      metadata,
    };

    return successResponse(data, '获取律师绩效数据成功');
  } catch (error) {
    logger.error('获取律师绩效数据失败:', error);
    return serverErrorResponse('获取律师绩效数据失败');
  }
}
