/**
 * 合同法条推荐API
 *
 * GET /api/v1/contracts/[id]/law-recommendations
 *
 * 功能：基于合同内容分析结果，调用知识图谱推荐相关法条
 * 设计：异步调用，不阻塞主分析流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { graphEnhancedSearch } from '@/lib/debate/graph-enhanced-law-search';
import { logger } from '@/lib/logger';

/**
 * 获取合同法条推荐
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const contractId = params.id;

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const caseType = searchParams.get('caseType');
    const timeoutMs = parseInt(searchParams.get('timeout') || '500', 10);

    // 验证参数
    if (!contractId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_CONTRACT_ID',
            message: '合同ID不能为空',
          },
        },
        { status: 400 }
      );
    }

    // 查找合同
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        caseId: true,
      },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONTRACT_NOT_FOUND',
            message: '合同不存在',
          },
        },
        { status: 404 }
      );
    }

    // 确定案件类型（如果有关联案件，从案件获取类型）
    let resolvedCaseType = caseType;
    if (!resolvedCaseType && contract.caseId) {
      const relatedCase = await prisma.case.findUnique({
        where: { id: contract.caseId },
        select: { type: true },
      });
      if (relatedCase) {
        resolvedCaseType = relatedCase.type;
      }
    }

    // 使用合同编号作为关键词进行图谱搜索
    const searchKeywords = contract.contractNumber || '合同';

    // 调用图谱增强搜索
    const graphResult = await graphEnhancedSearch(
      resolvedCaseType,
      searchKeywords,
      {
        timeoutMs: Math.min(timeoutMs, 1000), // 最多1秒超时
        includeAttackPaths: true,
      }
    );

    // 格式化推荐结果
    const recommendations = {
      // 支持法条
      supportingArticles: graphResult.supportingArticles.map(article => ({
        id: article.id,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        category: article.category,
      })),
      // 对方法条（用于预判对方观点）
      opposingArticles: graphResult.opposingArticles.map(article => ({
        id: article.id,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        category: article.category,
      })),
      // 冲突关系
      conflicts: graphResult.conflictRelations.map(rel => ({
        source: {
          lawName: rel.source.lawName,
          articleNumber: rel.source.articleNumber,
        },
        target: {
          lawName: rel.target.lawName,
          articleNumber: rel.target.articleNumber,
        },
      })),
      // 补充关系
      complements: graphResult.complementRelations.map(rel => ({
        source: {
          lawName: rel.source.lawName,
          articleNumber: rel.source.articleNumber,
        },
        target: {
          lawName: rel.target.lawName,
          articleNumber: rel.target.articleNumber,
        },
      })),
      // 攻击路径
      attackPaths: graphResult.attackPaths.map(path => ({
        explanation: path.explanation,
        relationType: path.relationType,
      })),
    };

    logger.info(
      `[contract-law-recommendations] 合同 ${contractId} 推荐完成，支持:${recommendations.supportingArticles.length}, 对手:${recommendations.opposingArticles.length}`
    );

    return NextResponse.json({
      success: true,
      contractId,
      graphAnalysisCompleted: graphResult.graphAnalysisCompleted,
      sourceAttribution: graphResult.sourceAttribution,
      recommendations,
    });
  } catch (error) {
    logger.error('获取合同法条推荐失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RECOMMENDATION_ERROR',
          message: '获取法条推荐失败',
        },
      },
      { status: 500 }
    );
  }
}
