// =============================================================================
// 知识图谱质量评分系统 - 评分计算器
// =============================================================================

import { logger } from '@/lib/logger';
import {
  QualityScoreInput,
  QualityScoreResult,
  QualityLevel,
  ScoreFactors,
  QualityScoreWeights,
  DefaultQualityScoreWeights,
  QualityScoreThresholds,
  DefaultQualityScoreThresholds,
} from './types';

/**
 * 质量评分计算器
 * 负责计算知识图谱关系的质量分数和等级
 */
export class ScoreCalculator {
  private readonly weights: QualityScoreWeights;
  private readonly thresholds: QualityScoreThresholds;

  constructor(
    weights?: Partial<QualityScoreWeights>,
    thresholds?: Partial<QualityScoreThresholds>
  ) {
    this.weights = { ...DefaultQualityScoreWeights, ...weights };
    this.thresholds = { ...DefaultQualityScoreThresholds, ...thresholds };
  }

  /**
   * 计算综合质量分数
   * 公式: qualityScore = (aiScore × ai权重) + (verificationScore × verification权重) + (feedbackScore × feedback权重) × 100
   */
  public calculateQualityScore(input: QualityScoreInput): QualityScoreResult {
    try {
      const factors: ScoreFactors = {
        aiScore: this.calculateAIScore(input.aiConfidence),
        verificationScore: this.calculateVerificationScore(
          input.verificationCount
        ),
        feedbackScore: this.calculateFeedbackScore(
          input.positiveFeedback,
          input.negativeFeedback
        ),
      };

      const weightedScore =
        factors.aiScore * this.weights.ai +
        factors.verificationScore * this.weights.verification +
        factors.feedbackScore * this.weights.feedback;

      const qualityScore = Math.round(weightedScore * 100);
      const qualityLevel = this.determineQualityLevel(qualityScore);

      logger.debug('Calculated quality score', {
        relationId: input as unknown as string,
        qualityScore,
        qualityLevel,
        factors,
      });

      return {
        qualityScore,
        qualityLevel,
        factors,
      };
    } catch (error) {
      logger.error('Error calculating quality score', error);
      throw new Error(
        `Failed to calculate quality score: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 判定质量等级
   */
  public determineQualityLevel(score: number): QualityLevel {
    if (score >= this.thresholds.excellent) {
      return 'excellent';
    }
    if (score >= this.thresholds.high) {
      return 'high';
    }
    if (score >= this.thresholds.medium) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * 计算AI置信度分数
   * 直接使用AI置信度值，如果为null则使用默认值0.5
   */
  public calculateAIScore(aiConfidence: number | null | undefined): number {
    if (aiConfidence === null || aiConfidence === undefined) {
      return 0.5; // 默认值
    }

    // 处理边界值
    if (aiConfidence < 0) {
      return 0;
    }
    if (aiConfidence > 1) {
      return 1;
    }

    return aiConfidence;
  }

  /**
   * 计算验证次数分数
   * 验证次数/10，饱和值1.0
   */
  public calculateVerificationScore(verificationCount: number): number {
    if (verificationCount < 0) {
      return 0;
    }

    const score = verificationCount / 10;
    return Math.min(score, 1.0);
  }

  /**
   * 计算用户反馈分数
   * 正面反馈 / 总反馈，如果没有反馈则使用默认值0.7
   */
  public calculateFeedbackScore(
    positiveFeedback: number,
    negativeFeedback: number
  ): number {
    const totalFeedback = positiveFeedback + negativeFeedback;

    if (totalFeedback <= 0) {
      return 0.7; // 默认值
    }

    return positiveFeedback / totalFeedback;
  }
}
