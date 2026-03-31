/**
 * 法条关系审核工作流
 *
 * 功能：
 * 1. 定义AI→审核→验证的完整流程
 * 2. 支持批量审核和单个审核
 * 3. 记录审核历史
 */

import {
  LawArticleRelationService,
  ReviewHistoryItem,
} from './relation-service';
import { AIRelationValidator } from './relation-discovery/ai-relation-validator';
import { LawArticle, RelationType, VerificationStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * 审核工作流步骤
 */
export enum WorkflowStep {
  AI_DETECTION = 'AI_DETECTION',
  VALIDATION = 'VALIDATION',
  PENDING_REVIEW = 'PENDING_REVIEW',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

/**
 * 工作流状态
 */
export interface WorkflowStatus {
  currentStep: WorkflowStep;
  progress: number; // 0-100
  canProceedToNextStep: boolean;
  metadata: Record<string, unknown>;
}

/**
 * AI发现关系输入
 */
export interface DiscoverRelationsInput {
  sourceArticle: LawArticle;
  targetArticles: LawArticle[];
  relationType: RelationType;
  userId: string;
  aiProvider?: string;
  aiModel?: string;
}

/**
 * 审核关系输入
 */
export interface ReviewRelationInput {
  relationId: string;
  reviewerId: string;
  isApproved: boolean;
  comment?: string;
}

/**
 * 批量审核输入
 */
export interface BatchReviewInput {
  relationIds: string[];
  reviewerId: string;
  isApproved: boolean;
  comment?: string;
}

/**
 * 关系发现结果
 */
export interface DiscoveryResult {
  relations: unknown[];
  rejected: Array<{ targetId: string; reason: string }>;
  workflowStatus: WorkflowStatus;
}

/**
 * 关系审核结果
 */
export interface ReviewResult {
  relationId: string;
  previousStatus: VerificationStatus;
  newStatus: VerificationStatus;
  workflowStatus: WorkflowStatus;
}

/**
 * 批量审核结果
 */
export interface BatchReviewResult {
  results: ReviewResult[];
  successCount: number;
  failureCount: number;
}

/**
 * 法条关系审核工作流
 */
export class RelationWorkflow {
  /**
   * 完整的AI发现关系工作流
   *
   * @param input 发现关系输入
   * @returns 发现结果
   */
  static async discoverRelations(
    input: DiscoverRelationsInput
  ): Promise<DiscoveryResult> {
    const {
      sourceArticle,
      targetArticles,
      relationType,
      userId,
      aiProvider,
      aiModel,
    } = input;

    logger.info('开始AI关系发现工作流', {
      sourceId: sourceArticle.id,
      targetCount: targetArticles.length,
      relationType,
    });

    // 步骤2: 验证和创建关系
    const validationResult = await AIRelationValidator.validateBatchRelations({
      sourceArticle,
      targetArticles,
      relationType,
      userId,
      aiProvider,
      aiModel,
    });

    // 步骤3: 等待人工审核
    const step3Status: WorkflowStatus = {
      currentStep: WorkflowStep.PENDING_REVIEW,
      progress: 80,
      canProceedToNextStep: false, // 需要人工审核
      metadata: {
        pendingRelations: validationResult.created.length,
      },
    };

    logger.info('AI关系发现工作流完成', {
      createdCount: validationResult.created.length,
      rejectedCount: validationResult.rejected.length,
      finalStatus: step3Status.currentStep,
    });

    return {
      relations: validationResult.created,
      rejected: validationResult.rejected,
      workflowStatus: step3Status,
    };
  }

  /**
   * 审核单个关系
   *
   * @param input 审核输入
   * @returns 审核结果
   */
  static async reviewRelation(
    input: ReviewRelationInput
  ): Promise<ReviewResult> {
    const { relationId, reviewerId, isApproved, comment } = input;

    logger.info('开始审核关系', {
      relationId,
      reviewerId,
      isApproved,
    });

    // 获取当前关系状态
    const relation =
      await LawArticleRelationService.getRelationById(relationId);

    if (!relation) {
      throw new Error(`关系不存在: ${relationId}`);
    }

    const previousStatus = relation.verificationStatus;

    // 验证工作流状态
    if (previousStatus !== VerificationStatus.PENDING) {
      throw new Error(`只能审核待审核状态的关系，当前状态: ${previousStatus}`);
    }

    // 执行审核
    const verifiedRelation = await LawArticleRelationService.verifyRelation(
      relationId,
      reviewerId,
      isApproved,
      comment
    );

    // 构建工作流状态
    const newStatus = verifiedRelation.verificationStatus;
    let workflowStep: WorkflowStep;

    switch (newStatus) {
      case VerificationStatus.VERIFIED:
        workflowStep = WorkflowStep.VERIFIED;
        break;
      case VerificationStatus.REJECTED:
        workflowStep = WorkflowStep.REJECTED;
        break;
      default:
        workflowStep = WorkflowStep.PENDING_REVIEW;
    }

    const workflowStatus: WorkflowStatus = {
      currentStep: workflowStep,
      progress: 100,
      canProceedToNextStep: false,
      metadata: {
        reviewerId,
        previousStatus,
        newStatus,
      },
    };

    logger.info('关系审核完成', {
      relationId,
      previousStatus,
      newStatus,
      workflowStep,
    });

    return {
      relationId,
      previousStatus,
      newStatus,
      workflowStatus,
    };
  }

  /**
   * 批量审核关系
   *
   * @param input 批量审核输入
   * @returns 批量审核结果
   */
  static async batchReviewRelations(
    input: BatchReviewInput
  ): Promise<BatchReviewResult> {
    const { relationIds, reviewerId, isApproved, comment } = input;

    logger.info('开始批量审核关系', {
      relationCount: relationIds.length,
      reviewerId,
      isApproved,
    });

    const results: ReviewResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const relationId of relationIds) {
      try {
        const result = await this.reviewRelation({
          relationId,
          reviewerId,
          isApproved,
          comment,
        });

        results.push(result);
        successCount++;
      } catch (error) {
        logger.error(`审核关系失败: ${relationId}`, { error });
        failureCount++;

        results.push({
          relationId,
          previousStatus: VerificationStatus.PENDING,
          newStatus: VerificationStatus.PENDING,
          workflowStatus: {
            currentStep: WorkflowStep.PENDING_REVIEW,
            progress: 0,
            canProceedToNextStep: false,
            metadata: { error: String(error) },
          },
        });
      }
    }

    logger.info('批量审核完成', {
      total: relationIds.length,
      successCount,
      failureCount,
    });

    return {
      results,
      successCount,
      failureCount,
    };
  }

  /**
   * 获取关系的当前工作流状态
   *
   * @param relationId 关系ID
   * @returns 工作流状态
   */
  static async getWorkflowStatus(relationId: string): Promise<WorkflowStatus> {
    const relation =
      await LawArticleRelationService.getRelationById(relationId);

    if (!relation) {
      throw new Error(`关系不存在: ${relationId}`);
    }

    const verificationStatus = relation.verificationStatus;

    let currentStep: WorkflowStep;
    let progress: number;
    let canProceedToNextStep: boolean;

    switch (verificationStatus) {
      case VerificationStatus.PENDING:
        currentStep = WorkflowStep.PENDING_REVIEW;
        progress = 80;
        canProceedToNextStep = true; // 可以进行人工审核
        break;
      case VerificationStatus.VERIFIED:
        currentStep = WorkflowStep.VERIFIED;
        progress = 100;
        canProceedToNextStep = false;
        break;
      case VerificationStatus.REJECTED:
        currentStep = WorkflowStep.REJECTED;
        progress = 100;
        canProceedToNextStep = false;
        break;
      default:
        currentStep = WorkflowStep.PENDING_REVIEW;
        progress = 0;
        canProceedToNextStep = false;
    }

    return {
      currentStep,
      progress,
      canProceedToNextStep,
      metadata: {
        verificationStatus,
        verifiedBy: relation.verifiedBy,
        verifiedAt: relation.verifiedAt,
        rejectionReason: relation.rejectionReason,
      },
    };
  }

  /**
   * 重新提交被拒绝的关系
   *
   * @param relationId 关系ID
   * @param userId 用户ID
   * @param reason 重新提交原因
   * @returns 工作流状态
   */
  static async resubmitRelation(
    relationId: string,
    userId: string,
    reason: string
  ): Promise<WorkflowStatus> {
    logger.info('重新提交被拒绝的关系', {
      relationId,
      userId,
      reason,
    });

    // 获取当前关系状态
    const relation =
      await LawArticleRelationService.getRelationById(relationId);

    if (!relation) {
      throw new Error(`关系不存在: ${relationId}`);
    }

    if (relation.verificationStatus !== VerificationStatus.REJECTED) {
      throw new Error(`只能重新提交被拒绝的关系`);
    }

    // 更新审核历史
    const newReviewItem: ReviewHistoryItem = {
      userId,
      action: 'MODIFIED',
      comment: `重新提交: ${reason}`,
      timestamp: new Date().toISOString(),
      previousStatus: VerificationStatus.REJECTED,
      newStatus: VerificationStatus.PENDING,
    };

    const currentHistory =
      (relation.reviewHistory as unknown as ReviewHistoryItem[]) ?? [];
    const newReviewHistory = [...currentHistory, newReviewItem];

    // 更新关系状态
    await LawArticleRelationService.updateRelation(relationId, {
      verificationStatus: VerificationStatus.PENDING,
      reviewHistory: newReviewHistory as unknown as Prisma.InputJsonValue,
      rejectionReason: null,
    });

    const workflowStatus: WorkflowStatus = {
      currentStep: WorkflowStep.PENDING_REVIEW,
      progress: 80,
      canProceedToNextStep: true,
      metadata: {
        resubmittedBy: userId,
        reason,
      },
    };

    logger.info('关系重新提交成功', {
      relationId,
      workflowStep: workflowStatus.currentStep,
    });
    return workflowStatus;
  }
}
