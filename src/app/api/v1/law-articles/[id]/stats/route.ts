/**
 * 法条统计API
 *
 * GET /api/v1/law-articles/[id]/stats
 *
 * 功能：获取指定法条的统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

/**
 * 获取法条统计信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const stats = await LawArticleRecommendationService.getRecommendationStats(
      params.id
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
