/**
 * 知识图谱企业风险分析API
 *
 * 功能：合同条款风险关联分析
 *
 * 端点: GET /api/v1/knowledge-graph/enterprise-risk-analysis
 * 参数:
 *   - contractId: 合同ID（必需）
 *   - enterpriseId: 企业ID（可选）
 *   - industryType: 行业类型（可选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';

interface RiskAnalysisResult {
  contractId: string;
  enterpriseId?: string;
  industryType?: string;
  clauses: Array<{
    lawArticleId: string;
    lawName: string;
    articleNumber: string;
  }>;
  risks: Array<{
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    description: string;
    affectedClauses: string[];
    relatedArticles: string[];
  }>;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  analysis: {
    totalClauses: number;
    totalRisks: number;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
  };
}

// 风险等级映射
const RISK_SEVERITY = {
  CONFLICTS: 'HIGH',
  INVALIDATES: 'CRITICAL',
  MODIFIES: 'MEDIUM',
  CITES: 'LOW',
  REFERS: 'LOW',
} as const;

/**
 * GET /api/v1/knowledge-graph/enterprise-risk-analysis
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;

  try {
    // 参数验证
    const contractId = searchParams.get('contractId');

    if (!contractId) {
      return NextResponse.json(
        { error: '缺少必需参数: contractId' },
        { status: 400 }
      );
    }

    const enterpriseId = searchParams.get('enterpriseId') || undefined;
    const industryType = searchParams.get('industryType') || undefined;

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      '', // 用户ID从header中获取
      KnowledgeGraphAction.VIEW_RELATIONS,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限进行企业风险分析', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 验证合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true },
    });

    if (!contract) {
      return NextResponse.json({ error: '合同不存在' }, { status: 404 });
    }

    // 获取合同关联的法条
    const contractLawArticles = await prisma.contractLawArticle.findMany({
      where: { contractId },
      select: {
        lawArticleId: true,
      },
    });

    if (!contractLawArticles || contractLawArticles.length === 0) {
      return NextResponse.json({
        contractId,
        enterpriseId,
        industryType,
        clauses: [],
        risks: [],
        riskLevel: 'LOW',
        analysis: {
          totalClauses: 0,
          totalRisks: 0,
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 0,
          lowRisks: 0,
        },
      });
    }

    // 获取图谱数据
    const graphData = await GraphBuilder.buildFullGraph();

    if (graphData.nodes.length === 0) {
      // 返回空风险分析结果
      return NextResponse.json({
        contractId,
        enterpriseId,
        industryType,
        clauses: [],
        risks: [],
        riskLevel: 'LOW',
        analysis: {
          totalClauses: 0,
          totalRisks: 0,
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 0,
          lowRisks: 0,
        },
      });
    }

    // 获取法条详情
    const clauseArticleIds = contractLawArticles.map(c => c.lawArticleId);
    const clauseArticles = await prisma.lawArticle.findMany({
      where: {
        id: { in: clauseArticleIds },
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
    });

    // 构建条款信息
    const clauses = clauseArticles.map(article => ({
      lawArticleId: article.id,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
    }));

    // 分析风险
    const risks: Array<{
      type: string;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      description: string;
      affectedClauses: string[];
      relatedArticles: string[];
    }> = [];

    // 检测条款之间的冲突关系
    for (let i = 0; i < clauseArticles.length; i++) {
      for (let j = i + 1; j < clauseArticles.length; j++) {
        const article1 = clauseArticles[i];
        const article2 = clauseArticles[j];

        const pathResult = GraphAlgorithms.shortestPath(
          graphData.nodes,
          graphData.links,
          article1.id,
          article2.id
        );

        if (pathResult.exists && pathResult.relationTypes.length > 0) {
          const relationType = pathResult.relationTypes[0];

          // 只关注高风险关系类型
          if (
            relationType === 'CONFLICTS' ||
            relationType === 'INVALIDATES' ||
            relationType === 'MODIFIES'
          ) {
            risks.push({
              type: relationType,
              severity:
                RISK_SEVERITY[relationType as keyof typeof RISK_SEVERITY],
              description: getRelationDescription(
                relationType,
                article1,
                article2
              ),
              affectedClauses: [
                `${article1.lawName}${article1.articleNumber}`,
                `${article2.lawName}${article2.articleNumber}`,
              ],
              relatedArticles: [article1.id, article2.id],
            });
          }
        }
      }
    }

    // 分析中心性（识别高风险法条）
    const centralityResults = GraphAlgorithms.degreeCentrality(
      graphData.nodes,
      graphData.links
    );

    // 找出合同条款中的高中心性法条
    const highRiskArticles = centralityResults
      .filter(r => clauseArticleIds.includes(r.nodeId) && r.score > 3)
      .slice(0, 5);

    for (const article of highRiskArticles) {
      risks.push({
        type: 'HIGH_CONNECTIVITY',
        severity: 'MEDIUM',
        description: `法条${article.articleNumber}与${article.score}个其他法条存在关联，可能增加风险传播范围`,
        affectedClauses: [`${article.lawName}${article.articleNumber}`],
        relatedArticles: [article.nodeId],
      });
    }

    // 统计风险等级
    const analysis = {
      totalClauses: clauseArticles.length,
      totalRisks: risks.length,
      criticalRisks: risks.filter(r => r.severity === 'CRITICAL').length,
      highRisks: risks.filter(r => r.severity === 'HIGH').length,
      mediumRisks: risks.filter(r => r.severity === 'MEDIUM').length,
      lowRisks: risks.filter(r => r.severity === 'LOW').length,
    };

    // 计算整体风险等级
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (analysis.criticalRisks > 0) {
      riskLevel = 'CRITICAL';
    } else if (analysis.highRisks >= 2) {
      riskLevel = 'HIGH';
    } else if (analysis.highRisks > 0 || analysis.mediumRisks >= 3) {
      riskLevel = 'MEDIUM';
    }

    const result: RiskAnalysisResult = {
      contractId,
      enterpriseId,
      industryType,
      clauses,
      risks,
      riskLevel,
      analysis,
    };

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: '', // 从header获取
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: 'RELATION' as never,
      description: `企业风险分析: 合同${contractId}`,
      metadata: {
        contractId,
        enterpriseId,
        industryType,
        riskLevel,
        totalRisks: risks.length,
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    logger.error('企业风险分析失败', {
      error,
      contractId: searchParams.get('contractId'),
    });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 获取关系类型描述
 */
function getRelationDescription(
  relationType: string,
  article1: { lawName: string; articleNumber: string },
  article2: { lawName: string; articleNumber: string }
): string {
  const descriptions: Record<string, string> = {
    CONFLICTS: `${article1.lawName}${article1.articleNumber}与${article2.lawName}${article2.articleNumber}存在冲突`,
    INVALIDATES: `${article1.lawName}${article1.articleNumber}使${article2.lawName}${article2.articleNumber}失效`,
    MODIFIES: `${article1.lawName}${article1.articleNumber}修改了${article2.lawName}${article2.articleNumber}`,
    CITES: `${article1.lawName}${article1.articleNumber}引用了${article2.lawName}${article2.articleNumber}`,
    REFERS: `${article1.lawName}${article1.articleNumber}提及了${article2.lawName}${article2.articleNumber}`,
  };

  return (
    descriptions[relationType] ||
    `${article1.lawName}${article1.articleNumber}与${article2.lawName}${article2.articleNumber}存在${relationType}关系`
  );
}
