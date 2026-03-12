/**
 * 法条推荐API
 *
 * GET /api/v1/law-articles/[id]/recommendations
 *
 * 功能：获取指定法条的推荐相关法条
 */

import { NextRequest, NextResponse } from 'next/server';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

const VALID_MODES = ['relations', 'graph_distance'] as const;
type RecommendMode = (typeof VALID_MODES)[number];

/**
 * 获取法条推荐
 *
 * 查询参数：
 * - limit: 返回数量（默认 10，最大 100）
 * - mode: 推荐模式
 *   - "relations"（默认）：基于直接关系的邻居推荐
 *   - "graph_distance"：基于多跳图距离的推荐，附带路径说明
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
    const { searchParams } = new URL(request.url);
    const limitRaw = parseInt(searchParams.get('limit') || '10', 10);
    const limit =
      isNaN(limitRaw) || limitRaw < 1 ? 10 : Math.min(limitRaw, 100);

    const modeRaw = searchParams.get('mode') ?? 'relations';
    if (!VALID_MODES.includes(modeRaw as RecommendMode)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: `无效的 mode 参数: ${modeRaw}。有效值为: ${VALID_MODES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }
    const mode = modeRaw as RecommendMode;

    const articleId = (await params).id;

    if (mode === 'graph_distance') {
      const recommendations =
        await LawArticleRecommendationService.recommendByGraphDistance(
          articleId,
          { limit }
        );
      return NextResponse.json({ success: true, data: recommendations });
    }

    // 默认模式：直接关系推荐
    const recommendations =
      await LawArticleRecommendationService.recommendByRelations(articleId, {
        limit,
      });

    return NextResponse.json({ success: true, data: recommendations });
  } catch (error) {
    logger.error('获取推荐失败', error instanceof Error ? error : undefined);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
