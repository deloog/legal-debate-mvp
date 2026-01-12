/**
 * 增量分析器（IncrementalAnalyzer）
 * 负责对新增的资料进行分析，复用历史分析结果
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

/**
 * 增量分析器类
 */
export class IncrementalAnalyzer {
  private config: IncrementalAnalysisConfig;

  constructor(config?: Partial<IncrementalAnalysisConfig>) {
    this.config = {
      ...DEFAULT_INCREMENTAL_CONFIG,
      ...config,
    };
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
   * 分析文档资料（模拟实现）
   */
  private async analyzeDocument(
    material: Material
  ): Promise<DocumentAnalysisOutput> {
    // TODO: 这里应该调用实际的 DocAnalyzer 服务
    return {
      parties: [
        {
          name: '原告',
          role: 'plaintiff',
          confidence: 0.95,
        },
        {
          name: '被告',
          role: 'defendant',
          confidence: 0.9,
        },
      ],
      claims: [],
      facts: [material.content.substring(0, 100)],
      keyDates: [],
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * 分析法条资料（模拟实现）
   */
  private async analyzeLawArticle(
    material: Material
  ): Promise<LawArticleApplicabilityResult> {
    // TODO: 这里应该调用实际的 ApplicabilityAnalyzer 服务
    return {
      articleId: material.id,
      lawName: '模拟法条',
      articleNumber: '第1条',
      applicable: true,
      score: 0.8,
      reasons: ['相关性较高'],
      warnings: [],
    };
  }

  /**
   * 分析证据资料（模拟实现）
   */
  private async analyzeEvidence(
    material: Material
  ): Promise<EvidenceAnalysisResult> {
    // TODO: 这里应该调用实际的证据分析服务
    return {
      evidenceId: material.id,
      content: material.content,
      relevance: 0.85,
      strength: 7,
      credibility: 8,
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
        console.warn(`任务 ${task.id} 超时: ${elapsed}ms`);
      }

      return result;
    } catch (error) {
      console.error(`任务 ${task.id} 分析失败:`, error);
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
          console.error('任务执行失败:', result.reason);
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
