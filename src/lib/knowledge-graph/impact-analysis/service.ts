/**
 * 知识图谱动态更新 - 影响分析服务
 * 当法条被修改或废止时，分析受影响的关系并提供处理建议
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  ChangeType,
  ImpactStatus,
  RecommendationAction,
  type ImpactAnalysisInput,
  type ImpactAnalysisResult,
  type ImpactedRelation,
  type ImpactRecommendation,
  type RelationUpdateInput,
  type BatchUpdateResult,
  type ImpactStatistics,
} from '@/lib/knowledge-graph/impact-analysis/types';
import { RelationType, VerificationStatus } from '@prisma/client';

/**
 * 影响分析配置
 */
const config = {
  defaultDepth: 2,
  highImpactThreshold: 10,
  mediumImpactThreshold: 5,
  enableAutoVerify: true,
  autoVerifyConditions: {
    minConfidence: 0.8,
    minStrength: 0.7,
    mustBeVerified: true,
  },
};

/**
 * 影响分析服务类
 */
export class ImpactAnalysisService {
  /**
   * 分析法条变更的影响
   */
  static async analyzeImpact(
    input: ImpactAnalysisInput
  ): Promise<ImpactAnalysisResult> {
    const { lawArticleId, changeType } = input;

    logger.info('开始分析法条变更影响', { lawArticleId, changeType });

    // 获取法条信息
    const article = await prisma.lawArticle.findUnique({
      where: { id: lawArticleId },
    });

    if (!article) {
      logger.error('法条不存在', { lawArticleId });
      throw new Error('法条不存在');
    }

    // 获取受影响的关系
    const impactedRelations = await this.getImpactedRelations(
      lawArticleId,
      changeType
    );

    // 生成处理建议
    const recommendations = this.generateRecommendations(
      impactedRelations,
      changeType
    );

    // 计算统计信息
    const statistics = this.calculateStatistics(
      impactedRelations,
      recommendations
    );

    const result: ImpactAnalysisResult = {
      articleId: lawArticleId,
      articleName: article.lawName,
      articleNumber: article.articleNumber,
      changeType,
      impactedRelations,
      recommendations,
      statistics,
      analyzedAt: new Date().toISOString(),
    };

    logger.info('影响分析完成', {
      lawArticleId,
      changeType,
      totalImpacted: statistics.totalImpacted,
      highPriorityCount: statistics.highPriorityCount,
    });

    return result;
  }

  /**
   * 获取受影响的关系
   */
  static async getImpactedRelations(
    articleId: string,
    changeType: ChangeType
  ): Promise<ImpactedRelation[]> {
    logger.debug('获取受影响的关系', { articleId, changeType });

    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [{ sourceId: articleId }, { targetId: articleId }],
      },
      include: {
        source: true,
        target: true,
      },
    });

    return relations.map(relation => ({
      relationId: relation.id,
      sourceId: relation.sourceId,
      sourceLawName: relation.source.lawName,
      sourceArticleNumber: relation.source.articleNumber,
      targetId: relation.targetId,
      targetLawName: relation.target.lawName,
      targetArticleNumber: relation.target.articleNumber,
      relationType: relation.relationType,
      impactStatus: this.determineImpactStatus(
        relation.relationType,
        changeType
      ),
      verificationStatus: relation.verificationStatus,
      strength: relation.strength,
      confidence: relation.confidence,
      discoveryMethod: relation.discoveryMethod,
    }));
  }

  /**
   * 根据关系类型和变更类型确定影响状态
   */
  private static determineImpactStatus(
    relationType: RelationType,
    changeType: ChangeType
  ): ImpactStatus {
    // 法条被废止时的处理规则
    if (changeType === ChangeType.REPEALED) {
      // CITES, COMPLETES, IMPLEMENTS 关系可能失效
      if (
        relationType === RelationType.CITES ||
        relationType === RelationType.COMPLETES ||
        relationType === RelationType.IMPLEMENTS ||
        relationType === RelationType.CITED_BY ||
        relationType === RelationType.COMPLETED_BY ||
        relationType === RelationType.IMPLEMENTED_BY
      ) {
        return ImpactStatus.POTENTIALLY_INVALID;
      }

      // SUPERSEDES 关系仍然有效，甚至可能被自动验证
      if (
        relationType === RelationType.SUPERSEDES ||
        relationType === RelationType.SUPERSEDED_BY
      ) {
        return ImpactStatus.AFFECTED;
      }

      // CONFLICTS, RELATED 关系标记为受影响
      return ImpactStatus.AFFECTED;
    }

    // 法条被修改时的处理规则
    if (changeType === ChangeType.AMENDED) {
      // 所有相关关系都需要重新审查
      return ImpactStatus.NEEDS_REVIEW;
    }

    return ImpactStatus.NONE;
  }

  /**
   * 生成处理建议
   */
  static generateRecommendations(
    impactedRelations: ImpactedRelation[],
    changeType: ChangeType
  ): ImpactRecommendation[] {
    return impactedRelations.map(relation => {
      const priority = this.determinePriority(relation, changeType);
      const action = this.determineAction(relation, changeType);

      let reason: string;
      let impactScope: string;
      let requiresHumanConfirmation: boolean;

      if (changeType === ChangeType.REPEALED) {
        reason = '目标法条已被废止';
        impactScope =
          relation.impactStatus === ImpactStatus.POTENTIALLY_INVALID
            ? '直接影响'
            : '间接影响';
        requiresHumanConfirmation = priority === 'high';
      } else {
        reason = '法条已被修改，建议重新验证关系';
        impactScope = '需要重新审查';
        requiresHumanConfirmation = action !== RecommendationAction.AUTO_VERIFY;
      }

      return {
        recommendationId: this.generateRecommendationId(relation.relationId),
        relationId: relation.relationId,
        action,
        reason,
        priority,
        impactScope,
        requiresHumanConfirmation,
      };
    });
  }

  /**
   * 确定建议操作
   */
  private static determineAction(
    relation: ImpactedRelation,
    changeType: ChangeType
  ): RecommendationAction {
    // 法条被废止时
    if (changeType === ChangeType.REPEALED) {
      if (relation.impactStatus === ImpactStatus.POTENTIALLY_INVALID) {
        // 检查是否可以自动验证
        if (
          config.enableAutoVerify &&
          relation.verificationStatus === VerificationStatus.VERIFIED &&
          relation.confidence >= config.autoVerifyConditions.minConfidence &&
          relation.strength >= config.autoVerifyConditions.minStrength
        ) {
          return RecommendationAction.AUTO_VERIFY;
        }
        return RecommendationAction.MARK_AS_INVALID;
      }

      if (relation.impactStatus === ImpactStatus.AFFECTED) {
        return RecommendationAction.REQUEST_REVIEW;
      }

      return RecommendationAction.NO_ACTION;
    }

    // 法条被修改时
    if (changeType === ChangeType.AMENDED) {
      if (
        config.enableAutoVerify &&
        relation.verificationStatus === VerificationStatus.VERIFIED &&
        relation.confidence >= config.autoVerifyConditions.minConfidence &&
        relation.strength >= config.autoVerifyConditions.minStrength
      ) {
        return RecommendationAction.AUTO_VERIFY;
      }
      return RecommendationAction.REQUEST_REVIEW;
    }

    return RecommendationAction.NO_ACTION;
  }

  /**
   * 确定优先级
   */
  static determinePriority(
    relation: ImpactedRelation,
    changeType: ChangeType
  ): 'high' | 'medium' | 'low' {
    // 高优先级：已验证的、高置信度的关键关系
    if (
      relation.verificationStatus === VerificationStatus.VERIFIED &&
      relation.confidence >= 0.9 &&
      (relation.relationType === RelationType.CITES ||
        relation.relationType === RelationType.CONFLICTS ||
        relation.relationType === RelationType.SUPERSEDES)
    ) {
      return 'high';
    }

    // 高优先级：法条废止时的CITES关系
    if (
      changeType === ChangeType.REPEALED &&
      relation.relationType === RelationType.CITES &&
      relation.verificationStatus === VerificationStatus.VERIFIED
    ) {
      return 'high';
    }

    // 中优先级：已验证的、中等置信度的关系
    if (
      relation.verificationStatus === VerificationStatus.VERIFIED &&
      relation.confidence >= 0.8
    ) {
      return 'medium';
    }

    // 中优先级：法条废止时的COMPLETES关系
    if (
      changeType === ChangeType.REPEALED &&
      relation.relationType === RelationType.COMPLETES
    ) {
      return 'medium';
    }

    // 低优先级：其他情况
    return 'low';
  }

  /**
   * 生成推荐ID
   */
  static generateRecommendationId(relationId: string): string {
    const timestamp = Date.now();
    return `rec_${relationId}_${timestamp}`;
  }

  /**
   * 批量更新关系
   */
  static async batchUpdateRelations(
    updates: RelationUpdateInput[]
  ): Promise<BatchUpdateResult> {
    logger.info('开始批量更新关系', { count: updates.length });

    const results: Array<{
      relationId: string;
      success: boolean;
      error?: string;
    }> = [];
    let successCount = 0;
    let failedCount = 0;

    for (const update of updates) {
      try {
        await prisma.lawArticleRelation.update({
          where: { id: update.relationId },
          data: {
            ...(update.verificationStatus && {
              verificationStatus: update.verificationStatus,
            }),
            ...(update.verifiedBy && {
              verifiedBy: update.verifiedBy,
              verifiedAt: new Date(),
            }),
            ...(update.rejectionReason && {
              rejectionReason: update.rejectionReason,
            }),
          },
        });

        results.push({ relationId: update.relationId, success: true });
        successCount++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        logger.error('更新关系失败', {
          relationId: update.relationId,
          error: errorMessage,
        });

        results.push({
          relationId: update.relationId,
          success: false,
          error: errorMessage,
        });
        failedCount++;
      }
    }

    logger.info('批量更新完成', {
      total: updates.length,
      successCount,
      failedCount,
    });

    return {
      successCount,
      failedCount,
      results,
    };
  }

  /**
   * 计算统计信息
   */
  static calculateStatistics(
    impactedRelations: ImpactedRelation[],
    recommendations: ImpactRecommendation[]
  ): ImpactStatistics {
    const statistics: ImpactStatistics = {
      totalImpacted: impactedRelations.length,
      byImpactStatus: {},
      byRelationType: {},
      highPriorityCount: 0,
      mediumPriorityCount: 0,
      lowPriorityCount: 0,
    };

    // 按影响状态分组
    for (const relation of impactedRelations) {
      const status = relation.impactStatus;
      statistics.byImpactStatus[status] =
        (statistics.byImpactStatus[status] || 0) + 1;

      // 按关系类型分组
      const type = relation.relationType;
      statistics.byRelationType[type] =
        (statistics.byRelationType[type] || 0) + 1;
    }

    // 按优先级分组
    for (const recommendation of recommendations) {
      switch (recommendation.priority) {
        case 'high':
          statistics.highPriorityCount++;
          break;
        case 'medium':
          statistics.mediumPriorityCount++;
          break;
        case 'low':
          statistics.lowPriorityCount++;
          break;
      }
    }

    return statistics;
  }

  /**
   * 获取配置
   */
  static getConfig() {
    return { ...config };
  }
}
