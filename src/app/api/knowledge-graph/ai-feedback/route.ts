/**
 * AI反馈 API
 * POST /api/knowledge-graph/ai-feedback - 提交AI反馈
 * GET /api/knowledge-graph/ai-feedback - 获取反馈列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  AIFeedbackService,
  SubmitFeedbackInput,
} from '@/lib/law-article/ai-feedback-service';

/**
 * POST 提交AI反馈
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const input: SubmitFeedbackInput = {
      relationId: body.relationId,
      userId: user.userId,
      feedbackType: body.feedbackType,
      aiConfidenceProvided: body.aiConfidenceProvided,
      userConfidenceRating: body.userConfidenceRating,
      actualCorrectness: body.actualCorrectness,
      comment: body.comment,
      suggestedRelationType: body.suggestedRelationType,
      suggestedConfidence: body.suggestedConfidence,
      aiProvider: body.aiProvider,
      aiModel: body.aiModel,
      metadata: body.metadata,
    };

    // 验证必填字段
    if (!input.relationId || !input.actualCorrectness) {
      return NextResponse.json(
        { success: false, error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 提交反馈
    const feedback = await AIFeedbackService.submitFeedback(input);

    logger.info('AI反馈提交成功', {
      feedbackId: feedback.id,
      userId: user.userId,
      relationId: input.relationId,
    });

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    logger.error('提交AI反馈失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: '提交AI反馈失败',
      },
      { status: 500 }
    );
  }
}

/**
 * GET 获取反馈列表（仅管理员）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    // 从DB实时读取角色，仅管理员可查看反馈列表
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });
    if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { success: false, error: '权限不足，仅管理员可查看反馈列表' },
        { status: 403 }
      );
    }

    // 解析查询参数
    const searchParams = request.nextUrl.searchParams;
    const relationId = searchParams.get('relationId');
    const aiProvider = searchParams.get('aiProvider');
    const aiModel = searchParams.get('aiModel');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    // 获取反馈统计
    const stats = await AIFeedbackService.getFeedbackStats({
      relationId: relationId || undefined,
      userId: user.userId,
      aiProvider: aiProvider || undefined,
      aiModel: aiModel || undefined,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    logger.info('反馈统计查询成功', {
      userId: user.userId,
      totalFeedbacks: stats.totalFeedbacks,
    });

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('获取反馈统计失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: '获取反馈统计失败',
      },
      { status: 500 }
    );
  }
}
