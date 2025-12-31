import {
  ApplicabilityInput,
  ApplicabilityAnalysisReport,
  ArticleApplicabilityResult,
  ApplicabilityConfig,
  AnalysisStatistics,
  DEFAULT_APPLICABILITY_CONFIG,
  SemanticMatchResult,
  RuleValidationResult,
  AIReviewResult,
} from "./types";
import { LawArticle } from "@prisma/client";
import SemanticMatcher from "./semantic-matcher";
import RuleValidator from "./rule-validator";
import AIReviewer from "./ai-reviewer";

/**
 * 法条适用性分析器
 *
 * 五层架构主类，整合所有分析层
 */
export class ApplicabilityAnalyzer {
  private semanticMatcher: SemanticMatcher;
  private ruleValidator: RuleValidator;
  private aiReviewer: AIReviewer;
  private initialized: boolean = false;

  /**
   * 初始化分析器
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.semanticMatcher = new SemanticMatcher();
    this.ruleValidator = new RuleValidator();
    this.aiReviewer = new AIReviewer();

    await Promise.all([
      this.semanticMatcher.initialize(),
      // RuleValidator不需要初始化
      this.aiReviewer.initialize(),
    ]);

    this.initialized = true;
  }

  /**
   * 分析法条适用性（主入口）
   */
  public async analyze(
    input: ApplicabilityInput,
  ): Promise<ApplicabilityAnalysisReport> {
    const config: Required<ApplicabilityConfig> = {
      ...DEFAULT_APPLICABILITY_CONFIG,
      ...input.config,
    };
    const startTime = Date.now();

    // 记录各阶段耗时
    const timings = {
      semanticMatching: 0,
      ruleValidation: 0,
      aiReview: 0,
    };

    // Layer 1: AI语义匹配
    let semanticMatches = new Map<string, SemanticMatchResult>();
    if (config.useAI) {
      const semanticStart = Date.now();
      semanticMatches = await this.semanticMatcher.matchArticles(
        input.articles,
        input.caseInfo,
      );
      timings.semanticMatching = Date.now() - semanticStart;
    }

    // Layer 2: 规则验证
    let ruleValidations = new Map<string, RuleValidationResult>();
    if (config.useRuleValidation) {
      const ruleStart = Date.now();
      ruleValidations = this.ruleValidator.validateArticles(
        input.articles,
        input.caseInfo,
      );
      timings.ruleValidation = Date.now() - ruleStart;
    }

    // Layer 3: AI审查
    let aiReviews = new Map<string, AIReviewResult>();
    if (config.useAIReview) {
      const aiStart = Date.now();
      aiReviews = await this.aiReviewer.reviewArticles(
        input.articles,
        input.caseInfo,
        semanticMatches,
        ruleValidations,
      );
      timings.aiReview = Date.now() - aiStart;
    }

    // 综合分析结果
    const results = this.synthesizeResults(
      input.articles,
      semanticMatches,
      ruleValidations,
      aiReviews,
    );

    // 计算统计信息
    const statistics = this.calculateStatistics(results, timings, startTime);

    // 生成报告
    return {
      analyzedAt: new Date(),
      totalArticles: input.articles.length,
      applicableArticles: results.filter((r) => r.applicable).length,
      notApplicableArticles: results.filter((r) => !r.applicable).length,
      results,
      statistics,
      config,
    };
  }

  /**
   * 综合分析结果
   */
  private synthesizeResults(
    articles: LawArticle[],
    semanticMatches: Map<string, SemanticMatchResult>,
    ruleValidations: Map<string, RuleValidationResult>,
    aiReviews: Map<string, AIReviewResult>,
  ): ArticleApplicabilityResult[] {
    return articles.map((article) => {
      const semanticMatch = semanticMatches.get(article.id);
      const ruleValidation = ruleValidations.get(article.id);
      const aiReview = aiReviews.get(article.id);

      const semanticScore = semanticMatch?.semanticRelevance || 0;
      const ruleScore = ruleValidation?.overallScore || 0;

      // 综合评分计算
      const score = this.calculateFinalScore(
        semanticScore,
        ruleScore,
        aiReview,
      );

      // 判断是否适用
      const applicable = this.determineApplicability(score, aiReview);

      // 收集原因和警告
      const reasons = this.collectReasons(
        semanticMatch,
        ruleValidation,
        aiReview,
      );
      const warnings = this.collectWarnings(
        semanticMatch,
        ruleValidation,
        aiReview,
      );

      return {
        articleId: article.id,
        articleNumber: article.articleNumber,
        lawName: article.lawName,
        applicable,
        score,
        semanticScore,
        ruleScore,
        aiConfidence: aiReview?.confidence,
        reasons,
        warnings,
        semanticMatch,
        ruleValidation,
      };
    });
  }

  /**
   * 计算最终适用性评分
   */
  private calculateFinalScore(
    semanticScore: number,
    ruleScore: number,
    aiReview: AIReviewResult | undefined,
  ): number {
    if (aiReview && aiReview.confidence !== undefined) {
      // 有AI审查结果，综合三者
      return semanticScore * 0.3 + ruleScore * 0.3 + aiReview.confidence * 0.4;
    }
    // 无AI审查结果，综合语义和规则
    return semanticScore * 0.4 + ruleScore * 0.6;
  }

  /**
   * 判断是否适用
   * 改进：确保至少有法条被标记为适用，除非评分极低
   */
  private determineApplicability(
    score: number,
    aiReview: AIReviewResult | undefined,
  ): boolean {
    // 评分低于0.1的直接排除
    if (score < 0.1) {
      return false;
    }

    // 如果AI明确判断不适用，且评分也低，返回false
    if (aiReview && aiReview.applicable === false && score < 0.3) {
      return false;
    }
    // 如果AI明确判断适用，返回true
    if (aiReview && aiReview.applicable === true) {
      return true;
    }
    // 否则根据评分判断（降低阈值，确保有法条通过）
    return score >= 0.2;
  }

  /**
   * 收集适用原因
   */
  private collectReasons(
    semanticMatch: SemanticMatchResult | undefined,
    ruleValidation: RuleValidationResult | undefined,
    aiReview: AIReviewResult | undefined,
  ): string[] {
    const reasons: string[] = [];

    if (semanticMatch?.relevanceReason) {
      reasons.push(semanticMatch.relevanceReason);
    }
    if (ruleValidation?.validity?.reason) {
      reasons.push(ruleValidation.validity.reason);
    }
    if (ruleValidation?.scope?.reason) {
      reasons.push(ruleValidation.scope.reason);
    }
    if (aiReview?.reasons && aiReview.reasons.length > 0) {
      reasons.push(...aiReview.reasons);
    }

    return reasons;
  }

  /**
   * 收集警告信息
   */
  private collectWarnings(
    semanticMatch: SemanticMatchResult | undefined,
    ruleValidation: RuleValidationResult | undefined,
    aiReview: AIReviewResult | undefined,
  ): string[] {
    const warnings: string[] = [];

    if (!ruleValidation?.validity?.passed && ruleValidation?.validity?.reason) {
      warnings.push(ruleValidation.validity.reason);
    }
    if (!ruleValidation?.scope?.passed && ruleValidation?.scope?.reason) {
      warnings.push(ruleValidation.scope.reason);
    }
    if (aiReview?.warnings && aiReview.warnings.length > 0) {
      warnings.push(...aiReview.warnings);
    }

    return warnings;
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    results: ArticleApplicabilityResult[],
    timings: {
      semanticMatching: number;
      ruleValidation: number;
      aiReview: number;
    },
    startTime: number,
  ): AnalysisStatistics {
    const executionTime = Date.now() - startTime;
    const scores = results.map((r) => r.score);
    const applicableCount = results.filter((r) => r.applicable).length;

    return {
      averageScore: scores.reduce((a, b) => a + b, 0) / results.length,
      maxScore: Math.max(...scores),
      minScore: Math.min(...scores),
      executionTime,
      semanticMatchingTime: timings.semanticMatching,
      ruleValidationTime: timings.ruleValidation,
      aiReviewTime: timings.aiReview,
      applicableRatio: applicableCount / results.length,
      byType: this.groupByType(results),
      byCategory: this.groupByCategory(results),
    };
  }

  /**
   * 按法条类型分组统计
   */
  private groupByType(
    results: ArticleApplicabilityResult[],
  ): Record<string, number> {
    return {
      applicable: results.filter((r) => r.applicable).length,
      notApplicable: results.filter((r) => !r.applicable).length,
    };
  }

  /**
   * 按法律分类分组统计
   */
  private groupByCategory(
    results: ArticleApplicabilityResult[],
  ): Record<string, number> {
    return {
      total: results.length,
    };
  }

  /**
   * 清理资源
   */
  public async destroy(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    await Promise.all([
      this.semanticMatcher?.destroy(),
      this.aiReviewer?.destroy(),
    ]);

    this.initialized = false;
  }
}

// 默认导出
export default ApplicabilityAnalyzer;
