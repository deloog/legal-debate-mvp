/**
 * 逻辑评分增强模块
 *
 * 功能：
 * 1. 评估推理深度（≥2步骤+0.05，≥3步骤+0.1）
 * 2. 评估逻辑连接词质量（强连接词+0.05，弱连接词+0.02）
 * 3. 评估因果关系完整性（明确因果+0.1）
 * 4. 评估论点间连贯性
 */

import {
  LOGICAL_CONNECTORS,
  CAUSAL_KEYWORDS,
  type CausalType,
} from '../../../agent/legal-agent/reasoning-rules';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 逻辑评分结果
 */
export interface LogicScoringResult {
  /** 基础评分 */
  baseScore: number;
  /** 推理深度奖励 */
  depthBonus: number;
  /** 逻辑连接词奖励 */
  connectorBonus: number;
  /** 因果关系奖励 */
  causalBonus: number;
  /** 连贯性奖励 */
  coherenceBonus: number;
  /** 最终评分 */
  finalScore: number;
  /** 评分详情 */
  details: {
    reasoningDepth: {
      steps: number;
      depth: number;
    };
    connectors: {
      strong: number;
      weak: number;
      total: number;
    };
    causalRelations: {
      count: number;
      types: CausalType[];
    };
    coherence: {
      score: number;
    };
  };
}

/**
 * 推理链信息
 */
export interface ReasoningChainInfo {
  /** 推理步骤 */
  steps: string[];
  /** 推理类型 */
  type: 'deductive' | 'inductive' | 'analogical';
}

// =============================================================================
// 配置常量
// =============================================================================

/**
 * 评分配置
 */
const SCORING_CONFIG = {
  /** 强连接词阈值 */
  STRONG_CONNECTOR_THRESHOLD: 0.8,
  /** 弱连接词阈值 */
  WEAK_CONNECTOR_THRESHOLD: 0.5,
  /** 最小推理步骤数 */
  MIN_REASONING_STEPS: 2,
  /** 最优推理步骤数 */
  OPTIMAL_REASONING_STEPS: 3,
  /** 推理深度奖励 */
  DEPTH_BONUS_MIN: 0.05,
  DEPTH_BONUS_MAX: 0.1,
  /** 强连接词奖励 */
  STRONG_CONNECTOR_BONUS: 0.05,
  /** 弱连接词奖励 */
  WEAK_CONNECTOR_BONUS: 0.02,
  /** 因果关系奖励 */
  CAUSAL_BONUS: 0.1,
  /** 连贯性奖励 */
  COHERENCE_BONUS: 0.05,
  /** 最大奖励分 */
  MAX_BONUS_SCORE: 0.15,
} as const;

// =============================================================================
// LogicScoringEnhancer 类
// =============================================================================

/**
 * 逻辑评分增强器类
 */
export class LogicScoringEnhancer {
  /**
   * 计算增强后的逻辑评分
   *
   * @param baseScore - 基础评分（0-1）
   * @param content - 论点内容
   * @param reasoningChain - 推理链信息
   * @param allArguments - 所有论点（用于评估连贯性）
   * @returns 增强后的逻辑评分
   */
  enhanceScore(
    baseScore: number,
    content: string,
    reasoningChain?: ReasoningChainInfo,
    allArguments?: string[]
  ): LogicScoringResult {
    // 评估推理深度
    const depthEvaluation = this.evaluateReasoningDepth(
      content,
      reasoningChain
    );

    // 评估逻辑连接词
    const connectorEvaluation = this.evaluateLogicalConnectors(content);

    // 评估因果关系
    const causalEvaluation = this.evaluateCausalRelations(content);

    // 评估连贯性
    const coherenceEvaluation = allArguments
      ? this.evaluateCoherence(allArguments)
      : { score: 0, count: 0 };

    // 计算各项奖励
    const depthBonus = this.calculateDepthBonus(depthEvaluation.depth);
    const connectorBonus = this.calculateConnectorBonus(
      connectorEvaluation.strong,
      connectorEvaluation.weak
    );
    const causalBonus = this.calculateCausalBonus(causalEvaluation.count);
    const coherenceBonus = this.calculateCoherenceBonus(
      coherenceEvaluation.score
    );

    // 计算总奖励分（不超过最大奖励）
    const totalBonus = Math.min(
      SCORING_CONFIG.MAX_BONUS_SCORE,
      depthBonus + connectorBonus + causalBonus + coherenceBonus
    );

    // 计算最终评分
    const finalScore = Math.min(1.0, baseScore + totalBonus);

    return {
      baseScore,
      depthBonus,
      connectorBonus,
      causalBonus,
      coherenceBonus,
      finalScore,
      details: {
        reasoningDepth: {
          steps: depthEvaluation.steps,
          depth: depthEvaluation.depth,
        },
        connectors: {
          strong: connectorEvaluation.strong,
          weak: connectorEvaluation.weak,
          total: connectorEvaluation.total,
        },
        causalRelations: {
          count: causalEvaluation.count,
          types: causalEvaluation.types,
        },
        coherence: {
          score: coherenceEvaluation.score,
        },
      },
    };
  }

  /**
   * 评估推理深度
   *
   * @param content - 论点内容
   * @param reasoningChain - 推理链信息
   * @returns 推理深度评估结果
   */
  private evaluateReasoningDepth(
    content: string,
    reasoningChain?: ReasoningChainInfo
  ): { steps: number; depth: number } {
    // 如果有明确的推理链，使用推理链步骤数
    if (reasoningChain && reasoningChain.steps.length > 0) {
      const steps = reasoningChain.steps.length;
      const depth = Math.min(
        steps / SCORING_CONFIG.OPTIMAL_REASONING_STEPS,
        1.0
      );
      return { steps, depth };
    }

    // 否则从内容中推断推理步骤数
    // 通过识别逻辑连接词和句式结构来推断
    const sentences = this.splitSentences(content);
    let steps = sentences.length;

    // 限制最大步骤数
    steps = Math.min(steps, 5);

    const depth = Math.min(steps / SCORING_CONFIG.OPTIMAL_REASONING_STEPS, 1.0);

    return { steps, depth };
  }

  /**
   * 评估逻辑连接词质量
   *
   * @param content - 论点内容
   * @returns 逻辑连接词评估结果
   */
  private evaluateLogicalConnectors(content: string): {
    strong: number;
    weak: number;
    total: number;
  } {
    let strongCount = 0;
    let weakCount = 0;

    for (const connector of LOGICAL_CONNECTORS) {
      if (content.includes(connector.word)) {
        if (connector.strength >= SCORING_CONFIG.STRONG_CONNECTOR_THRESHOLD) {
          strongCount++;
        } else if (
          connector.strength >= SCORING_CONFIG.WEAK_CONNECTOR_THRESHOLD
        ) {
          weakCount++;
        }
      }
    }

    return {
      strong: strongCount,
      weak: weakCount,
      total: strongCount + weakCount,
    };
  }

  /**
   * 评估因果关系完整性
   *
   * @param content - 论点内容
   * @returns 因果关系评估结果
   */
  private evaluateCausalRelations(content: string): {
    count: number;
    types: CausalType[];
  } {
    const types: CausalType[] = [];
    let count = 0;

    for (const [type, keywords] of Object.entries(CAUSAL_KEYWORDS)) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          count++;
          if (!types.includes(type as CausalType)) {
            types.push(type as CausalType);
          }
          break; // 同一类型只计数一次
        }
      }
    }

    return { count, types };
  }

  /**
   * 评估论点间连贯性
   *
   * @param arguments - 所有论点
   * @returns 连贯性评估结果
   */
  private evaluateCoherence(argumentList: string[]): {
    score: number;
    count: number;
  } {
    if (argumentList.length < 2) {
      return { score: 0, count: 0 };
    }

    let coherentPairs = 0;
    const totalPairs = argumentList.length - 1;

    for (let i = 0; i < argumentList.length - 1; i++) {
      const current = argumentList[i];
      const next = argumentList[i + 1];

      // 检查是否有逻辑连接词连接
      const hasConnector = LOGICAL_CONNECTORS.some(
        c => current.includes(c.word) || next.includes(c.word)
      );

      // 检查是否有因果关系
      const hasCausal = Object.values(CAUSAL_KEYWORDS).some(keywords =>
        keywords.some(k => current.includes(k) || next.includes(k))
      );

      if (hasConnector || hasCausal) {
        coherentPairs++;
      }
    }

    const score = coherentPairs / totalPairs;

    return { score, count: coherentPairs };
  }

  /**
   * 计算推理深度奖励
   *
   * @param depth - 推理深度（0-1）
   * @returns 推理深度奖励分
   */
  private calculateDepthBonus(depth: number): number {
    if (
      depth >=
      SCORING_CONFIG.OPTIMAL_REASONING_STEPS /
        SCORING_CONFIG.OPTIMAL_REASONING_STEPS
    ) {
      return SCORING_CONFIG.DEPTH_BONUS_MAX;
    } else if (
      depth >=
      SCORING_CONFIG.MIN_REASONING_STEPS /
        SCORING_CONFIG.OPTIMAL_REASONING_STEPS
    ) {
      return SCORING_CONFIG.DEPTH_BONUS_MIN;
    }
    return 0;
  }

  /**
   * 计算逻辑连接词奖励
   *
   * @param strongCount - 强连接词数量
   * @param weakCount - 弱连接词数量
   * @returns 逻辑连接词奖励分
   */
  private calculateConnectorBonus(
    strongCount: number,
    weakCount: number
  ): number {
    const strongBonus = strongCount * SCORING_CONFIG.STRONG_CONNECTOR_BONUS;
    const weakBonus = weakCount * SCORING_CONFIG.WEAK_CONNECTOR_BONUS;

    // 限制最大奖励
    return Math.min(SCORING_CONFIG.MAX_BONUS_SCORE, strongBonus + weakBonus);
  }

  /**
   * 计算因果关系奖励
   *
   * @param count - 因果关系数量
   * @returns 因果关系奖励分
   */
  private calculateCausalBonus(count: number): number {
    if (count >= 2) {
      return SCORING_CONFIG.CAUSAL_BONUS;
    } else if (count >= 1) {
      return SCORING_CONFIG.CAUSAL_BONUS * 0.5;
    }
    return 0;
  }

  /**
   * 计算连贯性奖励
   *
   * @param score - 连贯性评分（0-1）
   * @returns 连贯性奖励分
   */
  private calculateCoherenceBonus(score: number): number {
    if (score >= 0.8) {
      return SCORING_CONFIG.COHERENCE_BONUS;
    } else if (score >= 0.5) {
      return SCORING_CONFIG.COHERENCE_BONUS * 0.5;
    }
    return 0;
  }

  /**
   * 分割句子
   *
   * @param text - 文本
   * @returns 句子数组
   */
  private splitSentences(text: string): string[] {
    // 简单的句子分割逻辑
    return text
      .split(/[。；；!?！？]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 创建默认的评分增强器实例
 */
export function createLogicScoringEnhancer(): LogicScoringEnhancer {
  return new LogicScoringEnhancer();
}

/**
 * 快速评估单个论点的逻辑评分
 *
 * @param baseScore - 基础评分
 * @param content - 论点内容
 * @returns 逻辑评分结果
 */
export function quickEvaluateLogic(
  baseScore: number,
  content: string
): LogicScoringResult {
  const enhancer = new LogicScoringEnhancer();
  return enhancer.enhanceScore(baseScore, content);
}

/**
 * 批量评估多个论点的逻辑评分
 *
 * @param baseScores - 基础评分数组
 * @param arguments - 论点内容数组
 * @returns 逻辑评分结果数组
 */
export function batchEvaluateLogic(
  baseScores: number[],
  argumentList: string[]
): LogicScoringResult[] {
  const enhancer = new LogicScoringEnhancer();
  return baseScores.map((score, index) =>
    enhancer.enhanceScore(score, argumentList[index], undefined, argumentList)
  );
}
