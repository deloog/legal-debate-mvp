/**
 * 辩论推荐API路由
 * GET /api/v1/debates/[id]/recommendations
 *
 * 功能：为指定辩论推荐相关法条
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { logger } from '@/lib/logger';

/**
 * 获取辩论推荐法条
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: debateId } = await params;
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const limitParam = searchParams.get('limit');
    const minScoreParam = searchParams.get('minScore');

    // 验证参数
    let limit = 10; // 默认值
    let minScore = 0; // 默认值

    if (limitParam !== null) {
      limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'limit参数必须是大于0的整数',
          },
          { status: 400 }
        );
      }
      // 限制最大值
      if (limit > 100) {
        limit = 100;
      }
    }

    if (minScoreParam !== null) {
      minScore = parseFloat(minScoreParam);
      if (isNaN(minScore) || minScore < 0 || minScore > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'minScore参数必须是0到1之间的数字',
          },
          { status: 400 }
        );
      }
    }

    // 获取辩论信息
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: {
        id: true,
        caseId: true,
        title: true,
        status: true,
      },
    });

    if (!debate) {
      return NextResponse.json(
        {
          success: false,
          error: '辩论不存在',
        },
        { status: 404 }
      );
    }

    // 获取关联案件信息
    const caseInfo = await prisma.case.findUnique({
      where: { id: debate.caseId },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        cause: true,
        metadata: true,
      },
    });

    if (!caseInfo) {
      return NextResponse.json(
        {
          success: false,
          error: '关联案件不存在',
        },
        { status: 404 }
      );
    }

    // 提取关键词（从metadata或cause中）
    let keywords: string[] | undefined;
    if (caseInfo.metadata && typeof caseInfo.metadata === 'object') {
      const metadata = caseInfo.metadata as { keywords?: string[] };
      keywords = metadata.keywords;
    }
    if (!keywords && caseInfo.cause) {
      keywords = [caseInfo.cause];
    }

    // 调用推荐服务
    const recommendations =
      await LawArticleRecommendationService.recommendForDebate(
        {
          title: caseInfo.title,
          description: caseInfo.description,
          type: caseInfo.type,
          keywords,
        },
        {
          limit,
          minScore,
        }
      );

    // 返回结果
    return NextResponse.json(
      {
        success: true,
        recommendations,
        metadata: {
          debateId: debate.id,
          debateTitle: debate.title,
          caseId: caseInfo.id,
          caseTitle: caseInfo.title,
          caseType: caseInfo.type,
          totalCount: recommendations.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取辩论推荐失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取推荐失败',
      },
      { status: 500 }
    );
  }
}
