/**
 * 辩论质量评分统计API
 * 提供辩论论点质量评分数据和趋势，支持多维度筛选
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
  type DebateQualityScoreData,
  type DebateQualityScoreQueryParams,
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
): DebateQualityScoreQueryParams | null {
  const url = new URL(request.url);

  const timeRange = url.searchParams.get('timeRange') as TimeRange;
  const debateStatus = url.searchParams.get('debateStatus');
  const minConfidence = url.searchParams.get('minConfidence');
  const maxConfidence = url.searchParams.get('maxConfidence');

  // 验证timeRange
  const validTimeRanges = Object.values(TimeRange);
  if (timeRange && !validTimeRanges.includes(timeRange)) {
    return null;
  }

  // 验证debateStatus
  const validStatuses = [
    'DRAFT',
    'IN_PROGRESS',
    'PAUSED',
    'COMPLETED',
    'ARCHIVED',
  ];
  if (debateStatus && !validStatuses.includes(debateStatus)) {
    return null;
  }

  // 验证minConfidence和maxConfidence
  const minConf = minConfidence ? parseFloat(minConfidence) : undefined;
  const maxConf = maxConfidence ? parseFloat(maxConfidence) : undefined;

  if (
    (minConf !== undefined && (minConf < 0 || minConf > 1)) ||
    (maxConf !== undefined && (maxConf < 0 || maxConf > 1))
  ) {
    return null;
  }

  return {
    timeRange: timeRange ?? TimeRange.LAST_30_DAYS,
    debateStatus: debateStatus ?? undefined,
    minConfidence: minConf,
    maxConfidence: maxConf,
  };
}

/**
 * 构建查询条件
 */
function buildWhereClause(
  params: DebateQualityScoreQueryParams,
  startDate: Date,
  endDate: Date
) {
  const where: Record<string, unknown> = {
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  if (params.minConfidence !== undefined) {
    where.confidence = {
      ...((where.confidence as Record<string, unknown>) || {}),
      gte: params.minConfidence,
    };
  }

  if (params.maxConfidence !== undefined) {
    where.confidence = {
      ...((where.confidence as Record<string, unknown>) || {}),
      lte: params.maxConfidence,
    };
  }

  return where;
}

/**
 * 计算中位数
 */
function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// =============================================================================
// 核心函数：统计辩论质量评分
// =============================================================================

/**
 * 查询辩论质量评分数据
 */
async function getDebateQualityScore(
  startDate: Date,
  endDate: Date,
  params: DebateQualityScoreQueryParams
): Promise<DebateQualityScoreData> {
  const whereClause = buildWhereClause(params, startDate, endDate);

  // 查询所有论点及其置信度
  const argumentsWithConfidence = await prisma.argument.findMany({
    where: whereClause,
    select: {
      confidence: true,
      createdAt: true,
    },
  });

  const confidences = argumentsWithConfidence
    .map(arg => arg.confidence ?? 0)
    .filter(conf => conf > 0);

  const totalCount = confidences.length;

  // 计算质量评分分布
  const distribution = {
    excellent: confidences.filter(c => c >= 0.9).length,
    good: confidences.filter(c => c >= 0.7 && c < 0.9).length,
    average: confidences.filter(c => c >= 0.5 && c < 0.7).length,
    poor: confidences.filter(c => c < 0.5).length,
    totalCount,
  };

  // 计算汇总数据
  const averageScore =
    totalCount > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / totalCount
      : 0;
  const medianScore = calculateMedian(confidences);
  const minScore = totalCount > 0 ? Math.min(...confidences) : 0;
  const maxScore = totalCount > 0 ? Math.max(...confidences) : 0;

  const threshold = 0.8;
  const scoreAboveThreshold = confidences.filter(c => c > threshold).length;

  // 按天分组统计质量评分趋势
  const trendMap = new Map<string, number[]>();
  for (const arg of argumentsWithConfidence) {
    const dateKey = new Date(arg.createdAt).toISOString().split('T')[0];
    if (!trendMap.has(dateKey)) {
      trendMap.set(dateKey, []);
    }
    const confidence = arg.confidence ?? 0;
    if (confidence > 0) {
      trendMap.get(dateKey)!.push(confidence);
    }
  }

  // 构建趋势数据
  const trend: Array<{
    date: string;
    averageScore: number;
    minScore: number;
    maxScore: number;
    medianScore: number;
    argumentsCount: number;
  }> = [];

  const sortedDates = Array.from(trendMap.keys()).sort();
  for (const date of sortedDates) {
    const scores = trendMap.get(date) || [];
    const count = scores.length;
    const avgScore =
      count > 0 ? scores.reduce((sum, s) => sum + s, 0) / count : 0;
    const min = count > 0 ? Math.min(...scores) : 0;
    const max = count > 0 ? Math.max(...scores) : 0;
    const med = calculateMedian(scores);

    trend.push({
      date,
      averageScore: Math.round(avgScore * 10000) / 10000,
      minScore: Math.round(min * 10000) / 10000,
      maxScore: Math.round(max * 10000) / 10000,
      medianScore: Math.round(med * 10000) / 10000,
      argumentsCount: count,
    });
  }

  return {
    trend,
    distribution,
    summary: {
      averageScore: Math.round(averageScore * 10000) / 10000,
      medianScore: Math.round(medianScore * 10000) / 10000,
      minScore: Math.round(minScore * 10000) / 10000,
      maxScore: Math.round(maxScore * 10000) / 10000,
      scoreAboveThreshold,
      threshold,
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
 * GET /api/stats/debates/quality-score
 * 获取辩论质量评分数据（管理员权限）
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

    const { startDate, endDate } = getDateRange(params.timeRange ?? TimeRange.LAST_30_DAYS);

    // 查询辩论质量评分数据
    const data = await getDebateQualityScore(startDate, endDate, params);

    return successResponse(data, '获取辩论质量评分成功');
  } catch (error) {
    logger.error('获取辩论质量评分失败:', error);
    return serverErrorResponse('获取辩论质量评分失败');
  }
}
