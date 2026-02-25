/**
 * 冲突传播规则
 *
 * 规则逻辑：A引用B，B已失效 → 提示A引用的有效性问题
 * 置信度计算：基于引用强度（strength）
 */

import { logger } from '@/lib/logger';
import { ReasoningRule } from '../rule-engine';
import {
  RuleType,
  RulePriority,
  ReasoningContext,
  InferenceResult,
} from '../types';
import { RelationType } from '@prisma/client';

/**
 * 冲突传播规则实现
 */
export class ConflictPropagationRule implements ReasoningRule {
  readonly metadata = {
    type: RuleType.CONFLICT_PROPAGATION,
    name: '冲突传播规则',
    description: 'A引用B，B已失效 → 提示引用有效性问题',
    priority: RulePriority.MEDIUM,
    enabled: true,
    applicableRelationTypes: [RelationType.CITES],
  };

  private readonly INVALID_STATUSES = ['REPEALED', 'EXPIRED', 'OBSOLETE'];

  /**
   * 应用规则
   *
   * @param context 推理上下文
   * @returns 推断结果（警告列表）
   */
  async apply(context: ReasoningContext): Promise<InferenceResult[]> {
    const inferences: InferenceResult[] = [];

    try {
      // 查找所有失效的法条
      const invalidArticles = this.findInvalidArticles(context);

      if (invalidArticles.length === 0) {
        logger.debug('未找到失效法条', {
          sourceArticleId: context.sourceArticleId,
        });
        return inferences;
      }

      // 查找所有指向失效法条的引用关系
      const citationRelations = this.findCitationsToInvalidArticles(
        context,
        invalidArticles
      );

      if (citationRelations.length === 0) {
        logger.debug('未找到指向失效法条的引用', {
          sourceArticleId: context.sourceArticleId,
        });
        return inferences;
      }

      // 为每个引用生成警告
      for (const citation of citationRelations) {
        const targetNode = context.nodes.get(citation.targetId);
        if (!targetNode) {
          continue;
        }

        const inference: InferenceResult = {
          ruleType: RuleType.CONFLICT_PROPAGATION,
          sourceArticleId: citation.sourceId,
          targetArticleId: citation.targetId,
          inferredRelation: RelationType.CITES,
          confidence: citation.strength, // 置信度等于引用强度
          reasoningPath: [citation.sourceId, citation.targetId],
          explanation: this.generateWarningExplanation(citation, targetNode),
        };

        inferences.push(inference);
      }

      logger.info('冲突传播规则执行完成', {
        sourceArticleId: context.sourceArticleId,
        warningCount: inferences.length,
        invalidArticleCount: invalidArticles.length,
      });

      return inferences;
    } catch (error: unknown) {
      logger.error('冲突传播规则执行失败', {
        sourceArticleId: context.sourceArticleId,
        error: error instanceof Error ? error.message : '未知错误',
      });
      throw error;
    }
  }

  /**
   * 查找所有失效的法条
   *
   * @param context 推理上下文
   * @returns 失效法条ID列表
   */
  private findInvalidArticles(context: ReasoningContext): string[] {
    const invalidArticles: string[] = [];

    for (const node of context.nodes.values()) {
      if (this.INVALID_STATUSES.includes(node.status)) {
        invalidArticles.push(node.id);
      }
    }

    return invalidArticles;
  }

  /**
   * 查找所有指向失效法条的引用关系
   *
   * @param context 推理上下文
   * @param invalidArticles 失效法条ID列表
   * @returns 引用关系列表
   */
  private findCitationsToInvalidArticles(
    context: ReasoningContext,
    invalidArticles: string[]
  ): Array<{
    id: string;
    sourceId: string;
    targetId: string;
    strength: number;
  }> {
    const citations: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      strength: number;
    }> = [];

    const invalidArticleSet = new Set(invalidArticles);

    for (const relation of context.relations.values()) {
      if (
        relation.relationType === RelationType.CITES &&
        relation.verificationStatus === 'VERIFIED' &&
        invalidArticleSet.has(relation.targetId)
      ) {
        citations.push({
          id: relation.id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          strength: relation.strength,
        });
      }
    }

    return citations;
  }

  /**
   * 生成警告说明
   *
   * @param citation 引用关系
   * @param targetNode 目标法条节点
   * @returns 警告说明
   */
  private generateWarningExplanation(
    citation: {
      id: string;
      sourceId: string;
      targetId: string;
      strength: number;
    },
    targetNode: {
      id: string;
      lawName: string;
      articleNumber: string;
      status: string;
    }
  ): string {
    const riskLevel = this.determineRiskLevel(citation.strength);
    const targetTitle = `${targetNode.lawName}${targetNode.articleNumber}`;

    return `检测到引用失效：法条${citation.sourceId}引用了${targetTitle}（状态：${targetNode.status}），风险等级：${riskLevel}，引用强度：${(citation.strength * 100).toFixed(2)}%`;
  }

  /**
   * 确定风险等级
   *
   * @param strength 引用强度
   * @returns 风险等级
   */
  private determineRiskLevel(strength: number): string {
    if (strength >= 0.8) {
      return '高风险';
    } else if (strength >= 0.5) {
      return '中风险';
    } else {
      return '低风险';
    }
  }
}
