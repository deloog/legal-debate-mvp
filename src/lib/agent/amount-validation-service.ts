/**
 * 金额验证服务
 * 独立的验证调用层，将 VerificationAgent 从 AmountExtractor 中解耦
 *
 * 职责：
 * 1. 封装 VerificationAgent 的调用
 * 2. 提供多种验证策略
 * 3. 支持回调机制，让上层决定是否继续验证
 * 4. 提供置信度调整逻辑
 */

import { VerificationAgent } from './verification-agent';

// =============================================================================
// 类型定义
// =============================================================================

export interface AmountToValidate {
  originalText: string;
  normalizedAmount: number;
  currency: string;
  confidence: number;
  context?: string;
}

export interface AmountValidationResult {
  amount: AmountToValidate;
  factualValid: boolean | null;
  logicalValid: boolean | null;
  completenessValid: boolean | null;
  adjustedConfidence: number;
  skipped?: boolean;
  error?: string;
}

export type ValidationStrategy =
  | 'FULL'
  | 'FACTUAL_ONLY'
  | 'LOGICAL_ONLY'
  | 'NONE';

export interface ValidationOptions {
  strategy?: ValidationStrategy;
  fullText?: string;
  requireCurrency?: boolean;
  minConfidence?: number;
  callback?: ValidationCallback;
  /** 是否使用并行验证（默认false，保持顺序） */
  parallel?: boolean;
}

export type ValidationCallback = (
  result: AmountValidationResult,
  index: number,
  total: number
) => boolean | void | Promise<boolean | void>;

// =============================================================================
// 常量配置
// =============================================================================

const MAX_BATCH_SIZE = 1000; // 最大批量验证数量，防止DoS

// =============================================================================
// 金额验证服务类
// =============================================================================

export class AmountValidationService {
  private verificationAgent: VerificationAgent | null;

  constructor(verificationAgent?: VerificationAgent | null) {
    this.verificationAgent = verificationAgent ?? null;
  }

  /**
   * 验证单个金额
   */
  async validateAmount(
    amount: AmountToValidate,
    options: ValidationOptions = {}
  ): Promise<AmountValidationResult> {
    const { strategy = 'FULL', fullText = '' } = options;

    const result: AmountValidationResult = {
      amount,
      factualValid: null,
      logicalValid: null,
      completenessValid: null,
      adjustedConfidence: amount.confidence,
    };

    // 如果策略为 NONE，跳过验证
    if (strategy === 'NONE') {
      result.skipped = true;
      return result;
    }

    // 检查是否有验证服务
    if (
      !this.verificationAgent &&
      (strategy === 'FULL' || strategy === 'FACTUAL_ONLY')
    ) {
      result.skipped = true;
      result.factualValid = true; // 默认通过
    }

    try {
      // 1. 事实准确性验证
      if (
        (strategy === 'FULL' || strategy === 'FACTUAL_ONLY') &&
        this.verificationAgent
      ) {
        result.factualValid = await this.verifyFactualAccuracy(amount);
      }

      // 2. 逻辑一致性验证
      if (strategy === 'FULL' || strategy === 'LOGICAL_ONLY') {
        result.logicalValid = await this.verifyLogicalConsistency(
          amount,
          fullText
        );
      }

      // 3. 任务完成度验证
      if (strategy === 'FULL') {
        result.completenessValid = this.verifyCompleteness(amount, options);
      }

      // 4. 调整置信度
      result.adjustedConfidence = this.adjustConfidence(
        amount.confidence,
        result.factualValid ?? true,
        result.logicalValid ?? true,
        result.completenessValid ?? true
      );
    } catch (err) {
      result.error = err instanceof Error ? err.message : 'Unknown error';
      // 错误时默认通过，不降低置信度
      result.factualValid = result.factualValid ?? true;
      result.logicalValid = result.logicalValid ?? true;
    }

    return result;
  }

  /**
   * 批量验证金额
   * 支持批量限制和并行验证
   */
  async validateAmounts(
    amounts: AmountToValidate[],
    options: ValidationOptions = {}
  ): Promise<AmountValidationResult[]> {
    // 安全检查：限制批量大小，防止DoS
    if (amounts.length > MAX_BATCH_SIZE) {
      throw new Error(
        `批量验证数量不能超过 ${MAX_BATCH_SIZE}，当前数量: ${amounts.length}`
      );
    }

    // 如果使用并行验证，且没有回调函数
    if (options.parallel && !options.callback) {
      return this.validateAmountsParallel(amounts, options);
    }

    // 顺序验证（支持回调）
    return this.validateAmountsSequential(amounts, options);
  }

  /**
   * 顺序验证金额
   */
  private async validateAmountsSequential(
    amounts: AmountToValidate[],
    options: ValidationOptions
  ): Promise<AmountValidationResult[]> {
    const results: AmountValidationResult[] = [];

    for (let i = 0; i < amounts.length; i++) {
      const result = await this.validateAmount(amounts[i], options);
      results.push(result);

      // 调用回调函数
      if (options.callback) {
        const continueValidation = await options.callback(
          result,
          i,
          amounts.length
        );
        // 如果回调返回 false，停止验证
        if (continueValidation === false) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * 并行验证金额
   * 注意：并行验证不支持回调函数
   */
  private async validateAmountsParallel(
    amounts: AmountToValidate[],
    options: ValidationOptions
  ): Promise<AmountValidationResult[]> {
    // 并行执行验证（移除回调，因为并行不支持顺序回调）
    const { callback: _callback, ...optionsWithoutCallback } = options;
    const promises = amounts.map(amount =>
      this.validateAmount(amount, optionsWithoutCallback)
    );
    return Promise.all(promises);
  }

  /**
   * 事实准确性验证：验证金额与源数据一致性
   * 抛出错误以便上层捕获并设置 error 属性
   */
  private async verifyFactualAccuracy(
    amount: AmountToValidate
  ): Promise<boolean> {
    // 如果没有 VerificationAgent，跳过验证
    if (!this.verificationAgent) {
      return true;
    }

    const result = await this.verificationAgent.verify({
      amounts: [
        {
          field: 'extracted',
          value: amount.normalizedAmount,
        },
      ],
    });

    return result.passed;
  }

  /**
   * 逻辑一致性验证：验证金额在上下文中的合理性
   */
  private async verifyLogicalConsistency(
    amount: AmountToValidate,
    fullText: string
  ): Promise<boolean> {
    // 通用范围检查 - 任何超过1万亿的金额都不合理
    if (amount.normalizedAmount > 1000000000000) {
      return false;
    }

    // 检查金额在法律上下文中的合理性
    const context = this.extractContext(amount.originalText, fullText);
    const legalKeywords = [
      '赔偿',
      '违约金',
      '利息',
      '本金',
      '费用',
      '损失',
      '借款',
      '贷款',
    ];

    const hasLegalContext = legalKeywords.some(
      keyword => context.includes(keyword) || fullText.includes(keyword)
    );

    // 如果没有法律上下文，使用通用范围检查
    if (!hasLegalContext) {
      return (
        amount.normalizedAmount >= 0.01 && amount.normalizedAmount <= 100000000
      );
    }

    // 根据不同的法律场景判断合理性
    if (
      context.includes('借款') ||
      context.includes('贷款') ||
      fullText.includes('借款') ||
      fullText.includes('贷款')
    ) {
      return (
        amount.normalizedAmount >= 1000 && amount.normalizedAmount <= 100000000
      );
    }

    if (
      context.includes('赔偿') ||
      context.includes('损失') ||
      fullText.includes('赔偿') ||
      fullText.includes('损失')
    ) {
      return (
        amount.normalizedAmount >= 100 && amount.normalizedAmount <= 100000000
      );
    }

    if (context.includes('违约金') || fullText.includes('违约金')) {
      return (
        amount.normalizedAmount >= 100 && amount.normalizedAmount <= 50000000
      );
    }

    // 通用范围
    return (
      amount.normalizedAmount >= 0.01 && amount.normalizedAmount <= 100000000
    );
  }

  /**
   * 任务完成度验证：验证金额提取的完整性
   */
  private verifyCompleteness(
    amount: AmountToValidate,
    options: ValidationOptions
  ): boolean {
    // 检查是否满足货币要求
    if (options.requireCurrency && !amount.currency) {
      return false;
    }

    // 检查是否满足置信度要求
    if (options.minConfidence && amount.confidence < options.minConfidence) {
      return false;
    }

    return true;
  }

  /**
   * 根据验证结果调整置信度
   */
  adjustConfidence(
    originalConfidence: number,
    factualValid: boolean,
    logicalValid: boolean,
    completenessValid: boolean
  ): number {
    let adjusted = originalConfidence;

    if (factualValid) {
      adjusted = Math.min(adjusted + 0.1, 1.0);
    } else {
      const penalty = originalConfidence >= 0.7 ? 0.1 : 0.3;
      adjusted = Math.max(adjusted - penalty, 0.0);
    }

    if (logicalValid) {
      adjusted = Math.min(adjusted + 0.05, 1.0);
    } else {
      const penalty = originalConfidence >= 0.7 ? 0.05 : 0.2;
      adjusted = Math.max(adjusted - penalty, 0.0);
    }

    if (!completenessValid) {
      adjusted = Math.max(adjusted - 0.1, 0.0);
    }

    return adjusted;
  }

  /**
   * 提取上下文
   */
  private extractContext(target: string, fullText: string): string {
    const index = fullText.indexOf(target);
    if (index === -1) return '';

    const start = Math.max(0, index - 50);
    const end = Math.min(fullText.length, index + target.length + 50);

    return fullText.substring(start, end);
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

export function createAmountValidationService(
  verificationAgent?: VerificationAgent
): AmountValidationService {
  return new AmountValidationService(verificationAgent);
}
