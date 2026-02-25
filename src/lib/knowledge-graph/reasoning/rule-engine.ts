/**
 * 知识图谱推理规则引擎
 *
 * 功能：
 * 1. 规则注册和管理
 * 2. 规则执行和应用
 * 3. 推理结果汇总
 */

import { logger } from '@/lib/logger';
import {
  RuleType,
  InferenceResult,
  InferenceSummary,
  RuleApplicationResult,
  ReasoningExecutionResult,
  ArticleNode,
  ArticleRelation,
  ReasoningContext,
  RuleExecutionOptions,
  RuleMetadata,
} from './types';

/**
 * 推理规则接口
 */
export interface ReasoningRule {
  /** 规则元数据 */
  metadata: RuleMetadata;
  /** 应用规则并返回推断结果 */
  apply(context: ReasoningContext): Promise<InferenceResult[]>;
}

/**
 * 规则引擎类
 */
export class RuleEngine {
  /** 已注册的规则 */
  private rules: Map<RuleType, ReasoningRule> = new Map();

  /**
   * 注册推理规则
   *
   * @param rule 推理规则
   */
  registerRule(rule: ReasoningRule): void {
    const { type } = rule.metadata;
    this.rules.set(type, rule);
    logger.info('注册推理规则', {
      type,
      name: rule.metadata.name,
      priority: rule.metadata.priority,
    });

    // 按优先级排序
    this.sortRules();
  }

  /**
   * 设置规则启用状态
   *
   * @param ruleType 规则类型
   * @param enabled 是否启用
   */
  setRuleEnabled(ruleType: RuleType, enabled: boolean): void {
    const rule = this.rules.get(ruleType);
    if (rule) {
      rule.metadata.enabled = enabled;
      logger.info('设置规则启用状态', { ruleType, enabled });
    }
  }

  /**
   * 获取已注册的规则列表
   *
   * @returns 规则列表（按优先级排序）
   */
  getRegisteredRules(): ReasoningRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取规则
   *
   * @param ruleType 规则类型
   * @returns 规则对象或undefined
   */
  getRule(ruleType: RuleType): ReasoningRule | undefined {
    return this.rules.get(ruleType);
  }

  /**
   * 应用单个规则
   *
   * @param ruleType 规则类型
   * @param context 推理上下文
   * @returns 规则应用结果
   */
  async applyRule(
    ruleType: RuleType,
    context: ReasoningContext
  ): Promise<RuleApplicationResult> {
    const rule = this.rules.get(ruleType);

    if (!rule) {
      return {
        ruleType,
        inferences: [],
        executionTimeMs: 0,
        success: false,
        error: `规则不存在: ${ruleType}`,
      };
    }

    if (!rule.metadata.enabled) {
      logger.info('规则已禁用，跳过执行', { ruleType });
      return {
        ruleType,
        inferences: [],
        executionTimeMs: 0,
        success: true,
      };
    }

    const startTime = Date.now();

    try {
      const inferences = await rule.apply(context);
      const executionTime = Date.now() - startTime;

      logger.info('规则执行完成', {
        ruleType,
        inferenceCount: inferences.length,
        executionTimeMs: executionTime,
      });

      return {
        ruleType,
        inferences,
        executionTimeMs: executionTime,
        success: true,
      };
    } catch (error: unknown) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : '未知错误';

      logger.error('规则执行失败', {
        ruleType,
        error: errorMessage,
        executionTimeMs: executionTime,
      });

      return {
        ruleType,
        inferences: [],
        executionTimeMs: executionTime,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 执行完整推理流程
   *
   * @param context 推理上下文
   * @param options 执行选项
   * @param ruleTypes 指定应用的规则类型（可选，不指定则应用所有启用规则）
   * @returns 推理执行结果
   */
  async runReasoning(
    context: ReasoningContext,
    options: RuleExecutionOptions = {},
    ruleTypes?: RuleType[]
  ): Promise<ReasoningExecutionResult> {
    const startTime = Date.now();

    // 默认选项
    const finalOptions: Required<RuleExecutionOptions> = {
      maxDepth: options.maxDepth || 5,
      minConfidence: options.minConfidence || 0.3,
      includeMediumConfidence:
        options.includeMediumConfidence !== undefined
          ? options.includeMediumConfidence
          : true,
      includeLowConfidence:
        options.includeLowConfidence !== undefined
          ? options.includeLowConfidence
          : false,
    };

    // 更新上下文的最大深度
    context.maxDepth = finalOptions.maxDepth;

    // 确定要应用的规则
    let rulesToApply: ReasoningRule[] = [];

    if (ruleTypes && ruleTypes.length > 0) {
      // 应用指定的规则
      for (const ruleType of ruleTypes) {
        const rule = this.rules.get(ruleType);
        if (rule && rule.metadata.enabled) {
          rulesToApply.push(rule);
        }
      }
    } else {
      // 应用所有启用的规则
      rulesToApply = Array.from(this.rules.values()).filter(
        r => r.metadata.enabled
      );
    }

    // 执行所有规则
    const allInferences: InferenceResult[] = [];
    const appliedRules: RuleType[] = [];

    for (const rule of rulesToApply) {
      const result = await this.applyRule(rule.metadata.type, context);

      if (result.success && result.inferences.length > 0) {
        appliedRules.push(rule.metadata.type);
        allInferences.push(...result.inferences);
      }
    }

    // 过滤推断结果
    const filteredInferences = this.filterInferences(
      allInferences,
      finalOptions
    );

    // 生成摘要
    const summary = this.generateSummary(filteredInferences);

    const totalExecutionTime = Date.now() - startTime;

    logger.info('推理执行完成', {
      sourceArticleId: context.sourceArticleId,
      appliedRules: appliedRules.length,
      totalInferences: filteredInferences.length,
      executionTimeMs: totalExecutionTime,
    });

    return {
      sourceArticleId: context.sourceArticleId,
      appliedRules,
      inferences: filteredInferences,
      summary,
      totalExecutionTimeMs: totalExecutionTime,
    };
  }

  /**
   * 创建推理上下文
   *
   * @param nodes 法条节点
   * @param relations 法条关系
   * @param sourceArticleId 源法条ID
   * @param maxDepth 最大推理深度
   * @returns 推理上下文
   */
  createContext(
    nodes: Map<string, ArticleNode>,
    relations: Map<string, ArticleRelation>,
    sourceArticleId: string,
    maxDepth: number = 5
  ): ReasoningContext {
    return {
      nodes,
      relations,
      sourceArticleId,
      maxDepth,
      visited: new Set<string>(),
    };
  }

  /**
   * 按优先级排序规则
   */
  private sortRules(): void {
    const sortedRules = Array.from(this.rules.entries()).sort(
      ([, a], [, b]) => {
        return a.metadata.priority - b.metadata.priority;
      }
    );

    this.rules = new Map(sortedRules);
  }

  /**
   * 过滤推断结果
   *
   * @param inferences 原始推断结果
   * @param options 过滤选项
   * @returns 过滤后的推断结果
   */
  private filterInferences(
    inferences: InferenceResult[],
    options: Required<RuleExecutionOptions>
  ): InferenceResult[] {
    return inferences.filter(inference => {
      const { confidence } = inference;

      // 过滤低置信度结果
      if (confidence < options.minConfidence) {
        return false;
      }

      // 过滤中等置信度结果（如果不包含）
      if (!options.includeMediumConfidence && confidence < 0.7) {
        return false;
      }

      // 过滤低置信度结果（如果不包含）
      if (!options.includeLowConfidence && confidence < 0.3) {
        return false;
      }

      return true;
    });
  }

  /**
   * 生成推理摘要
   *
   * @param inferences 推断结果
   * @returns 推理摘要
   */
  private generateSummary(inferences: InferenceResult[]): InferenceSummary {
    const summary: InferenceSummary = {
      totalInferences: inferences.length,
      highConfidenceInferences: 0,
      mediumConfidenceInferences: 0,
      lowConfidenceInferences: 0,
      inferencesByRule: {} as Record<RuleType, number>,
      warnings: [],
    };

    // 统计置信度分布
    for (const inference of inferences) {
      const { confidence, ruleType } = inference;

      if (confidence >= 0.7) {
        summary.highConfidenceInferences++;
      } else if (confidence >= 0.3) {
        summary.mediumConfidenceInferences++;
      } else {
        summary.lowConfidenceInferences++;
      }

      // 按规则类型统计
      if (!summary.inferencesByRule[ruleType]) {
        summary.inferencesByRule[ruleType] = 0;
      }
      summary.inferencesByRule[ruleType]++;
    }

    // 添加警告
    if (summary.lowConfidenceInferences > 0) {
      summary.warnings.push(
        `存在${summary.lowConfidenceInferences}个低置信度推断结果`
      );
    }

    if (summary.totalInferences === 0) {
      summary.warnings.push('未发现任何推断结果');
    }

    return summary;
  }
}
