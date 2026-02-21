/**
 * ApplicabilityAnalyzer - 法条适用性分析器
 *
 * 功能：
 * 1. 语义匹配分析（关键词匹配度）
 * 2. 规则验证（时效性、适用范围、法条层级）
 * 3. AI审查（模拟AI分析结果）
 * 4. 综合评分计算
 */

import type {
  AIReviewResult,
  ApplicabilityAnalysisInput,
  ApplicabilityResult,
  CaseInfo,
  LawArticle,
  RuleValidationResult,
} from './types';

// =============================================================================
// 类型定义
// =============================================================================

interface AnalysisOptions {
  /** 适用性阈值（低于此值认为不适用） */
  threshold?: number;
  /** 是否启用AI审查（模拟） */
  enableAIReview?: boolean;
}

// =============================================================================
// ApplicabilityAnalyzer类
// =============================================================================

export class ApplicabilityAnalyzer {
  private readonly defaultThreshold: number = 0.6;

  /**
   * 分析法条适用性
   */
  async analyze(
    input: ApplicabilityAnalysisInput,
    options: AnalysisOptions = {}
  ): Promise<ApplicabilityResult> {
    const startTime = Date.now();
    const threshold = options.threshold || this.defaultThreshold;

    // 1. 语义匹配分析
    const semanticScores = this.analyzeSemanticMatch(
      input.articles,
      input.caseInfo
    );

    // 2. 规则验证
    const validation = new Map<string, RuleValidationResult>();
    for (const article of input.articles) {
      validation.set(article.id, this.validateArticle(article, input.caseInfo));
    }

    // 3. AI审查（模拟）
    const aiReview = options.enableAIReview
      ? await this.performAIReview(input, semanticScores, validation)
      : this.getEmptyAIReview();

    // 4. 分类法条
    const { applicableArticles, notApplicableArticles } = this.classifyArticles(
      input.articles,
      semanticScores,
      validation,
      threshold
    );

    // 5. 计算综合评分
    const overallScore = this.calculateOverallScore(
      applicableArticles,
      semanticScores,
      validation
    );

    return {
      applicableArticles,
      notApplicableArticles,
      semanticScores,
      validation,
      aiReview,
      overallScore,
      analysisTime: Date.now() - startTime,
    };
  }

  /**
   * 语义匹配分析
   */
  private analyzeSemanticMatch(
    articles: LawArticle[],
    caseInfo: unknown
  ): Map<string, number> {
    const scores = new Map<string, number>();

    for (const article of articles) {
      const score = this.calculateSemanticScore(article, caseInfo);
      scores.set(article.id, score);
    }

    return scores;
  }

  /**
   * 计算语义匹配得分
   */
  private calculateSemanticScore(
    article: LawArticle,
    caseInfo: unknown
  ): number {
    // 模拟语义匹配：基于关键词匹配度
    const articleKeywords = article.keywords || [];
    const articleText = article.content.toLowerCase();

    // 从案件信息中提取关键词（简化处理）
    const caseKeywords = this.extractCaseKeywords(caseInfo);

    let matchScore = 0;
    for (const keyword of caseKeywords) {
      if (articleKeywords.includes(keyword)) {
        matchScore += 0.3;
      }
      if (articleText.includes(keyword)) {
        matchScore += 0.2;
      }
    }

    return Math.min(matchScore, 1.0);
  }

  /**
   * 提取案件关键词
   */
  private extractCaseKeywords(caseInfo: CaseInfo): string[] {
    const keywords: string[] = [];

    // 从案件描述中提取关键词
    if (caseInfo.description) {
      keywords.push(...this.extractKeywordsFromText(caseInfo.description));
    }

    // 从争议焦点中提取关键词
    if (caseInfo.disputeFocus) {
      for (const focus of caseInfo.disputeFocus) {
        keywords.push(...this.extractKeywordsFromText(focus));
      }
    }

    // 从证据摘要中提取关键词
    if (caseInfo.evidences) {
      for (const evidence of caseInfo.evidences) {
        keywords.push(...this.extractKeywordsFromText(evidence.summary));
      }
    }

    // 如果没有提取到关键词，返回默认关键词
    if (keywords.length === 0) {
      return [
        '合同',
        '违约',
        '赔偿',
        '履行',
        '解除',
        '责任',
        '损失',
        '义务',
        '权利',
        '支付',
      ];
    }

    return [...new Set(keywords)]; // 去重
  }

  /**
   * 从文本中提取关键词
   * @param text 输入文本
   * @returns 关键词数组
   */
  private extractKeywordsFromText(text: string): string[] {
    const keywords: string[] = [];
    const commonLegalTerms = [
      '合同',
      '违约',
      '赔偿',
      '履行',
      '解除',
      '责任',
      '损失',
      '义务',
      '权利',
      '支付',
      '侵权',
      '损害',
      '承担',
      '返还',
      '交付',
      '验收',
      '质量',
      '期限',
      '利息',
      '违约金',
    ];

    for (const term of commonLegalTerms) {
      if (text.includes(term)) {
        keywords.push(term);
      }
    }

    return keywords;
  }

  /**
   * 验证法条规则
   */
  private validateArticle(
    article: LawArticle,
    caseInfo: CaseInfo
  ): RuleValidationResult {
    const timeValidity = this.checkTimeValidity(article);
    const scopeValidity = this.checkScopeValidity(article, caseInfo);
    const levelValidity = this.checkLevelValidity(article);

    const passed =
      timeValidity.valid && scopeValidity.valid && levelValidity.valid;

    return {
      articleId: article.id,
      passed,
      时效性检查: timeValidity,
      适用范围检查: scopeValidity,
      法条层级检查: levelValidity,
    };
  }

  /**
   * 检查时效性
   */
  private checkTimeValidity(article: LawArticle): {
    valid: boolean;
    reason?: string;
  } {
    if (article.deprecated) {
      return {
        valid: false,
        reason: '法条已废止',
      };
    }

    const now = new Date();
    if (article.effectiveDate) {
      const effectiveDate = new Date(article.effectiveDate);
      if (effectiveDate > now) {
        return {
          valid: false,
          reason: '法条尚未生效',
        };
      }
    }

    return { valid: true };
  }

  /**
   * 检查适用范围
   */
  private checkScopeValidity(
    article: LawArticle,
    caseInfo: CaseInfo
  ): { valid: boolean; reason?: string } {
    // 如果法条没有适用范围限制，则认为有效
    if (!article.scope || article.scope.length === 0) {
      return { valid: true };
    }

    // 如果案件没有地点信息，无法验证，返回有效（降级策略）
    if (!caseInfo.location) {
      return {
        valid: true,
        reason: '案件地点信息缺失，无法验证适用范围',
      };
    }

    // 检查案件地点是否在法条适用范围内
    const isApplicable = article.scope.some(scope =>
      caseInfo.location?.includes(scope)
    );

    if (isApplicable) {
      return {
        valid: true,
        reason: `案件地点"${caseInfo.location}"在适用范围[${article.scope.join(', ')}]内`,
      };
    }

    return {
      valid: false,
      reason: `案件地点"${caseInfo.location}"不在适用范围[${article.scope.join(', ')}]内`,
    };
  }

  /**
   * 检查法条层级
   */
  private checkLevelValidity(_article: LawArticle): {
    valid: boolean;
    reason?: string;
  } {
    // 简化处理：所有层级的法条都有效
    return { valid: true };
  }

  /**
   * AI审查（模拟）
   */
  private async performAIReview(
    input: ApplicabilityAnalysisInput,
    semanticScores: Map<string, number>,
    validation: Map<string, RuleValidationResult>
  ): Promise<AIReviewResult> {
    // 模拟AI审查结果
    const applicable: LawArticle[] = [];
    const notApplicable: LawArticle[] = [];
    const comments: string[] = [];

    for (const article of input.articles) {
      const score = semanticScores.get(article.id) || 0;
      const ruleResult = validation.get(article.id);

      if (score > 0.7 && ruleResult?.passed) {
        applicable.push(article);
        comments.push(
          `法条${article.articleNumber}与案件高度相关，语义相似度${score.toFixed(2)}`
        );
      } else if (score > 0.4) {
        comments.push(
          `法条${article.articleNumber}与案件有一定关联，建议进一步分析`
        );
      } else {
        notApplicable.push(article);
        if (score < 0.3) {
          comments.push(`法条${article.articleNumber}与案件相关性较低`);
        }
      }
    }

    // 计算审查评分
    const score =
      input.articles.length > 0 ? applicable.length / input.articles.length : 0;

    return {
      applicable,
      notApplicable,
      score,
      comments,
    };
  }

  /**
   * 获取空的AI审查结果
   */
  private getEmptyAIReview(): AIReviewResult {
    return {
      applicable: [],
      notApplicable: [],
      score: 0,
      comments: ['AI审查未启用'],
    };
  }

  /**
   * 分类法条
   */
  private classifyArticles(
    articles: LawArticle[],
    semanticScores: Map<string, number>,
    validation: Map<string, RuleValidationResult>,
    threshold: number
  ): { applicableArticles: LawArticle[]; notApplicableArticles: LawArticle[] } {
    const applicableArticles: LawArticle[] = [];
    const notApplicableArticles: LawArticle[] = [];

    for (const article of articles) {
      const score = semanticScores.get(article.id) || 0;
      const ruleResult = validation.get(article.id);

      // 综合判断：语义匹配得分高于阈值且规则验证通过
      if (score >= threshold && ruleResult?.passed) {
        applicableArticles.push(article);
      } else {
        notApplicableArticles.push(article);
      }
    }

    return { applicableArticles, notApplicableArticles };
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    applicableArticles: LawArticle[],
    semanticScores: Map<string, number>,
    validation: Map<string, RuleValidationResult>
  ): number {
    if (applicableArticles.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let count = 0;

    for (const article of applicableArticles) {
      const semanticScore = semanticScores.get(article.id) || 0;
      const ruleResult = validation.get(article.id);

      // 语义匹配权重0.6，规则验证权重0.4
      const ruleScore = ruleResult?.passed ? 1 : 0;
      const combinedScore = semanticScore * 0.6 + ruleScore * 0.4;

      totalScore += combinedScore;
      count++;
    }

    return count > 0 ? totalScore / count : 0;
  }

  /**
   * 批量分析多个案件
   */
  async batchAnalyze(
    inputs: ApplicabilityAnalysisInput[],
    options: AnalysisOptions = {}
  ): Promise<ApplicabilityResult[]> {
    const results: ApplicabilityResult[] = [];

    for (const input of inputs) {
      const result = await this.analyze(input, options);
      results.push(result);
    }

    return results;
  }
}
