/**
 * AI反馈收集服务
 *
 * 功能：
 * 1. 收集用户对AI检测结果的反馈
 * 2. 存储反馈到数据库
 * 3. 提供反馈统计和分析接口
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { Prisma, RelationType } from '@prisma/client';

/**
 * AI反馈类型（临时定义，运行prisma generate后使用枚举）
 */
export type AIFeedbackType =
  | 'CONFIDENCE_FEEDBACK'
  | 'CORRECTNESS_FEEDBACK'
  | 'TYPE_FEEDBACK'
  | 'GENERAL_FEEDBACK';

/**
 * AI正确性评估（临时定义，运行prisma generate后使用枚举）
 */
export type AIFeedbackCorrectness =
  | 'CORRECT'
  | 'INCORRECT'
  | 'PARTIALLY_CORRECT'
  | 'UNSURE';

/**
 * 提交反馈输入参数
 */
export interface SubmitFeedbackInput {
  relationId: string;
  userId: string;
  feedbackType: AIFeedbackType;
  aiConfidenceProvided?: number; // AI当时提供的置信度
  userConfidenceRating?: number; // 用户对置信度的评分 (1-5)
  actualCorrectness: AIFeedbackCorrectness;
  comment?: string;
  suggestedRelationType?: RelationType;
  suggestedConfidence?: number;
  aiProvider?: string;
  aiModel?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 反馈统计结果
 */
export interface FeedbackStats {
  totalFeedbacks: number;
  correctnessBreakdown: Record<string, number>;
  avgAccuracy: number;
  avgConfidenceRating: number;
  feedbackByType: Record<string, number>;
  feedbackByRelationType: Record<string, number>;
}

/**
 * AI置信度分析结果
 */
export interface ConfidenceAnalysis {
  aiConfidence: number;
  avgCorrectnessScore: number;
  totalFeedbacks: number;
  recommendedThreshold: number;
  analysis: string;
}

/**
 * AI反馈收集服务
 */
export class AIFeedbackService {
  /**
   * 提交AI反馈
   *
   * @param input 反馈输入
   * @returns 创建的反馈记录
   */
  static async submitFeedback(input: SubmitFeedbackInput) {
    const {
      relationId,
      userId,
      feedbackType,
      aiConfidenceProvided,
      userConfidenceRating,
      actualCorrectness,
      comment,
      suggestedRelationType,
      suggestedConfidence,
      aiProvider,
      aiModel,
      metadata,
    } = input;

    logger.info('提交AI反馈', {
      relationId,
      userId,
      feedbackType,
      actualCorrectness,
    });

    // 获取关系信息以获取AI元数据
    const relation = await prisma.lawArticleRelation.findUnique({
      where: { id: relationId },
      select: {
        aiConfidence: true,
        aiProvider: true,
        aiModel: true,
        relationType: true,
      },
    });

    if (!relation) {
      throw new Error(`关系不存在: ${relationId}`);
    }

    // 创建反馈记录（临时使用prisma.lawArticleRelation）
    // 等待运行prisma generate后使用prisma.aIFeedback
    const feedback = await prisma.aIFeedback.create({
      data: {
        relationId,
        userId,
        feedbackType,
        aiConfidenceProvided: aiConfidenceProvided ?? relation.aiConfidence,
        userConfidenceRating,
        actualCorrectness,
        comment,
        suggestedRelationType,
        suggestedConfidence,
        aiProvider: aiProvider ?? relation.aiProvider,
        aiModel: aiModel ?? relation.aiModel,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    logger.info('AI反馈提交成功', {
      feedbackId: feedback.id,
      relationId,
      actualCorrectness,
    });

    return feedback;
  }

  /**
   * 批量提交反馈
   *
   * @param feedbacks 反馈数组
   * @returns 创建的反馈记录数组
   */
  static async batchSubmitFeedback(feedbacks: SubmitFeedbackInput[]) {
    const results = [];

    for (const feedback of feedbacks) {
      try {
        const result = await this.submitFeedback(feedback);
        results.push(result);
      } catch (error) {
        logger.error('批量提交反馈失败', {
          error,
          relationId: feedback.relationId,
        });
        throw error;
      }
    }

    return results;
  }

  /**
   * 获取反馈统计
   *
   * @param options 查询选项
   * @returns 反馈统计结果
   */
  static async getFeedbackStats(options?: {
    relationId?: string;
    userId?: string;
    aiProvider?: string;
    aiModel?: string;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<FeedbackStats> {
    const where: Prisma.AIFeedbackWhereInput = {};

    if (options?.relationId) {
      where.relationId = options.relationId;
    }

    if (options?.userId) {
      where.userId = options.userId;
    }

    if (options?.aiProvider) {
      where.aiProvider = options.aiProvider;
    }

    if (options?.aiModel) {
      where.aiModel = options.aiModel;
    }

    if (options?.fromDate || options?.toDate) {
      where.createdAt = {};
      if (options.fromDate) {
        where.createdAt.gte = options.fromDate;
      }
      if (options.toDate) {
        where.createdAt.lte = options.toDate;
      }
    }

    // 获取所有反馈
    const feedbacks = await prisma.aIFeedback.findMany({
      where,
      include: {
        relation: {
          select: {
            relationType: true,
          },
        },
      },
    });

    // 统计正确性分布
    const correctnessBreakdown: Record<string, number> = {
      CORRECT: 0,
      INCORRECT: 0,
      PARTIALLY_CORRECT: 0,
      UNSURE: 0,
    };

    let totalCorrectnessScore = 0;
    let totalConfidenceRating = 0;
    let confidenceRatingCount = 0;

    const feedbackByType: Record<string, number> = {
      CONFIDENCE_FEEDBACK: 0,
      CORRECTNESS_FEEDBACK: 0,
      TYPE_FEEDBACK: 0,
      GENERAL_FEEDBACK: 0,
    };

    const feedbackByRelationType: Record<string, number> = {};

    for (const feedback of feedbacks) {
      // 正确性分布
      correctnessBreakdown[feedback.actualCorrectness]++;

      // 正确性评分（转换为数值）
      const correctnessScore = this.correctnessToScore(
        feedback.actualCorrectness
      );
      totalCorrectnessScore += correctnessScore;

      // 置信度评分
      if (feedback.userConfidenceRating) {
        totalConfidenceRating += feedback.userConfidenceRating;
        confidenceRatingCount++;
      }

      // 反馈类型统计
      feedbackByType[feedback.feedbackType]++;

      // 关系类型统计
      const relationType = (
        feedback.relation as unknown as { relationType: string }
      )?.relationType;
      if (relationType) {
        feedbackByRelationType[relationType] =
          (feedbackByRelationType[relationType] || 0) + 1;
      }
    }

    // 计算平均值
    const avgAccuracy =
      feedbacks.length > 0 ? totalCorrectnessScore / feedbacks.length : 0;
    const avgConfidenceRating =
      confidenceRatingCount > 0
        ? totalConfidenceRating / confidenceRatingCount
        : 0;

    logger.info('反馈统计获取成功', {
      totalFeedbacks: feedbacks.length,
      avgAccuracy,
      avgConfidenceRating,
    });

    return {
      totalFeedbacks: feedbacks.length,
      correctnessBreakdown,
      avgAccuracy,
      avgConfidenceRating,
      feedbackByType,
      feedbackByRelationType,
    };
  }

  /**
   * 分析AI置信度
   *
   * @param aiConfidence AI置信度
   * @param options 查询选项
   * @returns 置信度分析结果
   */
  static async analyzeConfidence(
    aiConfidence: number,
    options?: {
      aiProvider?: string;
      aiModel?: string;
      relationType?: RelationType;
    }
  ): Promise<ConfidenceAnalysis> {
    const where: Record<string, unknown> = {
      aiConfidenceProvided: {
        gte: aiConfidence - 0.05,
        lte: aiConfidence + 0.05,
      },
    };

    if (options?.aiProvider) {
      where.aiProvider = options.aiProvider;
    }

    if (options?.aiModel) {
      where.aiModel = options.aiModel;
    }

    if (options?.relationType) {
      where.relation = {
        relationType: options.relationType,
      };
    }

    // 获取相关反馈
    const feedbacks = await prisma.aIFeedback.findMany({
      where,
      include: {
        relation: {
          select: {
            relationType: true,
          },
        },
      },
    });

    if (feedbacks.length === 0) {
      return {
        aiConfidence,
        avgCorrectnessScore: 0,
        totalFeedbacks: 0,
        recommendedThreshold: aiConfidence,
        analysis: '暂无反馈数据',
      };
    }

    // 计算平均正确性分数
    let totalCorrectnessScore = 0;
    for (const feedback of feedbacks) {
      totalCorrectnessScore += this.correctnessToScore(
        feedback.actualCorrectness
      );
    }

    const avgCorrectnessScore = totalCorrectnessScore / feedbacks.length;

    // 推荐阈值
    let recommendedThreshold = aiConfidence;
    if (avgCorrectnessScore < 0.5) {
      // 准确率低，提高阈值
      recommendedThreshold = Math.min(aiConfidence + 0.1, 0.95);
    } else if (avgCorrectnessScore > 0.8) {
      // 准确率高，可以降低阈值
      recommendedThreshold = Math.max(aiConfidence - 0.05, 0.4);
    }

    // 分析说明
    let analysis = '';
    if (avgCorrectnessScore >= 0.8) {
      analysis = `置信度${aiConfidence.toFixed(2)}的判断准确率较高（${(avgCorrectnessScore * 100).toFixed(1)}%）`;
    } else if (avgCorrectnessScore >= 0.5) {
      analysis = `置信度${aiConfidence.toFixed(2)}的判断准确率一般（${(avgCorrectnessScore * 100).toFixed(1)}%）`;
    } else {
      analysis = `置信度${aiConfidence.toFixed(2)}的判断准确率较低（${(avgCorrectnessScore * 100).toFixed(1)}%），建议提高阈值`;
    }

    logger.info('置信度分析完成', {
      aiConfidence,
      avgCorrectnessScore,
      totalFeedbacks: feedbacks.length,
      recommendedThreshold,
    });

    return {
      aiConfidence,
      avgCorrectnessScore,
      totalFeedbacks: feedbacks.length,
      recommendedThreshold,
      analysis,
    };
  }

  /**
   * 获取需要重新审核的关系
   * 基于反馈分析，找出可能有问题但尚未被审核的关系
   *
   * @param options 查询选项
   * @returns 需要重新审核的关系ID列表
   */
  static async getRelationsNeedingReview(options?: {
    aiProvider?: string;
    aiModel?: string;
    limit?: number;
  }): Promise<string[]> {
    const limit = options?.limit ?? 100;

    // 找出被标记为INCORRECT的关系
    const incorrectFeedbacks = await prisma.aIFeedback.findMany({
      where: {
        actualCorrectness: 'INCORRECT',
        aiProvider: options?.aiProvider,
        aiModel: options?.aiModel,
      },
      distinct: ['relationId'],
      take: limit,
    });

    const relationIds = incorrectFeedbacks.map(f => f.relationId);

    logger.info('找到需要重新审核的关系', {
      count: relationIds.length,
      limit,
    });

    return relationIds;
  }

  /**
   * 删除反馈（仅管理员）
   *
   * @param feedbackId 反馈ID
   */
  static async deleteFeedback(feedbackId: string): Promise<void> {
    await prisma.aIFeedback.delete({
      where: { id: feedbackId },
    });

    logger.info('反馈删除成功', { feedbackId });
  }

  /**
   * 将正确性枚举转换为分数 (0-1)
   *
   * @param correctness 正确性枚举
   * @returns 分数 (0-1)
   */
  private static correctnessToScore(correctness: string): number {
    switch (correctness) {
      case 'CORRECT':
        return 1.0;
      case 'PARTIALLY_CORRECT':
        return 0.5;
      case 'INCORRECT':
        return 0.0;
      case 'UNSURE':
        return 0.3; // 不确定给一个较低分
      default:
        return 0.0;
    }
  }
}
