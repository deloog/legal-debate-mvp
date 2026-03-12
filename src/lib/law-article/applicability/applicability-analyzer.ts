import { LawArticle } from '@prisma/client';
import { DocumentAnalysisOutput } from '@/lib/agent/doc-analyzer/core/types';
import {
  ApplicabilityInput,
  ApplicabilityConfig,
  ArticleApplicabilityResult,
  ApplicabilityAnalysisReport,
  DEFAULT_APPLICABILITY_CONFIG,
} from './types';
import { RuleValidator } from './rule-validator';
import { AIReviewer } from './ai-reviewer';

/**
 * 法条适用性分析器
 *
 * 两阶段流水线：
 *
 * Phase 0 — 硬性规则过滤（同步，0 AI 成本）
 *   基于客观事实过滤明显无效法条：已废止、草案、未生效、已过期。
 *   AMENDED（已修订）法条通过过滤，附带警告由 AI 层综合判断。
 *
 * Phase 1 — AI 适用性分析（并行，受 concurrency 参数控制）
 *   每条通过过滤的法条发起一次 AI 调用，在单个 prompt 中完成：
 *   语义相关性评估 + 适用性判断 + 评分 + 原因 + 风险警告。
 *   所有 AI 调用按批次并行执行，避免串行等待。
 */
export class ApplicabilityAnalyzer {
  private ruleValidator: RuleValidator;
  private aiReviewer: AIReviewer;
  private initialized = false;

  constructor() {
    this.ruleValidator = new RuleValidator();
    this.aiReviewer = new AIReviewer();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.aiReviewer.initialize();
    this.initialized = true;
  }

  public async analyze(
    input: ApplicabilityInput
  ): Promise<ApplicabilityAnalysisReport> {
    const config: Required<ApplicabilityConfig> = {
      ...DEFAULT_APPLICABILITY_CONFIG,
      ...input.config,
    };
    const startTime = Date.now();
    const results: ArticleApplicabilityResult[] = [];

    // ─── Phase 0: 硬性规则过滤 ───────────────────────────────────────────────
    const filterStart = Date.now();
    const filterResults = this.ruleValidator.validateArticles(input.articles);
    const ruleValidationTime = Date.now() - filterStart;

    const passedArticles: LawArticle[] = [];

    for (const article of input.articles) {
      const filterResult = filterResults.get(article.id)!;
      if (!filterResult.passed) {
        results.push({
          articleId: article.id,
          articleNumber: article.articleNumber,
          lawName: article.lawName,
          applicable: false,
          score: 0,
          semanticScore: 0,
          ruleScore: 0,
          reasons: [filterResult.reason ?? '法条未通过有效性检查'],
          warnings: filterResult.warnings,
          ruleValidation: filterResult,
        });
      } else {
        passedArticles.push(article);
      }
    }

    // ─── Phase 1: AI 适用性分析（并行） ───────────────────────────────────────
    const aiStart = Date.now();
    const useAI = config.useAI !== false && config.useAIReview !== false;

    if (useAI && passedArticles.length > 0) {
      const caseContext = this.buildCaseContext(input.caseInfo);
      const concurrency = config.concurrency ?? 5;
      const aiResults = await this.aiReviewer.analyzeArticles(
        passedArticles,
        caseContext,
        concurrency
      );

      for (const article of passedArticles) {
        const filterResult = filterResults.get(article.id)!;
        const aiResult = aiResults.get(article.id) ?? {
          applicable: false,
          score: 0.3,
          confidence: 0.3,
          reasons: ['AI分析结果缺失，需要人工确认'],
          warnings: [],
        };
        results.push({
          articleId: article.id,
          articleNumber: article.articleNumber,
          lawName: article.lawName,
          applicable:
            aiResult.applicable &&
            aiResult.score >= config.minApplicabilityScore,
          score: aiResult.score,
          semanticScore: aiResult.score,
          ruleScore: 1.0,
          aiConfidence: aiResult.confidence,
          reasons: aiResult.reasons,
          warnings: [...filterResult.warnings, ...aiResult.warnings],
          ruleValidation: filterResult,
        });
      }
    } else {
      // AI 禁用：用法条层级评分作为 fallback
      for (const article of passedArticles) {
        const filterResult = filterResults.get(article.id)!;
        const levelScore = this.getLevelScore(article.lawType);
        results.push({
          articleId: article.id,
          articleNumber: article.articleNumber,
          lawName: article.lawName,
          applicable: levelScore >= config.minApplicabilityScore,
          score: levelScore,
          semanticScore: 0,
          ruleScore: levelScore,
          reasons: ['基于法条层级的规则评分（AI分析未启用）'],
          warnings: filterResult.warnings,
          ruleValidation: filterResult,
        });
      }
    }

    const semanticMatchingTime = Date.now() - aiStart;

    // ─── 排序 + 统计 ─────────────────────────────────────────────────────────
    results.sort((a, b) => b.score - a.score);

    const applicableCount = results.filter(r => r.applicable).length;
    const scores = results.map(r => r.score);

    return {
      analyzedAt: new Date(),
      totalArticles: input.articles.length,
      applicableArticles: applicableCount,
      notApplicableArticles: results.length - applicableCount,
      results,
      statistics: {
        averageScore:
          scores.length > 0
            ? scores.reduce((a, b) => a + b, 0) / scores.length
            : 0,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        executionTime: Date.now() - startTime,
        ruleValidationTime,
        semanticMatchingTime,
        aiReviewTime: 0,
        applicableRatio:
          results.length > 0 ? applicableCount / results.length : 0,
        byType: this.groupByType(results, input.articles),
        byCategory: this.groupByCategory(results, input.articles),
      },
      config,
    };
  }

  /**
   * 将案情信息构建为 AI prompt 的文本上下文
   */
  private buildCaseContext(caseInfo: DocumentAnalysisOutput): string {
    const { extractedData } = caseInfo;
    const parts: string[] = [];

    if (extractedData.caseType) {
      parts.push(`案件类型：${extractedData.caseType}`);
    }
    if (extractedData.parties?.length) {
      const plaintiff = extractedData.parties
        .filter(p => p.type === 'plaintiff')
        .map(p => p.name)
        .join('、');
      const defendant = extractedData.parties
        .filter(p => p.type === 'defendant')
        .map(p => p.name)
        .join('、');
      if (plaintiff) parts.push(`原告：${plaintiff}`);
      if (defendant) parts.push(`被告：${defendant}`);
    }
    if (extractedData.claims?.length) {
      const claimTexts = extractedData.claims
        .slice(0, 5)
        .map(c => c.content)
        .join('；');
      parts.push(`诉讼请求：${claimTexts}`);
    }
    if (extractedData.keyFacts?.length) {
      const factTexts = extractedData.keyFacts
        .slice(0, 5)
        .map(f => f.description)
        .join('；');
      parts.push(`关键事实：${factTexts}`);
    }
    if (extractedData.disputeFocuses?.length) {
      const focusTexts = extractedData.disputeFocuses
        .slice(0, 3)
        .map(d => d.coreIssue)
        .join('；');
      parts.push(`争议焦点：${focusTexts}`);
    }
    if (extractedData.summary) {
      parts.push(`案件摘要：${extractedData.summary}`);
    }

    return parts.join('\n') || '（案情信息不完整，请根据法条内容综合判断）';
  }

  /**
   * 根据法条类型返回层级基准评分（AI 禁用时的 fallback）
   */
  private getLevelScore(lawType: string): number {
    const scores: Record<string, number> = {
      CONSTITUTION: 0.9,
      LAW: 1.0,
      ADMINISTRATIVE_REGULATION: 0.85,
      JUDICIAL_INTERPRETATION: 0.8,
      LOCAL_REGULATION: 0.7,
      DEPARTMENTAL_RULE: 0.65,
      OTHER: 0.5,
    };
    return scores[lawType] ?? 0.5;
  }

  /**
   * 按法条类型统计适用数量（实际数据，非硬编码空值）
   */
  private groupByType(
    results: ArticleApplicabilityResult[],
    articles: LawArticle[]
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (const article of articles) {
      const result = results.find(r => r.articleId === article.id);
      if (result?.applicable) {
        map[article.lawType] = (map[article.lawType] ?? 0) + 1;
      }
    }
    return map;
  }

  /**
   * 按法律分类统计适用数量（实际数据，非硬编码空值）
   */
  private groupByCategory(
    results: ArticleApplicabilityResult[],
    articles: LawArticle[]
  ): Record<string, number> {
    const map: Record<string, number> = {};
    for (const article of articles) {
      const result = results.find(r => r.articleId === article.id);
      if (result?.applicable && article.category) {
        map[article.category] = (map[article.category] ?? 0) + 1;
      }
    }
    return map;
  }

  public async destroy(): Promise<void> {
    await this.aiReviewer.destroy();
    this.initialized = false;
  }
}

export default ApplicabilityAnalyzer;
