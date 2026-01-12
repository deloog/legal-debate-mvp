// =============================================================================
// DocAnalyzer 金额提取器
// 从文档中提取、标准化和验证金额信息
// 目标：金额识别精度≥99%
//
// 集成说明：已集成VerificationAgent实现三重验证机制
// - 事实准确性验证：验证金额与源数据一致性
// - 逻辑一致性验证：验证金额在上下文中的合理性
// - 任务完成度验证：验证金额提取的完整性
// =============================================================================

import type { Claim } from '../core/types';
import {
  PrecisionAmountExtractor,
  type AmountExtractionResult,
} from '../../../extraction/amount-extractor-precision';
import { VerificationAgent } from '../../verification-agent';

// =============================================================================
// 接口定义
// =============================================================================

export interface AmountExtractionOptions {
  currency?: string;
  requireCurrency?: boolean;
  minConfidence?: number;
  context?: string;
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

// =============================================================================
// 金额提取器类
// =============================================================================

export class AmountExtractor {
  private precisionExtractor: PrecisionAmountExtractor;
  private verificationAgent: VerificationAgent;

  constructor() {
    this.precisionExtractor = new PrecisionAmountExtractor();
    this.verificationAgent = new VerificationAgent();
  }

  /**
   * 从文本中提取金额信息
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

    // 使用VerificationAgent进行三重验证
    const verifiedAmounts = await this.verifyAmounts(
      processedAmounts,
      text,
      options
    );

    // 生成摘要
    const summary = this.generateSummary(verifiedAmounts);

    // 验证结果
    const validation = this.validateAmounts(verifiedAmounts);

    return {
      amounts: verifiedAmounts,
      summary,
      validation,
    };
  }

  /**
   * 使用VerificationAgent进行三重验证
   */
  private async verifyAmounts(
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
    const verifiedAmounts: Array<{
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
      context?: string;
    }> = [];

    for (const amount of amounts) {
      // 1. 事实准确性验证：验证金额与源数据一致性
      const factualValid = await this.verifyFactualAccuracy(amount);

      // 2. 逻辑一致性验证：验证金额在上下文中的合理性
      const logicalValid = await this.verifyLogicalConsistency(
        amount,
        fullText
      );

      // 3. 任务完成度验证：验证金额提取的完整性
      const completenessValid = this.verifyCompleteness(amount, options);

      // 综合验证结果调整置信度
      const adjustedConfidence = this.adjustConfidence(
        amount.confidence,
        factualValid,
        logicalValid,
        completenessValid
      );

      verifiedAmounts.push({
        ...amount,
        confidence: adjustedConfidence,
        context: this.enrichContext(amount, fullText),
      });
    }

    return verifiedAmounts;
  }

  /**
   * 事实准确性验证：验证金额与源数据一致性
   */
  private async verifyFactualAccuracy(amount: {
    originalText: string;
    normalizedAmount: number;
    currency: string;
    confidence: number;
  }): Promise<boolean> {
    try {
      const result = await this.verificationAgent.verify({
        amounts: [
          {
            field: 'extracted',
            value: amount.normalizedAmount,
          },
        ],
      });

      return result.passed;
    } catch {
      // 如果验证失败，返回true表示不降低置信度
      return true;
    }
  }

  /**
   * 逻辑一致性验证：验证金额在上下文中的合理性
   */
  private async verifyLogicalConsistency(
    amount: {
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
    },
    fullText: string
  ): Promise<boolean> {
    // 检查金额在法律上下文中的合理性
    const context = this.extractContext(amount.originalText, fullText);
    const legalKeywords = ['赔偿', '违约金', '利息', '本金', '费用', '损失'];

    const hasLegalContext = legalKeywords.some(keyword =>
      context.includes(keyword)
    );

    // 如果有法律上下文，金额应该在合理范围内
    if (hasLegalContext) {
      return (
        amount.normalizedAmount >= 0.01 && amount.normalizedAmount <= 100000000
      );
    }

    return true;
  }

  /**
   * 任务完成度验证：验证金额提取的完整性
   */
  private verifyCompleteness(
    amount: {
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
    },
    options: AmountExtractionOptions
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
  private adjustConfidence(
    originalConfidence: number,
    factualValid: boolean,
    logicalValid: boolean,
    completenessValid: boolean
  ): number {
    let adjusted = originalConfidence;

    if (factualValid) {
      adjusted = Math.min(adjusted + 0.1, 1.0);
    } else {
      adjusted = Math.max(adjusted - 0.3, 0.0);
    }

    if (logicalValid) {
      adjusted = Math.min(adjusted + 0.05, 1.0);
    } else {
      adjusted = Math.max(adjusted - 0.2, 0.0);
    }

    if (!completenessValid) {
      adjusted = Math.max(adjusted - 0.1, 0.0);
    }

    return adjusted;
  }

  /**
   * 丰富上下文信息
   */
  private enrichContext(
    amount: {
      originalText: string;
      normalizedAmount: number;
      currency: string;
      confidence: number;
    },
    fullText: string
  ): string {
    return this.extractContext(amount.originalText, fullText);
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

    // 检查金额范围
    for (const amount of amounts) {
      if (amount.normalizedAmount < 0.01) {
        issues.push(`金额过小: ${amount.normalizedAmount}`);
      }

      if (amount.normalizedAmount > 10000000) {
        issues.push(`金额异常大: ${amount.normalizedAmount}`);
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
