/**
 * 降级质量评估器
 * 评估降级结果的质量，判断是否需要重试或继续降级
 */

import type { ExtractedData } from '../doc-analyzer/core/types';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 降级类型
 */
export type FallbackType = 'PRIMARY' | 'RULE_BASED' | 'CACHED' | 'TEMPLATE';

/**
 * 质量等级
 */
export type QualityLevel = 'high' | 'medium' | 'low';

/**
 * 质量评估结果
 */
export interface QualityEvaluation {
  /** 质量等级 */
  quality: QualityLevel;
  /** 质量分数 (0-1) */
  score: number;
  /** 是否应该重试 */
  shouldRetry: boolean;
  /** 警告信息 */
  warnings: string[];
}

// =============================================================================
// 降级质量评估器类
// =============================================================================

/**
 * 降级质量评估器
 * 评估不同降级策略返回结果的质量
 */
export class FallbackQualityEvaluator {
  /**
   * 评估降级结果的质量
   * @param result 降级结果
   * @param fallbackType 降级类型
   * @returns 质量评估结果
   */
  evaluate(result: unknown, fallbackType: FallbackType): QualityEvaluation {
    const warnings: string[] = [];
    let score = 1.0;

    // 根据降级类型评估
    switch (fallbackType) {
      case 'PRIMARY':
        score = this.evaluatePrimaryResult(result, warnings);
        break;
      case 'RULE_BASED':
        score = this.evaluateRuleBasedResult(result, warnings);
        break;
      case 'CACHED':
        score = this.evaluateCachedResult(result, warnings);
        break;
      case 'TEMPLATE':
        score = this.evaluateTemplateResult(result, warnings);
        break;
      default:
        score = 0.5;
    }

    // 确保分数在 0-1 范围内
    score = Math.max(0, Math.min(1, score));

    // 判断质量等级
    const quality: QualityLevel =
      score > 0.8 ? 'high' : score >= 0.5 ? 'medium' : 'low';

    // 判断是否需要重试
    const shouldRetry = score < 0.5;

    return {
      quality,
      score,
      shouldRetry,
      warnings,
    };
  }

  /**
   * 评估主要结果（AI结果）的质量
   * @private
   */
  private evaluatePrimaryResult(result: unknown, warnings: string[]): number {
    if (!result) {
      warnings.push('主要方法返回空结果');
      return 0;
    }

    const data = result as ExtractedData;
    let score = 1.0;

    // 检查当事人
    if (!data.parties || data.parties.length === 0) {
      warnings.push('未提取到当事人');
      score -= 0.3;
    }

    // 检查诉讼请求
    if (!data.claims || data.claims.length === 0) {
      warnings.push('未提取到诉讼请求');
      score -= 0.3;
    }

    return Math.max(0, score);
  }

  /**
   * 评估规则降级结果的质量
   * @private
   */
  private evaluateRuleBasedResult(result: unknown, warnings: string[]): number {
    if (!result) {
      warnings.push('规则降级返回空结果');
      return 0;
    }

    // 检查结果完整性
    const data = result as ExtractedData;
    let score = 1.0;

    if (!data.parties || data.parties.length === 0) {
      warnings.push('规则降级未提取到当事人');
      score -= 0.3;
    } else if (data.parties.length === 1) {
      // 只有1个当事人，质量中等
      score -= 0.15;
    }

    if (!data.claims || data.claims.length === 0) {
      warnings.push('规则降级未提取到诉讼请求');
      score -= 0.3;
    } else if (data.claims.length === 1) {
      // 只有1个诉讼请求，质量中等
      score -= 0.15;
    }

    return Math.max(0, score);
  }

  /**
   * 评估缓存降级结果的质量
   * @private
   */
  private evaluateCachedResult(result: unknown, warnings: string[]): number {
    if (!result) {
      warnings.push('缓存降级返回空结果');
      return 0;
    }

    // 缓存结果通常质量较高
    return 0.9;
  }

  /**
   * 评估模板降级结果的质量
   * @private
   */
  private evaluateTemplateResult(result: unknown, warnings: string[]): number {
    if (!result) {
      warnings.push('模板降级返回空结果');
      return 0;
    }

    // 模板结果质量较低，但总比没有好
    warnings.push('使用模板降级，结果可能不准确');
    return 0.5;
  }
}
