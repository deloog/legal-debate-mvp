/**
 * 推荐反馈 API 路由
 *
 * POST /api/v1/feedbacks/recommendation - 创建推荐反馈
 * GET /api/v1/feedbacks/recommendation - 查询推荐反馈
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// 反馈类型枚举
const FEEDBACK_TYPES = [
  'HELPFUL',
  'NOT_HELPFUL',
  'IRRELEVANT',
  'EXCELLENT',
] as const;
const CONTEXT_TYPES = ['DEBATE', 'CONTRACT', 'GENERAL', 'SEARCH'] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number];
type ContextType = (typeof CONTEXT_TYPES)[number];

interface CreateFeedbackRequest {
  userId: string;
  lawArticleId: string;
  contextType: ContextType;
  contextId?: string;
  feedbackType: FeedbackType;
  comment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST - 创建推荐反馈
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateFeedbackRequest;

    // 验证必填字段
    if (!body.userId) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: userId' },
        { status: 400 }
      );
    }

    if (!body.lawArticleId) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: lawArticleId' },
        { status: 400 }
      );
    }

    if (!body.contextType) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: contextType' },
        { status: 400 }
      );
    }

    if (!body.feedbackType) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: feedbackType' },
        { status: 400 }
      );
    }

    // 验证反馈类型
    if (!FEEDBACK_TYPES.includes(body.feedbackType)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的反馈类型: ${body.feedbackType}。有效值: ${FEEDBACK_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 验证上下文类型
    if (!CONTEXT_TYPES.includes(body.contextType)) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的上下文类型: ${body.contextType}。有效值: ${CONTEXT_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 验证法条是否存在
    const lawArticle = await prisma.lawArticle.findUnique({
      where: { id: body.lawArticleId },
      select: { id: true, lawName: true, articleNumber: true },
    });

    if (!lawArticle) {
      return NextResponse.json(
        { success: false, error: '法条不存在' },
        { status: 404 }
      );
    }

    // 创建反馈
    const feedback = await prisma.recommendationFeedback.create({
      data: {
        userId: body.userId,
        lawArticleId: body.lawArticleId,
        contextType: body.contextType,
        contextId: body.contextId,
        feedbackType: body.feedbackType,
        comment: body.comment,
        metadata: (body.metadata || {}) as unknown as Prisma.InputJsonValue,
      },
      include: {
        lawArticle: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            fullText: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: feedback,
        message: '反馈提交成功',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建推荐反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建推荐反馈失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 查询推荐反馈
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 获取查询参数
    const userId = searchParams.get('userId');
    const lawArticleId = searchParams.get('lawArticleId');
    const contextType = searchParams.get('contextType');
    const contextId = searchParams.get('contextId');
    const feedbackType = searchParams.get('feedbackType');
    const stats = searchParams.get('stats') === 'true';

    // 分页参数
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (userId) {
      where.userId = userId;
    }

    if (lawArticleId) {
      where.lawArticleId = lawArticleId;
    }

    if (contextType) {
      where.contextType = contextType;
    }

    if (contextId) {
      where.contextId = contextId;
    }

    if (feedbackType) {
      where.feedbackType = feedbackType;
    }

    // 如果请求统计信息
    if (stats) {
      const statsWhere = { ...where };
      const groupedStats = await prisma.recommendationFeedback.groupBy({
        by: ['feedbackType'],
        where: statsWhere,
        _count: {
          id: true,
        },
      });

      const statsMap: Record<string, number> = {};
      for (const stat of groupedStats) {
        statsMap[stat.feedbackType] = stat._count.id;
      }

      return NextResponse.json({
        success: true,
        data: {
          stats: statsMap,
          total: Object.values(statsMap).reduce((sum, count) => sum + count, 0),
        },
      });
    }

    // 查询反馈列表
    const [feedbacks, total] = await Promise.all([
      prisma.recommendationFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          lawArticle: {
            select: {
              id: true,
              lawName: true,
              articleNumber: true,
              fullText: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.recommendationFeedback.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        feedbacks,
        total,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('查询推荐反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询推荐反馈失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
