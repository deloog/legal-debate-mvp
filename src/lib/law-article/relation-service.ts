/**
 * 法条关系管理服务
 * 提供关系的CRUD操作、查询和统计功能
 */

import { prisma } from '../db/prisma';
import { logger } from '../logger';
import {
  LawArticleRelation,
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  Prisma,
} from '@prisma/client';

/**
 * 创建关系的输入参数
 */
export interface CreateRelationInput {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  strength?: number;
  confidence?: number;
  description?: string;
  evidence?: Prisma.JsonValue;
  discoveryMethod?: DiscoveryMethod;
  userId?: string;

  // AI相关字段
  aiProvider?: string;
  aiModel?: string;
  aiConfidence?: number;
  aiReasoning?: string;
  aiCreatedAt?: Date;

  // 审核历史
  reviewHistory?: Prisma.JsonValue;
}

/**
 * 审核历史的记录项
 */
export interface ReviewHistoryItem {
  userId: string;
  action: 'VERIFIED' | 'REJECTED' | 'MODIFIED';
  comment?: string;
  timestamp: string;
  previousStatus?: VerificationStatus;
  newStatus?: VerificationStatus;
}

/**
 * 法条关系图结构
 */
export interface ArticleRelationGraph {
  articleId: string;
  outgoingRelations: Array<LawArticleRelation & { target: unknown }>;
  incomingRelations: Array<LawArticleRelation & { source: unknown }>;
  totalRelations: number;
}

/**
 * 关系路径
 */
export interface RelationPath {
  source: string;
  target: string;
  path: LawArticleRelation[];
  length: number;
}

/**
 * 关系统计
 */
export interface RelationStats {
  articleId: string;
  byType: Partial<Record<RelationType, number>>;
  total: number;
}

/**
 * 获取关系的选项
 */
export interface GetRelationsOptions {
  relationType?: RelationType;
  direction?: 'outgoing' | 'incoming' | 'both';
  minStrength?: number;
  verificationStatus?: VerificationStatus;
}

/**
 * 法条关系管理服务类
 */
export class LawArticleRelationService {
  /**
   * 创建关系
   */
  static async createRelation(
    data: CreateRelationInput
  ): Promise<LawArticleRelation> {
    // 验证关系的合理性
    await this.validateRelation(data);

    // 创建关系
    const relation = await prisma.lawArticleRelation.create({
      data: {
        sourceId: data.sourceId,
        targetId: data.targetId,
        relationType: data.relationType,
        strength: data.strength ?? 1.0,
        confidence: data.confidence ?? 1.0,
        description: data.description,
        evidence: data.evidence ?? Prisma.JsonNull,
        discoveryMethod: data.discoveryMethod ?? DiscoveryMethod.MANUAL,
        createdBy: data.userId,

        // AI相关字段
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        aiConfidence: data.aiConfidence,
        aiReasoning: data.aiReasoning,
        aiCreatedAt: data.aiCreatedAt,

        // 审核历史
        reviewHistory: data.reviewHistory ?? Prisma.JsonNull,
      },
    });

    return relation;
  }

  /**
   * 批量创建关系
   */
  static async batchCreateRelations(
    relations: CreateRelationInput[]
  ): Promise<LawArticleRelation[]> {
    const results: LawArticleRelation[] = [];

    for (const relationData of relations) {
      try {
        const relation = await this.createRelation(relationData);
        results.push(relation);
      } catch (error) {
        logger.error('创建关系失败', {
          error,
          sourceId: relationData.sourceId,
          targetId: relationData.targetId,
        });
      }
    }

    return results;
  }

  /**
   * 获取法条的所有关系
   */
  static async getArticleRelations(
    articleId: string,
    options?: GetRelationsOptions
  ): Promise<ArticleRelationGraph> {
    const where: Prisma.LawArticleRelationWhereInput = {};

    if (options?.relationType) {
      where.relationType = options.relationType;
    }

    if (options?.minStrength !== undefined) {
      where.strength = { gte: options.minStrength };
    }

    if (options?.verificationStatus) {
      where.verificationStatus = options.verificationStatus;
    }

    // 查询出边（source relations）
    const outgoing =
      options?.direction !== 'incoming'
        ? await prisma.lawArticleRelation.findMany({
            where: { sourceId: articleId, ...where },
            include: { target: true },
          })
        : [];

    // 查询入边（target relations）
    const incoming =
      options?.direction !== 'outgoing'
        ? await prisma.lawArticleRelation.findMany({
            where: { targetId: articleId, ...where },
            include: { source: true },
          })
        : [];

    return {
      articleId,
      outgoingRelations: outgoing,
      incomingRelations: incoming,
      totalRelations: outgoing.length + incoming.length,
    };
  }

  /**
   * 查找关系路径（A到B的关系链）
   */
  static async findRelationPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 3
  ): Promise<RelationPath[]> {
    // 源和目标相同时，返回空数组
    if (sourceId === targetId) {
      return [];
    }

    const visited = new Set<string>();
    const queue: Array<{
      articleId: string;
      path: LawArticleRelation[];
      depth: number;
    }> = [{ articleId: sourceId, path: [], depth: 0 }];
    const paths: RelationPath[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      if (current.depth > maxDepth) continue;
      if (visited.has(current.articleId)) continue;

      visited.add(current.articleId);

      // 获取相邻节点
      const relations = await prisma.lawArticleRelation.findMany({
        where: { sourceId: current.articleId },
      });

      for (const rel of relations) {
        const nextDepth = current.depth + 1;

        // 找到目标，且深度不超过限制
        if (rel.targetId === targetId && nextDepth <= maxDepth) {
          paths.push({
            source: sourceId,
            target: targetId,
            path: [...current.path, rel],
            length: nextDepth,
          });
          continue;
        }

        // 继续探索，但不超过最大深度
        if (!visited.has(rel.targetId) && nextDepth < maxDepth) {
          queue.push({
            articleId: rel.targetId,
            path: [...current.path, rel],
            depth: nextDepth,
          });
        }
      }
    }

    return paths;
  }

  /**
   * 获取关系统计
   */
  static async getRelationStats(articleId: string): Promise<RelationStats> {
    const stats = await prisma.lawArticleRelation.groupBy({
      by: ['relationType'],
      where: {
        OR: [{ sourceId: articleId }, { targetId: articleId }],
      },
      _count: true,
    });

    const byType: Partial<Record<RelationType, number>> = {};
    let total = 0;

    for (const stat of stats) {
      byType[stat.relationType] = stat._count;
      total += stat._count;
    }

    return {
      articleId,
      byType,
      total,
    };
  }

  /**
   * 验证关系
   */
  static async verifyRelation(
    relationId: string,
    verifiedBy: string,
    isApproved: boolean,
    comment?: string
  ): Promise<LawArticleRelation> {
    // 获取当前关系
    const currentRelation = await prisma.lawArticleRelation.findUnique({
      where: { id: relationId },
    });

    if (!currentRelation) {
      throw new Error(`关系不存在: ${relationId}`);
    }

    // 构建审核历史记录
    const reviewItem: ReviewHistoryItem = {
      userId: verifiedBy,
      action: isApproved ? 'VERIFIED' : 'REJECTED',
      comment,
      timestamp: new Date().toISOString(),
      previousStatus: currentRelation.verificationStatus,
      newStatus: isApproved
        ? VerificationStatus.VERIFIED
        : VerificationStatus.REJECTED,
    };

    // 更新审核历史
    const currentHistory =
      (currentRelation.reviewHistory as unknown as ReviewHistoryItem[]) ?? [];
    const newReviewHistory = [...currentHistory, reviewItem];

    return prisma.lawArticleRelation.update({
      where: { id: relationId },
      data: {
        verificationStatus: isApproved
          ? VerificationStatus.VERIFIED
          : VerificationStatus.REJECTED,
        verifiedBy,
        verifiedAt: new Date(),
        rejectionReason: isApproved ? null : (comment ?? null),
        reviewHistory: newReviewHistory as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 删除关系
   */
  static async deleteRelation(relationId: string): Promise<void> {
    await prisma.lawArticleRelation.delete({
      where: { id: relationId },
    });
  }

  /**
   * 根据ID获取关系
   */
  static async getRelationById(
    relationId: string
  ): Promise<LawArticleRelation | null> {
    return prisma.lawArticleRelation.findUnique({
      where: { id: relationId },
    });
  }

  /**
   * 更新关系
   */
  static async updateRelation(
    relationId: string,
    data: Prisma.LawArticleRelationUpdateInput
  ): Promise<LawArticleRelation> {
    return prisma.lawArticleRelation.update({
      where: { id: relationId },
      data,
    });
  }

  /**
   * 验证关系数据
   */
  private static async validateRelation(
    data: CreateRelationInput
  ): Promise<void> {
    // 检查参数有效性
    if (!data.sourceId || !data.targetId) {
      throw new Error('源法条ID和目标法条ID不能为空');
    }

    // 检查是否自引用
    if (data.sourceId === data.targetId) {
      throw new Error('禁止自引用');
    }

    // 检查源法条和目标法条是否存在
    const [source, target] = await Promise.all([
      prisma.lawArticle.findUnique({ where: { id: data.sourceId } }),
      prisma.lawArticle.findUnique({ where: { id: data.targetId } }),
    ]);

    if (!source) {
      throw new Error(`源法条不存在: ${data.sourceId}`);
    }

    if (!target) {
      throw new Error(`目标法条不存在: ${data.targetId}`);
    }
  }
}
