/**
 * 传递性替代规则
 *
 * 规则逻辑：A替代B，B替代C → A间接替代C
 * 置信度计算：strength(A→B) * strength(B→C)
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
 * 传递性替代规则实现
 */
export class TransitiveSupersessionRule implements ReasoningRule {
  readonly metadata = {
    type: RuleType.TRANSITIVE_SUPERSESSION,
    name: '传递性替代规则',
    description: 'A替代B，B替代C → 推断A间接替代C',
    priority: RulePriority.HIGH,
    enabled: true,
    applicableRelationTypes: [RelationType.SUPERSEDES],
  };

  private readonly MIN_STRENGTH = 0.5; // 最小关系强度阈值

  /**
   * 应用规则
   *
   * @param context 推理上下文
   * @returns 推断结果
   */
  async apply(context: ReasoningContext): Promise<InferenceResult[]> {
    const inferences: InferenceResult[] = [];

    try {
      // 保存上下文用于生成说明
      this.currentContext = context;

      // 查找从源法条出发的所有SUPERSEDES关系
      const outgoingRelations = this.findOutgoingSupersedesRelations(
        context,
        context.sourceArticleId
      );

      if (outgoingRelations.length === 0) {
        logger.debug('未找到从源法条出发的替代关系', {
          sourceArticleId: context.sourceArticleId,
        });
        return inferences;
      }

      // 对每个直接替代关系，查找后续的替代链
      for (const firstRelation of outgoingRelations) {
        const chainInferences = await this.traceSupersessionChain(
          context,
          context.sourceArticleId,
          firstRelation.targetId,
          [context.sourceArticleId, firstRelation.targetId],
          firstRelation.strength,
          1 // 初始跳数
        );

        inferences.push(...chainInferences);
      }

      logger.info('传递性替代规则执行完成', {
        sourceArticleId: context.sourceArticleId,
        inferenceCount: inferences.length,
      });

      return inferences;
    } catch (error: unknown) {
      logger.error('传递性替代规则执行失败', {
        sourceArticleId: context.sourceArticleId,
        error: error instanceof Error ? error.message : '未知错误',
      });
      throw error;
    }
  }

  /**
   * 查找从指定法条出发的所有SUPERSEDES关系
   *
   * @param context 推理上下文
   * @param sourceId 源法条ID
   * @returns SUPERSEDES关系列表
   */
  private findOutgoingSupersedesRelations(
    context: ReasoningContext,
    sourceId: string
  ): Array<{ id: string; targetId: string; strength: number }> {
    const relations: Array<{ id: string; targetId: string; strength: number }> =
      [];

    for (const relation of context.relations.values()) {
      if (
        relation.sourceId === sourceId &&
        relation.relationType === RelationType.SUPERSEDES &&
        relation.verificationStatus === 'VERIFIED' &&
        relation.strength >= this.MIN_STRENGTH
      ) {
        relations.push({
          id: relation.id,
          targetId: relation.targetId,
          strength: relation.strength,
        });
      }
    }

    return relations;
  }

  /**
   * 追踪替代链
   *
   * @param context 推理上下文
   * @param sourceArticleId 原始源法条ID
   * @param currentArticleId 当前法条ID
   * @param path 当前路径（法条ID列表）
   * @param currentConfidence 当前置信度（关系强度乘积）
   * @param currentHops 当前跳数
   * @returns 推断结果
   */
  private async traceSupersessionChain(
    context: ReasoningContext,
    sourceArticleId: string,
    currentArticleId: string,
    path: string[],
    currentConfidence: number,
    currentHops: number
  ): Promise<InferenceResult[]> {
    const inferences: InferenceResult[] = [];

    // 检查最大深度限制
    if (currentHops >= context.maxDepth) {
      logger.debug('达到最大深度限制', {
        currentHops,
        maxDepth: context.maxDepth,
      });
      return inferences;
    }

    // 检查目标法条是否存在
    const targetNode = context.nodes.get(currentArticleId);
    if (!targetNode) {
      logger.debug('目标法条不存在，跳过', { articleId: currentArticleId });
      return inferences;
    }

    // 查找从当前法条出发的SUPERSEDES关系
    const nextRelations = this.findOutgoingSupersedesRelations(
      context,
      currentArticleId
    );

    if (nextRelations.length === 0) {
      // 没有后续关系，到达链的末端
      return inferences;
    }

    // 对每个后续关系，生成推断并继续追踪
    for (const nextRelation of nextRelations) {
      const nextPath = [...path, nextRelation.targetId];

      // 检查循环：如果目标节点已在路径中（且不是最后一个），则跳过
      if (path.slice(0, -1).includes(nextRelation.targetId)) {
        logger.debug('检测到循环引用，跳过', { nextPath });
        continue;
      }

      const nextConfidence = currentConfidence * nextRelation.strength;

      // 生成推断结果
      const inference: InferenceResult = {
        ruleType: RuleType.TRANSITIVE_SUPERSESSION,
        sourceArticleId,
        targetArticleId: nextRelation.targetId,
        inferredRelation: RelationType.SUPERSEDES,
        confidence: nextConfidence,
        reasoningPath: nextPath,
        explanation: this.generateExplanation(nextPath, nextConfidence),
      };

      inferences.push(inference);

      // 继续追踪（BFS）
      const chainInferences = await this.traceSupersessionChain(
        context,
        sourceArticleId,
        nextRelation.targetId,
        nextPath,
        nextConfidence,
        currentHops + 1
      );

      inferences.push(...chainInferences);
    }

    return inferences;
  }

  /**
   * 生成推理说明
   *
   * @param path 推理路径
   * @param confidence 置信度
   * @returns 推理说明
   */
  private generateExplanation(path: string[], confidence: number): string {
    const pathStr = path
      .map(id => {
        const node = Array.from(
          this.getCurrentContext()?.nodes.values() || []
        ).find(n => n.id === id);
        return node ? `${node.lawName}${node.articleNumber}` : id;
      })
      .join(' → ');

    return `基于传递性规则：${pathStr}，推断出间接替代关系，置信度：${(confidence * 100).toFixed(2)}%`;
  }

  /**
   * 获取当前上下文（用于生成说明）
   * 注意：这是临时方案，更好的做法是通过参数传递
   */
  private currentContext?: ReasoningContext;

  getCurrentContext(): ReasoningContext | undefined {
    return this.currentContext;
  }

  setCurrentContext(context: ReasoningContext): void {
    this.currentContext = context;
  }
}
