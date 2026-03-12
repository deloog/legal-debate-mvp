/**
 * AccuracyCalculator - 准确性计算工具类
 *
 * 功能：
 * 1. 计算文档解析准确率（当事人、诉讼请求、金额）
 * 2. 计算法条检索准确率
 * 3. 计算综合准确率（加权平均）
 * 4. 提供详细的准确性报告
 */

// =============================================================================
// 类型定义
// =============================================================================

export interface Party {
  type: 'plaintiff' | 'defendant' | 'other';
  name: string;
  role?: string;
  contact?: string;
  address?: string;
  _inferred?: boolean;
}

export interface Claim {
  type: string;
  content: string;
  amount?: number;
  currency: string;
  evidence?: string[];
  legalBasis?: string;
  _inferred?: boolean;
}

export interface ExtractedData {
  parties: Party[];
  claims: Claim[];
  timeline?: unknown[];
  disputeFocuses?: unknown[];
  keyFacts?: unknown[];
  summary?: string;
  caseType?: string;
}

export interface ExpectedData {
  parties?: ExpectedParty[];
  claims?: ExpectedClaim[];
}

export interface ExpectedParty {
  name: string;
  type: 'plaintiff' | 'defendant' | 'other';
  role?: string;
}

export interface ExpectedClaim {
  type: string;
  content?: string;
  amount?: number;
}

export interface AccuracyMetrics {
  // 文档解析准确率
  documentAccuracy: number;
  partyAccuracy: number;
  claimRecall: number;
  amountAccuracy: number;

  // 法条检索准确率
  lawRetrievalAccuracy: number;

  // 辩论生成准确率
  debateGenerationAccuracy: number;

  // 综合准确率
  overallAccuracy: number;

  // 详细信息
  details: {
    partyMatches: number;
    partyTotal: number;
    claimMatches: number;
    claimTotal: number;
    amountMatches: number;
    amountTotal: number;
    lawMatches: number;
    lawTotal: number;
    debateMatches: number;
    debateTotal: number;
  };

  // 统计信息
  stats: {
    averageResponseTime: number;
    totalAICost: number;
    totalTokenCount: number;
  };
}

export interface AccuracyCalculationOptions {
  partyMatchThreshold?: number; // 相似度阈值，默认0.8
  claimMatchThreshold?: number; // 内容相似度阈值，默认0.7
  amountTolerance?: number; // 金额容差，默认0
  weights?: {
    document: number; // 文档解析权重，默认0.4
    law: number; // 法条检索权重，默认0.3
    debate: number; // 辩论生成权重，默认0.3
  };
}

// =============================================================================
// AccuracyCalculator类
// =============================================================================

export class AccuracyCalculator {
  private defaultOptions: AccuracyCalculationOptions = {
    partyMatchThreshold: 0.8,
    claimMatchThreshold: 0.7,
    amountTolerance: 0,
    weights: {
      document: 0.4,
      law: 0.3,
      debate: 0.3,
    },
  };

  constructor(private options: AccuracyCalculationOptions = {}) {
    this.options = {
      ...this.defaultOptions,
      ...options,
      weights: {
        ...this.defaultOptions.weights,
        ...options.weights,
      } as { document: number; law: number; debate: number },
    };
  }

  /**
   * 计算文档解析准确率
   */
  calculateDocumentAccuracy(
    extracted: ExtractedData,
    expected: ExpectedData
  ): number {
    const partyAccuracy = this.calculatePartyAccuracy(
      extracted.parties || [],
      expected.parties || []
    );

    const claimRecall = this.calculateClaimRecall(
      extracted.claims || [],
      expected.claims || []
    );

    const amountAccuracy = this.calculateAmountAccuracy(
      extracted.claims || [],
      expected.claims || []
    );

    // 文档解析准确率 = 当事人准确率40% + 诉讼请求召回率30% + 金额准确率30%
    const documentAccuracy =
      partyAccuracy * 0.4 + claimRecall * 0.3 + amountAccuracy * 0.3;

    return Math.round(documentAccuracy * 10000) / 10000; // 保留4位小数
  }

  /**
   * 计算当事人识别准确率
   */
  calculatePartyAccuracy(
    extracted: Party[],
    expected: ExpectedParty[]
  ): number {
    if (expected.length === 0) {
      return 1; // 没有期望数据，视为完全正确
    }

    if (extracted.length === 0) {
      return 0; // 有期望数据但未提取，完全错误
    }

    let matchCount = 0;
    const matchedExpectedIndices = new Set<number>();

    for (const expectedParty of expected) {
      for (let i = 0; i < extracted.length; i++) {
        if (matchedExpectedIndices.has(i)) {
          continue;
        }

        const similarity = this.calculatePartySimilarity(
          expectedParty,
          extracted[i]
        );

        if (similarity >= (this.options.partyMatchThreshold || 0.8)) {
          matchCount++;
          matchedExpectedIndices.add(i);
          break;
        }
      }
    }

    const accuracy = matchCount / expected.length;
    return Math.round(accuracy * 10000) / 10000;
  }

  /**
   * 计算当事人相似度
   */
  private calculatePartySimilarity(
    expected: ExpectedParty,
    extracted: Party
  ): number {
    let similarity = 0;

    // 姓名完全匹配，相似度1.0
    if (expected.name === extracted.name) {
      similarity = 1.0;
    }
    // 姓名部分匹配（包含），相似度0.5
    else if (
      expected.name.includes(extracted.name) ||
      extracted.name.includes(expected.name)
    ) {
      similarity = 0.5;
    }
    // 类型匹配，增加相似度
    if (expected.type === extracted.type) {
      similarity += 0.3;
    }

    // 角色匹配（如有），增加相似度
    if (expected.role && extracted.role && expected.role === extracted.role) {
      similarity += 0.2;
    }

    return Math.min(similarity, 1.0); // 限制最大值为1.0
  }

  /**
   * 计算诉讼请求召回率
   */
  calculateClaimRecall(extracted: Claim[], expected: ExpectedClaim[]): number {
    if (expected.length === 0) {
      return 1;
    }

    if (extracted.length === 0) {
      return 0;
    }

    let matchCount = 0;
    const matchedExpectedIndices = new Set<number>();

    for (const expectedClaim of expected) {
      for (let i = 0; i < extracted.length; i++) {
        if (matchedExpectedIndices.has(i)) {
          continue;
        }

        const similarity = this.calculateClaimSimilarity(
          expectedClaim,
          extracted[i]
        );

        if (similarity >= (this.options.claimMatchThreshold || 0.7)) {
          matchCount++;
          matchedExpectedIndices.add(i);
          break;
        }
      }
    }

    const recall = matchCount / expected.length;
    return Math.round(recall * 10000) / 10000;
  }

  /**
   * 计算诉讼请求相似度
   */
  private calculateClaimSimilarity(
    expected: ExpectedClaim,
    extracted: Claim
  ): number {
    let similarity = 0;

    // 类型匹配（最重要），相似度0.4
    if (expected.type === extracted.type) {
      similarity += 0.4;
    }

    // 内容相似度，相似度0.3
    if (expected.content && extracted.content) {
      const contentSimilarity = this.calculateStringSimilarity(
        expected.content,
        extracted.content
      );
      similarity += contentSimilarity * 0.3;
    }

    // 金额匹配，相似度0.3
    if (expected.amount !== undefined && extracted.amount !== undefined) {
      const tolerance = this.options.amountTolerance || 0;
      const amountDiff = Math.abs(expected.amount - extracted.amount);

      if (amountDiff <= tolerance) {
        similarity += 0.3;
      }
    }

    return Math.min(similarity, 1.0);
  }

  /**
   * 计算字符串相似度（基于关键词）
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const words1 = this.extractKeywords(str1);
    const words2 = this.extractKeywords(str2);

    if (words1.length === 0 && words2.length === 0) {
      return 1.0;
    }

    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }

    const intersection = words1.filter(word => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    const words: string[] = [];

    // 提取中文字符（连续的中文字符作为一个词）
    const chineseMatches = lowerText.match(/[\u4e00-\u9fa5]+/g) || [];
    words.push(...chineseMatches);

    // 提取英文单词
    const englishMatches = lowerText.match(/[a-z]{2,}/g) || [];
    words.push(...englishMatches);

    // 提取数字（2位以上）
    const numberMatches = lowerText.match(/\d{2,}/g) || [];
    words.push(...numberMatches);

    // 过滤掉长度小于2的词
    return words.filter(word => word.length > 1);
  }

  /**
   * 计算金额准确率
   */
  calculateAmountAccuracy(
    extracted: Claim[],
    expected: ExpectedClaim[]
  ): number {
    const expectedWithAmount = expected.filter(e => e.amount !== undefined);
    const extractedWithAmount = extracted.filter(e => e.amount !== undefined);

    if (expectedWithAmount.length === 0) {
      return 1;
    }

    if (extractedWithAmount.length === 0) {
      return 0;
    }

    let matchCount = 0;
    const tolerance = this.options.amountTolerance || 0;

    for (const expectedClaim of expectedWithAmount) {
      for (const extractedClaim of extractedWithAmount) {
        if (
          extractedClaim.type === expectedClaim.type &&
          extractedClaim.amount !== undefined &&
          expectedClaim.amount !== undefined
        ) {
          const amountDiff = Math.abs(
            expectedClaim.amount - extractedClaim.amount
          );

          if (amountDiff <= tolerance) {
            matchCount++;
            break;
          }
        }
      }
    }

    const accuracy = matchCount / expectedWithAmount.length;
    return Math.round(accuracy * 10000) / 10000;
  }

  /**
   * 计算法条检索准确率
   */
  calculateLawRetrievalAccuracy(
    retrievedArticles: unknown[],
    relevantArticles: string[],
    queryKeywords: string[]
  ): number {
    if (relevantArticles.length === 0) {
      return 1;
    }

    if (retrievedArticles.length === 0) {
      return 0;
    }

    let relevanceScore = 0;
    const totalWeight = retrievedArticles.length;

    // 计算每个检索结果的相关性
    for (let i = 0; i < retrievedArticles.length; i++) {
      const article = retrievedArticles[i] as Record<string, unknown>;
      const content = String(article.content || '');

      // 基于关键词匹配度计算相关性
      const keywordMatches = queryKeywords.filter(keyword =>
        content.toLowerCase().includes(keyword.toLowerCase())
      ).length;

      const matchRatio = keywordMatches / queryKeywords.length;

      // 前3个结果权重1.0，4-10个权重0.5
      const positionWeight = i < 3 ? 1.0 : 0.5;

      relevanceScore += matchRatio * positionWeight;
    }

    const accuracy = relevanceScore / totalWeight;
    return Math.round(accuracy * 10000) / 10000;
  }

  /**
   * 计算辩论生成准确率
   */
  calculateDebateGenerationAccuracy(
    generatedArguments: unknown[],
    expectedTopics: string[]
  ): number {
    if (expectedTopics.length === 0) {
      return 1;
    }

    if (generatedArguments.length === 0) {
      return 0;
    }

    let matchCount = 0;

    for (const expectedTopic of expectedTopics) {
      for (const argument of generatedArguments) {
        const arg = argument as Record<string, unknown>;
        const content = String(arg.content || arg.summary || '');

        if (content.toLowerCase().includes(expectedTopic.toLowerCase())) {
          matchCount++;
          break;
        }
      }
    }

    const accuracy = matchCount / expectedTopics.length;
    return Math.round(accuracy * 10000) / 10000;
  }

  /**
   * 计算综合准确率
   */
  calculateOverallAccuracy(metrics: Partial<AccuracyMetrics>): number {
    const weights = this.options.weights || this.defaultOptions.weights;

    const documentAccuracy = metrics.documentAccuracy || 0;
    const lawRetrievalAccuracy = metrics.lawRetrievalAccuracy || 0;
    const debateGenerationAccuracy = metrics.debateGenerationAccuracy || 0;

    const w = weights ?? { document: 0.4, law: 0.3, debate: 0.3 };
    const overall =
      documentAccuracy * w.document +
      lawRetrievalAccuracy * w.law +
      debateGenerationAccuracy * w.debate;

    // 四舍五入到2位小数
    return Math.round(overall * 100) / 100;
  }

  /**
   * 生成完整的准确性报告
   */
  generateAccuracyReport(metrics: AccuracyMetrics): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('📊 准确性验证报告');
    lines.push('='.repeat(60));
    lines.push('');

    // 准确性指标
    lines.push('📈 准确性指标:');
    lines.push(
      `   文档解析: ${(metrics.documentAccuracy * 100).toFixed(1)}% (目标: >95%)`
    );
    lines.push(
      `     - 当事人识别: ${(metrics.partyAccuracy * 100).toFixed(1)}%`
    );
    lines.push(
      `     - 诉讼请求召回: ${(metrics.claimRecall * 100).toFixed(1)}%`
    );
    lines.push(
      `     - 金额准确率: ${(metrics.amountAccuracy * 100).toFixed(1)}%`
    );
    lines.push(
      `   法条检索: ${(metrics.lawRetrievalAccuracy * 100).toFixed(1)}% (目标: >90%)`
    );
    lines.push(
      `   辩论生成: ${(metrics.debateGenerationAccuracy * 100).toFixed(1)}% (目标: >93%)`
    );
    lines.push(
      `   综合准确率: ${(metrics.overallAccuracy * 100).toFixed(1)}% (目标: 93分+)`
    );
    lines.push('');

    // 详细匹配信息
    lines.push('📋 详细匹配信息:');
    lines.push(
      `   当事人匹配: ${metrics.details.partyMatches}/${metrics.details.partyTotal}`
    );
    lines.push(
      `   诉讼请求匹配: ${metrics.details.claimMatches}/${metrics.details.claimTotal}`
    );
    lines.push(
      `   金额匹配: ${metrics.details.amountMatches}/${metrics.details.amountTotal}`
    );
    lines.push(
      `   法条匹配: ${metrics.details.lawMatches}/${metrics.details.lawTotal}`
    );
    lines.push(
      `   辩论匹配: ${metrics.details.debateMatches}/${metrics.details.debateTotal}`
    );
    lines.push('');

    // 性能指标
    lines.push('⏱️  性能指标:');
    lines.push(
      `   平均响应时间: ${metrics.stats.averageResponseTime.toFixed(0)}ms`
    );
    lines.push('');

    // AI成本
    lines.push('💰 AI成本:');
    lines.push(`   总Token消耗: ${metrics.stats.totalTokenCount}`);
    lines.push(`   总AI成本: ¥${metrics.stats.totalAICost.toFixed(4)}`);
    lines.push('');

    lines.push('='.repeat(60));

    return lines.join('\n');
  }

  /**
   * 计算测试统计信息
   */
  calculateTestStats(
    responseTimes: number[],
    costs: number[],
    tokenCounts: number[]
  ): {
    averageResponseTime: number;
    totalAICost: number;
    totalTokenCount: number;
  } {
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

    const totalAICost =
      costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) : 0;

    const totalTokenCount =
      tokenCounts.length > 0 ? tokenCounts.reduce((sum, t) => sum + t, 0) : 0;

    return {
      averageResponseTime,
      totalAICost,
      totalTokenCount,
    };
  }
}
