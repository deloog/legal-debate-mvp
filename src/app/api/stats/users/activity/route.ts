/**
 * 用户活跃度统计API
 * 提供用户活跃度数据和趋势
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
  TimeRange,
  type ActivityData,
  type ActivityQueryParams,
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
function parseQueryParams(request: NextRequest): ActivityQueryParams | null {
  const url = new URL(request.url);
  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const role = url.searchParams.get('role');
  const status = url.searchParams.get('status');

  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  const validRoles = ['USER', 'LAWYER', 'ADMIN', 'SUPER_ADMIN', 'ENTERPRISE'];
  if (role && !validRoles.includes(role)) {
    return null;
  }

  const validStatuses = ['ACTIVE', 'SUSPENDED', 'BANNED', 'INACTIVE'];
  if (status && !validStatuses.includes(status)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    role: role ?? undefined,
    status: status ?? undefined,
  };
}

/**
 * 构建查询条件
 */
function buildWhereClause(params: ActivityQueryParams) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (params.role) {
    where.role = params.role;
  }

  if (params.status) {
    where.status = params.status;
  }

  return where;
}

// =============================================================================
// 核心函数：统计活跃度
// =============================================================================

/**
 * 查询活跃度数据
 */
async function getActivityData(
  startDate: Date,
  endDate: Date,
  whereClause: Record<string, unknown>
): Promise<ActivityData> {
  const now = new Date();

  // 定义活跃度阈值
  const veryActiveThreshold = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1天内登录
  const activeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7天内登录
  const inactiveThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30天内登录
  const dormantThreshold = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90天内登录

  // 统计活跃度分布
  const [veryActive, active, inactive, dormant] = await Promise.all([
    // 非常活跃：1天内登录
    prisma.user.count({
      where: {
        ...whereClause,
        lastLoginAt: {
          gte: veryActiveThreshold,
        },
      },
    }),
    // 活跃：1-7天内登录
    prisma.user.count({
      where: {
        ...whereClause,
        lastLoginAt: {
          gte: activeThreshold,
          lt: veryActiveThreshold,
        },
      },
    }),
    // 不活跃：7-30天内登录
    prisma.user.count({
      where: {
        ...whereClause,
        lastLoginAt: {
          gte: inactiveThreshold,
          lt: activeThreshold,
        },
      },
    }),
    // 沉默：30-90天内登录
    prisma.user.count({
      where: {
        ...whereClause,
        lastLoginAt: {
          gte: dormantThreshold,
          lt: inactiveThreshold,
        },
      },
    }),
  ]);

  // 总用户数
  const totalUsers = veryActive + active + inactive + dormant;

  // 查询活跃度趋势（按天统计）
  // 构建安全的WHERE条件（防止SQL注入）
  const trendWhereConditions: Prisma.Sql[] = [
    Prisma.sql`"users"."lastLoginAt" >= ${startDate.toISOString()}::timestamp`,
    Prisma.sql`"users"."lastLoginAt" <= ${endDate.toISOString()}::timestamp`,
    Prisma.sql`"users"."deletedAt" IS NULL`,
  ];

  if (whereClause.role) {
    trendWhereConditions.push(Prisma.sql`"users"."role" = ${whereClause.role}`);
  }
  if (whereClause.status) {
    trendWhereConditions.push(
      Prisma.sql`"users"."status" = ${whereClause.status}`
    );
  }

  const trendWhereSql = Prisma.join(trendWhereConditions, ' AND ');

  const trendResults = (await prisma.$queryRaw<
    Array<{
      date: string;
      active_users: bigint;
    }>
  >(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC('day', "users"."lastLoginAt"), 'YYYY-MM-DD') as date,
      COUNT(DISTINCT "users"."id")::bigint as active_users
    FROM "users"
    WHERE ${trendWhereSql}
    GROUP BY TO_CHAR(DATE_TRUNC('day', "users"."lastLoginAt"), 'YYYY-MM-DD')
    ORDER BY TO_CHAR(DATE_TRUNC('day', "users"."lastLoginAt"), 'YYYY-MM-DD')
  `)) as Array<{ date: string; active_users: bigint }>;

  // 查询每日新增用户
  // 构建安全的WHERE条件（防止SQL注入）
  const newUsersWhereConditions: Prisma.Sql[] = [
    Prisma.sql`"createdAt" >= ${startDate.toISOString()}::timestamp`,
    Prisma.sql`"createdAt" <= ${endDate.toISOString()}::timestamp`,
    Prisma.sql`"deletedAt" IS NULL`,
  ];

  if (whereClause.role) {
    newUsersWhereConditions.push(Prisma.sql`"role" = ${whereClause.role}`);
  }
  if (whereClause.status) {
    newUsersWhereConditions.push(Prisma.sql`"status" = ${whereClause.status}`);
  }

  const newUsersWhereSql = Prisma.join(newUsersWhereConditions, ' AND ');

  const newUsersResults = (await prisma.$queryRaw<
    Array<{ date: string; new_users: bigint }>
  >(Prisma.sql`
    SELECT
      TO_CHAR(DATE_TRUNC('day', "users"."createdAt"), 'YYYY-MM-DD') as date,
      COUNT(*)::bigint as new_users
    FROM "users"
    WHERE ${newUsersWhereSql}
    GROUP BY TO_CHAR(DATE_TRUNC('day', "users"."createdAt"), 'YYYY-MM-DD')
    ORDER BY TO_CHAR(DATE_TRUNC('day', "users"."createdAt"), 'YYYY-MM-DD')
  `)) as Array<{ date: string; new_users: bigint }>;

  // 合并趋势数据
  const trendMap = new Map<
    string,
    { date: string; activeUsers: number; newUsers: number }
  >();

  if (Array.isArray(trendResults)) {
    for (const row of trendResults) {
      trendMap.set(row.date, {
        date: row.date,
        activeUsers: Number(row.active_users),
        newUsers: 0,
      });
    }
  }

  if (Array.isArray(newUsersResults)) {
    for (const row of newUsersResults) {
      const existing = trendMap.get(row.date);
      if (existing) {
        existing.newUsers = Number(row.new_users);
      } else {
        trendMap.set(row.date, {
          date: row.date,
          activeUsers: 0,
          newUsers: Number(row.new_users),
        });
      }
    }
  }

  const trend = Array.from(trendMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 计算汇总数据
  const activeUsers = veryActive + active;
  // 活跃率包括非常活跃和活跃的用户占总用户数的百分比
  const activeRate =
    totalUsers > 0 ? ((veryActive + active) / totalUsers) * 100 : 0;

  // 计算平均登录频率（基于ActionLog）
  const activeUserIds = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
    },
  });

  const actionLogResults = await prisma.actionLog.findMany({
    where: {
      actionType: 'LOGIN',
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      userId: { in: activeUserIds.map(user => user.id) },
    },
    select: {
      userId: true,
      createdAt: true,
    },
  });

  const loginCountsMap = new Map<string, number>();
  for (const log of actionLogResults) {
    const count = loginCountsMap.get(log.userId) ?? 0;
    loginCountsMap.set(log.userId, count + 1);
  }

  const totalLoginCount = Array.from(loginCountsMap.values()).reduce(
    (sum, count) => sum + count,
    0
  );
  const uniqueLogins = loginCountsMap.size;
  const avgLoginFrequency =
    uniqueLogins > 0 ? totalLoginCount / uniqueLogins : 0;

  return {
    distribution: {
      veryActive,
      active,
      inactive,
      dormant,
    },
    trend,
    summary: {
      totalUsers,
      activeUsers,
      activeRate: Math.round(activeRate * 100) / 100,
      avgLoginFrequency: Math.round(avgLoginFrequency * 100) / 100,
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
 * GET /api/stats/users/activity
 * 获取用户活跃度数据（管理员权限）
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

    // 查询活跃度数据
    const data = await getActivityData(startDate, endDate, whereClause);

    return successResponse(data, '获取活跃度数据成功');
  } catch (error) {
    logger.error('获取活跃度数据失败:', error);
    return serverErrorResponse('获取活跃度数据失败');
  }
}
