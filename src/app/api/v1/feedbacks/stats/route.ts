/**
 * 反馈统计API
 *
 * GET /api/v1/feedbacks/stats - 获取反馈统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

type RecommendationFeedbackWithArticle =
  Prisma.RecommendationFeedbackGetPayload<{
    include: {
      lawArticle: { select: { id: true; lawName: true; articleNumber: true } };
    };
  }>;

type RelationFeedbackWithRelation = Prisma.RelationFeedbackGetPayload<{
  include: {
    relation: {
      select: { id: true; sourceId: true; targetId: true; relationType: true };
    };
  };
}>;

// GroupBy result item shapes (matching Prisma's actual returned field names)
type FeedbackTypeGroupItem = {
  feedbackType: string;
  _count: { feedbackType: number };
};
type TrendGroupItem = { createdAt: Date; _count: { id: number } };

/**
 * 获取反馈统计
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  // 仅管理员可查看反馈统计
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (!dbUser || (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN')) {
    return NextResponse.json(
      { success: false, error: '权限不足' },
      { status: 403 }
    );
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const contextType = searchParams.get('contextType');
    const includeTrend = searchParams.get('includeTrend') === 'true';

    // 参数验证
    if (!type) {
      return NextResponse.json(
        { success: false, error: '缺少必需参数: type' },
        { status: 400 }
      );
    }

    if (type !== 'recommendation' && type !== 'relation') {
      return NextResponse.json(
        { success: false, error: 'type 必须是 recommendation 或 relation' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: Record<string, unknown> = {};

    // 时间范围过滤
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return NextResponse.json(
            { success: false, error: '无效的开始日期格式' },
            { status: 400 }
          );
        }
        (where.createdAt as Record<string, Date>).gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            { success: false, error: '无效的结束日期格式' },
            { status: 400 }
          );
        }
        (where.createdAt as Record<string, Date>).lte = end;
      }
    }

    // 上下文类型过滤（仅适用于推荐反馈）
    if (type === 'recommendation' && contextType) {
      const validContextTypes = ['DEBATE', 'CONTRACT', 'GENERAL', 'SEARCH'];
      if (!validContextTypes.includes(contextType)) {
        return NextResponse.json(
          {
            success: false,
            error: 'contextType 必须是 DEBATE, CONTRACT, GENERAL 或 SEARCH',
          },
          { status: 400 }
        );
      }
      where.contextType = contextType;
    }

    // 根据类型选择数据表并获取统计数据（每个分支分别推断类型，避免 any）
    let total: number;
    let byTypeFormatted: Array<{
      feedbackType: string;
      count: number;
      percentage: number;
    }>;
    let recentFeedbacks:
      | RecommendationFeedbackWithArticle[]
      | RelationFeedbackWithRelation[];

    if (type === 'recommendation') {
      total = await prisma.recommendationFeedback.count({ where });

      const byType = await prisma.recommendationFeedback.groupBy({
        by: ['feedbackType'],
        where,
        _count: {
          feedbackType: true,
        },
      });
      byTypeFormatted = (byType as FeedbackTypeGroupItem[]).map(item => ({
        feedbackType: item.feedbackType,
        count: item._count.feedbackType,
        percentage: total > 0 ? (item._count.feedbackType / total) * 100 : 0,
      }));

      recentFeedbacks = await prisma.recommendationFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          lawArticle: {
            select: {
              id: true,
              lawName: true,
              articleNumber: true,
            },
          },
        },
      });
    } else {
      total = await prisma.relationFeedback.count({ where });

      const byType = await prisma.relationFeedback.groupBy({
        by: ['feedbackType'],
        where,
        _count: {
          feedbackType: true,
        },
      });
      byTypeFormatted = (byType as FeedbackTypeGroupItem[]).map(item => ({
        feedbackType: item.feedbackType,
        count: item._count.feedbackType,
        percentage: total > 0 ? (item._count.feedbackType / total) * 100 : 0,
      }));

      recentFeedbacks = await prisma.relationFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          relation: {
            select: {
              id: true,
              sourceId: true,
              targetId: true,
              relationType: true,
            },
          },
        },
      });
    }

    // 构建响应数据
    const responseData: {
      total: number;
      byType: Array<{
        feedbackType: string;
        count: number;
        percentage: number;
      }>;
      recentFeedbacks:
        | RecommendationFeedbackWithArticle[]
        | RelationFeedbackWithRelation[];
      trend?: Array<{ date: string; count: number }>;
    } = {
      total,
      byType: byTypeFormatted,
      recentFeedbacks,
    };

    // 如果需要趋势数据
    if (includeTrend) {
      if (type === 'recommendation') {
        const trendData = await prisma.recommendationFeedback.groupBy({
          by: ['createdAt'],
          where,
          _count: {
            id: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
        responseData.trend = (trendData as TrendGroupItem[]).map(item => ({
          date: item.createdAt.toISOString().split('T')[0],
          count: item._count.id,
        }));
      } else {
        const trendData = await prisma.relationFeedback.groupBy({
          by: ['createdAt'],
          where,
          _count: {
            id: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        });
        responseData.trend = (trendData as TrendGroupItem[]).map(item => ({
          date: item.createdAt.toISOString().split('T')[0],
          count: item._count.id,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('获取反馈统计失败:', error);
    return NextResponse.json(
      { success: false, error: '获取反馈统计失败' },
      { status: 500 }
    );
  }
}
