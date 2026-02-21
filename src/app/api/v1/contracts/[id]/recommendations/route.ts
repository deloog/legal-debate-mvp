/**
 * 合同推荐API路由
 * GET /api/v1/contracts/[id]/recommendations
 *
 * 功能：为指定合同推荐相关法条
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { logger } from '@/lib/logger';

/**
 * 获取合同推荐法条
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const { id: contractId } = params;
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

    // 获取合同信息
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        caseType: true,
        caseSummary: true,
        scope: true,
        status: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: '合同不存在',
        },
        { status: 404 }
      );
    }

    // 调用推荐服务
    const recommendations =
      await LawArticleRecommendationService.recommendForContract(
        {
          type: contract.caseType,
          content: contract.caseSummary,
          existingArticles: [], // 可以后续扩展，从合同中提取已有法条
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
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          caseType: contract.caseType,
          totalCount: recommendations.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('获取合同推荐失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取推荐失败',
      },
      { status: 500 }
    );
  }
}
