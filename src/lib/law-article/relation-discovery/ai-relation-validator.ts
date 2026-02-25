/**
 * AI关系验证器
 *
 * 功能：
 * 1. 验证AI检测结果的置信度
 * 2. 强制将AI发现的关系标记为待审核状态
 * 3. 自动拒绝低置信度关系
 * 4. 记录完整的AI元数据
 */

import { LawArticle, RelationType, VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { AIDetector } from './ai-detector';
import {
  LawArticleRelationService,
  CreateRelationInput,
} from '../relation-service';
import { AI_DETECTOR_CONFIG } from './ai-detector-config';

/**
 * 关系类型特定的置信度阈值
 */
const CONFIDENCE_THRESHOLDS: Partial<Record<RelationType, number>> = {
  CONFLICTS: 0.8, // 冲突关系需要更高置信度
  CITES: 0.6,
  CITED_BY: 0.6,
  COMPLETES: 0.7,
  IMPLEMENTS: 0.7,
  RELATED: 0.6,
};

/**
 * 验证输入参数
 */
export interface ValidateRelationInput {
  sourceArticle: LawArticle;
  targetArticle: LawArticle;
  relationType: RelationType;
  userId: string;
  aiProvider?: string;
  aiModel?: string;
  aiReasoning?: string;
}

/**
 * 批量验证输入参数
 */
export interface ValidateBatchRelationsInput {
  sourceArticle: LawArticle;
  targetArticles: LawArticle[];
  relationType: RelationType;
  userId: string;
  aiProvider?: string;
  aiModel?: string;
}

/**
 * 单个关系验证结果
 */
export interface ValidationResult {
  success: boolean;
  relation?: unknown;
  reason?: string;
}

/**
 * 批量关系验证结果
 */
export interface BatchValidationResult {
  created: unknown[];
  rejected: Array<{ targetId: string; reason: string }>;
  total: number;
}

/**
 * 置信度验证结果
 */
export interface ConfidenceValidationResult {
  valid: boolean;
  threshold: number;
  actual: number;
  reason?: string;
}

/**
 * AI关系验证器
 */
export class AIRelationValidator {
  /**
   * 验证并创建单个关系
   *
   * @param input 验证输入参数
   * @returns 验证结果
   */
  static async validateAndCreateRelation(
    input: ValidateRelationInput
  ): Promise<ValidationResult> {
    const {
      sourceArticle,
      targetArticle,
      relationType,
      userId,
      aiProvider,
      aiModel,
    } = input;

    try {
      // 1. 调用AI检测关系
      const aiResult = await AIDetector.detectRelations(
        sourceArticle,
        targetArticle
      );

      // 2. 检查AI是否检测到指定类型的关系
      const detectedRelation = aiResult.relations.find(
        r => r.type === relationType
      );

      if (!detectedRelation) {
        return {
          success: false,
          reason: `AI未检测到${relationType}类型的关系`,
        };
      }

      // 3. 验证置信度
      const confidenceCheck = this.validateConfidence(
        detectedRelation.confidence,
        relationType
      );

      if (!confidenceCheck.valid) {
        logger.info('拒绝低置信度关系', {
          sourceId: sourceArticle.id,
          targetId: targetArticle.id,
          relationType,
          confidence: detectedRelation.confidence,
          threshold: confidenceCheck.threshold,
        });

        return {
          success: false,
          reason: `置信度过低（${detectedRelation.confidence.toFixed(
            2
          )} < ${confidenceCheck.threshold}）`,
        };
      }

      // 4. 创建关系（强制为待审核状态）
      const relationData: CreateRelationInput = {
        sourceId: sourceArticle.id,
        targetId: targetArticle.id,
        relationType: detectedRelation.type as RelationType,
        confidence: detectedRelation.confidence,
        description: detectedRelation.reason,
        evidence: { text: detectedRelation.evidence },
        discoveryMethod: 'AI' as any,
        userId,

        // AI相关字段
        aiProvider: aiProvider || AI_DETECTOR_CONFIG.model,
        aiModel: aiModel || AI_DETECTOR_CONFIG.model,
        aiConfidence: detectedRelation.confidence,
        aiReasoning: input.aiReasoning || detectedRelation.reason,
        aiCreatedAt: new Date(),
      };

      const relation =
        await LawArticleRelationService.createRelation(relationData);

      logger.info('AI关系创建成功（待审核）', {
        relationId: relation.id,
        sourceId: sourceArticle.id,
        targetId: targetArticle.id,
        relationType,
        confidence: detectedRelation.confidence,
      });

      return {
        success: true,
        relation,
      };
    } catch (error) {
      logger.error('验证和创建关系失败', {
        error,
        sourceId: sourceArticle.id,
        targetId: targetArticle.id,
        relationType,
      });

      return {
        success: false,
        reason: '关系验证失败',
      };
    }
  }

  /**
   * 批量验证并创建关系
   *
   * @param input 批量验证输入参数
   * @returns 批量验证结果
   */
  static async validateBatchRelations(
    input: ValidateBatchRelationsInput
  ): Promise<BatchValidationResult> {
    const {
      sourceArticle,
      targetArticles,
      relationType,
      userId,
      aiProvider,
      aiModel,
    } = input;

    const created: unknown[] = [];
    const rejected: Array<{ targetId: string; reason: string }> = [];

    for (const targetArticle of targetArticles) {
      const result = await this.validateAndCreateRelation({
        sourceArticle,
        targetArticle,
        relationType,
        userId,
        aiProvider,
        aiModel,
      });

      if (result.success) {
        created.push(result.relation);
      } else {
        rejected.push({
          targetId: targetArticle.id,
          reason: result.reason || '未知原因',
        });
      }
    }

    logger.info('批量关系验证完成', {
      createdCount: created.length,
      rejectedCount: rejected.length,
      total: targetArticles.length,
    });

    return {
      created,
      rejected,
      total: targetArticles.length,
    };
  }

  /**
   * 验证置信度是否符合阈值要求
   *
   * @param confidence AI置信度
   * @param relationType 关系类型
   * @returns 置信度验证结果
   */
  static validateConfidence(
    confidence: number,
    relationType: RelationType
  ): ConfidenceValidationResult {
    // 获取该关系类型的阈值，如果没有特定阈值则使用全局阈值
    const threshold =
      CONFIDENCE_THRESHOLDS[relationType] ??
      AI_DETECTOR_CONFIG.minConfidenceThreshold;

    const valid = confidence >= threshold;

    return {
      valid,
      threshold,
      actual: confidence,
      reason: valid
        ? undefined
        : `置信度${confidence.toFixed(2)}低于阈值${threshold}`,
    };
  }

  /**
   * 获取关系类型的置信度阈值
   *
   * @param relationType 关系类型
   * @returns 置信度阈值
   */
  static getThreshold(relationType: RelationType): number {
    return (
      CONFIDENCE_THRESHOLDS[relationType] ??
      AI_DETECTOR_CONFIG.minConfidenceThreshold
    );
  }

  /**
   * 设置关系类型的置信度阈值（运行时动态调整）
   *
   * @param relationType 关系类型
   * @param threshold 新的阈值
   */
  static setThreshold(relationType: RelationType, threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('置信度阈值必须在0-1之间');
    }

    CONFIDENCE_THRESHOLDS[relationType] = threshold;

    logger.info('更新置信度阈值', {
      relationType,
      newThreshold: threshold,
    });
  }

  /**
   * 获取所有关系类型的阈值配置
   *
   * @returns 阈值配置
   */
  static getAllThresholds(): Partial<Record<RelationType, number>> {
    return { ...CONFIDENCE_THRESHOLDS };
  }
}
