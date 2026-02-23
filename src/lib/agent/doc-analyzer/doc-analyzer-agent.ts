/**
 * DocAnalyzerAgent - 文档分析智能体主类
 *
 * 集成所有模块，实现五层处理架构和Reviewer审查流程
 *
 * === 设计决策（为什么这样设计） ===
 *
 * 1. 为什么采用五层架构？
 *    参见：docs/architecture/ARCHITECTURE_DECISION_RECORDS.md#adr-002保留docanalyzer五层架构
 *
 *    - 五层架构已验证达到88分准确率（接近95分目标）
 *    - 每层都有独特价值：
 *      * Layer 0-1: 质量预检，过滤低质量文档，避免浪费AI资源
 *      * Layer 2: AI核心理解，利用AI语义理解能力识别当事人、诉讼请求、金额
 *      * Layer 3: 规则验证，AI失败时使用规则算法兜底，确保可靠性
 *      * Layer 4: 双重审查（AI+规则），二次验证提升准确率
 *      * Layer 5: 缓存层，减少重复AI调用，降低成本40-60%
 *    - 简化为三层可能导致准确率下降，风险大于收益
 *    - 性能可接受（<2秒），缓存优化后<500ms
 *
 * 2. 为什么使用双审查器（AIReviewer + RuleReviewer）？
 *
 *    - AIReviewer：验证AI识别的语义正确性，发现AI可能遗漏的错误
 *    - RuleReviewer：验证数据结构完整性（如金额格式、必填字段）
 *    - 两者互补：AI擅长语义理解，规则擅长结构验证，组合使用可覆盖更多错误类型
 *    - 审查评分低于0.7时自动降低整体置信度，确保质量
 *
 * 3. 为什么需要降级策略？
 *
 *    - AI服务可能超时、限流或不可用
 *    - 降级到简单结果（空数据）比完全失败更好，允许用户手动补充
 *    - 符合"Graceful Degradation"原则：系统功能逐步降级而非突然崩溃
 *
 * 4. 为什么使用熔断器（Circuit Breaker）？
 *
 *    - 防止AI服务故障时持续请求，浪费资源
 *    - 失败率>50%时自动熔断，60秒后自动尝试恢复
 *    - 保护系统和用户体验
 *
 * === 架构价值 ===
 *
 * - 已验证准确率：88分（综合评分）
 * - 缓存命中率：60%+（减少AI调用40-60%）
 * - 错误恢复率：90%+（容错机制）
 * - 性能目标：<2秒（首次），<500ms（缓存命中）
 */

import { BaseAgent } from '../base-agent';
import { AgentType, AgentContext } from '../../../types/agent';
import {
  DocumentAnalysisOutput,
  DocumentAnalysisInput,
  AnalysisProcess,
  Correction,
} from './core/types';
import { DEFAULT_CONFIG } from './core/constants';
import {
  createFaultToleranceConfig,
  createRetryConfig,
  createFallbackConfig,
  createCircuitBreakerConfig,
  type AgentFaultToleranceConfig,
} from '../fault-tolerance/config';
import { TextExtractor } from './extractors/text-extractor';
import { FilterProcessor } from './processors/filter-processor';
import { AIProcessor } from './processors/ai-processor';
import { RuleProcessor } from './processors/rule-processor';
import { CacheProcessor } from './processors/cache-processor';
import { LegalRepresentativeFilter } from './processors/legal-representative-filter';
import { ReviewerManager } from './reviewers/reviewer-manager';
import { AIReviewer } from './reviewers/ai-reviewer';
import { RuleReviewer } from './reviewers/rule-reviewer';
import {
  EvidenceAnalyzer,
  TimelineExtractor,
  ComprehensiveAnalyzer,
} from './analyzers';
import { logger } from '../../agent/security/logger';
import { AnalysisError } from '../../agent/security/errors';

export class DocAnalyzerAgent extends BaseAgent {
  private textExtractor: TextExtractor;
  private filterProcessor: FilterProcessor;
  private aiProcessor: AIProcessor;
  private ruleProcessor: RuleProcessor;
  private legalRepFilter: LegalRepresentativeFilter;
  private cacheProcessor: CacheProcessor;
  private reviewerManager: ReviewerManager;
  private aiReviewer: AIReviewer | null = null;
  private ruleReviewer: RuleReviewer | null = null;
  private _useMock: boolean;
  private evidenceAnalyzer: EvidenceAnalyzer;
  private timelineExtractor: TimelineExtractor;
  private comprehensiveAnalyzer: ComprehensiveAnalyzer;

  constructor(useMock: boolean = false) {
    // 传递容错配置到父类（不使用this）
    const faultToleranceConfig: AgentFaultToleranceConfig = {
      retry: {
        maxRetries: 3,
        backoffMs: [1000, 2000, 4000],
        retryableErrors: [
          'TIMEOUT',
          'AI_SERVICE_ERROR',
          'NETWORK_ERROR',
          'RATE_LIMIT_ERROR',
          'ECONNREFUSED',
          'ETIMEDOUT',
        ],
      },
      fallback: {
        enabled: true,
        fallbackType: 'SIMPLE',
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 0.5,
        timeout: 60000,
        halfOpenRequests: 3,
      },
    };

    super(undefined, undefined, faultToleranceConfig);
    this.useMock = useMock;
    this.textExtractor = new TextExtractor();
    this.filterProcessor = new FilterProcessor();
    this.aiProcessor = new AIProcessor(DEFAULT_CONFIG, useMock);
    this.ruleProcessor = new RuleProcessor();
    this.legalRepFilter = new LegalRepresentativeFilter();
    this.cacheProcessor = new CacheProcessor({
      enabled: DEFAULT_CONFIG.cacheEnabled,
      ttl: DEFAULT_CONFIG.cacheTTL,
      namespace: 'doc-analyzer',
    });
    this.reviewerManager = new ReviewerManager();
    this.setupReviewers();

    // 初始化三个分析器（修复extractTimeline未定义错误）
    this.evidenceAnalyzer = new EvidenceAnalyzer();
    this.timelineExtractor = new TimelineExtractor();
    this.comprehensiveAnalyzer = new ComprehensiveAnalyzer();
  }

  get name(): string {
    return 'DocAnalyzer';
  }

  get type(): AgentType {
    return AgentType.DOC_ANALYZER;
  }

  get version(): string {
    return '3.0.0';
  }

  get description(): string {
    return '模块化文档分析智能体，实现五层处理架构和Reviewer审查流程';
  }

  getCapabilities(): string[] {
    return [
      'DOCUMENT_ANALYSIS',
      'TEXT_EXTRACTION',
      'STRUCTURED_DATA_EXTRACTION',
      'QUALITY_REVIEW',
    ];
  }

  getSupportedTasks(): string[] {
    return [
      'DOCUMENT_PARSE',
      'DOCUMENT_ANALYZE',
      'INFO_EXTRACT',
      'QUALITY_CHECK',
    ];
  }

  getDependencies(): AgentType[] {
    return [];
  }

  getRequiredConfig(): string[] {
    return [];
  }

  getOptionalConfig(): string[] {
    return ['aiTimeout', 'maxRetries', 'cacheEnabled'];
  }

  /**
   * 强制使用真实AI服务（用于准确性测试）
   */
  public forceUseRealAI(): void {
    this.aiProcessor.forceUseRealAI();
  }

  /**
   * 禁用缓存（用于准确性测试）
   */
  public disableCache(): void {
    this.cacheProcessor.disable();
  }

  /**
   * 启用缓存
   */
  public enableCache(): void {
    this.cacheProcessor.enable();
  }

  getProcessingSteps(): string[] {
    return [
      'Input validation',
      'Layer 0: Text extraction',
      'Layer 1: Filter (OCR quality + doc type)',
      'Layer 2: AI core understanding',
      'Layer 3: Rule validation',
      'Layer 4: Reviewer check',
      'Layer 5: Cache',
    ];
  }

  /**
   * 初始化Agent
   */
  async initialize(): Promise<void> {
    logger.info('DocAnalyzerAgent初始化', { version: this.version });

    // 初始化AIReviewer
    if (this.aiReviewer) {
      await this.initializeAIReviewer();
    }
  }

  /**
   * 设置审查器
   */
  private setupReviewers(): void {
    this.aiReviewer = new AIReviewer();
    this.ruleReviewer = new RuleReviewer();

    this.reviewerManager.registerReviewer(this.aiReviewer);
    this.reviewerManager.registerReviewer(this.ruleReviewer);

    logger.info('审查器已注册', { count: 2 });
  }

  /**
   * 初始化AIReviewer
   */
  private async initializeAIReviewer(): Promise<void> {
    if (!this.aiReviewer) {
      return;
    }

    try {
      const aiService = await this.aiProcessor.getAIService();
      if (aiService) {
        await this.aiReviewer.initialize(aiService);
        logger.info('AIReviewer初始化成功');
      }
    } catch (error) {
      logger.warn('AIReviewer初始化失败', error);
    }
  }

  protected async executeLogic(
    context: AgentContext
  ): Promise<DocumentAnalysisOutput> {
    const input = context.data as unknown as DocumentAnalysisInput;
    const startTime = Date.now();

    try {
      // Layer 0: 输入验证
      const { validateInput } = await import('./validators');
      validateInput(input);

      // Layer 0: 文本提取
      let extractedText = input.content || '';
      if (!extractedText) {
        extractedText = await this.textExtractor.extractText(
          input.filePath,
          input.fileType
        );
      }

      if (!extractedText?.trim()) {
        throw new AnalysisError(
          '无法从文档中提取有效文本内容',
          new Error('文档内容为空'),
          { documentId: input.documentId }
        );
      }

      // Layer 5: 缓存检查
      const cached = await this.cacheProcessor.get(
        input.documentId,
        input.fileType,
        extractedText
      );

      if (cached) {
        return { ...cached, processingTime: Date.now() - startTime };
      }

      // Layer 1: 快速过滤（OCR质量检查、文档类型分类、基础格式校验）
      const filterResult = await this.filterProcessor.process(extractedText);
      if (!filterResult.passed) {
        throw new AnalysisError(
          `文档质量检查未通过：${filterResult.reason || '未知原因'}`,
          new Error(filterResult.reason || '质量检查失败'),
          {
            documentId: input.documentId,
            qualityScore: filterResult.qualityScore,
            warnings: filterResult.warnings,
          }
        );
      }

      const filteredText = filterResult.filteredText;
      const documentType = filterResult.documentType;

      // Layer 2: AI核心理解（当事人角色识别、诉讼请求分类、金额模糊识别）
      const aiResult = await this.aiProcessor.process(filteredText);

      // Layer 3: 规则验证（算法兜底，使用AmountExtractor和ClaimExtractor）
      const ruleResult = await this.ruleProcessor.process(
        aiResult.extractedData,
        filteredText
      );

      // Layer 3.5: 法定代表人过滤（在规则验证后进行）
      const legalRepFilterResult =
        await this.legalRepFilter.applyToExtractedData(
          filteredText,
          ruleResult.data
        );

      // Layer 3.6: 时间线提取（新增）
      const timelineReport = this.timelineExtractor.extractTimeline(
        filteredText,
        legalRepFilterResult
      );
      legalRepFilterResult.timeline = timelineReport.events;

      // Layer 3.7: 证据分析（新增，可选）
      let evidenceAnalysis;
      if (input.options?.analyzeEvidence) {
        evidenceAnalysis = this.evidenceAnalyzer.analyze(
          filteredText,
          legalRepFilterResult
        );
      }

      // Layer 3.8: 综合分析（新增，可选）
      let comprehensiveAnalysis;
      if (input.options?.comprehensiveAnalysis) {
        comprehensiveAnalysis = this.comprehensiveAnalyzer.analyze(
          legalRepFilterResult.parties,
          legalRepFilterResult.claims,
          timelineReport.events,
          evidenceAnalysis
        );
      }

      // Layer 4: Reviewer审查（AI + 规则，独立质量检查）
      const reviewConfig = DEFAULT_CONFIG.reviewers.aiReviewer.enabled
        ? DEFAULT_CONFIG.reviewers.aiReviewer
        : { enabled: false, threshold: 0.7 };
      const reviewResult = await this.reviewerManager.review(
        legalRepFilterResult,
        filteredText,
        reviewConfig
      );

      // 应用审查结果修正
      let finalExtractedData = legalRepFilterResult;
      if (reviewResult.corrections && reviewResult.corrections.length > 0) {
        finalExtractedData = this.applyCorrections(
          legalRepFilterResult,
          reviewResult.corrections
        );
        logger.info('应用AI审查修正', {
          count: reviewResult.corrections.length,
          types: reviewResult.corrections.map(c => c.type),
        });
      }

      // 计算综合置信度
      let confidence = aiResult.confidence;
      if (reviewResult.score < 0.7) {
        logger.warn('审查评分低于阈值', { score: reviewResult.score });
        confidence = Math.min(confidence, reviewResult.score);
      }

      // 收集所有警告信息
      const warnings: string[] = [];

      // 从过滤器添加警告
      if (filterResult.warnings && filterResult.warnings.length > 0) {
        warnings.push(...filterResult.warnings);
      }

      // 从规则处理器添加警告（基于corrections）
      if (ruleResult.corrections && ruleResult.corrections.length > 0) {
        ruleResult.corrections.forEach((correction: Correction) => {
          if (
            correction.type === 'OTHER' ||
            correction.description.includes('缺少') ||
            correction.description.includes('推断')
          ) {
            warnings.push(correction.description);
          }
        });
      }

      const output: DocumentAnalysisOutput = {
        success: true,
        extractedData: finalExtractedData,
        confidence,
        processingTime: Date.now() - startTime,
        metadata: {
          wordCount: this.textExtractor.countWords(filteredText),
          analysisModel: 'zhipu-glm-4.6-modular',
          tokenUsed: aiResult.tokenUsed,
          analysisProcess: {
            ...aiResult.analysisProcess,
            documentType,
            filterQualityScore: filterResult.qualityScore,
            filterWarnings: filterResult.warnings,
          } as AnalysisProcess,
          evidenceAnalysis,
          comprehensiveAnalysis,
          warnings, // 添加警告信息到metadata
        },
      };

      // Layer 5: 缓存存储
      await this.cacheProcessor.set(
        input.documentId,
        input.fileType,
        extractedText,
        output
      );

      logger.info('文档分析完成', {
        documentId: input.documentId,
        processingTime: output.processingTime,
        confidence: output.confidence,
        reviewScore: reviewResult.score,
        documentType,
        filterQualityScore: filterResult.qualityScore,
      });

      return output;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('文档分析失败', error, {
        documentId: input.documentId,
        processingTime,
      });

      if (error instanceof AnalysisError) {
        throw error;
      }

      throw new AnalysisError(
        `文档分析失败: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
        { documentId: input.documentId }
      );
    }
  }

  /**
   * 应用审查结果修正
   * 根据Reviewer返回的corrections实际修改数据
   */
  private applyCorrections(
    data: DocumentAnalysisOutput['extractedData'],
    corrections: unknown[]
  ): DocumentAnalysisOutput['extractedData'] {
    const result = {
      ...data,
      parties: [...data.parties],
      claims: [...data.claims],
      disputeFocuses: data.disputeFocuses ? [...data.disputeFocuses] : [],
      timeline: data.timeline ? [...data.timeline] : [],
      keyFacts: data.keyFacts ? [...data.keyFacts] : [],
    };

    for (const correction of corrections) {
      const typedCorrection = correction as {
        type: string;
        correctedValue?: {
          name?: string;
          role?: string;
          type?: string;
          content?: string;
          amount?: number;
          currency?: string;
        };
      };
      switch (typedCorrection.type) {
        case 'ADD_PARTY':
          // 添加遗漏的当事人
          if (typedCorrection.correctedValue) {
            const newParty = typedCorrection.correctedValue as {
              name?: string;
              role?: string;
              type?: 'plaintiff' | 'defendant' | 'other';
            };
            const exists = result.parties.some(p => p.name === newParty.name);
            if (!exists && newParty.name) {
              result.parties.push({
                type: newParty.type || 'other',
                name: newParty.name,
                role: newParty.role,
              });
              logger.debug('应用修正：添加当事人', {
                name: newParty.name,
              });
            }
          }
          break;

        case 'FIX_ROLE':
          // 修正当事人角色
          if (
            typedCorrection.correctedValue &&
            typedCorrection.correctedValue.name
          ) {
            const partyIndex = result.parties.findIndex(
              p => p.name === typedCorrection.correctedValue.name
            );
            if (partyIndex >= 0) {
              result.parties[partyIndex] = {
                ...result.parties[partyIndex],
                role: typedCorrection.correctedValue.role,
              };
              logger.debug('应用修正：修正角色', {
                name: typedCorrection.correctedValue.name,
                oldRole: result.parties[partyIndex].role,
                newRole: typedCorrection.correctedValue.role,
              });
            }
          }
          break;

        case 'ADD_CLAIM':
          // 添加遗漏的诉讼请求
          if (typedCorrection.correctedValue) {
            const newClaim = typedCorrection.correctedValue as {
              type?: string;
              content?: string;
              amount?: number;
              currency?: string;
            };
            const exists = result.claims.some(
              c => c.type === newClaim.type && c.content === newClaim.content
            );
            if (!exists && newClaim.type && newClaim.content) {
              result.claims.push({
                type: newClaim.type as
                  | 'PAY_PRINCIPAL'
                  | 'PAY_INTEREST'
                  | 'PAY_PENALTY'
                  | 'PAY_DAMAGES'
                  | 'LITIGATION_COST'
                  | 'PERFORMANCE'
                  | 'TERMINATION'
                  | 'OTHER',
                content: newClaim.content,
                amount: newClaim.amount,
                currency: newClaim.currency || 'CNY',
              });
              logger.debug('应用修正：添加诉讼请求', {
                type: newClaim.type,
                content: newClaim.content,
              });
            }
          }
          break;

        case 'FIX_AMOUNT':
          // 修正金额
          if (
            typedCorrection.correctedValue &&
            typedCorrection.correctedValue.type
          ) {
            const claimIndex = result.claims.findIndex(
              c => c.type === typedCorrection.correctedValue.type
            );
            if (claimIndex >= 0) {
              result.claims[claimIndex] = {
                ...result.claims[claimIndex],
                amount: typedCorrection.correctedValue.amount,
              };
              logger.debug('应用修正：修正金额', {
                type: typedCorrection.correctedValue.type,
                oldAmount: result.claims[claimIndex].amount,
                newAmount: typedCorrection.correctedValue.amount,
              });
            }
          }
          break;

        default:
          logger.debug('未知修正类型', { type: typedCorrection.type });
          break;
      }
    }

    return result;
  }

  async cleanup(): Promise<void> {
    logger.info('DocAnalyzerAgent清理');
  }

  /**
   * 获取缓存处理器
   */
  getCacheProcessor(): CacheProcessor {
    return this.cacheProcessor;
  }

  /**
   * 获取DocAnalyzerAgent特定的容错配置
   */
  protected getFaultToleranceConfig(): AgentFaultToleranceConfig {
    return createFaultToleranceConfig({
      retry: createRetryConfig({
        maxRetries: 3,
        backoffMs: [1000, 2000, 4000],
        retryableErrors: [
          'TIMEOUT',
          'AI_SERVICE_ERROR',
          'NETWORK_ERROR',
          'RATE_LIMIT_ERROR',
          'ECONNREFUSED',
          'ETIMEDOUT',
        ],
      }),
      fallback: createFallbackConfig({
        enabled: true,
        fallbackType: 'SIMPLE',
        fallbackFunction: this.createFallbackResult.bind(this),
      }),
      circuitBreaker: createCircuitBreakerConfig({
        enabled: true,
        failureThreshold: 0.5,
        timeout: 60000,
        halfOpenRequests: 3,
      }),
    });
  }

  /**
   * 创建降级结果
   * 当文档解析失败时返回降级结果
   */
  private async createFallbackResult(
    error: unknown,
    context: AgentContext
  ): Promise<DocumentAnalysisOutput> {
    const input = context.data as unknown as DocumentAnalysisInput;

    logger.warn('文档解析降级到简化结果', {
      documentId: input.documentId,
      error: error instanceof Error ? error.message : String(error),
    });

    // 返回简化结果，标记置信度为0
    return {
      success: true,
      extractedData: {
        parties: [],
        claims: [],
      },
      confidence: 0.0,
      processingTime: 0,
      metadata: {
        wordCount: 0,
        analysisModel: 'fallback-simple',
        tokenUsed: 0,
        analysisProcess: {
          ocrErrors: [error instanceof Error ? error.message : 'Unknown'],
          entitiesListed: {
            persons: [],
            companies: [],
            amounts: [],
          },
          roleReasoning: 'Fallback - no analysis performed',
          claimDecomposition: 'Fallback - no analysis performed',
          amountNormalization: 'Fallback - no analysis performed',
          validationResults: {
            duplicatesFound: [],
            roleConflicts: [],
            missingClaims: [],
            amountInconsistencies: [],
          },
        },
      },
    };
  }
}
