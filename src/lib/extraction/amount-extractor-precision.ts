// =============================================================================
// 金额提取精度优化模块（重构版）
// 专门用于处理中文金额表达、货币单位、格式不统一等问题
// 目标：金额识别精度≥99%
//
// 重构说明：原文件已拆分为多个模块以符合.clinerules规范（≤500行）
// - amount-extractor-core.ts: 核心提取逻辑
// - chinese-number-converter.ts: 中文数字转换
// - amount-patterns.ts: 正则表达式模式
// - amount-validator.ts: 金额验证
// =============================================================================

import { AmountExtractorCore } from "./amount-extractor-core";
import { ChineseNumberConverter } from "./chinese-number-converter";
import {
  AmountValidator,
  type AmountExtractionResult,
  type AmountValidationResult,
} from "./amount-validator";

/**
 * 精度金额提取器（兼容原API的包装类）
 */
export class PrecisionAmountExtractor {
  private core: AmountExtractorCore;
  private chineseConverter: ChineseNumberConverter;
  private validator: AmountValidator;

  constructor() {
    this.core = new AmountExtractorCore();
    this.chineseConverter = new ChineseNumberConverter();
    this.validator = new AmountValidator();
  }

  /**
   * 精确提取金额信息
   */
  async extractWithPrecision(text: string): Promise<AmountExtractionResult[]> {
    return this.core.extractWithPrecision(text);
  }

  /**
   * 提取中文大写数字（公共方法）
   */
  extractChineseNumbers(text: string): number | null {
    return this.chineseConverter.convertToNumber(text);
  }

  /**
   * 验证金额一致性
   */
  validateAmountConsistency(
    amounts: AmountExtractionResult[],
  ): AmountValidationResult {
    return this.validator.validateAmountConsistency(amounts);
  }

  /**
   * 获取最佳金额提取结果
   */
  getBestExtraction(
    results: AmountExtractionResult[],
  ): AmountExtractionResult | null {
    return this.core.getBestExtraction(results);
  }

  /**
   * 生成金额提取报告
   */
  generateExtractionReport(results: AmountExtractionResult[]): string {
    return this.core.generateExtractionReport(results);
  }
}

// 导出类型
export type { AmountExtractionResult, AmountValidationResult };
