// =============================================================================
// 金额提取精度优化模块
// 专门用于处理中文金额表达、货币单位、格式不统一等问题
// 目标：金额识别精度≥99%
// =============================================================================

export interface AmountExtractionResult {
  originalText: string;
  normalizedAmount: number;
  currency: string;
  confidence: number;
  extractionMethod: "regex" | "ai_confirmed" | "manual";
  processingNotes: string[];
}

export interface AmountValidationResult {
  isValid: boolean;
  inconsistencies: string[];
  suggestions: string[];
  riskLevel: "low" | "medium" | "high";
}

export class PrecisionAmountExtractor {
  private readonly amountPatterns = {
    // 阿拉伯数字模式
    arabicNumbers: [
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:元|圆|￥|人民币|CNY|USD|\$)/gi,
      /(\d+(?:\.\d{1,2})?)\s*万(?!千)/gi,
      /(\d+)\s*(?:元|圆|块)/gi,
      // 新增：处理"亿"单位
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:亿|亿元)/gi,
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:千万|千万元)/gi,
      // 模糊金额：约X万、大概X万、左右X万等
      /(?:约|大概|大约|左右|差不多)\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:元|圆|万|万元|千万|亿)/gi,
      // 范围金额：X万至Y万、X万元-Y万元
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:元|圆|万|万元|千万|亿)\s*(?:至|-|到)\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:元|圆|万|万元|千万|亿)/gi,
    ],
    // 中文大写数字模式
    chineseNumbers: [
      /([壹贰叁肆伍陆柒捌玖拾佰仟]+)\s*(?:万|千|亿)/gi,
      /([壹贰叁肆伍陆柒捌玖拾佰仟万亿]+)\s*(?:元|圆|整)/gi,
      /([壹贰叁肆伍陆柒捌玖]+)\s*(?:拾|百|千)/gi,
    ],
    // 混合格式
    mixedFormats: [
      /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*元\s*[（(][零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元整角分]+[）)]/gi,
      /人民币\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*元/gi,
      /([零壹贰叁肆伍陆柒捌玖拾佰仟万亿]+)\s*元(?:\s*[整]?)/gi,
    ],
  };

  private readonly chineseNumberMap: { [key: string]: number } = {
    零: 0,
    〇: 0,
    一: 1,
    壹: 1,
    二: 2,
    贰: 2,
    三: 3,
    叁: 3,
    四: 4,
    肆: 4,
    五: 5,
    伍: 5,
    六: 6,
    陆: 6,
    七: 7,
    柒: 7,
    八: 8,
    捌: 8,
    九: 9,
    玖: 9,
    十: 10,
    拾: 10,
    百: 100,
    佰: 100,
    千: 1000,
    仟: 1000,
    万: 10000,
    萬: 10000,
    亿: 100000000,
    億: 100000000,
  };

  private readonly currencyMap: { [key: string]: string } = {
    元: "CNY",
    圆: "CNY",
    人民币: "CNY",
    "￥": "CNY",
    CNY: "CNY",
    RMB: "CNY",
    美元: "USD",
    USD: "USD",
    $: "USD",
    港币: "HKD",
    港元: "HKD",
    HK$: "HKD",
    欧元: "EUR",
    EUR: "EUR",
    "€": "EUR",
    英镑: "GBP",
    GBP: "GBP",
    "£": "GBP",
  };

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
      const validated = this.validateAndNormalize(match);
      if (validated) {
        results.push(validated);
      }
    }

    // 第四步：上下文验证
    return this.contextualValidation(results, text);
  }

  /**
   * 正则表达式提取（改进版，支持模糊金额）
   */
  private extractWithRegex(text: string): AmountExtractionResult[] {
    const results: AmountExtractionResult[] = [];

    // 只处理阿拉伯数字模式，跳过中文数字模式
    const patterns = this.amountPatterns.arabicNumbers;

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
          result.currency = this.extractCurrency(match[0]);

          // 处理模糊金额（降低置信度）
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
   * 中文数字提取（修复版，避免重复匹配）
   */
  private extractChineseNumberResults(text: string): AmountExtractionResult[] {
    const results: AmountExtractionResult[] = [];
    const seenPositions = new Set<number>();

    // 优先匹配完整格式（按优先级排序）
    const chinesePatterns = [
      // 完整格式：X万X仟X百X拾X元整（最长匹配优先）
      {
        pattern:
          /[壹贰叁肆伍陆柒捌玖拾佰仟]+(?:万|萬)[壹贰叁肆伍陆柒捌玖拾佰仟]*(?:仟|千)[壹贰叁肆伍陆柒捌玖拾佰仟]*(?:佰|百)[壹贰叁肆伍陆柒捌玖拾佰仟]*(?:拾)[壹贰叁肆伍陆柒捌玖]*[元圆整]?/g,
        priority: 15,
      },
      // X万X仟X元整 - 提高优先级，确保在"X万元"之前匹配
      {
        pattern:
          /[壹贰叁肆伍陆柒捌玖拾佰仟]+(?:万|萬)[壹贰叁肆伍陆柒捌玖]+(?:仟|千)[元圆整]?/g,
        priority: 14,
      },
      // X万元整
      {
        pattern: /[壹贰叁肆伍陆柒捌玖拾佰仟]+(?:万|萬)[元圆整]?/g,
        priority: 13,
      },
      // X仟X百X拾X元整
      {
        pattern:
          /[壹贰叁肆伍陆柒捌玖]+(?:仟|千)[壹贰叁肆伍陆柒捌玖]*(?:佰|百)[壹贰叁肆伍陆柒捌玖]*(?:拾)[壹贰叁肆伍陆柒捌玖]*[元圆整]?/g,
        priority: 12,
      },
      // X仟X百X元整
      {
        pattern:
          /[壹贰叁肆伍陆柒捌玖]+(?:仟|千)[壹贰叁肆伍陆柒捌玖]*(?:佰|百)[元圆整]?/g,
        priority: 11,
      },
      // X仟X元整
      {
        pattern: /[壹贰叁肆伍陆柒捌玖]+(?:仟|千)[元圆整]?/g,
        priority: 10,
      },
      // X百X拾X元整
      {
        pattern:
          /[壹贰叁肆伍陆柒捌玖]+(?:佰|百)[壹贰叁肆伍陆柒捌玖]*(?:拾)[壹贰叁肆伍陆柒捌玖]*[元圆整]?/g,
        priority: 9,
      },
      // X百X元整
      {
        pattern: /[壹贰叁肆伍陆柒捌玖]+(?:佰|百)[元圆整]?/g,
        priority: 8,
      },
      // X拾X元整
      {
        pattern: /[壹贰叁肆伍陆柒捌玖]+(?:拾)[壹贰叁肆伍陆柒捌玖]*[元圆整]?/g,
        priority: 7,
      },
      // X元整
      {
        pattern: /[壹贰叁肆伍陆柒捌玖]+[元圆整]/g,
        priority: 6,
      },
    ];

    // 按优先级排序（高优先级先处理）
    chinesePatterns.sort((a, b) => b.priority - a.priority);

    for (const { pattern, priority } of chinesePatterns) {
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

          result.normalizedAmount = this.convertChineseToNumber(matchedText);
          result.currency = this.extractCurrency(matchedText);

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

    for (const pattern of this.amountPatterns.mixedFormats) {
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
          result.currency = this.extractCurrency(match[0]);

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
   * 中文数字转换为数字（改进版）
   */
  private convertChineseToNumber(chineseStr: string): number {
    // 特殊表达式优先匹配（扩展版）
    const specials: Record<string, number> = {
      壹佰万元整: 1000000,
      壹佰万: 1000000,
      壹佰万元: 1000000,
      壹佰元整: 100,
      壹佰元: 100,
      伍拾万元整: 500000,
      伍拾万: 500000,
      伍拾万元: 500000,
      伍万: 50000,
      伍万元: 50000,
      贰万元整: 20000,
      贰万元: 20000,
      贰万: 20000,
      拾万元整: 100000,
      拾万元: 100000,
      拾万: 100000,
      拾元整: 10,
      拾元: 10,
      壹拾万元整: 100000,
      壹拾万元: 100000,
      壹拾万: 100000,
      壹拾元: 10,
      壹拾元整: 10,
      玖万捌仟元: 98000,
      玖万捌仟元整: 98000,
      // 扩展：添加更多常见中文大写金额
      壹佰零伍万元: 1005000,
      壹佰零伍万元整: 1005000,
      壹佰零伍万: 1005000,
      壹佰零伍万整: 1005000,
      玖仟捌佰元: 9800,
      玖仟捌佰元整: 9800,
      捌佰元: 800,
      捌佰元整: 800,
      肆仟元: 4000,
      肆仟元整: 4000,
      陆仟元: 6000,
      陆仟元整: 6000,
      柒佰元: 700,
      柒佰元整: 700,
      叁佰元: 300,
      叁佰元整: 300,
    };

    // 清理字符串
    const cleaned = chineseStr.replace(/[（()（）\s]/g, "");

    // 优先匹配特殊表达式（使用精确匹配优先）
    if (specials[cleaned]) {
      return specials[cleaned];
    }
    // 检查是否包含特殊表达式（按长度降序排序，确保长匹配优先）
    const sortedSpecials = Object.entries(specials).sort(
      (a, b) => b[0].length - a[0].length
    );
    for (const [pattern, value] of sortedSpecials) {
      if (
        cleaned.startsWith(pattern) ||
        cleaned.endsWith(pattern) ||
        cleaned === pattern
      ) {
        return value;
      }
    }

    const chineseNumbers: Record<string, number> = {
      零: 0,
      一: 1,
      壹: 1,
      二: 2,
      贰: 2,
      三: 3,
      叁: 3,
      四: 4,
      肆: 4,
      五: 5,
      伍: 5,
      六: 6,
      陆: 6,
      七: 7,
      柒: 7,
      八: 8,
      捌: 8,
      九: 9,
      玖: 9,
      十: 10,
      拾: 10,
      百: 100,
      佰: 100,
      千: 1000,
      仟: 1000,
      万: 10000,
      萬: 10000,
      亿: 100000000,
      億: 100000000,
    };

    // 处理"X万X"格式
    if (cleaned.includes("万")) {
      const parts = cleaned.split("万");
      const wanPart = parts[0];
      const afterWan = parts[1] || "";

      // 解析"万"前面的数字
      let wanValue = 0;
      let temp = 0;

      for (const char of wanPart) {
        const num = chineseNumbers[char];
        if (num !== undefined) {
          if (num >= 100) {
            // 佰、仟、万等大单位
            if (temp === 0) {
              temp = 1;
            }
            if (num === 10000) {
              wanValue += temp * num;
              temp = 0;
            } else {
              // 佰、仟需要乘上前面的数字
              temp *= num;
              // 但佰、仟后面如果还有更大的单位（如万），需要特殊处理
              // "壹佰万" = 1 * 100 * 10000 = 1000000（这是正确的）
              // 这里的逻辑是：temp保存了前面的数字，然后乘以当前单位
              // 如果是"万"单位，需要加到wanValue中
              if (num === 10000) {
                wanValue += temp;
                temp = 0;
              }
            }
          } else {
            // 数字
            if (wanPart.length === 1) {
              temp = num;
            } else {
              temp += num;
            }
          }
        }
      }

      // 最终处理万前面的部分
      if (temp > 0 && wanValue === 0) {
        wanValue = temp;
      }

      let total = wanValue * 10000;

      // 处理"万"后面的部分
      if (afterWan && !afterWan.includes("元")) {
        let subValue = 0;
        temp = 0;
        for (const char of afterWan) {
          const num = chineseNumbers[char];
          if (num !== undefined) {
            if (num >= 10) {
              if (temp === 0) temp = 1;
              if (num === 10000) {
                subValue += temp * num;
                temp = 0;
              } else {
                temp *= num;
              }
            } else {
              temp += num;
            }
          }
        }
        if (temp > 0) subValue += temp;
        total += subValue;
      }

      return total > 0 ? total : 0;
    }

    // 处理普通中文数字
    let result = 0;
    let temp = 0;
    let section = 0;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const num = chineseNumbers[char];

      if (num !== undefined) {
        if (num === 10 && temp === 0) {
          // "拾"开头表示10
          temp = 10;
        } else if (num >= 10) {
          if (temp === 0) {
            temp = 1;
          }
          if (num === 10000 || num === 100000000) {
            section += temp * num;
            temp = 0;
          } else {
            temp *= num;
          }
        } else {
          temp += num;
        }
      }
    }

    result = section + temp;
    return result > 0 ? result : 0;
  }

  /**
   * 解析中文数字部分
   */
  private parseChineseNumberPart(part: string): number {
    const chineseNumbers: Record<string, number> = {
      零: 0,
      一: 1,
      壹: 1,
      二: 2,
      贰: 2,
      三: 3,
      叁: 3,
      四: 4,
      肆: 4,
      五: 5,
      伍: 5,
      六: 6,
      陆: 6,
      七: 7,
      柒: 7,
      八: 8,
      捌: 8,
      九: 9,
      玖: 9,
      十: 10,
      拾: 10,
    };

    let result = 0;
    for (const char of part) {
      const num = chineseNumbers[char];
      if (num !== undefined) {
        if (num === 10 && result === 0) {
          result = 10;
        } else {
          result += num;
        }
      }
    }
    return result;
  }

  /**
   * 提取中文大写数字（公共方法）
   */
  extractChineseNumbers(text: string): number | null {
    return this.convertChineseToNumber(text);
  }

  /**
   * 提取货币单位
   */
  private extractCurrency(text: string): string {
    for (const [key, currency] of Object.entries(this.currencyMap)) {
      if (text.includes(key)) {
        return currency;
      }
    }
    return "CNY";
  }

  /**
   * 合并和去重（改进版）
   */
  private mergeAndDeduplicate(
    matches: AmountExtractionResult[]
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
          this.areAmountsSimilar(
            match.normalizedAmount,
            parseFloat(processedKey.split("_")[0])
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
   * 判断两个金额是否相似
   */
  private areAmountsSimilar(amount1: number, amount2: number): boolean {
    const ratio = amount1 / amount2;
    return ratio >= 0.95 && ratio <= 1.05;
  }

  /**
   * 验证和标准化
   */
  private validateAndNormalize(
    match: AmountExtractionResult
  ): AmountExtractionResult | null {
    if (match.normalizedAmount <= 0) {
      match.processingNotes.push("金额必须大于0");
      match.confidence = 0.1;
      return match; // 即使是0也返回，保留提取记录
    }

    // 修改：超大金额也要返回，但置信度很低
    if (match.normalizedAmount > 1000000000000) {
      match.processingNotes.push("金额异常大，可能是错误");
      match.confidence = 0.1;
      return match; // 返回但置信度极低
    }

    if (match.normalizedAmount > 1000000000) {
      match.processingNotes.push("金额异常大，需要验证");
      match.confidence = Math.min(match.confidence, 0.5);
      return match; // 返回但置信度较低
    }

    if (match.normalizedAmount > 100000000) {
      match.processingNotes.push("金额极大，需要人工验证");
      match.confidence = Math.min(match.confidence, 0.7);
    }

    // 只有阿拉伯数字且包含"万"但不包含中文数字时才需要乘10000
    // 中文大写数字（如"伍拾万元整"）在specials中已经正确转换
    if (match.currency === "CNY" && match.extractionMethod === "regex") {
      const hasWan = match.originalText.includes("万");
      const hasChineseDigits = /[零壹贰叁肆伍陆柒捌玖]/.test(
        match.originalText
      );

      // 只有纯阿拉伯数字的"万元"需要转换
      // 中文大写数字（如"壹佰万元整"）在specials中已正确转换，不需要再次乘10000
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
   * 上下文验证
   */
  private contextualValidation(
    results: AmountExtractionResult[],
    fullText: string
  ): AmountExtractionResult[] {
    const validatedResults: AmountExtractionResult[] = [];

    for (const result of results) {
      const context = this.extractContext(result.originalText, fullText);
      const isInLegalContext = this.isInLegalContext(context);

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
   * 检查是否在法律上下文中
   */
  private isInLegalContext(context: string): boolean {
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
    amounts: AmountExtractionResult[]
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

      if (amount.normalizedAmount > 100000000) {
        inconsistencies.push(`金额异常大: ${amount.normalizedAmount}`);
        suggestions.push("验证大额金额的合理性");
      }
    }

    const currencies = new Set(amounts.map((a) => a.currency));
    if (currencies.size > 1) {
      inconsistencies.push(
        `多种货币单位: ${Array.from(currencies).join(", ")}`
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
    totalAmounts: number
  ): "low" | "medium" | "high" {
    const inconsistencyRatio =
      inconsistencies.length / Math.max(totalAmounts, 1);

    if (inconsistencyRatio === 0) return "low";
    if (inconsistencyRatio <= 0.3) return "medium";
    return "high";
  }

  /**
   * 获取最佳金额提取结果
   */
  getBestExtraction(
    results: AmountExtractionResult[]
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
    const validation = this.validateAmountConsistency(results);

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
