/**
 * 准确性监控模块
 * 用于统计和分析知识图谱关系的准确性指标
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RelationFeedbackType, VerificationStatus } from '@prisma/client';
import {
  AccuracyMetrics,
  AccuracyStatsOptions,
  LowQualityRelation,
} from './types';

// =============================================================================
// 准确性监控类
// =============================================================================

export class AccuracyMonitor {
  /**
   * 计算准确性指标
   * @param options 统计选项
   * @returns 准确性指标
   */
  async calculateMetrics(
    options: AccuracyStatsOptions = {}
  ): Promise<AccuracyMetrics> {
    return calculateAccuracyMetrics(options);
  }

  /**
   * 识别低质量关系
   * @param threshold 负面反馈率阈值
   * @returns 低质量关系列表
   */
  async identifyLowQualityRelations(
    threshold: number = 0.5
  ): Promise<LowQualityRelation[]> {
    return identifyLowQualityRelations(threshold);
  }
}

// =============================================================================
// 准确性指标计算函数
// =============================================================================

/**
 * 计算准确性指标
 * @param options 统计选项
 * @returns 准确性指标
 */
export async function calculateAccuracyMetrics(
  options: AccuracyStatsOptions = {}
): Promise<AccuracyMetrics> {
  try {
    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (options.relationType) {
      where.relationType = options.relationType;
    }

    if (options.discoveryMethod) {
      where.discoveryMethod = options.discoveryMethod;
    }

    // 统计总关系数
    const totalRelations = await prisma.lawArticleRelation.count({ where });

    // 统计已验证关系数
    const verifiedRelations = await prisma.lawArticleRelation.count({
      where: {
        ...where,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    // 统计用户反馈数据
    const feedbacks = await prisma.relationFeedback.findMany({
      where: {
        relation: {
          ...where,
        },
      },
      select: {
        feedbackType: true,
      },
    });

    const userFeedbackCount = feedbacks.length;

    // 统计正面和负面反馈
    const positiveFeedbackTypes: RelationFeedbackType[] = [
      RelationFeedbackType.ACCURATE,
    ];

    const negativeFeedbackTypes: RelationFeedbackType[] = [
      RelationFeedbackType.INACCURATE,
      RelationFeedbackType.SHOULD_REMOVE,
      RelationFeedbackType.WRONG_TYPE,
    ];

    const positiveFeedbackCount = feedbacks.filter(f =>
      positiveFeedbackTypes.includes(f.feedbackType)
    ).length;

    const negativeFeedbackCount = feedbacks.filter(f =>
      negativeFeedbackTypes.includes(f.feedbackType)
    ).length;

    // 计算正面反馈率
    const positiveFeedbackRate =
      userFeedbackCount > 0 ? positiveFeedbackCount / userFeedbackCount : 1.0; // 默认值：无反馈时视为高质量

    // 计算验证率
    const verificationRate =
      totalRelations > 0 ? verifiedRelations / totalRelations : 0;

    logger.info('准确性指标计算完成', {
      totalRelations,
      verifiedRelations,
      userFeedbackCount,
      positiveFeedbackRate,
      verificationRate,
    });

    return {
      totalRelations,
      verifiedRelations,
      userFeedbackCount,
      positiveFeedbackCount,
      negativeFeedbackCount,
      positiveFeedbackRate,
      verificationRate,
    };
  } catch (error) {
    logger.error('计算准确性指标失败', { error });
    throw new Error('计算准确性指标失败');
  }
}

// =============================================================================
// 低质量关系识别函数
// =============================================================================

/**
 * 识别低质量关系
 * @param threshold 负面反馈率阈值
 * @returns 低质量关系列表
 */
export async function identifyLowQualityRelations(
  threshold: number = 0.5
): Promise<LowQualityRelation[]> {
  try {
    // 负面反馈类型
    const negativeFeedbackTypes: RelationFeedbackType[] = [
      RelationFeedbackType.INACCURATE,
      RelationFeedbackType.SHOULD_REMOVE,
      RelationFeedbackType.WRONG_TYPE,
    ];

    // 查询所有关系及其反馈统计
    const relationsWithFeedback = await prisma.lawArticleRelation.findMany({
      include: {
        feedbacks: {
          select: {
            feedbackType: true,
          },
        },
      },
    });

    // 计算每个关系的负面反馈率
    const lowQualityRelations: LowQualityRelation[] = [];

    for (const relation of relationsWithFeedback) {
      const feedbacks = relation.feedbacks;
      const feedbackCount = feedbacks.length;

      // 跳过没有反馈的关系（不标记为低质量）
      if (feedbackCount === 0) {
        continue;
      }

      // 统计负面反馈数
      const negativeFeedbackCount = feedbacks.filter(f =>
        negativeFeedbackTypes.includes(f.feedbackType)
      ).length;

      // 计算负面反馈率
      const negativeFeedbackRate = negativeFeedbackCount / feedbackCount;

      // 如果超过阈值，则标记为低质量
      if (negativeFeedbackRate >= threshold) {
        lowQualityRelations.push({
          relationId: relation.id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          relationType: relation.relationType,
          feedbackCount,
          negativeFeedbackCount,
          negativeFeedbackRate,
        });
      }
    }

    logger.info(`识别到 ${lowQualityRelations.length} 个低质量关系`, {
      threshold,
    });

    return lowQualityRelations;
  } catch (error) {
    logger.error('识别低质量关系失败', { error });
    throw new Error('识别低质量关系失败');
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取关系的用户反馈统计
 * @param relationId 关系ID
 * @returns 反馈统计
 */
export async function getRelationFeedbackStats(relationId: string): Promise<{
  totalFeedbacks: number;
  positiveFeedbacks: number;
  negativeFeedbacks: number;
  positiveFeedbackRate: number;
}> {
  try {
    const feedbacks = await prisma.relationFeedback.findMany({
      where: { relationId },
      select: { feedbackType: true },
    });

    const totalFeedbacks = feedbacks.length;

    const positiveFeedbackTypes: RelationFeedbackType[] = [
      RelationFeedbackType.ACCURATE,
    ];

    const negativeFeedbackTypes: RelationFeedbackType[] = [
      RelationFeedbackType.INACCURATE,
      RelationFeedbackType.SHOULD_REMOVE,
      RelationFeedbackType.WRONG_TYPE,
    ];

    const positiveFeedbacks = feedbacks.filter(f =>
      positiveFeedbackTypes.includes(f.feedbackType)
    ).length;

    const negativeFeedbacks = feedbacks.filter(f =>
      negativeFeedbackTypes.includes(f.feedbackType)
    ).length;

    const positiveFeedbackRate =
      totalFeedbacks > 0 ? positiveFeedbacks / totalFeedbacks : 1.0;

    return {
      totalFeedbacks,
      positiveFeedbacks,
      negativeFeedbacks,
      positiveFeedbackRate,
    };
  } catch (error) {
    logger.error('获取关系反馈统计失败', { error, relationId });
    return {
      totalFeedbacks: 0,
      positiveFeedbacks: 0,
      negativeFeedbacks: 0,
      positiveFeedbackRate: 1.0,
    };
  }
}
