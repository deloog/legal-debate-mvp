/**
 * 关系反馈 API 路由
 *
 * POST /api/v1/feedbacks/relation - 创建关系反馈
 * GET /api/v1/feedbacks/relation - 查询关系反馈
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

// 反馈类型枚举
const FEEDBACK_TYPES = [
  'ACCURATE',
  'INACCURATE',
  'MISSING',
  'SHOULD_REMOVE',
  'WRONG_TYPE',
] as const;
const RELATION_TYPES = [
  'CITES',
  'CITED_BY',
  'CONFLICTS',
  'COMPLETES',
  'COMPLETED_BY',
  'SUPERSEDES',
  'SUPERSEDED_BY',
  'IMPLEMENTS',
  'IMPLEMENTED_BY',
  'RELATED',
] as const;

type FeedbackType = (typeof FEEDBACK_TYPES)[number];
type RelationType = (typeof RELATION_TYPES)[number];

interface CreateFeedbackRequest {
  relationId: string;
  feedbackType: FeedbackType;
  suggestedRelationType?: RelationType;
  comment?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST - 创建关系反馈
 */
export async function POST(request: NextRequest) {
  try {
    // 从 JWT 获取用户身份，防止用户 ID 注入
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateFeedbackRequest;

    // 验证必填字段
    if (!body.relationId) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段: relationId' },
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

    // 验证建议的关系类型（如果提供）
    if (
      body.suggestedRelationType &&
      !RELATION_TYPES.includes(body.suggestedRelationType)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `无效的关系类型: ${body.suggestedRelationType}。有效值: ${RELATION_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 验证关系是否存在
    const relation = await prisma.lawArticleRelation.findUnique({
      where: { id: body.relationId },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        source: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
          },
        },
        target: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
          },
        },
      },
    });

    if (!relation) {
      return NextResponse.json(
        { success: false, error: '关系不存在' },
        { status: 404 }
      );
    }

    // 创建反馈（使用 JWT 中的 userId）
    const feedback = await prisma.relationFeedback.create({
      data: {
        userId: authUser.userId,
        relationId: body.relationId,
        feedbackType: body.feedbackType,
        suggestedRelationType: body.suggestedRelationType,
        comment: body.comment,
        metadata: (body.metadata || {}) as unknown as Prisma.InputJsonValue,
      },
      include: {
        relation: {
          select: {
            id: true,
            sourceId: true,
            targetId: true,
            relationType: true,
            source: {
              select: {
                id: true,
                lawName: true,
                articleNumber: true,
              },
            },
            target: {
              select: {
                id: true,
                lawName: true,
                articleNumber: true,
              },
            },
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
    logger.error('创建关系反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建关系反馈失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET - 查询关系反馈
 */
export async function GET(request: NextRequest) {
  try {
    // 从 JWT 获取用户身份
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);

    // 获取查询参数
    const relationId = searchParams.get('relationId');
    const feedbackType = searchParams.get('feedbackType');
    const stats = searchParams.get('stats') === 'true';

    // 分页参数
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (relationId) {
      where.relationId = relationId;
    }

    if (feedbackType) {
      where.feedbackType = feedbackType;
    }

    // 如果请求统计信息
    if (stats) {
      const statsWhere = { ...where };
      const groupedStats = await prisma.relationFeedback.groupBy({
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
      prisma.relationFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          relation: {
            select: {
              id: true,
              sourceId: true,
              targetId: true,
              relationType: true,
              source: {
                select: {
                  id: true,
                  lawName: true,
                  articleNumber: true,
                },
              },
              target: {
                select: {
                  id: true,
                  lawName: true,
                  articleNumber: true,
                },
              },
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
      prisma.relationFeedback.count({ where }),
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
    logger.error('查询关系反馈失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '查询关系反馈失败',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
