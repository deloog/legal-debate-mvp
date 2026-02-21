/**
 * 辩论生成次数统计API
 * 提供辩论和论点生成趋势数据，支持多维度筛选
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
  type DebateGenerationCountData,
  type DebateGenerationCountQueryParams,
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

// =============================================================================
// 辅助函数：参数解析
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(
  request: NextRequest
): DebateGenerationCountQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const granularity = url.searchParams.get('granularity') as DateGranularity;
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

  // 验证status
  const validStatuses = [
    'DRAFT',
    'IN_PROGRESS',
    'PAUSED',
    'COMPLETED',
    'ARCHIVED',
  ];
  if (status && !validStatuses.includes(status)) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    granularity: granularity ?? DateGranularity.DAY,
    status: status ?? undefined,
  };
}

/**
 * 构建查询条件
 */
function buildWhereClause(params: DebateGenerationCountQueryParams) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (params.status) {
    where.status = params.status;
  }

  return where;
}

// =============================================================================
// 核心函数：统计辩论生成次数
// =============================================================================

/**
 * 查询辩论生成次数数据（简化版）
 */
async function getDebateGenerationCount(
  startDate: Date,
  endDate: Date,
  _granularity: DateGranularity,
  whereClause: Record<string, unknown>
): Promise<DebateGenerationCountData> {
  // 查询总辩论数
  const totalDebates = await prisma.debate.count({
    where: {
      ...whereClause,
      createdAt: {
        lte: endDate,
      },
    },
  });

  // 查询总论点数
  const totalArguments = await prisma.argument.count({
    where: {
      createdAt: {
        lte: endDate,
      },
    },
  });

  // 查询时间段内的辩论
  const debatesInPeriod = await prisma.debate.findMany({
    where: {
      ...whereClause,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  // 构建趋势数据（按天分组）
  const debateCountByDate = new Map<string, number>();
  const argumentCountByDate = new Map<string, number>();

  for (const debate of debatesInPeriod) {
    const dateKey = debate.createdAt.toISOString().split('T')[0];
    debateCountByDate.set(dateKey, (debateCountByDate.get(dateKey) || 0) + 1);
  }

  // 查询时间段内的论点
  const roundsInPeriod = await prisma.debateRound.findMany({
    where: {
      debate: {
        ...whereClause,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    include: {
      arguments: true,
    },
  });

  for (const round of roundsInPeriod) {
    const dateKey = round.createdAt.toISOString().split('T')[0];
    const argCount = round.arguments.length;
    argumentCountByDate.set(
      dateKey,
      (argumentCountByDate.get(dateKey) || 0) + argCount
    );
  }

  // 合并所有日期
  const allDates = new Set([
    ...debateCountByDate.keys(),
    ...argumentCountByDate.keys(),
  ]);

  // 构建趋势数据
  const trend = Array.from(allDates)
    .sort()
    .map(date => {
      const debateCount = debateCountByDate.get(date) || 0;
      const argumentCount = argumentCountByDate.get(date) || 0;
      return {
        date,
        debatesCreated: debateCount,
        argumentsGenerated: argumentCount,
        averageArgumentsPerDebate:
          debateCount > 0 ? argumentCount / debateCount : 0,
      };
    });

  // 计算汇总数据
  const currentPeriodDebates = debatesInPeriod.length;

  // 计算增长率（与上一个时间段对比）
  const previousEndDate = new Date(startDate.getTime() - 1);
  const previousStartDate = new Date(
    startDate.getTime() - (endDate.getTime() - startDate.getTime())
  );

  const previousPeriodDebates = await prisma.debate.count({
    where: {
      ...whereClause,
      createdAt: {
        gte: previousStartDate,
        lte: previousEndDate,
      },
    },
  });

  const growthRate =
    previousPeriodDebates > 0
      ? ((currentPeriodDebates - previousPeriodDebates) /
          previousPeriodDebates) *
        100
      : 0;

  // 计算平均每个辩论的论点数
  const averageArgumentsPerDebate =
    totalDebates > 0 ? totalArguments / totalDebates : 0;

  return {
    trend,
    summary: {
      totalDebates,
      totalArguments,
      averageArgumentsPerDebate:
        Math.round(averageArgumentsPerDebate * 100) / 100,
      growthRate: Math.round(growthRate * 100) / 100,
    },
    metadata: {
      timeRange: TimeRange.LAST_30_DAYS,
      granularity: DateGranularity.DAY,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  };
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/stats/debates/generation-count
 * 获取辩论生成次数数据（管理员权限）
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

    // 查询辩论生成次数数据
    const data = await getDebateGenerationCount(
      startDate,
      endDate,
      params.granularity,
      whereClause
    );

    return successResponse(data, '获取辩论生成次数成功');
  } catch (error) {
    logger.error('获取辩论生成次数失败:', error);
    return serverErrorResponse('获取辩论生成次数失败');
  }
}
