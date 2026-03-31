// GenerationAgent：生成法律文书和辩论内容的核心代理

import { CaseInfo, DebateGenerationResult } from '@/types/debate';
import type { LawArticle } from '@prisma/client';
import {
  DocumentGenerator,
  DebateContentWrapper,
  StreamGenerator,
  ContentOptimizer,
} from '.';
import {
  GenerationAgentConfig,
  GenerationInput,
  GenerationOutput,
} from './types';

/**
 * GenerationAgent：生成法律文书和辩论内容的核心代理
 */
export class GenerationAgent {
  private config: GenerationAgentConfig;
  private documentGenerator: DocumentGenerator;
  private debateWrapper: DebateContentWrapper;
  private streamGenerator: StreamGenerator;
  private contentOptimizer: ContentOptimizer;

  constructor(config?: Partial<GenerationAgentConfig>) {
    this.config = {
      defaultFormat: config?.defaultFormat ?? 'legal',
      enableStream: config?.enableStream ?? true,
      streamChunkSize: config?.streamChunkSize ?? 200,
      streamDelayMs: config?.streamDelayMs ?? 100,
      autoOptimize: config?.autoOptimize ?? true,
      optimizationLevel: config?.optimizationLevel ?? 'medium',
      aiProvider: config?.aiProvider ?? 'deepseek',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
    };

    this.documentGenerator = new DocumentGenerator({
      format: this.config.defaultFormat,
      includeHeader: true,
      includeFooter: true,
      dateFormat: 'zh-CN',
    });

    this.debateWrapper = new DebateContentWrapper({
      balanceStrictness: 'medium',
      includeLegalAnalysis: true,
      maxArgumentsPerSide: 3,
      qualityThreshold: 0.7,
    });

    this.streamGenerator = new StreamGenerator({
      chunkSize: this.config.streamChunkSize,
      delayMs: this.config.streamDelayMs,
      format: 'sse',
    });

    this.contentOptimizer = new ContentOptimizer({
      clarityLevel: this.config.optimizationLevel,
      logicCheck: true,
      formatStandard: this.config.defaultFormat,
    });
  }

  /**
   * 生成法律文书
   */
  async generateDocument(input: GenerationInput): Promise<GenerationOutput> {
    const { type, caseInfo, lawArticles = [], options } = input;

    if (type === 'debate') {
      throw new Error('请使用 generateDebate 方法生成辩论内容');
    }

    let output: GenerationOutput;

    switch (type) {
      case 'complaint':
        output = this.documentGenerator.generateComplaint(
          caseInfo,
          lawArticles,
          options
        );
        break;
      case 'answer':
        output = this.documentGenerator.generateAnswer(
          caseInfo,
          lawArticles,
          options
        );
        break;
      case 'evidence':
        output = this.documentGenerator.generateEvidence(caseInfo, [], options);
        break;
      case 'appeal':
        output = this.documentGenerator.generateAppeal(
          caseInfo,
          lawArticles,
          options
        );
        break;
      default:
        throw new Error(`不支持的文档类型: ${type}`);
    }

    // 自动优化
    if (this.config.autoOptimize) {
      const optimized = this.contentOptimizer.optimize(output.content);
      output.content = optimized.optimizedContent;
      output.qualityScore = optimized.optimizedScore;
    }

    return output;
  }

  /**
   * 生成辩论内容
   */
  async generateDebate(
    caseInfo: CaseInfo,
    lawArticles: LawArticle[]
  ): Promise<DebateGenerationResult> {
    const plaintiffArguments = this.generatePlaintiffArguments(
      caseInfo,
      lawArticles
    );
    const defendantArguments = this.generateDefendantArguments(
      caseInfo,
      lawArticles
    );

    const result = this.debateWrapper.wrapDebateResult(
      plaintiffArguments,
      defendantArguments,
      lawArticles
    );

    return result;
  }

  /**
   * 流式生成内容
   */
  async *generateStream(
    content: string
  ): AsyncGenerator<{ chunk: string; progress: number; finished: boolean }> {
    yield* this.streamGenerator.generateWithProgress(content);
  }

  /**
   * 生成起诉状
   */
  async generateComplaint(
    caseInfo: CaseInfo,
    lawArticles?: LawArticle[]
  ): Promise<GenerationOutput> {
    return this.generateDocument({
      type: 'complaint',
      caseInfo,
      lawArticles,
    });
  }

  /**
   * 生成答辩状
   */
  async generateAnswer(
    caseInfo: CaseInfo,
    lawArticles?: LawArticle[]
  ): Promise<GenerationOutput> {
    return this.generateDocument({
      type: 'answer',
      caseInfo,
      lawArticles,
    });
  }

  /**
   * 生成证据清单
   */
  async generateEvidence(caseInfo: CaseInfo): Promise<GenerationOutput> {
    return this.generateDocument({
      type: 'evidence',
      caseInfo,
      template: undefined,
      options: undefined,
    });
  }

  /**
   * 生成上诉状
   */
  async generateAppeal(
    caseInfo: CaseInfo,
    lawArticles?: LawArticle[]
  ): Promise<GenerationOutput> {
    return this.generateDocument({
      type: 'appeal',
      caseInfo,
      lawArticles,
    });
  }

  /**
   * 优化内容
   */
  optimizeContent(content: string): string {
    const result = this.contentOptimizer.optimize(content);
    return result.optimizedContent;
  }

  /**
   * 评估内容质量
   */
  assessContentQuality(content: string) {
    return this.contentOptimizer.assessQuality(content);
  }

  /**
   * 生成原告论点
   */
  private generatePlaintiffArguments(
    caseInfo: CaseInfo,
    lawArticles: LawArticle[]
  ) {
    return [
      {
        side: 'plaintiff' as const,
        content: `根据案件事实，${caseInfo.title}`,
        legalBasis: lawArticles[0]
          ? `《${lawArticles[0].lawName}》${lawArticles[0].articleNumber}`
          : undefined,
        reasoning: '基于上述事实和法律依据，原告的主张具有充分理由。',
        score: 0.85,
        evidenceRefs: [],
      },
      {
        side: 'plaintiff' as const,
        content: '被告的行为已构成违约，应承担相应的法律责任。',
        legalBasis: undefined,
        reasoning: '根据合同法相关规定，违约方应当承担违约责任。',
        score: 0.8,
        evidenceRefs: [],
      },
      {
        side: 'plaintiff' as const,
        content: '请求法院判令被告履行合同义务，赔偿原告损失。',
        legalBasis: undefined,
        reasoning: '为维护原告合法权益，请求法院依法裁判。',
        score: 0.9,
        evidenceRefs: [],
      },
    ];
  }

  /**
   * 生成被告论点
   */
  private generateDefendantArguments(
    _caseInfo: CaseInfo,
    _lawArticles: LawArticle[]
  ) {
    return [
      {
        side: 'defendant' as const,
        content: '原告的主张缺乏事实和法律依据。',
        legalBasis: undefined,
        reasoning: '原告未能提供充分证据证明其主张。',
        score: 0.8,
        evidenceRefs: [],
      },
      {
        side: 'defendant' as const,
        content: '被告已履行合同义务，不存在违约行为。',
        legalBasis: undefined,
        reasoning: '根据合同约定和相关事实，被告已履行全部义务。',
        score: 0.85,
        evidenceRefs: [],
      },
      {
        side: 'defendant' as const,
        content: '请求法院驳回原告的全部诉讼请求。',
        legalBasis: undefined,
        reasoning: '原告的诉讼请求没有事实和法律依据，不应予以支持。',
        score: 0.9,
        evidenceRefs: [],
      },
    ];
  }

  /**
   * 获取配置
   */
  getConfig(): GenerationAgentConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<GenerationAgentConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.defaultFormat) {
      this.documentGenerator.updateConfig({ format: config.defaultFormat });
      this.contentOptimizer.updateOptions({
        formatStandard: config.defaultFormat,
      });
    }

    if (config.streamChunkSize || config.streamDelayMs) {
      this.streamGenerator.updateConfig({
        chunkSize: config.streamChunkSize ?? this.config.streamChunkSize,
        delayMs: config.streamDelayMs ?? this.config.streamDelayMs,
      });
    }

    if (config.optimizationLevel) {
      this.contentOptimizer.updateOptions({
        clarityLevel: config.optimizationLevel,
      });
    }
  }

  /**
   * 获取文档生成器
   */
  getDocumentGenerator(): DocumentGenerator {
    return this.documentGenerator;
  }

  /**
   * 获取辩论包装器
   */
  getDebateWrapper(): DebateContentWrapper {
    return this.debateWrapper;
  }

  /**
   * 获取流式生成器
   */
  getStreamGenerator(): StreamGenerator {
    return this.streamGenerator;
  }

  /**
   * 获取内容优化器
   */
  getContentOptimizer(): ContentOptimizer {
    return this.contentOptimizer;
  }

  /**
   * 获取质量评估结果
   */
  getQualityMetrics(content: string) {
    return this.contentOptimizer.assessQuality(content);
  }

  /**
   * 批量生成文档
   */
  async batchGenerateDocuments(
    inputs: GenerationInput[]
  ): Promise<GenerationOutput[]> {
    const results: GenerationOutput[] = [];

    for (const input of inputs) {
      const result = await this.generateDocument(input);
      results.push(result);
    }

    return results;
  }
}

// 导出所有模块
export { DocumentGenerator } from './document-generator';
export { DebateContentWrapper } from './debate-content-wrapper';
export { StreamGenerator } from './stream-generator';
export { ContentOptimizer } from './content-optimizer';
export * from './types';
