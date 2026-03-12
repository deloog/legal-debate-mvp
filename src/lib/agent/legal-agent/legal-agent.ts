/**
 * LegalAgent - 法律智能代理主类
 *
 * 整合法律检索、适用性分析、论点生成、法律推理等功能
 */

import { LawSearcher } from './law-searcher';
import { ApplicabilityAnalyzer } from './applicability-analyzer';
import { ArgumentGenerator } from './argument-generator';
import { LegalReasoner } from './legal-reasoner';
import type {
  LegalAgentConfig,
  LegalQuery,
  SearchResult,
  ApplicabilityAnalysisInput,
  ApplicabilityResult,
  ArgumentGenerationResult,
  ReasoningChain,
  Fact,
  LogicValidationResult,
  LegalBasis,
  Argument,
  CaseInfo,
} from './types';

// =============================================================================
// LegalAgent类
// =============================================================================

export class LegalAgent {
  private searcher: LawSearcher;
  private analyzer: ApplicabilityAnalyzer;
  private argumentGenerator: ArgumentGenerator;
  private reasoner: LegalReasoner;
  private config: LegalAgentConfig;

  constructor(config: Partial<LegalAgentConfig> = {}) {
    this.config = {
      maxSearchResults: config.maxSearchResults || 10,
      enableExternalSearch: config.enableExternalSearch ?? true,
      externalSearchThreshold: config.externalSearchThreshold || 5,
      vectorDimension: config.vectorDimension || 1536,
      applicabilityThreshold: config.applicabilityThreshold || 0.6,
      argumentCount: config.argumentCount || {
        main: 3,
        supporting: 5,
        legalReference: 2,
      },
      maxReasoningSteps: config.maxReasoningSteps || 10,
    };

    this.searcher = new LawSearcher();
    this.analyzer = new ApplicabilityAnalyzer();
    this.argumentGenerator = new ArgumentGenerator();
    this.reasoner = new LegalReasoner();
  }

  /**
   * 搜索法条
   */
  async searchLaws(query: LegalQuery): Promise<SearchResult> {
    return this.searcher.search({
      ...query,
      limit: query.limit || this.config.maxSearchResults,
    });
  }

  /**
   * 分析法条适用性
   */
  async analyzeApplicability(
    input: ApplicabilityAnalysisInput
  ): Promise<ApplicabilityResult> {
    return this.analyzer.analyze(input, {
      threshold: this.config.applicabilityThreshold,
      enableAIReview: true,
    });
  }

  /**
   * 生成论点
   */
  async generateArguments(
    legalBasis: LegalBasis,
    side: 'PLAINTIFF' | 'DEFENDANT' = 'PLAINTIFF'
  ): Promise<ArgumentGenerationResult> {
    return this.argumentGenerator.generate(legalBasis, {
      mainCount: this.config.argumentCount.main,
      supportingCount: this.config.argumentCount.supporting,
      legalReferenceCount: this.config.argumentCount.legalReference,
      side,
    });
  }

  /**
   * 生成反驳论点
   */
  async generateRebuttal(
    legalBasis: LegalBasis,
    counterArguments: Argument[],
    side: 'PLAINTIFF' | 'DEFENDANT' = 'DEFENDANT'
  ): Promise<ArgumentGenerationResult> {
    return this.argumentGenerator.generateRebuttal(
      legalBasis,
      counterArguments,
      {
        side,
      }
    );
  }

  /**
   * 构建推理链
   */
  async buildReasoningChain(
    facts: Fact[],
    laws: unknown[]
  ): Promise<ReasoningChain> {
    return this.reasoner.buildReasoningChain(facts, laws as never, {
      maxSteps: this.config.maxReasoningSteps,
      reasoningType: 'deductive',
      minConfidence: 0.5,
    });
  }

  /**
   * 验证推理逻辑
   */
  validateReasoning(reasoningChain: ReasoningChain): LogicValidationResult {
    return this.reasoner.validateLogic(reasoningChain);
  }

  /**
   * 完整的法律智能分析流程
   */
  async analyzeCase(input: {
    /** 关键词 */
    keywords: string[];
    /** 案件类型 */
    caseType?: string;
    /** 法律类型 */
    lawType?: string;
    /** 案件信息 */
    caseInfo: CaseInfo;
    /** 事实列表 */
    facts: Fact[];
    /** 论点方向 */
    side?: 'PLAINTIFF' | 'DEFENDANT';
  }) {
    // 1. 搜索相关法条
    const searchResult = await this.searchLaws({
      keywords: input.keywords,
      caseType: input.caseType,
      lawType: input.lawType,
      limit: this.config.maxSearchResults,
    });

    if (searchResult.articles.length === 0) {
      return {
        searchResult,
        applicabilityResult: null,
        argumentResult: null,
        reasoningChain: null,
        validation: null,
        error: '未找到相关法条',
      };
    }

    // 2. 分析适用性
    const applicabilityResult = await this.analyzeApplicability({
      articles: searchResult.articles,
      caseInfo: input.caseInfo,
    });

    if (applicabilityResult.applicableArticles.length === 0) {
      return {
        searchResult,
        applicabilityResult,
        argumentResult: null,
        reasoningChain: null,
        validation: null,
        error: '未找到适用的法条',
      };
    }

    // 3. 生成论点
    const legalBasis: LegalBasis = {
      articles: applicabilityResult.applicableArticles,
      facts: input.facts.map(f => f.content),
    };

    const argumentResult = await this.generateArguments(
      legalBasis,
      input.side || 'PLAINTIFF'
    );

    // 4. 构建推理链
    const reasoningChain = await this.buildReasoningChain(
      input.facts,
      applicabilityResult.applicableArticles
    );

    // 5. 验证推理逻辑
    const validation = this.validateReasoning(reasoningChain);

    return {
      searchResult,
      applicabilityResult,
      argumentResult,
      reasoningChain,
      validation,
      error: null,
    };
  }

  /**
   * 批量分析案件
   */
  async batchAnalyzeCases(
    inputs: Array<{
      keywords: string[];
      caseType?: string;
      lawType?: string;
      caseInfo: CaseInfo;
      facts: Fact[];
      side?: 'PLAINTIFF' | 'DEFENDANT';
    }>
  ) {
    const results: Awaited<ReturnType<LegalAgent['analyzeCase']>>[] = [];

    for (const input of inputs) {
      const result = await this.analyzeCase(input);
      results.push(result);
    }

    return results;
  }

  /**
   * 获取配置
   */
  getConfig(): LegalAgentConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<LegalAgentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.searcher.initialize();
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.searcher.cleanup();
  }
}
