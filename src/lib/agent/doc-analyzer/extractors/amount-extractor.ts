// =============================================================================
// DocAnalyzer 金额提取器
// 从文档中提取、标准化和验证金额信息
// 目标：金额识别精度≥99%
//
// 重构说明（P1-005）：已将VerificationAgent解耦
// - AmountExtractor 只负责提取
// - 验证逻辑移至 AmountValidationService
// - 通过选项控制是否验证，由上层决定
// =============================================================================

import type { Claim } from '../core/types';
import {
  PrecisionAmountExtractor,
  type AmountExtractionResult,
} from '../../../extraction/amount-extractor-precision';
import {
  AmountValidationService,
  type AmountToValidate,
  type ValidationCallback,
  type ValidationOptions,
} from '../../amount-validation-service';

// =============================================================================
// 接口定义
// =============================================================================

export interface AmountExtractionOptions {
  currency?: string;
  requireCurrency?: boolean;
  minConfidence?: number;
  context?: string;
  /** 是否启用验证（默认false） */
  validate?: boolean;
  /** 验证结果回调 */
  onValidationResult?: ValidationCallback;
}

export interface AmountExtractionOutput {
  amounts: Array<{
    originalText: string;
    normalizedAmount: number;
    currency: string;
    confidence: number;
    context?: string;
  }>;
  summary: {
    total: number;
    count: number;
    average: number;
    currency: string;
  };
  validation: {
    isValid: boolean;
    issues: string[];
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/** 构造函数选项 */
export interface AmountExtractorOptions {
  /** 可选的验证服务，如不提供则不进行验证 */
  validationService?: AmountValidationService;
}

// =============================================================================
// 金额提取器类
// =============================================================================

export class AmountExtractor {
  private precisionExtractor: PrecisionAmountExtractor;
  private validationService: AmountValidationService | null;

  constructor(options: AmountExtractorOptions = {}) {
    this.precisionExtractor = new PrecisionAmountExtractor();
    // 解耦：不再直接创建 VerificationAgent，而是接收可选的验证服务
    this.validationService = options.validationService ?? null;
  }

  /**
   * 从文本中提取金额信息
   *
   * 重构后：验证变为可选，通过 options.validate 控制
   * 验证逻辑委托给 AmountValidationService
   */
  async extractFromText(
    text: string,
    options: AmountExtractionOptions = {}
  ): Promise<AmountExtractionOutput> {
    const extractionResults =
      await this.precisionExtractor.extractWithPrecision(text);

    // 过滤和处理结果
    const processedAmounts = this.processExtractionResults(
      extractionResults,
      options
    );

    // 如果启用验证且提供了验证服务，则进行验证
    let finalAmounts = processedAmounts;
    if (options.validate && this.validationService) {
      finalAmounts = await this.validateExtractedAmounts(
        processedAmounts,
        text,
        options
      );
    }

    // 生成摘要
    const summary = this.generateSummary(finalAmounts);

    // 验证结果（本地验证，不涉及 VerificationAgent）
    const validation = this.validateAmounts(finalAmounts);

    return {
      amounts: finalAmounts,
      summary,
      validation,
    };
  }

  /**
   * 验证提取的金额（新方法，替代原来的 verifyAmounts）
   * 委托给 AmountValidationService
   */
  private async validateExtractedAmounts(
    amounts: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }>,
    fullText: string,
    options: AmountExtractionOptions
  ): Promise<
    Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }>
  > {
    if (!this.validationService) {
      // 如果没有验证服务，直接返回原金额
      return amounts;
    }

    // 转换为验证服务需要的格式
    const amountsToValidate: AmountToValidate[] = amounts.map(a => ({
      originalText: a.originalText,
      normalizedAmount: a.normalizedAmount,
      currency: a.currency,
      confidence: a.confidence,
      context: a.context,
    }));

    // 调用验证服务
    const validationOptions: ValidationOptions = {
      strategy: 'FULL',
      fullText,
      requireCurrency: options.requireCurrency,
      minConfidence: options.minConfidence,
      callback: options.onValidationResult,
    };

    const results = await this.validationService.validateAmounts(
      amountsToValidate,
      validationOptions
    );

    // 应用验证结果（调整置信度）
    return amounts.map((amount, index) => ({
      ...amount,
      confidence: results[index]?.adjustedConfidence ?? amount.confidence,
    }));
  }

  /**
   * 从诉讼请求中提取金额
   */
  async extractFromClaims(claims: Claim[]): Promise<Claim[]> {
    const processedClaims: Claim[] = [];

    for (const claim of claims) {
      const processedClaim = await this.extractAmountFromClaim(claim);
      if (processedClaim.amount !== undefined) {
        processedClaims.push(processedClaim);
      } else {
        processedClaims.push(claim);
      }
    }

    return processedClaims;
  }

  /**
   * 从单个诉讼请求中提取金额
   */
  private async extractAmountFromClaim(claim: Claim): Promise<Claim> {
    // 如果已经有金额且是数字，直接返回
    if (typeof claim.amount === 'number' && claim.amount > 0) {
      return claim;
    }

    // 如果有金额字符串，尝试解析
    if (typeof claim.amount === 'string') {
      const result = await this.normalizeAmountString(claim.amount);
      return {
        ...claim,
        amount: result,
      };
    }

    // 尝试从内容中提取金额
    if (claim.content) {
      const result = await this.extractFromText(claim.content);
      if (result.amounts.length > 0) {
        const best = this.getBestAmount(result.amounts);
        return {
          ...claim,
          amount: best.normalizedAmount,
          currency: best.currency,
        };
      }
    }

    return claim;
  }

  /**
   * 处理提取结果
   */
  private processExtractionResults(
    results: AmountExtractionResult[],
    options: AmountExtractionOptions
  ): Array<{
    originalText: string;
    normalizedAmount: number;
    currency: string;
    confidence: number;
    context?: string;
  }> {
    const processed = results
      .filter(result => {
        // 过滤无意义的原始文本（如纯单位）
        if (result.originalText.length < 2) {
          return false;
        }

        // 过滤货币不匹配结果
        if (options.currency && result.currency !== options.currency) {
          return false;
        }

        return result.normalizedAmount > 0;
      })
      .map(result => ({
        originalText: result.originalText,
        normalizedAmount: result.normalizedAmount,
        currency: result.currency,
        confidence: result.confidence,
        context: options.context,
      }));

    // 去重
    return this.deduplicateAmounts(processed);
  }

  /**
   * 去重金额
   */
  private deduplicateAmounts(
    amounts: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }>
  ): Array<{
    originalText: string;
    normalizedAmount: number;
    currency: string;
    confidence: number;
    context?: string;
  }> {
    const seen = new Set<string>();
    const unique: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }> = [];

    for (const amount of amounts) {
      const key = `${amount.normalizedAmount}_${amount.currency}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(amount);
      }
    }

    return unique;
  }

  /**
   * 生成金额摘要
   */
  private generateSummary(
    amounts: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }>
  ): { total: number; count: number; average: number; currency: string } {
    if (amounts.length === 0) {
      return { total: 0, count: 0, average: 0, currency: 'CNY' };
    }

    const total = amounts.reduce((sum, a) => sum + a.normalizedAmount, 0);
    const count = amounts.length;
    const average = total / count;
    const currency = amounts[0].currency;

    return { total, count, average, currency };
  }

  /**
   * 验证金额
   */
  private validateAmounts(
    amounts: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }>
  ): {
    isValid: boolean;
    issues: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const issues: string[] = [];

    // 检查金额范围和上下文合理性
    for (const amount of amounts) {
      // 金额过小：小于等于0.01元
      if (amount.normalizedAmount <= 0.01) {
        issues.push(`金额过小: ${amount.normalizedAmount}`);
      }

      if (amount.normalizedAmount > 10000000) {
        issues.push(`金额异常大: ${amount.normalizedAmount}`);
      }

      // 检查上下文中的场景合理性
      if (amount.context) {
        const context = amount.context;

        // 借款场景：异常小的借款金额（小于1000元）
        if (
          (context.includes('借款') || context.includes('贷款')) &&
          amount.normalizedAmount < 1000
        ) {
          issues.push(
            `借款金额异常小: ${amount.normalizedAmount}元（通常不低于1000元）`
          );
        }

        // 借款场景：异常大的借款金额（大于1亿）
        if (
          (context.includes('借款') || context.includes('贷款')) &&
          amount.normalizedAmount > 100000000
        ) {
          issues.push(`借款金额异常大: ${amount.normalizedAmount}元`);
        }

        // 赔偿场景：异常小的赔偿金额（小于100元）
        if (
          (context.includes('赔偿') || context.includes('损失')) &&
          amount.normalizedAmount < 100
        ) {
          issues.push(`赔偿金额异常小: ${amount.normalizedAmount}元`);
        }

        // 违约金场景：异常大的违约金（大于5000万）
        if (context.includes('违约金') && amount.normalizedAmount > 50000000) {
          issues.push(`违约金金额异常大: ${amount.normalizedAmount}元`);
        }
      }
    }

    // 检查货币一致性
    const currencies = new Set(amounts.map(a => a.currency));
    if (currencies.size > 1) {
      issues.push(`多种货币单位: ${Array.from(currencies).join(', ')}`);
    }

    // 计算风险等级
    const riskLevel = this.calculateRiskLevel(issues, amounts.length);

    return {
      isValid: issues.length === 0,
      issues,
      riskLevel,
    };
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    issues: string[],
    total: number
  ): 'low' | 'medium' | 'high' {
    const ratio = issues.length / Math.max(total, 1);

    if (ratio === 0) return 'low';
    if (ratio <= 0.3) return 'medium';
    return 'high';
  }

  /**
   * 标准化金额字符串
   */
  private async normalizeAmountString(amountStr: string): Promise<number> {
    const results =
      await this.precisionExtractor.extractWithPrecision(amountStr);
    const best = this.precisionExtractor.getBestExtraction(results);

    return best?.normalizedAmount || 0;
  }

  /**
   * 获取最佳金额
   */
  private getBestAmount(
    amounts: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }>
  ): {
    originalText: string;
    normalizedAmount: number;
    currency: string;
    confidence: number;
    context?: string;
  } {
    if (amounts.length === 0) {
      throw new Error('没有可用的金额');
    }

    return amounts.sort((a, b) => b.confidence - a.confidence)[0];
  }

  /**
   * 批量标准化金额
   */
  async normalizeBatch(amounts: string[]): Promise<number[]> {
    const results: number[] = [];

    for (const amount of amounts) {
      const normalized = await this.normalizeAmountString(amount);
      results.push(normalized);
    }

    return results;
  }

  /**
   * 检查金额是否合理
   */
  isAmountReasonable(amount: number, currency: string = 'CNY'): boolean {
    // 金额必须大于0
    if (amount <= 0) return false;

    // 检查金额范围（根据货币类型）
    const maxAmounts: { [key: string]: number } = {
      CNY: 100000000, // 1亿人民币
      USD: 10000000, // 1千万美元
      EUR: 10000000, // 1千万欧元
      HKD: 100000000, // 1亿港币
    };

    const max = maxAmounts[currency] || maxAmounts.CNY;
    return amount <= max;
  }

  /**
   * 格式化金额用于显示
   */
  formatAmount(amount: number, currency: string = 'CNY'): string {
    const formatted = amount.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const currencySymbols: { [key: string]: string } = {
      CNY: '¥',
      USD: '$',
      EUR: '€',
      GBP: '£',
      HKD: 'HK$',
    };

    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${formatted}`;
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认金额提取器实例
 */
export function createAmountExtractor(): AmountExtractor {
  return new AmountExtractor();
}

/**
 * 从文本中快速提取单个最佳金额
 */
export async function extractBestAmount(
  text: string,
  currency?: string
): Promise<{ amount: number; currency: string; confidence: number } | null> {
  const extractor = createAmountExtractor();
  const result = await extractor.extractFromText(text, { currency });

  if (result.amounts.length === 0) {
    return null;
  }

  const best = result.amounts.sort((a, b) => b.confidence - a.confidence)[0];

  return {
    amount: best.normalizedAmount,
    currency: best.currency,
    confidence: best.confidence,
  };
}
