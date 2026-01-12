// =============================================================================
// 诉讼请求标准分类系统
// 建立标准分类体系，提高诉讼请求识别准确率≥95%
// 支持原子化拆解、分类映射、语义理解
// =============================================================================

import { PrecisionAmountExtractor } from '../extraction/amount-extractor-precision';

export enum LawsuitRequestType {
  // 金钱给付请求
  PAY_PRINCIPAL = 'PAY_PRINCIPAL', // 偿还本金
  PAY_INTEREST = 'PAY_INTEREST', // 支付利息
  PAY_PENALTY = 'PAY_PENALTY', // 违约金
  PAY_DAMAGES = 'PAY_DAMAGES', // 赔偿损失
  PAY_COMPENSATION = 'PAY_COMPENSATION', // 补偿款
  PAY_COSTS = 'PAY_COSTS', // 费用支出

  // 行为履行请求
  PERFORMANCE = 'PERFORMANCE', // 履行义务
  DELIVERY = 'DELIVERY', // 交付货物
  SERVICE = 'SERVICE', // 提供服务
  TRANSFER = 'TRANSFER', // 转移财产

  // 确认请求
  CONFIRMATION = 'CONFIRMATION', // 确认关系
  VALIDATION = 'VALIDATION', // 确认效力
  OWNERSHIP = 'OWNERSHIP', // 确认所有权

  // 形成请求
  TERMINATION = 'TERMINATION', // 解除合同
  CANCELLATION = 'CANCELLATION', // 撤销行为
  RESCISSION = 'RESCISSION', // 废除合同

  // 程序性请求
  LITIGATION_COST = 'LITIGATION_COST', // 诉讼费用
  ATTORNEY_FEES = 'ATTORNEY_FEES', // 律师费
  INTEREST_COST = 'INTEREST_COST', // 利息损失

  // 复合请求
  COMPOUND = 'COMPOUND', // 复合请求
  MULTIPLE = 'MULTIPLE', // 多项请求

  // 其他
  OTHER = 'OTHER',
}

export interface ClassificationRule {
  type: LawsuitRequestType;
  keywords: string[];
  patterns: RegExp[];
  priority: number;
  description: string;
  examples: string[];
}

export interface ClassifiedClaim {
  originalText: string;
  classifiedType: LawsuitRequestType;
  confidence: number;
  matchedKeywords: string[];
  matchedPatterns: string[];
  amount?: number;
  currency: string;
  description: string;
  evidence?: string[];
  legalBasis?: string;
  subClaims?: ClassifiedClaim[]; // 复合请求的子请求
}

export interface ClassificationResult {
  claims: ClassifiedClaim[];
  totalAmount?: number;
  currency: string;
  hasCompoundClaims: boolean;
  classificationConfidence: number;
  unclassifiedText: string[];
  warnings: string[];
}

export class LawsuitRequestClassifier {
  private readonly classificationRules: Map<
    LawsuitRequestType,
    ClassificationRule
  > = new Map();
  private readonly amountExtractor: PrecisionAmountExtractor;

  constructor() {
    this.amountExtractor = new PrecisionAmountExtractor();
    this.initializeClassificationRules();
  }

  /**
   * 初始化分类规则
   */
  private initializeClassificationRules(): void {
    const rules: ClassificationRule[] = [
      {
        type: LawsuitRequestType.PAY_PRINCIPAL,
        keywords: ['本金', '货款', '借款', '欠款', '价款', '购货款', '销售款'],
        patterns: [
          /偿还.*?本金/gi,
          /支付.*?本金/gi,
          /归还.*?本金/gi,
          /清偿.*?本金/gi,
          /支付.*?货款/gi,
        ],
        priority: 1,
        description: '请求对方支付本金或货款',
        examples: [
          '判令被告偿还借款本金50万元',
          '请求支付货款100万元',
          '要求归还本金80万元',
        ],
      },
      {
        type: LawsuitRequestType.PAY_INTEREST,
        keywords: ['利息', '罚息', '逾期利息', '违约利息', '迟延利息'],
        patterns: [
          /支付.*?利息/gi,
          /承担.*?利息/gi,
          /计算.*?利息/gi,
          /.*?年利率.*?%/gi,
          /.*?月利率.*?%/gi,
        ],
        priority: 2,
        description: '请求支付利息或利息损失',
        examples: [
          '支付自借款之日起至实际清偿之日止的利息',
          '按年利率6%计算利息',
          '承担逾期付款利息',
        ],
      },
      {
        type: LawsuitRequestType.PAY_PENALTY,
        keywords: ['违约金', '罚金', '滞纳金', '赔偿金', '违约责任'],
        patterns: [
          /支付.*?违约金/gi,
          /承担.*?违约金/gi,
          /赔偿.*?违约金/gi,
          /支付.*?罚金/gi,
        ],
        priority: 3,
        description: '请求支付违约金或罚金',
        examples: [
          '支付违约金10万元',
          '承担合同约定的违约金',
          '赔偿逾期付款违约金',
        ],
      },
      {
        type: LawsuitRequestType.PAY_DAMAGES,
        keywords: ['损失', '赔偿损失', '损害赔偿', '经济损失', '实际损失'],
        patterns: [
          /赔偿.*?损失/gi,
          /承担.*?损失/gi,
          /弥补.*?损失/gi,
          /赔偿.*?损害/gi,
        ],
        priority: 4,
        description: '请求赔偿损失或损害',
        examples: [
          '赔偿经济损失50万元',
          '承担实际损失30万元',
          '赔偿因违约造成的损失',
        ],
      },
      {
        type: LawsuitRequestType.LITIGATION_COST,
        keywords: ['诉讼费', '案件受理费', '保全费', '执行费', '费用'],
        patterns: [
          /承担.*?诉讼费/gi,
          /支付.*?诉讼费/gi,
          /负担.*?案件受理费/gi,
          /承担.*?保全费/gi,
        ],
        priority: 5,
        description: '请求承担诉讼相关费用',
        examples: [
          '由被告承担本案诉讼费用',
          '案件受理费由被告负担',
          '保全费由被申请人承担',
        ],
      },
      {
        type: LawsuitRequestType.PERFORMANCE,
        keywords: ['履行', '继续履行', '执行', '完成', '实施'],
        patterns: [
          /继续履行.*?合同/gi,
          /履行.*?义务/gi,
          /执行.*?合同/gi,
          /完成.*?义务/gi,
        ],
        priority: 6,
        description: '请求履行合同义务或特定义务',
        examples: [
          '继续履行商品房买卖合同',
          '履行交付房屋的义务',
          '执行合同约定的义务',
        ],
      },
      {
        type: LawsuitRequestType.TERMINATION,
        keywords: ['解除', '终止', '撤销', '废除', '无效'],
        patterns: [
          /解除.*?合同/gi,
          /终止.*?合同/gi,
          /撤销.*?合同/gi,
          /确认.*?合同.*?无效/gi,
        ],
        priority: 7,
        description: '请求解除或终止合同关系',
        examples: [
          '解除双方签订的买卖合同',
          '终止租赁合同关系',
          '确认劳动合同无效',
        ],
      },
      {
        type: LawsuitRequestType.CONFIRMATION,
        keywords: ['确认', '认定', '判定', '声明'],
        patterns: [
          /确认.*?关系/gi,
          /认定.*?事实/gi,
          /判定.*?权属/gi,
          /声明.*?权利/gi,
        ],
        priority: 8,
        description: '请求确认某种法律关系或事实',
        examples: [
          '确认原被告之间存在借贷关系',
          '认定房屋归原告所有',
          '确认商标权归属',
        ],
      },
    ];

    rules.forEach(rule => {
      this.classificationRules.set(rule.type, rule);
    });
  }

  /**
   * 分类诉讼请求
   */
  async classifyLawsuitRequests(
    requestText: string
  ): Promise<ClassificationResult> {
    const claims: ClassifiedClaim[] = [];
    const warnings: string[] = [];
    let totalAmount = 0;
    const currencies = new Set<string>();

    // 第一步：原子化拆解
    const atomicClaims = this.atomizeLawsuitRequests(requestText);

    // 第二步：逐个分类
    for (const claimText of atomicClaims) {
      const classified = await this.classifySingleClaim(claimText);
      if (classified) {
        claims.push(classified);
        if (classified.amount) {
          totalAmount += classified.amount;
          currencies.add(classified.currency);
        }
      } else {
        warnings.push(`无法分类的请求: ${claimText.substring(0, 50)}...`);
      }
    }

    // 第三步：处理复合请求
    const processedClaims = this.processCompoundClaims(claims);

    // 第四步：验证和清理
    const validation = this.validateClassification(
      processedClaims,
      requestText
    );

    // 第五步：计算整体置信度
    const overallConfidence = this.calculateOverallConfidence(processedClaims);

    return {
      claims: processedClaims,
      totalAmount: totalAmount > 0 ? totalAmount : undefined,
      currency: currencies.size === 1 ? Array.from(currencies)[0] : 'CNY',
      hasCompoundClaims: processedClaims.some(
        c => c.subClaims && c.subClaims.length > 0
      ),
      classificationConfidence: overallConfidence,
      unclassifiedText: validation.unclassifiedText,
      warnings: [...warnings, ...validation.warnings],
    };
  }

  /**
   * 原子化拆解诉讼请求
   */
  private atomizeLawsuitRequests(text: string): string[] {
    const claims: string[] = [];

    // 按标点符号拆分
    const sentences = text.split(/[；;。\n]/).filter(s => s.trim().length > 0);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();

      // 检查是否包含多个请求
      if (this.containsMultipleRequests(trimmed)) {
        // 进一步拆解
        const subClaims = this.extractSubRequests(trimmed);
        claims.push(...subClaims);
      } else {
        claims.push(trimmed);
      }
    }

    return claims;
  }

  /**
   * 检查是否包含多个请求
   */
  private containsMultipleRequests(text: string): boolean {
    const multipleIndicators = [
      /及.*?利息/,
      /并.*?违约金/,
      /加.*?赔偿/,
      /另.*?支付/,
      /同时.*?承担/,
      /以及.*?费用/,
    ];

    return multipleIndicators.some(pattern => pattern.test(text));
  }

  /**
   * 提取子请求
   */
  private extractSubRequests(text: string): string[] {
    const subClaims: string[] = [];

    // 使用连词拆解
    const connectors = ['及', '并', '加', '另', '同时', '以及', '且'];

    let remainingText = text;
    for (const connector of connectors) {
      if (remainingText.includes(connector)) {
        const parts = remainingText.split(connector);
        if (parts.length >= 2) {
          subClaims.push(parts[0].trim());
          remainingText = parts.slice(1).join(connector);
        }
      }
    }

    if (remainingText.trim()) {
      subClaims.push(remainingText.trim());
    }

    return subClaims;
  }

  /**
   * 分类单个请求
   */
  private async classifySingleClaim(
    claimText: string
  ): Promise<ClassifiedClaim | null> {
    const matchedTypes: {
      type: LawsuitRequestType;
      score: number;
      keywords: string[];
      patterns: string[];
    }[] = [];

    // 遍历所有分类规则
    for (const rule of this.classificationRules.values()) {
      let score = 0;
      const matchedKeywords: string[] = [];
      const matchedPatterns: string[] = [];

      // 关键词匹配
      for (const keyword of rule.keywords) {
        if (claimText.includes(keyword)) {
          score += 2;
          matchedKeywords.push(keyword);
        }
      }

      // 正则表达式匹配
      for (const pattern of rule.patterns) {
        if (pattern.test(claimText)) {
          score += 3;
          matchedPatterns.push(pattern.source);
        }
      }

      // 优先级加分
      score += (10 - rule.priority) * 0.1;

      if (score > 0) {
        matchedTypes.push({
          type: rule.type,
          score,
          keywords: matchedKeywords,
          patterns: matchedPatterns,
        });
      }
    }

    if (matchedTypes.length === 0) {
      return null;
    }

    // 选择得分最高的分类
    const bestMatch = matchedTypes.sort((a, b) => b.score - a.score)[0];
    const confidence = Math.min(bestMatch.score / 10, 1.0);

    // 提取金额
    const amountResults =
      await this.amountExtractor.extractWithPrecision(claimText);
    const bestAmount = this.amountExtractor.getBestExtraction(amountResults);

    return {
      originalText: claimText,
      classifiedType: bestMatch.type,
      confidence,
      matchedKeywords: bestMatch.keywords,
      matchedPatterns: bestMatch.patterns,
      amount: bestAmount?.normalizedAmount,
      currency: bestAmount?.currency || 'CNY',
      description: this.getClassificationDescription(bestMatch.type),
      evidence: [],
      legalBasis: '',
    };
  }

  /**
   * 处理复合请求
   */
  private processCompoundClaims(claims: ClassifiedClaim[]): ClassifiedClaim[] {
    const processedClaims: ClassifiedClaim[] = [];
    const compoundClaims: ClassifiedClaim[] = [];

    // 识别可能的复合请求
    for (let i = 0; i < claims.length; i++) {
      const current = claims[i];
      const next = claims[i + 1];

      if (this.shouldCombineClaims(current, next)) {
        // 创建复合请求
        const compoundClaim: ClassifiedClaim = {
          originalText: current.originalText + '；' + next.originalText,
          classifiedType: LawsuitRequestType.COMPOUND,
          confidence: (current.confidence + next.confidence) / 2,
          matchedKeywords: [
            ...current.matchedKeywords,
            ...next.matchedKeywords,
          ],
          matchedPatterns: [
            ...current.matchedPatterns,
            ...next.matchedPatterns,
          ],
          amount: (current.amount || 0) + (next.amount || 0),
          currency: current.currency,
          description: '复合请求，包含多个子请求',
          subClaims: [current, next],
        };

        compoundClaims.push(compoundClaim);
        i++; // 跳过下一个请求
      } else {
        processedClaims.push(current);
      }
    }

    // 添加最后一个请求（如果未被复合）
    if (claims.length > 0 && processedClaims.length < claims.length) {
      const lastClaim = claims[claims.length - 1];
      if (!compoundClaims.some(c => c.subClaims?.includes(lastClaim))) {
        processedClaims.push(lastClaim);
      }
    }

    return [...processedClaims, ...compoundClaims];
  }

  /**
   * 判断是否应该合并请求
   */
  private shouldCombineClaims(
    claim1: ClassifiedClaim,
    claim2: ClassifiedClaim
  ): boolean {
    // 同一原文中的连续请求
    if (
      !claim1.originalText.includes('；') &&
      !claim2.originalText.includes('；')
    ) {
      return false;
    }

    // 金钱相关请求可以合并
    const moneyTypes = [
      LawsuitRequestType.PAY_PRINCIPAL,
      LawsuitRequestType.PAY_INTEREST,
      LawsuitRequestType.PAY_PENALTY,
      LawsuitRequestType.PAY_DAMAGES,
    ];

    return (
      moneyTypes.includes(claim1.classifiedType) &&
      moneyTypes.includes(claim2.classifiedType)
    );
  }

  /**
   * 验证分类结果
   */
  private validateClassification(
    claims: ClassifiedClaim[],
    originalText: string
  ): { unclassifiedText: string[]; warnings: string[] } {
    const unclassifiedText: string[] = [];
    const warnings: string[] = [];

    // 检查是否有未分类的文本
    let remainingText = originalText;
    for (const claim of claims) {
      remainingText = remainingText.replace(claim.originalText, '');
    }

    const cleanRemaining = remainingText.replace(/[；;。\s]/g, '').trim();
    if (cleanRemaining.length > 10) {
      unclassifiedText.push(cleanRemaining);
    }

    // 检查金额一致性
    const amounts = claims.filter(c => c.amount && c.amount > 0);
    if (amounts.length > 1) {
      const currencies = new Set(amounts.map(a => a.currency));
      if (currencies.size > 1) {
        warnings.push('发现多种货币单位，建议统一');
      }
    }

    // 检查重复分类
    const typeCounts = new Map<LawsuitRequestType, number>();
    for (const claim of claims) {
      typeCounts.set(
        claim.classifiedType,
        (typeCounts.get(claim.classifiedType) || 0) + 1
      );
    }

    for (const [type, count] of typeCounts) {
      if (count > 1 && type !== LawsuitRequestType.OTHER) {
        warnings.push(`重复分类: ${type} 出现 ${count} 次`);
      }
    }

    return { unclassifiedText, warnings };
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(claims: ClassifiedClaim[]): number {
    if (claims.length === 0) return 0;

    const totalConfidence = claims.reduce(
      (sum, claim) => sum + claim.confidence,
      0
    );
    return totalConfidence / claims.length;
  }

  /**
   * 获取分类描述
   */
  private getClassificationDescription(type: LawsuitRequestType): string {
    const descriptions: { [key in LawsuitRequestType]: string } = {
      [LawsuitRequestType.PAY_PRINCIPAL]: '请求支付本金或货款',
      [LawsuitRequestType.PAY_INTEREST]: '请求支付利息',
      [LawsuitRequestType.PAY_PENALTY]: '请求支付违约金或罚金',
      [LawsuitRequestType.PAY_DAMAGES]: '请求赔偿损失或损害',
      [LawsuitRequestType.PAY_COMPENSATION]: '请求支付补偿款',
      [LawsuitRequestType.PAY_COSTS]: '请求支付费用',
      [LawsuitRequestType.PERFORMANCE]: '请求履行特定义务',
      [LawsuitRequestType.DELIVERY]: '请求交付特定物品',
      [LawsuitRequestType.SERVICE]: '请求提供服务',
      [LawsuitRequestType.TRANSFER]: '请求转移财产权',
      [LawsuitRequestType.CONFIRMATION]: '请求确认法律关系或事实',
      [LawsuitRequestType.VALIDATION]: '请求确认效力',
      [LawsuitRequestType.OWNERSHIP]: '请求确认所有权',
      [LawsuitRequestType.TERMINATION]: '请求解除或终止关系',
      [LawsuitRequestType.CANCELLATION]: '请求撤销行为',
      [LawsuitRequestType.RESCISSION]: '请求废除合同',
      [LawsuitRequestType.LITIGATION_COST]: '请求承担诉讼费用',
      [LawsuitRequestType.ATTORNEY_FEES]: '请求支付律师费',
      [LawsuitRequestType.INTEREST_COST]: '请求承担利息损失',
      [LawsuitRequestType.COMPOUND]: '复合请求，包含多个子请求',
      [LawsuitRequestType.MULTIPLE]: '多项请求',
      [LawsuitRequestType.OTHER]: '其他请求',
    };

    return descriptions[type] || '未知请求类型';
  }

  /**
   * 生成分类报告
   */
  generateClassificationReport(result: ClassificationResult): string {
    let report = '诉讼请求分类报告\n';
    report += '===================\n';

    // 基本信息
    report += `总请求数量: ${result.claims.length}\n`;
    report += `整体置信度: ${(result.classificationConfidence * 100).toFixed(1)}%\n`;
    report += `包含复合请求: ${result.hasCompoundClaims ? '是' : '否'}\n`;

    if (result.totalAmount) {
      report += `涉及总金额: ${result.totalAmount} ${result.currency}\n`;
    }

    // 详细分类结果
    report += '\n详细分类结果:\n';
    result.claims.forEach((claim, index) => {
      report += `${index + 1}. ${claim.originalText}\n`;
      report += `   类型: ${claim.classifiedType}\n`;
      report += `   描述: ${claim.description}\n`;
      report += `   置信度: ${(claim.confidence * 100).toFixed(1)}%\n`;

      if (claim.amount) {
        report += `   金额: ${claim.amount} ${claim.currency}\n`;
      }

      if (claim.matchedKeywords.length > 0) {
        report += `   匹配关键词: ${claim.matchedKeywords.join(', ')}\n`;
      }

      if (claim.subClaims && claim.subClaims.length > 0) {
        report += `   包含子请求: ${claim.subClaims.length} 个\n`;
        claim.subClaims.forEach((subClaim, subIndex) => {
          report += `     ${subIndex + 1}. ${subClaim.originalText} (${subClaim.classifiedType})\n`;
        });
      }

      report += '\n';
    });

    // 警告信息
    if (result.warnings.length > 0) {
      report += '警告信息:\n';
      result.warnings.forEach(warning => {
        report += `  - ${warning}\n`;
      });
      report += '\n';
    }

    // 未分类文本
    if (result.unclassifiedText.length > 0) {
      report += '未分类文本:\n';
      result.unclassifiedText.forEach(text => {
        report += `  - ${text}\n`;
      });
    }

    return report;
  }
}
