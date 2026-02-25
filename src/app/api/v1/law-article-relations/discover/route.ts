/**
 * 关系发现触发API
 *
 * 端点: POST /api/v1/law-article-relations/discover
 *
 * 功能：触发法条关系发现
 *
 * 参数:
 *   - articleId: 要发现关系的法条ID
 *   - discoveryMethod: 发现方法（rule_based/ai/case_based/all）
 *   - maxCandidates: 最大候选法条数（可选，默认20）
 *   - triggeredBy: 触发人ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RelationType, DiscoveryMethod } from '@prisma/client';
import { AIDetector } from '@/lib/law-article/relation-discovery/ai-detector';
import { RuleBasedDetector } from '@/lib/law-article/relation-discovery/rule-based-detector';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';

interface DiscoveryRequestBody {
  articleId: string;
  discoveryMethod: 'rule_based' | 'ai' | 'case_based' | 'all';
  maxCandidates?: number;
  triggeredBy: string;
}

interface DiscoveryResult {
  relationId: string;
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence: number;
  discoveryMethod: DiscoveryMethod;
}

interface DiscoveryResponse {
  success: boolean;
  data?: {
    articleId: string;
    discoveredCount: number;
    results: DiscoveryResult[];
  };
  error?: string;
}

// 默认最大候选法条数
const DEFAULT_MAX_CANDIDATES = 20;
const MAX_MAX_CANDIDATES = 100;

export async function POST(
  request: NextRequest
): Promise<NextResponse<DiscoveryResponse>> {
  try {
    // 解析请求体
    let body: DiscoveryRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: '无效的请求体',
        },
        { status: 400 }
      );
    }

    // 参数验证
    if (!body.articleId || typeof body.articleId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'articleId参数是必需的',
        },
        { status: 400 }
      );
    }

    if (
      !['rule_based', 'ai', 'case_based', 'all'].includes(body.discoveryMethod)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'discoveryMethod参数必须是rule_based、ai、case_based或all',
        },
        { status: 400 }
      );
    }

    const maxCandidates = Math.min(
      body.maxCandidates || DEFAULT_MAX_CANDIDATES,
      MAX_MAX_CANDIDATES
    );

    if (!body.triggeredBy || typeof body.triggeredBy !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'triggeredBy参数是必需的',
        },
        { status: 400 }
      );
    }

    if (body.triggeredBy.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'triggeredBy不能为空',
        },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      body.triggeredBy,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: permissionResult.reason || '权限不足',
        },
        { status: 403 }
      );
    }

    // 查询源法条
    const sourceArticle = await prisma.lawArticle.findUnique({
      where: { id: body.articleId },
    });

    if (!sourceArticle) {
      return NextResponse.json(
        {
          success: false,
          error: '法条不存在',
        },
        { status: 404 }
      );
    }

    // 获取候选法条
    const candidateArticles = await prisma.lawArticle.findMany({
      where: {
        id: { not: body.articleId }, // 排除自己
        OR: [
          { category: sourceArticle.category },
          { lawName: sourceArticle.lawName },
        ],
      },
      take: maxCandidates,
    });

    const discoveredRelations: DiscoveryResult[] = [];

    // 根据发现方法执行
    const methods =
      body.discoveryMethod === 'all'
        ? ['rule_based', 'ai']
        : [body.discoveryMethod];

    for (const method of methods) {
      if (method === 'rule_based') {
        // 规则匹配 - 使用替代关系检测（检测新旧法条替代关系）
        try {
          const supersedesRelations =
            RuleBasedDetector.detectSupersedesRelation([
              sourceArticle,
              ...candidateArticles,
            ]);

          for (const relation of supersedesRelations) {
            if (relation.sourceId !== sourceArticle.id) {
              continue; // 只保留以sourceArticle为源的关系
            }

            // 检查是否已存在相同关系
            const existingRelation = await prisma.lawArticleRelation.findFirst({
              where: {
                sourceId: relation.sourceId,
                targetId: relation.targetId,
                relationType: relation.relationType,
              },
            });

            if (!existingRelation) {
              const createdRelation = await prisma.lawArticleRelation.create({
                data: {
                  sourceId: relation.sourceId,
                  targetId: relation.targetId,
                  relationType: relation.relationType,
                  confidence: relation.confidence,
                  strength: relation.confidence,
                  discoveryMethod: DiscoveryMethod.RULE_BASED,
                  verificationStatus: 'PENDING',
                  createdBy: body.triggeredBy,
                  evidence: { description: relation.evidence },
                },
              });

              discoveredRelations.push({
                relationId: createdRelation.id,
                sourceId: createdRelation.sourceId,
                targetId: createdRelation.targetId,
                relationType: createdRelation.relationType,
                confidence: createdRelation.confidence,
                discoveryMethod: createdRelation.discoveryMethod,
              });
            }
          }
        } catch (error) {
          logger.error('规则匹配失败:', error);
        }
      } else if (method === 'ai') {
        // AI检测
        const analysisResults = await AIDetector.batchDetectRelations(
          sourceArticle,
          candidateArticles
        );

        for (const [targetId, result] of analysisResults.entries()) {
          for (const relation of result.relations) {
            // 过滤掉NONE类型
            if (relation.type === 'NONE') {
              continue;
            }

            // 检查是否已存在相同关系
            const existingRelation = await prisma.lawArticleRelation.findFirst({
              where: {
                sourceId: sourceArticle.id,
                targetId,
                relationType: relation.type as RelationType,
              },
            });

            if (!existingRelation) {
              const createdRelation = await prisma.lawArticleRelation.create({
                data: {
                  sourceId: sourceArticle.id,
                  targetId,
                  relationType: relation.type as RelationType,
                  confidence: relation.confidence,
                  strength: relation.confidence,
                  discoveryMethod: DiscoveryMethod.AI_DETECTED,
                  verificationStatus: 'PENDING',
                  createdBy: body.triggeredBy,
                  evidence: { description: relation.reason },
                },
              });

              discoveredRelations.push({
                relationId: createdRelation.id,
                sourceId: createdRelation.sourceId,
                targetId: createdRelation.targetId,
                relationType: createdRelation.relationType,
                confidence: createdRelation.confidence,
                discoveryMethod: createdRelation.discoveryMethod,
              });
            }
          }
        }
      }
    }

    // 记录关系发现操作日志
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await logKnowledgeGraphAction({
        userId: body.triggeredBy,
        action: KnowledgeGraphAction.MANAGE_RELATIONS,
        resource: KnowledgeGraphResource.RELATION,
        description: `触发法条关系发现，发现${discoveredRelations.length}个新关系`,
        ipAddress,
        userAgent,
        metadata: {
          articleId: body.articleId,
          discoveryMethod: body.discoveryMethod,
          discoveredCount: discoveredRelations.length,
          maxCandidates,
        },
      });
    } catch (logError) {
      // 日志记录失败不应影响主流程
      logger.error('记录关系发现日志失败:', logError);
    }

    return NextResponse.json({
      success: true,
      data: {
        articleId: body.articleId,
        discoveredCount: discoveredRelations.length,
        results: discoveredRelations,
      },
    });
  } catch (error) {
    logger.error('触发关系发现失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '触发关系发现失败',
      },
      { status: 500 }
    );
  }
}
