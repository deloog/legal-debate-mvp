/**
 * 知识图谱法条推荐API
 *
 * 端点: GET /api/v1/knowledge-graph/recommendations
 * 参数:
 *   - articleId: 源法条ID（必需）
 *   - limit: 返回数量（默认 10，最大 50）
 *   - mode: 推荐模式 ('relations' | 'graph_distance' | 'similarity')
 *   - relationTypes: 关系类型过滤（可选，逗号分隔）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RelationType, VerificationStatus } from '@prisma/client';
import { validateID } from '@/lib/validation/id-validator';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  sendError,
  sendSuccess,
  sendNotFound,
  sendValidationError,
} from '@/lib/api/api-response';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

interface RecommendationResult {
  articleId: string;
  lawName: string;
  articleNumber: string;
  relevanceScore: number;
  relationType?: string;
  relationStrength?: number;
  reason: string;
}

/**
 * GET /api/v1/knowledge-graph/recommendations
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return sendError('UNAUTHORIZED');
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      return sendError('FORBIDDEN');
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get('articleId');
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get('limit') || '10', 10))
    );
    const mode = searchParams.get('mode') || 'relations';
    const relationTypesParam = searchParams.get('relationTypes');

    // 验证必需参数
    if (!articleId) {
      logger.warn('推荐查询缺少 articleId 参数，返回空结果');
      return sendSuccess(
        {
          sourceArticle: null,
          recommendations: [],
          mode: mode || 'relations',
        },
        { message: '请提供 articleId 参数以获取推荐' }
      );
    }

    // 验证 ID 格式
    const idValidation = validateID(articleId, 'articleId');
    if (!idValidation.valid) {
      return sendValidationError(idValidation.error);
    }

    // 验证源法条是否存在
    const sourceArticle = await prisma.lawArticle.findUnique({
      where: { id: articleId },
      select: { id: true, lawName: true, articleNumber: true, category: true },
    });

    if (!sourceArticle) {
      return sendNotFound('法条');
    }

    // 解析关系类型过滤
    const relationTypes = relationTypesParam
      ? (relationTypesParam
          .split(',')
          .filter(type =>
            Object.values(RelationType).includes(type as RelationType)
          ) as RelationType[])
      : undefined;

    let recommendations: RecommendationResult[] = [];

    // 根据模式选择推荐策略
    switch (mode) {
      case 'relations':
        recommendations = await getRelationBasedRecommendations(
          articleId,
          limit,
          relationTypes
        );
        break;
      case 'graph_distance':
        recommendations = await getGraphDistanceRecommendations(
          articleId,
          limit,
          relationTypes
        );
        break;
      case 'similarity':
        recommendations = await getSimilarityRecommendations(
          sourceArticle,
          limit
        );
        break;
      default:
        return sendValidationError(
          '无效的 mode 参数，有效值为: relations, graph_distance, similarity'
        );
    }

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: KnowledgeGraphResource.GRAPH,
      description: `获取法条推荐: ${sourceArticle.lawName}${sourceArticle.articleNumber}`,
      metadata: {
        articleId,
        mode,
        limit,
        resultCount: recommendations.length,
      },
    });

    return sendSuccess({
      sourceArticle: {
        id: sourceArticle.id,
        lawName: sourceArticle.lawName,
        articleNumber: sourceArticle.articleNumber,
      },
      recommendations,
      mode,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : '获取法条推荐失败';
    logger.error('获取法条推荐失败:', { error: errorMessage });
    return sendError('INTERNAL_ERROR', '获取法条推荐失败，请稍后重试');
  }
}

/**
 * 基于直接关系获取推荐
 */
async function getRelationBasedRecommendations(
  articleId: string,
  limit: number,
  relationTypes?: RelationType[]
): Promise<RecommendationResult[]> {
  const where: {
    verificationStatus: VerificationStatus;
    OR: Array<{ sourceId: string } | { targetId: string }>;
    relationType?: { in: RelationType[] };
  } = {
    verificationStatus: VerificationStatus.VERIFIED,
    OR: [{ sourceId: articleId }, { targetId: articleId }],
  };

  if (relationTypes && relationTypes.length > 0) {
    where.relationType = { in: relationTypes };
  }

  const relations = await prisma.lawArticleRelation.findMany({
    where,
    include: {
      source: {
        select: { id: true, lawName: true, articleNumber: true },
      },
      target: {
        select: { id: true, lawName: true, articleNumber: true },
      },
    },
    orderBy: { strength: 'desc' },
    take: limit * 2, // 获取多一些以便过滤
  });

  const recommendations: RecommendationResult[] = [];
  const seenIds = new Set<string>();

  for (const relation of relations) {
    // 确定推荐的目标法条（不是源法条的那个）
    const isSource = relation.sourceId === articleId;
    const targetArticle = isSource ? relation.target : relation.source;

    if (!targetArticle || seenIds.has(targetArticle.id)) {
      continue;
    }

    seenIds.add(targetArticle.id);

    recommendations.push({
      articleId: targetArticle.id,
      lawName: targetArticle.lawName,
      articleNumber: targetArticle.articleNumber,
      relevanceScore: relation.strength,
      relationType: relation.relationType,
      relationStrength: relation.strength,
      reason: `基于${getRelationTypeLabel(relation.relationType)}关系推荐`,
    });

    if (recommendations.length >= limit) {
      break;
    }
  }

  return recommendations;
}

/**
 * 基于图距离获取推荐（2跳邻居）
 */
async function getGraphDistanceRecommendations(
  articleId: string,
  limit: number,
  relationTypes?: RelationType[]
): Promise<RecommendationResult[]> {
  // 首先获取直接邻居
  const directRelations = await prisma.lawArticleRelation.findMany({
    where: {
      verificationStatus: VerificationStatus.VERIFIED,
      OR: [{ sourceId: articleId }, { targetId: articleId }],
      ...(relationTypes && relationTypes.length > 0
        ? { relationType: { in: relationTypes } }
        : {}),
    },
    select: {
      sourceId: true,
      targetId: true,
    },
  });

  const directNeighborIds = directRelations.map(r =>
    r.sourceId === articleId ? r.targetId : r.sourceId
  );

  if (directNeighborIds.length === 0) {
    return [];
  }

  // 获取2跳邻居（邻居的邻居）
  // 注意：查询邻居的关系，但排除与原始 articleId 直接相关的关系
  const secondHopRelations = await prisma.lawArticleRelation.findMany({
    where: {
      verificationStatus: VerificationStatus.VERIFIED,
      OR: [
        { sourceId: { in: directNeighborIds } },
        { targetId: { in: directNeighborIds } },
      ],
      // 排除与原始 articleId 直接相关的关系（避免查询 1 跳关系）
      AND: [{ sourceId: { not: articleId } }, { targetId: { not: articleId } }],
      ...(relationTypes && relationTypes.length > 0
        ? { relationType: { in: relationTypes } }
        : {}),
    },
    include: {
      source: {
        select: { id: true, lawName: true, articleNumber: true },
      },
      target: {
        select: { id: true, lawName: true, articleNumber: true },
      },
    },
    orderBy: { strength: 'desc' },
    take: limit * 3,
  });

  const recommendations: RecommendationResult[] = [];
  // 需要排除：原始 articleId + 直接邻居
  const seenIds = new Set<string>([articleId, ...directNeighborIds]);

  for (const relation of secondHopRelations) {
    // 确定目标节点（与 directNeighborIds 相连的那个节点的另一端）
    let targetArticle;
    if (directNeighborIds.includes(relation.sourceId)) {
      targetArticle = relation.target;
    } else {
      targetArticle = relation.source;
    }

    if (!targetArticle || seenIds.has(targetArticle.id)) {
      continue;
    }

    seenIds.add(targetArticle.id);

    // 计算衰减后的相关性分数
    const decayedScore = relation.strength * 0.7; // 2跳衰减

    recommendations.push({
      articleId: targetArticle.id,
      lawName: targetArticle.lawName,
      articleNumber: targetArticle.articleNumber,
      relevanceScore: decayedScore,
      relationType: relation.relationType,
      relationStrength: relation.strength,
      reason: `基于图距离推荐（2跳）- ${getRelationTypeLabel(relation.relationType)}关系`,
    });

    if (recommendations.length >= limit) {
      break;
    }
  }

  return recommendations;
}

/**
 * 基于相似性获取推荐（同类别）
 */
async function getSimilarityRecommendations(
  sourceArticle: {
    id: string;
    lawName: string;
    articleNumber: string;
    category: string | null;
  },
  limit: number
): Promise<RecommendationResult[]> {
  if (!sourceArticle.category) {
    return [];
  }

  const similarArticles = await prisma.lawArticle.findMany({
    where: {
      category: sourceArticle.category as any,
      id: { not: sourceArticle.id },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return similarArticles.map(article => ({
    articleId: article.id,
    lawName: article.lawName,
    articleNumber: article.articleNumber,
    relevanceScore: 0.5, // 基础相似度
    reason: `基于同类别推荐（${sourceArticle.category}）`,
  }));
}

/**
 * 获取关系类型中文标签
 */
function getRelationTypeLabel(relationType: RelationType): string {
  const labels: Record<RelationType, string> = {
    [RelationType.SUPERSEDES]: '替代',
    [RelationType.SUPERSEDED_BY]: '被替代',
    [RelationType.IMPLEMENTS]: '实施',
    [RelationType.IMPLEMENTED_BY]: '被实施',
    [RelationType.CITES]: '引用',
    [RelationType.CITED_BY]: '被引用',
    [RelationType.CONFLICTS]: '冲突',
    [RelationType.RELATED]: '相关',
    [RelationType.COMPLETES]: '补充',
    [RelationType.COMPLETED_BY]: '被补充',
  };
  return labels[relationType] || relationType;
}
