'use strict';
// =============================================================================
// 金额提取精度优化模块
// 专门用于处理中文金额表达、货币单位、格式不统一等问题
// 目标：金额识别精度≥99%
// =============================================================================
Object.defineProperty(exports, '__esModule', { value: true });
exports.PrecisionAmountExtractor = void 0;
class PrecisionAmountExtractor {
  constructor() {
    this.amountPatterns = {
      // 阿拉伯数字模式
      arabicNumbers: [
        /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:元|圆|￥|人民币|CNY|USD|\$)/gi,
        /(\d+(?:\.\d{1,2})?)\s*(?:万|万千)/gi,
        /(\d+)\s*(?:元|圆|块)/gi,
      ],
      // 中文大写数字模式
      chineseNumbers: [
        /([零壹贰叁肆伍陆柒捌玖拾佰仟万亿]+(?:\s*(?:元|圆|整)))/gi,
        /([零壹贰叁肆伍陆柒捌玖拾佰仟万]+(?:\s*(?:万|千)))/gi,
        /([壹贰叁肆伍陆柒捌玖]+(?:\s*(?:拾|百|千)))/gi,
      ],
      // 混合格式
      mixedFormats: [
        /(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*元\s*[（(][零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元整角分]+[）)]/gi,
        /人民币\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*元/gi,
        /([零壹贰叁肆伍陆柒捌玖拾佰仟万亿]+)\s*元(?:\s*[整]?)/gi,
      ],
    };
    this.chineseNumberMap = {
      零: 0,
      〇: 0,
      一: 1,
      壹: 1,
      弌: 1,
      幺: 1,
      二: 2,
      贰: 2,
      貳: 2,
      两: 2,
      俩: 2,
      三: 3,
      叁: 3,
      参: 3,
      叄: 3,
      四: 4,
      肆: 4,
      䦲: 4,
      五: 5,
      伍: 5,
      仵: 5,
      六: 6,
      陆: 6,
      陸: 6,
      七: 7,
      柒: 7,
      漆: 7,
      八: 8,
      捌: 8,
      扒: 8,
      九: 9,
      玖: 9,
      玫: 9,
      十: 10,
      拾: 10,
      什: 10,
      百: 100,
      佰: 100,
      陌: 100,
      千: 1000,
      仟: 1000,
      阡: 1000,
      万: 10000,
      萬: 10000,
      亿: 100000000,
      億: 100000000,
      乙: 100000000,
    };
    this.currencyMap = {
      元: 'CNY',
      圆: 'CNY',
      人民币: 'CNY',
      '￥': 'CNY',
      CNY: 'CNY',
      RMB: 'CNY',
      美元: 'USD',
      USD: 'USD',
      $: 'USD',
      港币: 'HKD',
      港元: 'HKD',
      HK$: 'HKD',
      欧元: 'EUR',
      EUR: 'EUR',
      '€': 'EUR',
      英镑: 'GBP',
      GBP: 'GBP',
      '£': 'GBP',
    };
  }
  /**
   * 精确提取金额信息
   */
  async extractWithPrecision(text) {
    const results = [];
    // 第一步：多模式匹配
    const regexMatches = this.extractWithRegex(text);
    const chineseMatches = this.extractChineseNumbers(text);
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
   * 正则表达式提取
   */
  extractWithRegex(text) {
    const results = [];
    for (const patternGroup of Object.values(this.amountPatterns)) {
      for (const pattern of patternGroup) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match && match[0]) {
            const result = {
              originalText: match[0],
              normalizedAmount: 0,
              currency: 'CNY',
              confidence: 0.8,
              extractionMethod: 'regex',
              processingNotes: [],
            };
            // 尝试解析数字部分
            const numberPart = match[1] || match[0];
            result.normalizedAmount = this.parseNumericString(numberPart);
            result.currency = this.extractCurrency(match[0]);
            if (result.normalizedAmount > 0) {
              results.push(result);
            }
          }
        }
      }
    }
    return results;
  }
  /**
   * 中文数字提取
   */
  extractChineseNumbers(text) {
    const results = [];
    // 匹配连续的中文数字
    const chinesePattern = /[零壹贰叁肆伍陆柒捌玖拾佰仟万亿圆元整角分]+/g;
    const matches = text.match(chinesePattern);
    if (matches) {
      for (const match of matches) {
        const result = {
          originalText: match,
          normalizedAmount: 0,
          currency: 'CNY',
          confidence: 0.9,
          extractionMethod: 'regex',
          processingNotes: ['中文数字识别'],
        };
        result.normalizedAmount = this.convertChineseToNumber(match);
        result.currency = this.extractCurrency(match);
        if (result.normalizedAmount > 0) {
          results.push(result);
        }
      }
    }
    return results;
  }
  /**
   * 混合格式提取
   */
  extractMixedFormats(text) {
    const results = [];
    for (const pattern of this.amountPatterns.mixedFormats) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match && match[0]) {
          const result = {
            originalText: match[0],
            normalizedAmount: 0,
            currency: 'CNY',
            confidence: 0.85,
            extractionMethod: 'regex',
            processingNotes: ['混合格式解析'],
          };
          // 提取数字部分
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
   * 中文数字转换为阿拉伯数字
   */
  convertChineseToNumber(chineseStr) {
    let result = 0;
    let temp = 0;
    let section = 0;
    for (let i = 0; i < chineseStr.length; i++) {
      const char = chineseStr[i];
      const num = this.chineseNumberMap[char];
      if (num !== undefined) {
        if (num >= 10) {
          // 万、亿等单位
          if (section === 0) {
            section = 1;
          }
          result += temp * num;
          temp = 0;
        } else {
          // 个位数
          temp = temp * 10 + num;
          section = 0;
        }
      }
    }
    result += temp;
    return result;
  }
  /**
   * 解析数字字符串
   */
  parseNumericString(str) {
    // 移除非数字字符
    const cleanStr = str.replace(/[^\d.]/g, '');
    if (cleanStr.includes('.')) {
      return parseFloat(cleanStr);
    } else {
      return parseInt(cleanStr, 10);
    }
  }
  /**
   * 提取货币单位
   */
  extractCurrency(text) {
    for (const [key, currency] of Object.entries(this.currencyMap)) {
      if (text.includes(key)) {
        return currency;
      }
    }
    return 'CNY'; // 默认人民币
  }
  /**
   * 合并和去重
   */
  mergeAndDeduplicate(matches) {
    const seen = new Set();
    const results = [];
    for (const match of matches) {
      const key = `${match.originalText}_${match.normalizedAmount}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(match);
      }
    }
    return results;
  }
  /**
   * 验证和标准化
   */
  validateAndNormalize(match) {
    // 金额合理性检查
    if (match.normalizedAmount <= 0) {
      match.processingNotes.push('金额必须大于0');
      return null;
    }
    if (match.normalizedAmount > 1000000000) {
      // 超过1000万
      match.processingNotes.push('金额异常大，需要验证');
      match.confidence = Math.min(match.confidence, 0.6);
    }
    // 单位标准化
    if (match.currency === 'CNY') {
      // 检查是否是万元单位
      if (match.originalText.includes('万')) {
        match.normalizedAmount *= 10000;
        match.processingNotes.push('万元单位已转换为元');
      }
    }
    return match;
  }
  /**
   * 上下文验证
   */
  contextualValidation(results, fullText) {
    const validatedResults = [];
    for (const result of results) {
      // 查找金额在原文中的上下文
      const context = this.extractContext(result.originalText, fullText);
      // 检查是否在法律相关的上下文中
      const isInLegalContext = this.isInLegalContext(context);
      if (isInLegalContext) {
        result.confidence = Math.min(result.confidence + 0.1, 1.0);
        result.processingNotes.push('法律上下文验证通过');
      } else {
        result.confidence = Math.max(result.confidence - 0.2, 0.3);
        result.processingNotes.push('法律上下文验证未通过');
      }
      validatedResults.push(result);
    }
    return validatedResults.sort((a, b) => b.confidence - a.confidence);
  }
  /**
   * 提取上下文
   */
  extractContext(target, fullText) {
    const index = fullText.indexOf(target);
    if (index === -1) return '';
    const start = Math.max(0, index - 50);
    const end = Math.min(fullText.length, index + target.length + 50);
    return fullText.substring(start, end);
  }
  /**
   * 检查是否在法律上下文中
   */
  isInLegalContext(context) {
    const legalKeywords = [
      '诉讼',
      '请求',
      '判令',
      '支付',
      '偿还',
      '赔偿',
      '违约',
      '利息',
      '本金',
      '费用',
      '损失',
      '合同',
      '义务',
      '责任',
      '金额',
    ];
    return legalKeywords.some(keyword => context.includes(keyword));
  }
  /**
   * 验证金额一致性
   */
  validateAmountConsistency(amounts) {
    const inconsistencies = [];
    const suggestions = [];
    // 检查重复金额
    const uniqueAmounts = new Set();
    const duplicates = [];
    for (const amount of amounts) {
      if (uniqueAmounts.has(amount.normalizedAmount)) {
        duplicates.push(amount.normalizedAmount);
      } else {
        uniqueAmounts.add(amount.normalizedAmount);
      }
    }
    if (duplicates.length > 0) {
      inconsistencies.push(`发现重复金额: ${duplicates.join(', ')}`);
      suggestions.push('检查是否为同一金额的不同表达方式');
    }
    // 检查金额范围合理性
    for (const amount of amounts) {
      if (amount.normalizedAmount < 0.01) {
        inconsistencies.push(`金额过小: ${amount.normalizedAmount}`);
        suggestions.push('检查金额单位是否正确');
      }
      if (amount.normalizedAmount > 100000000) {
        inconsistencies.push(`金额异常大: ${amount.normalizedAmount}`);
        suggestions.push('验证大额金额的合理性');
      }
    }
    // 检查货币单位一致性
    const currencies = new Set(amounts.map(a => a.currency));
    if (currencies.size > 1) {
      inconsistencies.push(
        `多种货币单位: ${Array.from(currencies).join(', ')}`
      );
      suggestions.push('统一货币单位或进行汇率转换');
    }
    // 计算风险等级
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
  calculateRiskLevel(inconsistencies, totalAmounts) {
    const inconsistencyRatio =
      inconsistencies.length / Math.max(totalAmounts, 1);
    if (inconsistencyRatio === 0) return 'low';
    if (inconsistencyRatio <= 0.3) return 'medium';
    return 'high';
  }
  /**
   * 获取最佳金额提取结果
   */
  getBestExtraction(results) {
    if (results.length === 0) return null;
    // 按置信度排序，选择最高且合理的金额
    const sortedResults = results.sort((a, b) => {
      // 优先考虑置信度
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      // 置信度相同时，选择更精确的提取方法
      if (
        a.extractionMethod === 'ai_confirmed' &&
        b.extractionMethod !== 'ai_confirmed'
      ) {
        return -1;
      }
      if (
        b.extractionMethod === 'ai_confirmed' &&
        a.extractionMethod !== 'ai_confirmed'
      ) {
        return 1;
      }
      // 最后选择绝对值较大的（通常更可能是主要金额）
      return b.normalizedAmount - a.normalizedAmount;
    });
    return sortedResults[0];
  }
  /**
   * 生成金额提取报告
   */
  generateExtractionReport(results) {
    if (results.length === 0) {
      return '未检测到金额信息';
    }
    const best = this.getBestExtraction(results);
    const validation = this.validateAmountConsistency(results);
    let report = '金额提取报告\n';
    report += '===================\n';
    if (best) {
      report += `最佳提取结果: ${best.originalText} → ${best.normalizedAmount} ${best.currency}\n`;
      report += `置信度: ${(best.confidence * 100).toFixed(1)}%\n`;
      report += `提取方法: ${best.extractionMethod}\n`;
      if (best.processingNotes.length > 0) {
        report += `处理说明: ${best.processingNotes.join(', ')}\n`;
      }
    }
    report += '\n验证结果:\n';
    report += `有效性: ${validation.isValid ? '✅ 通过' : '❌ 存在问题'}\n`;
    report += `风险等级: ${validation.riskLevel}\n`;
    if (validation.inconsistencies.length > 0) {
      report += '发现的问题:\n';
      validation.inconsistencies.forEach(issue => {
        report += `  - ${issue}\n`;
      });
    }
    if (validation.suggestions.length > 0) {
      report += '建议:\n';
      validation.suggestions.forEach(suggestion => {
        report += `  - ${suggestion}\n`;
      });
    }
    return report;
  }
}
exports.PrecisionAmountExtractor = PrecisionAmountExtractor;
