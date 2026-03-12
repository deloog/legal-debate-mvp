/**
 * 增量分析器（IncrementalAnalyzer）
 * 负责对新增的资料进行分析，复用历史分析结果
 *
 * 已集成真实分析服务：
 * - DocAnalyzerAgent: 文档分析
 * - ApplicabilityAnalyzer: 法条适用性分析
 * - EvidenceChainAnalyzer: 证据链分析
 */

import {
  AnalysisTask,
  DEFAULT_INCREMENTAL_CONFIG,
  DiffResult,
  DocumentAnalysisOutput,
  EvidenceAnalysisResult,
  IncrementalAnalysisConfig,
  LawArticleApplicabilityResult,
  Material,
} from './types';

// 导入真实分析服务
import { DocAnalyzerAgent } from '../../agent/doc-analyzer';
import { ApplicabilityAnalyzer } from '../../agent/legal-agent/applicability-analyzer';
import { EvidenceChainAnalyzer } from '../../evidence/evidence-chain-analyzer';
import { AgentContext, TaskPriority } from '../../../types/agent';
import { logger } from '@/lib/logger';

/**
 * 增量分析器类
 */
export class IncrementalAnalyzer {
  private config: IncrementalAnalysisConfig;
  private docAnalyzer: DocAnalyzerAgent;
  private applicabilityAnalyzer: ApplicabilityAnalyzer;
  private evidenceAnalyzer: EvidenceChainAnalyzer;

  constructor(config?: Partial<IncrementalAnalysisConfig>) {
    this.config = {
      ...DEFAULT_INCREMENTAL_CONFIG,
      ...config,
    };

    // 初始化真实分析服务
    this.docAnalyzer = new DocAnalyzerAgent();
    this.applicabilityAnalyzer = new ApplicabilityAnalyzer();
    this.evidenceAnalyzer = new EvidenceChainAnalyzer();
  }

  /**
   * 根据差异创建分析任务
   */
  private createAnalysisTasks(diff: DiffResult): AnalysisTask[] {
    const tasks: AnalysisTask[] = [];

    // 只对新增和修改的资料进行分析
    for (const material of [...diff.added, ...diff.modified]) {
      const task: AnalysisTask = {
        id: `task_${material.id}`,
        type: this.determineAnalysisType(material),
        material,
        priority: this.determinePriority(material),
      };
      tasks.push(task);
    }

    // 按优先级排序
    return tasks.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 根据资料类型确定分析类型
   */
  private determineAnalysisType(material: Material): AnalysisTask['type'] {
    switch (material.type) {
      case 'DOCUMENT':
        return 'DOCUMENT_ANALYSIS';
      case 'LAW_ARTICLE':
        return 'LAW_SEARCH';
      case 'EVIDENCE':
        return 'EVIDENCE_ANALYSIS';
      case 'ARGUMENT':
        return 'DOCUMENT_ANALYSIS';
      default:
        return 'DOCUMENT_ANALYSIS';
    }
  }

  /**
   * 根据资料属性确定优先级
   */
  private determinePriority(material: Material): AnalysisTask['priority'] {
    const metadata = material.metadata;
    const priority = metadata.priority;

    if (priority === 'high' || priority === 'medium' || priority === 'low') {
      return priority;
    }

    switch (material.type) {
      case 'DOCUMENT':
        return 'high';
      case 'EVIDENCE':
        return 'high';
      case 'LAW_ARTICLE':
        return 'medium';
      default:
        return 'medium';
    }
  }

  /**
   * 分析文档资料（使用真实 DocAnalyzerAgent）
   */
  private async analyzeDocument(
    material: Material
  ): Promise<DocumentAnalysisOutput> {
    try {
      // 构建 DocAnalyzer 输入
      const filePath = String(material.metadata?.filePath || '');
      const context: AgentContext = {
        task: `doc_analysis_${material.id}`,
        priority: TaskPriority.HIGH,
        data: {
          documentId: material.id,
          content: material.content,
          filePath: filePath,
          fileType: this.detectFileType(filePath),
          options: {
            extractParties: true,
            extractClaims: true,
            extractTimeline: true,
            extractKeyFacts: true,
          },
        },
        metadata: {
          source: material.metadata.source,
          round: material.metadata.round,
        },
      };

      // 调用真实 DocAnalyzer
      const result = await this.docAnalyzer.execute(context);

      // 转换输出格式
      return this.convertDocAnalyzerOutput(result);
    } catch (error) {
      logger.error(`文档分析失败 (${material.id}):`, error);
      // 降级返回基础结果
      return this.createFallbackDocumentOutput(material);
    }
  }

  /**
   * 检测文件类型
   */
  private detectFileType(
    filePath: string
  ): 'PDF' | 'DOCX' | 'DOC' | 'TXT' | 'IMAGE' {
    const ext = filePath.toLowerCase().split('.').pop() || '';
    switch (ext) {
      case 'pdf':
        return 'PDF';
      case 'docx':
        return 'DOCX';
      case 'doc':
        return 'DOC';
      case 'png':
      case 'jpg':
      case 'jpeg':
        return 'IMAGE';
      default:
        return 'TXT';
    }
  }

  /**
   * 转换 DocAnalyzer 输出格式
   */
  private convertDocAnalyzerOutput(result: unknown): DocumentAnalysisOutput {
    const typedResult = result as {
      extractedData?: {
        parties?: Array<{ name: string; type: string; role?: string }>;
        claims?: Array<{
          type: string;
          content: string;
          amount?: number;
        }>;
        timeline?: Array<{ date: string; event: string; importance?: number }>;
        keyFacts?: Array<{ description: string }>;
      };
      confidence?: number;
    };

    const extractedData = typedResult?.extractedData || {};

    return {
      parties: (extractedData.parties || []).map(p => ({
        name: p.name || '未知',
        role: (p.type as 'plaintiff' | 'defendant' | 'other') || 'other',
        confidence: typedResult?.confidence || 0.8,
      })),
      claims: (extractedData.claims || []).map(c => ({
        type: c.type || 'OTHER',
        content: c.content || '',
        amount: c.amount,
        confidence: typedResult?.confidence || 0.8,
      })),
      facts: (extractedData.keyFacts || []).map(f => f.description || ''),
      keyDates: (extractedData.timeline || []).map(t => ({
        date: new Date(t.date),
        event: t.event || '',
        importance: t.importance || 5,
      })),
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * 创建降级文档输出
   */
  private createFallbackDocumentOutput(
    material: Material
  ): DocumentAnalysisOutput {
    return {
      parties: [],
      claims: [],
      facts: material.content ? [material.content.substring(0, 200)] : [],
      keyDates: [],
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * 分析法条资料（使用真实 ApplicabilityAnalyzer）
   */
  private async analyzeLawArticle(
    material: Material
  ): Promise<LawArticleApplicabilityResult> {
    try {
      // 构建法条对象
      const lawArticle = {
        id: material.id,
        lawName: (material.metadata?.lawName as string) || '未知法律',
        articleNumber:
          (material.metadata?.articleNumber as string) || '未知条款',
        content: material.content,
        category: (material.metadata?.category as string) || 'civil', // 默认民事类
        keywords: this.extractKeywords(material.content),
        deprecated: false,
        effectiveDate: material.metadata?.effectiveDate as string | undefined,
        scope: material.metadata?.scope as string[] | undefined,
      };

      // 构建案件信息
      const caseInfo = material.metadata?.caseInfo || {
        description: material.content.substring(0, 500),
        caseType: material.metadata?.caseType || 'civil',
      };

      // 调用真实 ApplicabilityAnalyzer
      const result = await this.applicabilityAnalyzer.analyze(
        {
          articles: [lawArticle],
          caseInfo,
        },
        {
          threshold: 0.6,
          enableAIReview: true,
        }
      );

      // 转换输出格式
      return this.convertApplicabilityOutput(material, result);
    } catch (error) {
      logger.error(`法条适用性分析失败 (${material.id}):`, error);
      // 降级返回基础结果
      return this.createFallbackLawArticleOutput(material);
    }
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    const legalKeywords = [
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
      '担保',
      '抵押',
      '质押',
      '保证',
      '债务',
      '债权',
      '诉讼',
      '仲裁',
      '调解',
      '执行',
    ];

    return legalKeywords.filter(keyword =>
      content.toLowerCase().includes(keyword)
    );
  }

  /**
   * 转换适用性分析输出格式
   */
  private convertApplicabilityOutput(
    material: Material,
    result: {
      applicableArticles: unknown[];
      overallScore: number;
      semanticScores: Map<string, number>;
      aiReview?: { comments?: string[] };
    }
  ): LawArticleApplicabilityResult {
    const isApplicable = result.applicableArticles.length > 0;
    const score = result.semanticScores.get(material.id) || result.overallScore;

    return {
      articleId: material.id,
      lawName: (material.metadata?.lawName as string) || '未知法律',
      articleNumber: (material.metadata?.articleNumber as string) || '未知条款',
      applicable: isApplicable,
      score: score,
      reasons:
        result.aiReview?.comments || (isApplicable ? ['法条与案件相关'] : []),
      warnings: isApplicable ? [] : ['法条适用性较低，建议人工复核'],
    };
  }

  /**
   * 创建降级法条分析输出
   */
  private createFallbackLawArticleOutput(
    material: Material
  ): LawArticleApplicabilityResult {
    return {
      articleId: material.id,
      lawName: (material.metadata?.lawName as string) || '未知法律',
      articleNumber: (material.metadata?.articleNumber as string) || '未知条款',
      applicable: false,
      score: 0,
      reasons: ['分析服务暂时不可用'],
      warnings: ['需要人工复核'],
    };
  }

  /**
   * 分析证据资料（使用真实 EvidenceChainAnalyzer）
   */
  private async analyzeEvidence(
    material: Material
  ): Promise<EvidenceAnalysisResult> {
    try {
      // 构建证据对象
      const evidence = {
        id: material.id,
        name: (material.metadata?.name as string) || `证据_${material.id}`,
        type: this.detectEvidenceType(material),
        status: 'SUBMITTED' as const,
        relevanceScore: 50, // 默认值，将由分析器计算
        content: material.content,
      };

      // 获取已有的关联关系
      const existingRelations =
        (material.metadata?.relations as Array<{
          evidenceId: string;
          relationType: string;
          relatedId: string;
          description?: string;
        }>) || [];

      // 获取案件ID
      const caseId = (material.metadata?.caseId as string) || 'default_case';

      // 调用真实 EvidenceChainAnalyzer
      const result = this.evidenceAnalyzer.analyzeEvidenceChain({
        caseId,
        evidences: [evidence],
        existingRelations,
      });

      // 转换输出格式
      return this.convertEvidenceOutput(material, result);
    } catch (error) {
      logger.error(`证据分析失败 (${material.id}):`, error);
      // 降级返回基础结果
      return this.createFallbackEvidenceOutput(material);
    }
  }

  /**
   * 检测证据类型
   */
  private detectEvidenceType(
    material: Material
  ):
    | 'PHYSICAL'
    | 'DOCUMENTARY'
    | 'WITNESS'
    | 'EXPERT'
    | 'AUDIO_VIDEO'
    | 'ELECTRONIC'
    | 'OTHER' {
    const content = material.content.toLowerCase();
    const metadata = material.metadata;

    // 根据元数据判断
    if (metadata?.evidenceType) {
      return metadata.evidenceType as
        | 'PHYSICAL'
        | 'DOCUMENTARY'
        | 'WITNESS'
        | 'EXPERT'
        | 'AUDIO_VIDEO'
        | 'ELECTRONIC'
        | 'OTHER';
    }

    // 根据内容关键词判断
    if (content.includes('证人') || content.includes('陈述')) {
      return 'WITNESS';
    }
    if (content.includes('鉴定') || content.includes('专家')) {
      return 'EXPERT';
    }
    if (
      content.includes('录音') ||
      content.includes('视频') ||
      content.includes('录像')
    ) {
      return 'AUDIO_VIDEO';
    }
    if (
      content.includes('电子邮件') ||
      content.includes('微信') ||
      content.includes('短信')
    ) {
      return 'ELECTRONIC';
    }
    if (
      content.includes('合同') ||
      content.includes('协议') ||
      content.includes('收据')
    ) {
      return 'DOCUMENTARY';
    }

    return 'OTHER';
  }

  /**
   * 转换证据分析输出格式
   */
  private convertEvidenceOutput(
    material: Material,
    result: {
      summary: {
        averageEffectiveness: number;
        chainCount: number;
      };
      effectivenessEvaluations: Map<
        string,
        { effectivenessScore: number; credibilityScore?: number }
      >;
      chainGraph: {
        coreEvidences: unknown[];
      };
    }
  ): EvidenceAnalysisResult {
    const evaluation = result.effectivenessEvaluations.get(material.id);
    const effectiveness = evaluation?.effectivenessScore || 50;
    const credibility = evaluation?.credibilityScore || 70;

    // 计算相关性（基于是否为核心证据）
    const isCoreEvidence = result.chainGraph.coreEvidences.some(
      (e: unknown) => (e as { id: string }).id === material.id
    );
    const relevance = isCoreEvidence ? 0.9 : effectiveness / 100;

    // 计算强度（0-10 范围）
    const strength = Math.round(effectiveness / 10);

    // 计算可信度（0-10 范围）
    const credibilityScore = Math.round(credibility / 10);

    // 提取关联的诉讼请求
    const relatedClaims = (material.metadata?.relatedClaims as string[]) || [];

    return {
      evidenceId: material.id,
      content: material.content,
      relevance: Math.min(relevance, 1),
      strength: Math.min(strength, 10),
      credibility: Math.min(credibilityScore, 10),
      relatedClaims,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * 创建降级证据分析输出
   */
  private createFallbackEvidenceOutput(
    material: Material
  ): EvidenceAnalysisResult {
    return {
      evidenceId: material.id,
      content: material.content,
      relevance: 0.5,
      strength: 5,
      credibility: 5,
      relatedClaims: [],
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * 执行单个分析任务
   */
  private async executeTask(task: AnalysisTask): Promise<unknown> {
    const startTime = Date.now();

    try {
      let result: unknown;

      switch (task.type) {
        case 'DOCUMENT_ANALYSIS':
          result = await this.analyzeDocument(task.material);
          break;
        case 'LAW_SEARCH':
          result = await this.analyzeLawArticle(task.material);
          break;
        case 'EVIDENCE_ANALYSIS':
          result = await this.analyzeEvidence(task.material);
          break;
        default:
          throw new Error(`未知分析类型: ${task.type}`);
      }

      const elapsed = Date.now() - startTime;
      if (elapsed > this.config.analysis.timeout) {
        logger.warn(`任务 ${task.id} 超时: ${elapsed}ms`);
      }

      return result;
    } catch (error) {
      logger.error(`任务 ${task.id} 分析失败:`, error);
      throw error;
    }
  }

  /**
   * 批量执行分析任务（带并发控制）
   */
  private async executeTasks(tasks: AnalysisTask[]): Promise<unknown[]> {
    const results: unknown[] = [];
    const maxConcurrent = this.config.analysis.maxConcurrent;

    for (let i = 0; i < tasks.length; i += maxConcurrent) {
      const batch = tasks.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(task => this.executeTask(task))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          logger.error('任务执行失败:', result.reason);
        }
      }
    }

    return results;
  }

  /**
   * 组织分析结果
   */
  private organizeResults(
    tasks: AnalysisTask[],
    results: unknown[]
  ): {
    newDocuments: DocumentAnalysisOutput[];
    newLawArticles: LawArticleApplicabilityResult[];
    newEvidence: EvidenceAnalysisResult[];
  } {
    const organized = {
      newDocuments: [] as DocumentAnalysisOutput[],
      newLawArticles: [] as LawArticleApplicabilityResult[],
      newEvidence: [] as EvidenceAnalysisResult[],
    };

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const result = results[i];

      if (!result) continue;

      switch (task.type) {
        case 'DOCUMENT_ANALYSIS':
          organized.newDocuments.push(result as DocumentAnalysisOutput);
          break;
        case 'LAW_SEARCH':
          organized.newLawArticles.push(
            result as LawArticleApplicabilityResult
          );
          break;
        case 'EVIDENCE_ANALYSIS':
          organized.newEvidence.push(result as EvidenceAnalysisResult);
          break;
      }
    }

    return organized;
  }

  /**
   * 执行增量分析
   */
  async analyze(diff: DiffResult): Promise<{
    newDocuments: DocumentAnalysisOutput[];
    newLawArticles: LawArticleApplicabilityResult[];
    newEvidence: EvidenceAnalysisResult[];
  }> {
    const tasks = this.createAnalysisTasks(diff);

    if (tasks.length === 0) {
      return {
        newDocuments: [],
        newLawArticles: [],
        newEvidence: [],
      };
    }

    const results = await this.executeTasks(tasks);
    return this.organizeResults(tasks, results);
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<IncrementalAnalysisConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): IncrementalAnalysisConfig {
    return { ...this.config };
  }
}
