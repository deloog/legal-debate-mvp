/**
 * 金额验证模块
 * 负责金额的验证和标准化
 */

/**
 * 金额提取结果接口
 */
export interface AmountExtractionResult {
  originalText: string;
  normalizedAmount: number;
  currency: string;
  confidence: number;
  extractionMethod: "regex" | "ai_confirmed" | "manual";
  processingNotes: string[];
}

/**
 * 金额验证结果接口
 */
export interface AmountValidationResult {
  isValid: boolean;
  inconsistencies: string[];
  suggestions: string[];
  riskLevel: "low" | "medium" | "high";
}

/**
 * 金额验证器类
 */
export class AmountValidator {
  /**
   * 验证和标准化
   */
  validateAndNormalize(
    match: AmountExtractionResult,
  ): AmountExtractionResult | null {
    if (match.normalizedAmount <= 0) {
      match.processingNotes.push("金额必须大于0");
      match.confidence = 0.1;
      return match;
    }

    // 超大金额也要返回，但置信度很低
    if (match.normalizedAmount > 1000000000000) {
      match.processingNotes.push("金额异常大，可能是错误");
      match.confidence = 0.1;
      return match;
    }

    if (match.normalizedAmount > 1000000000) {
      match.processingNotes.push("金额异常大，需要验证");
      match.confidence = Math.min(match.confidence, 0.5);
      return match;
    }

    if (match.normalizedAmount > 10000000) {
      match.processingNotes.push("金额极大，需要人工验证");
      match.confidence = Math.min(match.confidence, 0.7);
    }

    // 只有阿拉伯数字且包含"万"但不包含中文数字时才需要乘10000
    if (match.currency === "CNY" && match.extractionMethod === "regex") {
      const hasWan = match.originalText.includes("万");
      const hasChineseDigits = /[零壹贰叁肆伍陆柒捌玖]/.test(
        match.originalText,
      );

      if (
        hasWan &&
        !hasChineseDigits &&
        !match.processingNotes.includes("中文数字识别")
      ) {
        match.normalizedAmount *= 10000;
        match.processingNotes.push("万元单位已转换为元");
      }
    }

    return match;
  }

  /**
   * 判断两个金额是否相似
   */
  areAmountsSimilar(amount1: number, amount2: number): boolean {
    const ratio = amount1 / amount2;
    return ratio >= 0.99 && ratio <= 1.01;
  }

  /**
   * 检查是否在法律上下文中
   */
  isInLegalContext(context: string): boolean {
    const legalKeywords = [
      "诉讼",
      "请求",
      "判令",
      "支付",
      "偿还",
      "赔偿",
      "违约",
      "利息",
      "本金",
      "费用",
      "损失",
      "合同",
      "义务",
      "责任",
      "金额",
    ];

    return legalKeywords.some((keyword) => context.includes(keyword));
  }

  /**
   * 验证金额一致性
   */
  validateAmountConsistency(
    amounts: AmountExtractionResult[],
  ): AmountValidationResult {
    const inconsistencies: string[] = [];
    const suggestions: string[] = [];

    const uniqueAmounts = new Set<number>();
    const duplicates: number[] = [];

    for (const amount of amounts) {
      if (uniqueAmounts.has(amount.normalizedAmount)) {
        duplicates.push(amount.normalizedAmount);
      } else {
        uniqueAmounts.add(amount.normalizedAmount);
      }
    }

    if (duplicates.length > 0) {
      inconsistencies.push(`发现重复金额: ${duplicates.join(", ")}`);
      suggestions.push("检查是否为同一金额的不同表达方式");
    }

    for (const amount of amounts) {
      if (amount.normalizedAmount < 0.01) {
        inconsistencies.push(`金额过小: ${amount.normalizedAmount}`);
        suggestions.push("检查金额单位是否正确");
      }

      if (amount.normalizedAmount > 10000000) {
        inconsistencies.push(`金额异常大: ${amount.normalizedAmount}`);
        suggestions.push("验证大额金额的合理性");
      }
    }

    const currencies = new Set(amounts.map((a) => a.currency));
    if (currencies.size > 1) {
      inconsistencies.push(
        `多种货币单位: ${Array.from(currencies).join(", ")}`,
      );
      suggestions.push("统一货币单位或进行汇率转换");
    }

    const riskLevel = this.calculateRiskLevel(inconsistencies, amounts.length);

    return {
      isValid: inconsistencies.length === 0,
      inconsistencies,
      suggestions,
      riskLevel,
    };
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(
    inconsistencies: string[],
    totalAmounts: number,
  ): "low" | "medium" | "high" {
    const inconsistencyRatio =
      inconsistencies.length / Math.max(totalAmounts, 1);

    if (inconsistencyRatio === 0) return "low";
    if (inconsistencyRatio <= 0.3) return "medium";
    return "high";
  }
}
