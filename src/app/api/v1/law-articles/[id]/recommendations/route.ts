/**
 * 法条推荐API
 *
 * GET /api/v1/law-articles/[id]/recommendations
 *
 * 功能：获取指定法条的推荐相关法条
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';

/**
 * 获取法条推荐
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const recommendations =
      await LawArticleRecommendationService.recommendByRelations(params.id, {
        limit,
      });

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('获取推荐失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
