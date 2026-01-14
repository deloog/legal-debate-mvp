/**
 * 用户注册趋势统计API
 * 提供用户注册趋势数据，支持多维度筛选
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
  DateGranularity,
  TimeRange,
  type RegistrationTrendData,
  type RegistrationTrendQueryParams,
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
        groupBy: 'DATE_TRUNC(\'hour\', "users"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'hour\', "users"."createdAt"), \'YYYY-MM-DD HH24:00\')',
      };

    case DateGranularity.DAY:
    default:
      return {
        groupBy: 'DATE_TRUNC(\'day\', "users"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'day\', "users"."createdAt"), \'YYYY-MM-DD\')',
      };

    case DateGranularity.WEEK:
      return {
        groupBy: 'DATE_TRUNC(\'week\', "users"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'week\', "users"."createdAt"), \'YYYY-MM-DD\')',
      };

    case DateGranularity.MONTH:
      return {
        groupBy: 'DATE_TRUNC(\'month\', "users"."createdAt")',
        dateFormat:
          'TO_CHAR(DATE_TRUNC(\'month\', "users"."createdAt"), \'YYYY-MM\')',
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
): RegistrationTrendQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const granularity = url.searchParams.get('granularity') as DateGranularity;
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');

  // 验证timeRange
  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  // 验证granularity
  const validGranularities = Object.values(DateGranularity);
  if (granularity && !validGranularities.includes(granularity)) {
    return null;
  }

  // 验证role
  const validRoles = ['ADMIN', 'LAWYER', 'PARTY'];
  if (role && !validRoles.includes(role)) {
    return null;
  }

  // 验证status
  const validStatuses = ['ACTIVE', 'INACTIVE', 'PENDING'];
  if (status && !validStatuses.includes(status)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    granularity: granularity ?? DateGranularity.DAY,
    role: role ?? undefined,
    status: status ?? undefined,
  };
}

/**
 * 构建查询条件
 */
function buildWhereClause(params: RegistrationTrendQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.role) {
    where.role = params.role;
  }

  if (params.status) {
    where.status = params.status;
  }

  return where;
}

// =============================================================================
// 核心函数：统计注册趋势
// =============================================================================

/**
 * 查询注册趋势数据
 */
async function getRegistrationTrend(
  startDate: Date,
  endDate: Date,
  granularity: DateGranularity,
  whereClause: Record<string, unknown>
): Promise<RegistrationTrendData> {
  // 查询总用户数
  const totalUsers = await prisma.user.count({
    where: {
      ...whereClause,
      createdAt: {
        lte: endDate,
      },
    },
  });

  // 使用原生SQL查询按时间段分组统计
  const sqlDateGrouping = getDateGroupingFunction(granularity);

  // 构建WHERE子句
  const whereConditions = [
    `"createdAt" >= '${startDate.toISOString()}'`,
    `"createdAt" <= '${endDate.toISOString()}'`,
  ];
  if (whereClause.role) {
    whereConditions.push(`"role" = '${whereClause.role}'`);
  }
  if (whereClause.status) {
    whereConditions.push(`"status" = '${whereClause.status}'`);
  }
  const whereSql = whereConditions.join(' AND ');

  const rawResults = (await prisma.$queryRawUnsafe<
    Array<{ date: string; count: bigint }>
  >(
    `SELECT 
      ${sqlDateGrouping.dateFormat} as date,
      COUNT(*) as count
    FROM "users"
    WHERE ${whereSql}
    GROUP BY ${sqlDateGrouping.groupBy}
    ORDER BY ${sqlDateGrouping.groupBy}`
  )) as Array<{ date: string; count: bigint }>;

  // 确保rawResults是数组
  const resultsArray = Array.isArray(rawResults) ? rawResults : [];

  // 构建趋势数据
  const trend = resultsArray.map(row => ({
    date: row.date,
    count: Number(row.count),
  }));

  // 计算汇总数据
  const newUsers = trend.reduce((sum, point) => sum + point.count, 0);

  // 计算增长率（与上一个时间段对比）
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(
    startDate.getTime() - (endDate.getTime() - startDate.getTime())
  );

  const previousPeriodUsers = await prisma.user.count({
    where: {
      ...whereClause,
      createdAt: {
        gte: previousStartDate,
        lte: previousEndDate,
      },
    },
  });

  const growthRate =
    previousPeriodUsers > 0
      ? ((newUsers - previousPeriodUsers) / previousPeriodUsers) * 100
      : 0;

  // 计算日均新增用户
  const daysDiff = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const averageDaily = daysDiff > 0 ? newUsers / daysDiff : 0;

  return {
    trend,
    summary: {
      totalUsers,
      newUsers,
      growthRate: Math.round(growthRate * 100) / 100,
      averageDaily: Math.round(averageDaily * 100) / 100,
    },
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
 * GET /api/stats/users/registration-trend
 * 获取用户注册趋势数据（管理员权限）
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

    // 查询注册趋势数据
    const data = await getRegistrationTrend(
      startDate,
      endDate,
      params.granularity,
      whereClause
    );

    return successResponse(data, '获取注册趋势成功');
  } catch (error) {
    console.error('获取注册趋势失败:', error);
    return serverErrorResponse('获取注册趋势失败');
  }
}
