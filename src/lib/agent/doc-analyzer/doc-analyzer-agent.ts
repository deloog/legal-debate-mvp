/**
 * DocAnalyzerAgent - 文档分析智能体主类
 * 
 * 集成所有模块，实现四层处理架构和Reviewer审查流程
 */

import { BaseAgent } from '../base-agent';
import { AgentType, AgentContext } from '../../../types/agent';
import {
  DocumentAnalysisOutput,
  DocumentAnalysisInput,
  DocAnalyzerConfig
} from './core/types';
import { DEFAULT_CONFIG } from './core/constants';
import { TextExtractor } from './extractors/text-extractor';
import { FilterProcessor } from './processors/filter-processor';
import { AIProcessor } from './processors/ai-processor';
import { RuleProcessor } from './processors/rule-processor';
import { CacheProcessor } from './processors/cache-processor';
import { LegalRepresentativeFilter } from './processors/legal-representative-filter';
import { ReviewerManager } from './reviewers/reviewer-manager';
import { AIReviewer } from './reviewers/ai-reviewer';
import { RuleReviewer } from './reviewers/rule-reviewer';
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

  constructor() {
    super();
    this.textExtractor = new TextExtractor();
    this.filterProcessor = new FilterProcessor();
    this.aiProcessor = new AIProcessor(DEFAULT_CONFIG);
    this.ruleProcessor = new RuleProcessor();
    this.legalRepFilter = new LegalRepresentativeFilter();
    this.cacheProcessor = new CacheProcessor({
      enabled: DEFAULT_CONFIG.cacheEnabled,
      ttl: DEFAULT_CONFIG.cacheTTL,
      namespace: 'doc-analyzer'
    });
    this.reviewerManager = new ReviewerManager();
    this.setupReviewers();
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
    return ['DOCUMENT_ANALYSIS', 'TEXT_EXTRACTION', 'STRUCTURED_DATA_EXTRACTION', 'QUALITY_REVIEW'];
  }

  getSupportedTasks(): string[] {
    return ['DOCUMENT_PARSE', 'DOCUMENT_ANALYZE', 'INFO_EXTRACT', 'QUALITY_CHECK'];
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

  getProcessingSteps(): string[] {
    return [
      'Input validation',
      'Layer 0: Text extraction',
      'Layer 1: Filter (OCR quality + doc type)',
      'Layer 2: AI core understanding',
      'Layer 3: Rule validation',
      'Layer 4: Reviewer check',
      'Layer 5: Cache'
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
      const unifiedService = await this.aiProcessor.getAIService();
      if (unifiedService) {
        await this.aiReviewer.initialize(unifiedService);
        logger.info('AIReviewer初始化成功');
      }
    } catch (error) {
      logger.warn('AIReviewer初始化失败', error);
    }
  }

  protected async executeLogic(context: AgentContext): Promise<DocumentAnalysisOutput> {
    const input = context.data as DocumentAnalysisInput;
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
        throw new AnalysisError('无法从文档中提取有效文本内容', new Error('文档内容为空'), { documentId: input.documentId });
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
            warnings: filterResult.warnings
          }
        );
      }

      const filteredText = filterResult.filteredText;
      const documentType = filterResult.documentType;

      // Layer 2: AI核心理解（当事人角色识别、诉讼请求分类、金额模糊识别）
      const aiResult = await this.aiProcessor.process(
        filteredText,
        input.options
      );

      // Layer 3: 规则验证（算法兜底，使用AmountExtractor和ClaimExtractor）
      const ruleResult = await this.ruleProcessor.process(
        aiResult.extractedData,
        filteredText
      );

      // Layer 3.5: 法定代表人过滤（在规则验证后进行）
      const legalRepFilterResult = await this.legalRepFilter.applyToExtractedData(
        filteredText,
        ruleResult.data
      );

      // Layer 4: Reviewer审查（AI + 规则，独立质量检查）
      const reviewResult = await this.reviewerManager.review(
        legalRepFilterResult,
        filteredText,
        DEFAULT_CONFIG.reviewers.aiReviewer.enabled ? DEFAULT_CONFIG.reviewers.aiReviewer : { enabled: false, threshold: 0.7, rules: [] }
      );

      // 计算综合置信度
      let confidence = aiResult.confidence;
      if (reviewResult.score < 0.7) {
        logger.warn('审查评分低于阈值', { score: reviewResult.score });
        confidence = Math.min(confidence, reviewResult.score);
      }

      const output: DocumentAnalysisOutput = {
        success: true,
        extractedData: legalRepFilterResult,
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
            filterWarnings: filterResult.warnings
          } as any
        }
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
        filterQualityScore: filterResult.qualityScore
      });

      return output;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('文档分析失败', error, { documentId: input.documentId, processingTime });

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

  async cleanup(): Promise<void> {
    logger.info('DocAnalyzerAgent清理');
  }

  /**
   * 获取缓存处理器
   */
  getCacheProcessor(): CacheProcessor {
    return this.cacheProcessor;
  }
}
