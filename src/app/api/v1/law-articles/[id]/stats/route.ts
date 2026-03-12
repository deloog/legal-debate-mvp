/**
 * 法条统计API
 *
 * GET /api/v1/law-articles/[id]/stats
 *
 * 功能：获取指定法条的统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取法条统计信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const stats = await LawArticleRecommendationService.getRecommendationStats(
      (await params).id
    );

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    logger.error('获取统计信息失败:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}
