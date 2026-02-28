// =============================================================================
// 知识图谱质量评分系统 - 质量评分服务
// =============================================================================

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { ScoreCalculator } from './score-calculator';
import {
  RelationQualityData,
  BatchQualityScoreInput,
  QualityStats,
  LowQualityRelationsInput,
  LowQualityRelation,
  UpdateQualityScoreInput,
  QualityWarning,
  QualityLevel,
} from './types';

/**
 * 质量评分服务
 * 负责知识图谱关系的质量评分计算、存储和查询
 */
export class QualityScoreService {
  private readonly calculator: ScoreCalculator;

  constructor(calculator?: ScoreCalculator) {
    this.calculator = calculator || new ScoreCalculator();
  }

  /**
   * 为单个关系计算质量分数
   */
  public async calculateRelationQuality(
    relationId: string
  ): Promise<RelationQualityData> {
    try {
      // 获取关系信息
      const relation = await prisma.lawArticleRelation.findUnique({
        where: { id: relationId },
        include: {
          source: true,
          target: true,
        },
      });

      if (!relation) {
        throw new Error('Relation not found');
      }

      // 获取用户反馈统计
      const positiveFeedbackCount = await prisma.relationFeedback.count({
        where: {
          relationId,
          feedbackType: 'ACCURATE',
        },
      });

      const negativeFeedbackCount = await prisma.relationFeedback.count({
        where: {
          relationId,
          feedbackType: { in: ['INACCURATE', 'SHOULD_REMOVE', 'WRONG_TYPE'] },
        },
      });

      // 获取AI反馈数量
      const aiFeedbackCount = await prisma.aIFeedback.count({
        where: { relationId },
      });

      // 获取AI置信度（如果有多个反馈，取平均值）
      let aiConfidence: number | null = relation.aiConfidence;
      if (!aiConfidence && aiFeedbackCount > 0) {
        const aiFeedbacks = await prisma.aIFeedback.findMany({
          where: { relationId },
          take: 10,
        });
        const confidences = aiFeedbacks
          .map(f => f.aiConfidenceProvided)
          .filter(c => c !== null) as number[];
        if (confidences.length > 0) {
          aiConfidence =
            confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }
      }

      // 计算质量分数
      const scoreResult = this.calculator.calculateQualityScore({
        aiConfidence,
        verificationCount: relation.verificationStatus === 'VERIFIED' ? 1 : 0,
        positiveFeedback: positiveFeedbackCount,
        negativeFeedback: negativeFeedbackCount,
      });

      // 保存或更新质量分数
      await prisma.knowledgeGraphQualityScore.upsert({
        where: { relationId },
        update: {
          aiConfidence,
          verificationCount: relation.verificationStatus === 'VERIFIED' ? 1 : 0,
          positiveFeedback: positiveFeedbackCount,
          negativeFeedback: negativeFeedbackCount,
          qualityScore: scoreResult.qualityScore,
          qualityLevel: scoreResult.qualityLevel,
          lastCalculatedAt: new Date(),
        },
        create: {
          relationId,
          aiConfidence,
          verificationCount: relation.verificationStatus === 'VERIFIED' ? 1 : 0,
          positiveFeedback: positiveFeedbackCount,
          negativeFeedback: negativeFeedbackCount,
          qualityScore: scoreResult.qualityScore,
          qualityLevel: scoreResult.qualityLevel,
        },
      });

      logger.info('Quality score calculated', {
        relationId,
        qualityScore: scoreResult.qualityScore,
        qualityLevel: scoreResult.qualityLevel,
      });

      return {
        relationId,
        aiConfidence,
        verificationCount: relation.verificationStatus === 'VERIFIED' ? 1 : 0,
        positiveFeedback: positiveFeedbackCount,
        negativeFeedback: negativeFeedbackCount,
        qualityScore: scoreResult.qualityScore,
        qualityLevel: scoreResult.qualityLevel,
      };
    } catch (error) {
      logger.error('Error calculating relation quality', { relationId, error });
      throw new Error(
        `Failed to calculate relation quality: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 批量计算质量分数
   */
  public async batchCalculateQuality(
    input: BatchQualityScoreInput
  ): Promise<RelationQualityData[]> {
    try {
      const { relationIds, calculateForces } = input;

      // 如果是强制计算，忽略已有分数；否则只计算没有分数的关系
      const existingScores = calculateForces
        ? []
        : await prisma.knowledgeGraphQualityScore.findMany({
            where: { relationId: { in: relationIds } },
            select: { relationId: true },
          });

      const existingRelationIds = existingScores.map(s => s.relationId);
      const relationsToCalculate = calculateForces
        ? relationIds
        : relationIds.filter(id => !existingRelationIds.includes(id));

      if (relationsToCalculate.length === 0) {
        logger.info('No relations to calculate');
        return [];
      }

      // 批量计算
      const results = await Promise.allSettled(
        relationsToCalculate.map(id => this.calculateRelationQuality(id))
      );

      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(
          result =>
            (result as PromiseFulfilledResult<RelationQualityData>).value
        );

      const failedCount = results.filter(
        result => result.status === 'rejected'
      ).length;
      if (failedCount > 0) {
        logger.warn(
          `Batch calculation partially failed: ${failedCount}/${results.length} failed`
        );
      }

      logger.info('Batch quality score calculation completed', {
        total: relationsToCalculate.length,
        success: successfulResults.length,
        failed: failedCount,
      });

      return successfulResults;
    } catch (error) {
      logger.error('Error in batch quality calculation', { input, error });
      throw new Error(
        `Failed to batch calculate quality: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取单个关系的质量分数
   */
  public async getRelationQualityScore(
    relationId: string
  ): Promise<LowQualityRelation | null> {
    try {
      const qualityScore = await prisma.knowledgeGraphQualityScore.findUnique({
        where: { relationId },
        include: {
          relation: {
            include: {
              source: true,
              target: true,
            },
          },
        },
      });

      if (!qualityScore) {
        return null;
      }

      const factors = this.calculator.calculateQualityScore({
        aiConfidence: qualityScore.aiConfidence,
        verificationCount: qualityScore.verificationCount,
        positiveFeedback: qualityScore.positiveFeedback,
        negativeFeedback: qualityScore.negativeFeedback,
      }).factors;

      return {
        id: qualityScore.id,
        relationId: qualityScore.relationId,
        sourceArticleId: qualityScore.relation.source.id,
        sourceArticleName: qualityScore.relation.source.lawName,
        sourceArticleNumber: qualityScore.relation.source.articleNumber,
        targetArticleId: qualityScore.relation.target.id,
        targetArticleName: qualityScore.relation.target.lawName,
        targetArticleNumber: qualityScore.relation.target.articleNumber,
        relationType: qualityScore.relation.relationType,
        qualityScore: qualityScore.qualityScore,
        qualityLevel: qualityScore.qualityLevel as QualityLevel,
        factors,
        createdAt: qualityScore.relation.createdAt,
        lastCalculatedAt: qualityScore.lastCalculatedAt,
      };
    } catch (error) {
      logger.error('Error getting relation quality score', {
        relationId,
        error,
      });
      throw new Error(
        `Failed to get relation quality score: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取低质量关系列表
   */
  public async getLowQualityRelations(
    input: LowQualityRelationsInput
  ): Promise<LowQualityRelation[]> {
    try {
      const {
        qualityLevel,
        minScore,
        maxScore,
        limit = 50,
        offset = 0,
        sortBy = 'score',
        sortOrder = 'asc',
      } = input;

      const where: Record<string, unknown> = {};
      if (qualityLevel) {
        where.qualityLevel = qualityLevel;
      }
      if (minScore !== undefined) {
        where.qualityScore = {
          ...((where.qualityScore as Record<string, unknown>) || {}),
          gte: minScore,
        };
      }
      if (maxScore !== undefined) {
        where.qualityScore = {
          ...((where.qualityScore as Record<string, unknown>) || {}),
          lte: maxScore,
        };
      }

      const orderBy = {
        [sortBy === 'score' ? 'qualityScore' : 'lastCalculatedAt']: sortOrder,
      };

      const qualityScores = await prisma.knowledgeGraphQualityScore.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          relation: {
            include: {
              source: true,
              target: true,
            },
          },
        },
      });

      return qualityScores.map(score => {
        const factors = this.calculator.calculateQualityScore({
          aiConfidence: score.aiConfidence,
          verificationCount: score.verificationCount,
          positiveFeedback: score.positiveFeedback,
          negativeFeedback: score.negativeFeedback,
        }).factors;

        return {
          id: score.id,
          relationId: score.relationId,
          sourceArticleId: score.relation.source.id,
          sourceArticleName: score.relation.source.lawName,
          sourceArticleNumber: score.relation.source.articleNumber,
          targetArticleId: score.relation.target.id,
          targetArticleName: score.relation.target.lawName,
          targetArticleNumber: score.relation.target.articleNumber,
          relationType: score.relation.relationType,
          qualityScore: score.qualityScore,
          qualityLevel: score.qualityLevel as QualityLevel,
          factors,
          createdAt: score.relation.createdAt,
          lastCalculatedAt: score.lastCalculatedAt,
        };
      });
    } catch (error) {
      logger.error('Error getting low quality relations', { input, error });
      throw new Error(
        `Failed to get low quality relations: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取质量统计
   */
  public async getQualityStats(): Promise<QualityStats> {
    try {
      const stats = await prisma.knowledgeGraphQualityScore.aggregate({
        _count: { id: true },
        _avg: { qualityScore: true },
      });

      const excellentCount = await prisma.knowledgeGraphQualityScore.count({
        where: { qualityLevel: 'excellent' },
      });
      const highCount = await prisma.knowledgeGraphQualityScore.count({
        where: { qualityLevel: 'high' },
      });
      const mediumCount = await prisma.knowledgeGraphQualityScore.count({
        where: { qualityLevel: 'medium' },
      });
      const lowCount = await prisma.knowledgeGraphQualityScore.count({
        where: { qualityLevel: 'low' },
      });

      return {
        totalRelations: stats._count.id,
        excellentCount,
        highCount,
        mediumCount,
        lowCount,
        averageScore: stats._avg.qualityScore || 0,
        scoreDistribution: {
          excellent: excellentCount,
          high: highCount,
          medium: mediumCount,
          low: lowCount,
        },
      };
    } catch (error) {
      logger.error('Error getting quality stats', { error });
      throw new Error(
        `Failed to get quality stats: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 更新关系质量分数
   */
  public async updateRelationScore(
    input: UpdateQualityScoreInput
  ): Promise<RelationQualityData> {
    try {
      const {
        relationId,
        incrementVerification,
        addPositiveFeedback,
        addNegativeFeedback,
        forceRecalculate,
      } = input;

      // 获取当前质量分数
      const currentScore = await prisma.knowledgeGraphQualityScore.findUnique({
        where: { relationId },
      });

      if (!currentScore) {
        return this.calculateRelationQuality(relationId);
      }

      // 更新计数器
      const updateData: Record<string, unknown> = {};
      if (incrementVerification) {
        updateData.verificationCount = {
          increment: 1,
        };
      }
      if (addPositiveFeedback) {
        updateData.positiveFeedback = {
          increment: 1,
        };
      }
      if (addNegativeFeedback) {
        updateData.negativeFeedback = {
          increment: 1,
        };
      }

      const updatedScore = await prisma.knowledgeGraphQualityScore.update({
        where: { relationId },
        data: updateData,
      });

      // 如果需要强制重新计算，重新计算质量分数
      if (
        forceRecalculate ||
        incrementVerification ||
        addPositiveFeedback ||
        addNegativeFeedback
      ) {
        return this.calculateRelationQuality(relationId);
      }

      return {
        relationId,
        aiConfidence: updatedScore.aiConfidence,
        verificationCount: updatedScore.verificationCount,
        positiveFeedback: updatedScore.positiveFeedback,
        negativeFeedback: updatedScore.negativeFeedback,
        qualityScore: updatedScore.qualityScore,
        qualityLevel: updatedScore.qualityLevel as QualityLevel,
      };
    } catch (error) {
      logger.error('Error updating relation score', { input, error });
      throw new Error(
        `Failed to update relation score: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 批量更新关系质量分数
   */
  public async batchUpdateRelationScores(
    inputs: UpdateQualityScoreInput[]
  ): Promise<RelationQualityData[]> {
    try {
      const results = await Promise.allSettled(
        inputs.map(input => this.updateRelationScore(input))
      );

      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(
          result =>
            (result as PromiseFulfilledResult<RelationQualityData>).value
        );

      const failedCount = results.filter(
        result => result.status === 'rejected'
      ).length;
      if (failedCount > 0) {
        logger.warn(
          `Batch update partially failed: ${failedCount}/${results.length} failed`
        );
      }

      logger.info('Batch relation score update completed', {
        total: inputs.length,
        success: successfulResults.length,
        failed: failedCount,
      });

      return successfulResults;
    } catch (error) {
      logger.error('Error in batch relation score update', { inputs, error });
      throw new Error(
        `Failed to batch update relation scores: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 触发质量预警
   */
  public async triggerQualityWarning(): Promise<QualityWarning[]> {
    try {
      const warnings: QualityWarning[] = [];

      // 获取低质量关系
      const lowQualityRelations =
        await prisma.knowledgeGraphQualityScore.findMany({
          where: {
            qualityLevel: 'low',
          },
          include: {
            relation: {
              include: {
                source: true,
                target: true,
              },
            },
          },
          take: 100,
        });

      for (const relation of lowQualityRelations) {
        warnings.push({
          relationId: relation.relationId,
          warningType: 'LOW_QUALITY',
          message: `关系质量分数过低 (${relation.qualityScore})，建议人工审核`,
          severity: 'WARNING',
          currentScore: relation.qualityScore,
          timestamp: relation.lastCalculatedAt,
        });

        logger.warn('Low quality relation detected', {
          relationId: relation.relationId,
          qualityScore: relation.qualityScore,
        });
      }

      // 检查高负面反馈关系
      const highNegativeFeedbackRelations =
        await prisma.knowledgeGraphQualityScore.findMany({
          where: {
            negativeFeedback: {
              gte: 5,
            },
            qualityScore: {
              lt: 70,
            },
          },
          include: {
            relation: true,
          },
        });

      for (const relation of highNegativeFeedbackRelations) {
        warnings.push({
          relationId: relation.relationId,
          warningType: 'HIGH_NEGATIVE_FEEDBACK',
          message: `关系收到大量负面反馈 (${relation.negativeFeedback}条)，需要关注`,
          severity: 'ERROR',
          currentScore: relation.qualityScore,
          timestamp: relation.lastCalculatedAt,
        });

        logger.error('High negative feedback relation detected', {
          relationId: relation.relationId,
          negativeFeedback: relation.negativeFeedback,
        });
      }

      logger.info('Quality warning check completed', {
        warningCount: warnings.length,
      });

      return warnings;
    } catch (error) {
      logger.error('Error triggering quality warning', { error });
      throw new Error(
        `Failed to trigger quality warning: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
