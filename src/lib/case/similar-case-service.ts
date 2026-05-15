import { logger } from '@/lib/agent/security/logger';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
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
  SimilarCaseMatch,
} from '../../types/case-example';

type RuntimeCaseInput = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  cause: string | null;
  court: string | null;
};

/**
 * 相似案例服务类
 * 支持两类输入：
 * 1. CaseExample.id：使用向量相似度检索
 * 2. Case.id：降级为基于文本重叠的相似案例检索
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

  private buildWhereClause(
    params: Partial<
      Pick<
        SimilaritySearchParams,
        'caseType' | 'result' | 'startDate' | 'endDate'
      >
    >
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

  private buildCaseQueryText(caseData: RuntimeCaseInput): string {
    return [
      caseData.title,
      caseData.cause || '',
      caseData.court || '',
      caseData.description || '',
    ]
      .join('\n')
      .trim();
  }

  private tokenizeText(text: string): string[] {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const wordTokens = normalized
      .split(/[^a-z0-9\u4e00-\u9fa5]+/i)
      .map(token => token.trim())
      .filter(Boolean);

    const chineseChars = normalized.match(/[\u4e00-\u9fa5]/g) || [];
    const chineseBigrams: string[] = [];
    for (let i = 0; i < chineseChars.length - 1; i += 1) {
      chineseBigrams.push(chineseChars[i] + chineseChars[i + 1]);
    }

    return [...new Set([...wordTokens, ...chineseBigrams])];
  }

  private calculateTextSimilarity(
    queryText: string,
    candidateText: string
  ): number {
    const queryTokens = new Set(this.tokenizeText(queryText));
    const candidateTokens = new Set(this.tokenizeText(candidateText));

    if (queryTokens.size === 0 || candidateTokens.size === 0) {
      return 0;
    }

    const intersection = [...queryTokens].filter(token =>
      candidateTokens.has(token)
    ).length;
    const union = new Set([...queryTokens, ...candidateTokens]).size;

    return union === 0 ? 0 : intersection / union;
  }

  private extractMatchingFactorsForCase(
    caseData: RuntimeCaseInput,
    candidate: {
      type: string;
      cause: string | null;
      court: string;
    },
    similarity: number
  ): string[] {
    const factors: string[] = [];

    if (caseData.type === candidate.type) {
      factors.push('案件类型一致');
    }

    if (
      caseData.cause &&
      candidate.cause &&
      caseData.cause === candidate.cause
    ) {
      factors.push('案由一致');
    }

    if (
      caseData.court &&
      candidate.court &&
      (candidate.court.includes(caseData.court) ||
        caseData.court.includes(candidate.court))
    ) {
      factors.push('法院接近');
    }

    if (similarity >= 0.8) {
      factors.push('事实描述高度相似');
    } else if (similarity >= 0.6) {
      factors.push('事实描述相似');
    } else {
      factors.push('存在部分相似要素');
    }

    return factors;
  }

  private async searchByCaseExample(
    params: SimilaritySearchParams
  ): Promise<SimilaritySearchResult | null> {
    const queryCase = await prisma.caseExample.findUnique({
      where: { id: params.caseId },
    });

    if (!queryCase) return null;

    if (!queryCase.embedding || !Array.isArray(queryCase.embedding)) {
      throw new Error(`Embedding not found for case: ${params.caseId}`);
    }

    const cached = this.similaritySearcher.getCache(params.caseId);
    if (cached) {
      return {
        caseId: params.caseId,
        matches: cached,
        totalMatches: cached.length,
        searchTime: 0,
      };
    }

    const where = this.buildWhereClause(params);
    const targetCases = await prisma.caseExample.findMany({
      where: {
        ...where,
        id: { not: params.caseId },
        embedding: { not: Prisma.DbNull },
      },
    });

    const matches = await this.similaritySearcher.searchSimilarCases(
      queryCase.embedding as number[],
      targetCases
    );

    this.similaritySearcher.setCache(params.caseId, matches);

    return {
      caseId: params.caseId,
      matches,
      totalMatches: matches.length,
      searchTime: 0,
      metadata: {
        algorithm: this.similaritySearcher.getConfig().method,
        vectorDimension: (queryCase.embedding as number[]).length,
        casesSearched: targetCases.length,
      },
    };
  }

  private async searchByRuntimeCase(
    params: SimilaritySearchParams
  ): Promise<SimilaritySearchResult> {
    const queryRealCase = await prisma.case.findFirst({
      where: { id: params.caseId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        cause: true,
        court: true,
      },
    });

    if (!queryRealCase) {
      throw new Error(`Case or case example not found: ${params.caseId}`);
    }

    const where = this.buildWhereClause({
      ...params,
      caseType: params.caseType || queryRealCase.type,
    });

    const targetCases = await prisma.caseExample.findMany({ where });
    const queryText = this.buildCaseQueryText(queryRealCase);

    const matches = targetCases
      .map(candidate => {
        const candidateText = [
          candidate.title,
          candidate.cause || '',
          candidate.court,
          candidate.facts,
          candidate.judgment,
        ].join('\n');
        const similarity = this.calculateTextSimilarity(
          queryText,
          candidateText
        );
        return {
          caseExample: candidate,
          similarity,
          matchingFactors: this.extractMatchingFactorsForCase(
            queryRealCase,
            candidate,
            similarity
          ),
        } as SimilarCaseMatch;
      })
      .filter(match => match.similarity >= (params.threshold ?? 0.7))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, params.topK ?? 10);

    return {
      caseId: params.caseId,
      matches,
      totalMatches: matches.length,
      searchTime: 0,
      metadata: {
        algorithm: 'text-jaccard-fallback',
        vectorDimension: 0,
        casesSearched: targetCases.length,
      },
    };
  }

  public async searchSimilarCases(
    params: SimilaritySearchParams
  ): Promise<SimilaritySearchResult> {
    const startTime = Date.now();

    try {
      const byCaseExample = await this.searchByCaseExample(params);
      const result = byCaseExample || (await this.searchByRuntimeCase(params));
      return {
        ...result,
        searchTime: Date.now() - startTime,
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

  public async batchCalculateSimilarity(
    params: BatchSimilarityRequest
  ): Promise<BatchSimilarityResult> {
    try {
      const queryCase = await prisma.caseExample.findUnique({
        where: { id: params.caseId },
      });

      if (!queryCase) {
        throw new Error(`Case example not found: ${params.caseId}`);
      }

      if (!queryCase.embedding || !Array.isArray(queryCase.embedding)) {
        throw new Error(`Embedding not found for case: ${params.caseId}`);
      }

      const targetCases = await prisma.caseExample.findMany({
        where: {
          id: { in: params.targetIds },
        },
        select: {
          id: true,
          embedding: true,
        },
      });

      const targetEmbeddings = targetCases.map(c => ({
        id: c.id,
        embedding: c.embedding as number[],
      }));

      const results = await this.similaritySearcher.batchCalculateSimilarity(
        queryCase.embedding as number[],
        targetEmbeddings
      );

      const successful = results.filter(r => !r.error).length;
      const failed = results.filter(r => r.error).length;

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

  public clearCache(): void {
    this.similaritySearcher.clearCache();
  }

  public clearCacheForCase(caseId: string): boolean {
    return this.similaritySearcher.clearCacheForCase(caseId);
  }

  public getCacheStats(): { size: number; keys: string[] } {
    return this.similaritySearcher.getCacheStats();
  }

  public async warmupCache(caseIds: string[]): Promise<void> {
    for (const caseId of caseIds) {
      await this.searchSimilarCases({ caseId });
    }
  }

  public getConfig() {
    return this.similaritySearcher.getConfig();
  }

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

  public async getQualityMetrics(caseId: string) {
    const result = await this.searchSimilarCases({ caseId });
    return this.similaritySearcher.calculateQualityMetrics(result.matches);
  }

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

  public async generateEmbedding(caseId: string): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> {
    const result =
      await this.embeddingService.generateAndStoreEmbedding(caseId);
    if (result.success) {
      this.similaritySearcher.clearCacheForCase(caseId);
    }
    return result;
  }

  public async analyzeSuccessRate(
    params: SuccessRateAnalysisParams
  ): Promise<SuccessRateAnalysis> {
    try {
      const searchResult = await this.searchSimilarCases({
        caseId: params.caseId,
        topK: params.maxCases ?? 20,
        threshold: params.minSimilarity ?? 0.6,
      });

      return this.successRateAnalyzer.analyze(params, searchResult.matches);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to analyze success rate', new Error(errorMessage), {
        caseId: params.caseId,
      });
      throw error;
    }
  }

  public async dispose(): Promise<void> {
    this.similaritySearcher.clearCache();
  }
}

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
