/**
 * 金额提取核心模块
 * 负责金额提取的主要逻辑
 */

import { chineseNumberPatterns, extractCurrency } from "./amount-patterns";
import { ChineseNumberConverter } from "./chinese-number-converter";
import {
  AmountValidator,
  type AmountExtractionResult,
} from "./amount-validator";

/**
 * 金额提取核心配置
 */
export interface AmountExtractorConfig {
  currency?: string;
  minConfidence?: number;
  enableContextValidation?: boolean;
}

/**
 * 金额提取核心类
 */
export class AmountExtractorCore {
  private chineseConverter: ChineseNumberConverter;
  private validator: AmountValidator;
  private config: AmountExtractorConfig;

  constructor(config?: AmountExtractorConfig) {
    this.config = {
      currency: "CNY",
      minConfidence: 0.5,
      enableContextValidation: true,
      ...config,
    };
    this.chineseConverter = new ChineseNumberConverter();
    this.validator = new AmountValidator();
  }

  /**
   * 精确提取金额信息
   */
  async extractWithPrecision(text: string): Promise<AmountExtractionResult[]> {
    const results: AmountExtractionResult[] = [];

    // 第一步：多模式匹配
    const regexMatches = this.extractWithRegex(text);
    const chineseMatches = this.extractChineseNumberResults(text);
    const mixedMatches = this.extractMixedFormats(text);

    // 第二步：去重和合并
    const allMatches = this.mergeAndDeduplicate([
      ...regexMatches,
      ...chineseMatches,
      ...mixedMatches,
    ]);

    // 第三步：验证和标准化
    for (const match of allMatches) {
      const validated = this.validator.validateAndNormalize(match);
      if (validated) {
        results.push(validated);
      }
    }

    // 第四步：上下文验证
    return this.config.enableContextValidation
      ? this.contextualValidation(results, text)
      : results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 正则表达式提取
   */
  private extractWithRegex(text: string): AmountExtractionResult[] {
    const results: AmountExtractionResult[] = [];

    const patterns = chineseNumberPatterns.arabicNumbers;

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match && match[0]) {
          const result: AmountExtractionResult = {
            originalText: match[0],
            normalizedAmount: 0,
            currency: "CNY",
            confidence: 0.8,
            extractionMethod: "regex",
            processingNotes: [],
          };

          const numberPart = match[1] || match[0];
          result.normalizedAmount = this.parseNumericString(numberPart);
          result.currency = extractCurrency(match[0]);

          // 处理模糊金额
          if (this.isFuzzyAmount(match[0])) {
            result.confidence = 0.6;
            result.processingNotes.push("模糊金额表达");
          }

          // 处理范围金额
          if (match[2]) {
            const num1 = this.parseNumericString(match[1]);
            const num2 = this.parseNumericString(match[2]);
            result.normalizedAmount = (num1 + num2) / 2;
            result.processingNotes.push(`范围金额：${num1}至${num2}，取平均值`);
            result.confidence = 0.7;
          }

          if (result.normalizedAmount > 0) {
            results.push(result);
          }
        }
      }
    }

    return results;
  }

  /**
   * 判断是否为模糊金额表达
   */
  private isFuzzyAmount(text: string): boolean {
    const fuzzyKeywords = [
      "约",
      "大概",
      "大约",
      "左右",
      "差不多",
      "接近",
      "近",
    ];
    return fuzzyKeywords.some((keyword) => text.includes(keyword));
  }

  /**
   * 中文数字提取
   */
  private extractChineseNumberResults(text: string): AmountExtractionResult[] {
    const results: AmountExtractionResult[] = [];
    const seenPositions = new Set<number>();

    // 按优先级排序
    const chinesePatterns = [...chineseNumberPatterns.chineseNumbers].sort(
      (a, b) => b.priority - a.priority,
    );

    for (const { pattern } of chinesePatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match && match[0] && match.index !== undefined) {
          const matchedText = match[0];

          // 跳过无效匹配
          if (
            matchedText === "万" ||
            matchedText === "万元" ||
            matchedText.length < 1
          ) {
            continue;
          }

          // 检查是否已被更高级别的匹配覆盖
          const startPos = match.index;
          const endPos = match.index + matchedText.length;

          let isOverlapped = false;
          for (let i = startPos; i < endPos; i++) {
            if (seenPositions.has(i)) {
              isOverlapped = true;
              break;
            }
          }

          if (isOverlapped) {
            continue;
          }

          // 标记这些位置已被使用
          for (let i = startPos; i < endPos; i++) {
            seenPositions.add(i);
          }

          const result: AmountExtractionResult = {
            originalText: matchedText,
            normalizedAmount: 0,
            currency: "CNY",
            confidence: 0.9,
            extractionMethod: "regex",
            processingNotes: ["中文数字识别"],
          };

          result.normalizedAmount =
            this.chineseConverter.convertToNumber(matchedText);
          result.currency = extractCurrency(matchedText);

          if (result.normalizedAmount > 0) {
            results.push(result);
          }
        }
      }
    }

    return results;
  }

  /**
   * 混合格式提取
   */
  private extractMixedFormats(text: string): AmountExtractionResult[] {
    const results: AmountExtractionResult[] = [];

    for (const pattern of chineseNumberPatterns.mixedFormats) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match && match[0]) {
          const result: AmountExtractionResult = {
            originalText: match[0],
            normalizedAmount: 0,
            currency: "CNY",
            confidence: 0.85,
            extractionMethod: "regex",
            processingNotes: ["混合格式解析"],
          };

          const numberPart = match[1];
          result.normalizedAmount = this.parseNumericString(numberPart);
          result.currency = extractCurrency(match[0]);

          if (result.normalizedAmount > 0) {
            results.push(result);
          }
        }
      }
    }

    return results;
  }

  /**
   * 解析数字字符串
   */
  private parseNumericString(str: string): number {
    const cleanStr = str.replace(/[^\d.,]/g, "");
    const noCommas = cleanStr.replace(/,/g, "");
    const num = parseFloat(noCommas);
    return isNaN(num) ? 0 : num;
  }

  /**
   * 合并和去重
   */
  private mergeAndDeduplicate(
    matches: AmountExtractionResult[],
  ): AmountExtractionResult[] {
    const seen = new Set<string>();
    const filtered1: AmountExtractionResult[] = [];

    for (const match of matches) {
      const key = `${match.originalText}_${match.normalizedAmount}`;
      if (!seen.has(key)) {
        seen.add(key);
        filtered1.push(match);
      }
    }

    const deduplicated: AmountExtractionResult[] = [];
    const processedAmounts = new Set<string>();

    for (const match of filtered1.sort((a, b) => b.confidence - a.confidence)) {
      const amountKey = this.getSimilarityKey(match.normalizedAmount);

      let hasSimilar = false;
      for (const processedKey of processedAmounts) {
        if (
          this.validator.areAmountsSimilar(
            match.normalizedAmount,
            parseFloat(processedKey.split("_")[0]),
          )
        ) {
          hasSimilar = true;
          break;
        }
      }

      if (!hasSimilar) {
        deduplicated.push(match);
        processedAmounts.add(amountKey);
      }
    }

    return deduplicated;
  }

  /**
   * 获取金额相似性key
   */
  private getSimilarityKey(amount: number): string {
    if (amount < 1000) {
      return `${amount.toFixed(0)}_small`;
    } else if (amount < 10000) {
      return `${Math.round(amount / 100) * 100}_thousand`;
    } else if (amount < 100000000) {
      return `${Math.round(amount / 10000) * 10000}_ten_thousand`;
    } else {
      return `${Math.round(amount / 100000000) * 100000000}_hundred_million`;
    }
  }

  /**
   * 上下文验证
   */
  private contextualValidation(
    results: AmountExtractionResult[],
    fullText: string,
  ): AmountExtractionResult[] {
    const validatedResults: AmountExtractionResult[] = [];

    for (const result of results) {
      const context = this.extractContext(result.originalText, fullText);
      const isInLegalContext = this.validator.isInLegalContext(context);

      if (isInLegalContext) {
        result.confidence = Math.min(result.confidence + 0.1, 1.0);
        result.processingNotes.push("法律上下文验证通过");
      } else {
        result.confidence = Math.max(result.confidence - 0.2, 0.3);
        result.processingNotes.push("法律上下文验证未通过");
      }

      validatedResults.push(result);
    }

    return validatedResults.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 提取上下文
   */
  private extractContext(target: string, fullText: string): string {
    const index = fullText.indexOf(target);
    if (index === -1) return "";

    const start = Math.max(0, index - 50);
    const end = Math.min(fullText.length, index + target.length + 50);

    return fullText.substring(start, end);
  }

  /**
   * 获取最佳金额提取结果
   */
  getBestExtraction(
    results: AmountExtractionResult[],
  ): AmountExtractionResult | null {
    if (results.length === 0) return null;

    const sortedResults = results.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      if (
        a.extractionMethod === "ai_confirmed" &&
        b.extractionMethod !== "ai_confirmed"
      ) {
        return -1;
      }
      if (
        b.extractionMethod === "ai_confirmed" &&
        a.extractionMethod !== "ai_confirmed"
      ) {
        return 1;
      }
      return b.normalizedAmount - a.normalizedAmount;
    });

    return sortedResults[0];
  }

  /**
   * 生成金额提取报告
   */
  generateExtractionReport(results: AmountExtractionResult[]): string {
    if (results.length === 0) {
      return "未检测到金额信息";
    }

    const best = this.getBestExtraction(results);
    const validation = this.validator.validateAmountConsistency(results);

    let report = "金额提取报告\n";
    report += "===================\n";

    if (best) {
      report += `最佳提取结果: ${best.originalText} → ${best.normalizedAmount} ${best.currency}\n`;
      report += `置信度: ${(best.confidence * 100).toFixed(1)}%\n`;
      report += `提取方法: ${best.extractionMethod}\n`;
      if (best.processingNotes.length > 0) {
        report += `处理说明: ${best.processingNotes.join(", ")}\n`;
      }
    }

    report += "\n验证结果:\n";
    report += `有效性: ${validation.isValid ? "✅ 通过" : "❌ 存在问题"}\n`;
    report += `风险等级: ${validation.riskLevel}\n`;

    if (validation.inconsistencies.length > 0) {
      report += "发现的问题:\n";
      validation.inconsistencies.forEach((issue) => {
        report += `  - ${issue}\n`;
      });
    }

    if (validation.suggestions.length > 0) {
      report += "建议:\n";
      validation.suggestions.forEach((suggestion) => {
        report += `  - ${suggestion}\n`;
      });
    }

    return report;
  }
}
