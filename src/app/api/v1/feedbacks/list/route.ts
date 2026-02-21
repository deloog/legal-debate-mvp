/**
 * 反馈列表API
 *
 * GET /api/v1/feedbacks/list - 获取反馈列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * 获取反馈列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const feedbackType = searchParams.get('feedbackType');
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

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

    if (page < 1) {
      return NextResponse.json(
        { success: false, error: 'page 必须大于 0' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { success: false, error: 'pageSize 必须在 1-100 之间' },
        { status: 400 }
      );
    }

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (feedbackType) {
      where.feedbackType = feedbackType;
    }

    if (userId) {
      where.userId = userId;
    }

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

    // 构建排序条件
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    // 根据类型选择数据表并获取数据
    let total: number;
    let feedbacks: any[];

    if (type === 'recommendation') {
      total = await prisma.recommendationFeedback.count({ where });
      feedbacks = await prisma.recommendationFeedback.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      feedbacks = await prisma.relationFeedback.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
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

    // 计算分页信息
    const totalPages = Math.ceil(total / pageSize);

    return NextResponse.json({
      success: true,
      data: {
        feedbacks,
        total,
        pagination: {
          page,
          pageSize,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('获取反馈列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取反馈列表失败' },
      { status: 500 }
    );
  }
}
