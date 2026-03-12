/**
 * 多级降级策略
 * 实现 AI → 规则 → 缓存 → 模板 的多级降级机制
 */

import { FallbackQualityEvaluator } from './fallback-quality-evaluator';
import type { QualityEvaluation } from './fallback-quality-evaluator';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 降级上下文
 * 包含各级降级函数
 */
export interface FallbackContext {
  /** 规则降级函数 */
  ruleFallback?: () => Promise<unknown>;
  /** 缓存降级函数 */
  cacheFallback?: () => Promise<unknown>;
  /** 模板降级函数 */
  templateFallback?: () => Promise<unknown>;
}

/**
 * 降级级别
 */
export type FallbackLevel =
  | 'primary'
  | 'rule'
  | 'cache'
  | 'template'
  | 'failed';

/**
 * 降级执行结果
 */
export interface FallbackExecutionResult {
  /** 结果数据 */
  result: unknown;
  /** 降级级别 */
  level: FallbackLevel;
  /** 质量评估 */
  quality: QualityEvaluation;
}

// =============================================================================
// 多级降级策略类
// =============================================================================

/**
 * 多级降级策略
 * 按照 AI → 规则 → 缓存 → 模板 的顺序尝试降级
 */
export class MultiLevelFallbackStrategy {
  private qualityEvaluator: FallbackQualityEvaluator;

  constructor() {
    this.qualityEvaluator = new FallbackQualityEvaluator();
  }

  /**
   * 执行多级降级策略
   * @param primaryFn 主要执行函数（AI）
   * @param context 降级上下文
   * @returns 降级执行结果
   */
  async execute(
    primaryFn: () => Promise<unknown>,
    context: FallbackContext
  ): Promise<FallbackExecutionResult> {
    // Level 1: 尝试主要方法（AI）
    try {
      const result = await primaryFn();
      const quality = this.qualityEvaluator.evaluate(result, 'PRIMARY');

      if (quality.score > 0.7) {
        return { result, level: 'primary', quality };
      }

      // AI结果质量不佳，尝试降级
      logger.warn('[MultiLevelFallbackStrategy] AI结果质量不佳，尝试降级', {
        quality,
      });
    } catch (error) {
      logger.error('[MultiLevelFallbackStrategy] AI执行失败，尝试降级', {
        error,
      });
    }

    // Level 2: 规则降级
    if (context.ruleFallback) {
      try {
        const result = await context.ruleFallback();
        const quality = this.qualityEvaluator.evaluate(result, 'RULE_BASED');

        if (quality.score > 0.5) {
          return { result, level: 'rule', quality };
        }

        logger.warn('[MultiLevelFallbackStrategy] 规则降级质量不佳，继续降级', {
          quality,
        });
      } catch (error) {
        logger.error('[MultiLevelFallbackStrategy] 规则降级失败', { error });
      }
    }

    // Level 3: 缓存降级
    if (context.cacheFallback) {
      try {
        const result = await context.cacheFallback();
        const quality = this.qualityEvaluator.evaluate(result, 'CACHED');

        if (quality.score > 0.5) {
          return { result, level: 'cache', quality };
        }

        logger.warn('[MultiLevelFallbackStrategy] 缓存降级质量不佳，继续降级', {
          quality,
        });
      } catch (error) {
        logger.error('[MultiLevelFallbackStrategy] 缓存降级失败', { error });
      }
    }

    // Level 4: 模板降级
    if (context.templateFallback) {
      try {
        const result = await context.templateFallback();

        // 检查结果是否为null或undefined
        if (result === null || result === undefined) {
          logger.warn('[MultiLevelFallbackStrategy] 模板降级返回空结果');
        } else {
          const quality = this.qualityEvaluator.evaluate(result, 'TEMPLATE');
          return { result, level: 'template', quality };
        }
      } catch (error) {
        logger.error('[MultiLevelFallbackStrategy] 模板降级失败', { error });
      }
    }

    // 所有降级都失败
    return {
      result: null,
      level: 'failed',
      quality: {
        quality: 'low',
        score: 0,
        shouldRetry: true,
        warnings: ['所有降级策略都失败'],
      },
    };
  }
}
