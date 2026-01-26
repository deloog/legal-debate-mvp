import { logger } from '@/lib/agent/security/logger';
import { prisma } from '../db/prisma';
import { SimilaritySearcherFactory } from '../ai/case/similarity-searcher';
import { CaseEmbeddingServiceFactory } from './embedding-service';
import { SuccessRateAnalyzerFactory } from '../ai/case/success-rate-analyzer';
import type {
  SimilaritySearchParams,
  SimilaritySearchResult,
  BatchSimilarityRequest,
  BatchSimilarityResult,
  SimilarityMethod,
  SuccessRateAnalysis,
  SuccessRateAnalysisParams,
} from '../../types/case-example';

/**
 * 相似案例服务类
 * 负责相似案例的查询和管理
 */
export class SimilarCaseService {
  private similaritySearcher: ReturnType<
    typeof SimilaritySearcherFactory.getInstance
  >;
  private embeddingService: ReturnType<
    typeof CaseEmbeddingServiceFactory.getInstance
  >;
  private successRateAnalyzer: ReturnType<
    typeof SuccessRateAnalyzerFactory.getInstance
  >;

  constructor() {
    this.similaritySearcher = SimilaritySearcherFactory.getInstance(
      'similar-case-service'
    );
    this.embeddingService = CaseEmbeddingServiceFactory.getInstance(
      'similar-case-service'
    );
    this.successRateAnalyzer = SuccessRateAnalyzerFactory.getInstance(
      'similar-case-service'
    );
  }

  /**
   * 检索相似案例
   */
  public async searchSimilarCases(
    params: SimilaritySearchParams
  ): Promise<SimilaritySearchResult> {
    const startTime = Date.now();

    try {
      // 获取查询案例
      const queryCase = await prisma.caseExample.findUnique({
        where: { id: params.caseId },
      });

      if (!queryCase) {
        throw new Error(`Case example not found: ${params.caseId}`);
      }

      // 检查是否有向量
      if (!queryCase.embedding || !Array.isArray(queryCase.embedding)) {
        throw new Error(`Embedding not found for case: ${params.caseId}`);
      }

      // 检查缓存
      const cached = this.similaritySearcher.getCache(params.caseId);
      if (cached) {
        logger.info('Similar cases found in cache', {
          caseId: params.caseId,
          count: cached.length,
        });
        return {
          caseId: params.caseId,
          matches: cached,
          totalMatches: cached.length,
          searchTime: Date.now() - startTime,
        };
      }

      // 构建查询条件
      const where = this.buildWhereClause(params);

      // 获取目标案例列表
      const targetCases = await prisma.caseExample.findMany({
        where: {
          ...where,
          id: { not: params.caseId }, // 排除自己
          embedding: { not: null }, // 只检索有向量的案例
        },
      });

      // 执行相似度检索
      const matches = await this.similaritySearcher.searchSimilarCases(
        queryCase.embedding as number[],
        targetCases
      );

      // 缓存结果
      this.similaritySearcher.setCache(params.caseId, matches);

      const searchTime = Date.now() - startTime;
      logger.info('Similar cases search completed', {
        caseId: params.caseId,
        totalCases: targetCases.length,
        matchedCases: matches.length,
        searchTime,
      });

      return {
        caseId: params.caseId,
        matches,
        totalMatches: matches.length,
        searchTime,
        metadata: {
          algorithm: this.similaritySearcher.getConfig().method,
          vectorDimension: (queryCase.embedding as number[]).length,
          casesSearched: targetCases.length,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to search similar cases', new Error(errorMessage), {
        caseId: params.caseId,
      });
      throw error;
    }
  }

  /**
   * 批量计算相似度
   */
  public async batchCalculateSimilarity(
    params: BatchSimilarityRequest
  ): Promise<BatchSimilarityResult> {
    try {
      // 获取查询案例
      const queryCase = await prisma.caseExample.findUnique({
        where: { id: params.caseId },
      });

      if (!queryCase) {
        throw new Error(`Case example not found: ${params.caseId}`);
      }

      if (!queryCase.embedding || !Array.isArray(queryCase.embedding)) {
        throw new Error(`Embedding not found for case: ${params.caseId}`);
      }

      // 获取目标案例
      const targetCases = await prisma.caseExample.findMany({
        where: {
          id: { in: params.targetIds },
        },
        select: {
          id: true,
          embedding: true,
        },
      });

      // 构建目标向量数组
      const targetEmbeddings = targetCases.map(c => ({
        id: c.id,
        embedding: c.embedding as number[],
      }));

      // 批量计算相似度
      const results = await this.similaritySearcher.batchCalculateSimilarity(
        queryCase.embedding as number[],
        targetEmbeddings
      );

      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;

      logger.info('Batch similarity calculation completed', {
        caseId: params.caseId,
        total: results.length,
        successful,
        failed,
      });

      return {
        total: results.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to batch calculate similarity',
        new Error(errorMessage),
        {
          caseId: params.caseId,
        }
      );
      throw error;
    }
  }

  /**
   * 构建查询条件
   */
  private buildWhereClause(
    params: SimilaritySearchParams
  ): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = [];

    if (params.caseType) {
      conditions.push({ type: params.caseType });
    }

    if (params.result) {
      conditions.push({ result: params.result });
    }

    if (params.startDate || params.endDate) {
      conditions.push({
        judgmentDate: {
          ...(params.startDate && { gte: params.startDate }),
          ...(params.endDate && { lte: params.endDate }),
        },
      });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.similaritySearcher.clearCache();
    logger.info('Similar case service cache cleared');
  }

  /**
   * 清除指定案例的缓存
   */
  public clearCacheForCase(caseId: string): boolean {
    return this.similaritySearcher.clearCacheForCase(caseId);
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return this.similaritySearcher.getCacheStats();
  }

  /**
   * 预热缓存
   */
  public async warmupCache(caseIds: string[]): Promise<void> {
    try {
      for (const caseId of caseIds) {
        await this.searchSimilarCases({ caseId });
      }
      logger.info('Cache warmup completed', { warmpedCases: caseIds.length });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to warmup cache', new Error(errorMessage), {
        caseIds,
      });
      throw error;
    }
  }

  /**
   * 获取相似度检索配置
   */
  public getConfig() {
    return this.similaritySearcher.getConfig();
  }

  /**
   * 更新相似度检索配置
   */
  public updateConfig(config: {
    method?: SimilarityMethod;
    topK?: number;
    threshold?: number;
    normalizeVectors?: boolean;
    cacheEnabled?: boolean;
    maxCacheSize?: number;
  }): void {
    this.similaritySearcher.updateConfig(config);
  }

  /**
   * 获取搜索质量指标
   */
  public async getQualityMetrics(caseId: string) {
    const result = await this.searchSimilarCases({ caseId });
    return this.similaritySearcher.calculateQualityMetrics(result.matches);
  }

  /**
   * 批量生成案例向量
   */
  public async batchGenerateEmbeddings(caseIds: string[]): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      id: string;
      success: boolean;
      embedding?: number[];
      error?: string;
    }>;
  }> {
    return await this.embeddingService.batchGenerateAndStore(caseIds);
  }

  /**
   * 为案例生成向量
   */
  public async generateEmbedding(caseId: string): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> {
    const result =
      await this.embeddingService.generateAndStoreEmbedding(caseId);
    // 清除缓存
    if (result.success) {
      this.similaritySearcher.clearCacheForCase(caseId);
    }
    return result;
  }

  /**
   * 分析胜败率
   */
  public async analyzeSuccessRate(
    params: SuccessRateAnalysisParams
  ): Promise<SuccessRateAnalysis> {
    try {
      // 获取相似案例检索结果
      const searchResult = await this.searchSimilarCases({
        caseId: params.caseId,
      });

      // 调用胜败率分析器
      const analysis = this.successRateAnalyzer.analyze(
        params,
        searchResult.matches
      );

      logger.info('Success rate analysis completed', {
        caseId: params.caseId,
        winRate: analysis.winRate,
        winProbability: analysis.winProbability,
        confidence: analysis.confidence,
        similarCasesCount: analysis.similarCasesCount,
      });

      return analysis;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to analyze success rate', new Error(errorMessage), {
        caseId: params.caseId,
      });
      throw error;
    }
  }

  /**
   * 清理资源
   */
  public async dispose(): Promise<void> {
    this.similaritySearcher.clearCache();
    logger.info('SimilarCaseService disposed');
  }
}

/**
 * 相似案例服务工厂
 */
export class SimilarCaseServiceFactory {
  private static instances: Map<string, SimilarCaseService> = new Map();

  public static getInstance(name: string = 'default'): SimilarCaseService {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new SimilarCaseService();
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      void instance.dispose();
      return this.instances.delete(name);
    }
    return false;
  }

  public static getAllInstances(): Map<string, SimilarCaseService> {
    return new Map(this.instances);
  }

  public static async disposeAll(): Promise<void> {
    for (const instance of this.instances.values()) {
      await instance.dispose();
    }
    this.instances.clear();
  }
}

export default SimilarCaseServiceFactory;
