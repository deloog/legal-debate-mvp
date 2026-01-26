import { logger } from '../../../../config/winston.config';
import {
  cosineSimilarity,
  euclideanDistance,
  normalizeVector,
  validateEmbedding,
} from '../../../types/embedding';
import type {
  SimilaritySearchConfig,
  SimilarCaseMatch,
} from '../../../types/case-example';
import { SimilarityMethod } from '../../../types/case-example';
import type { CaseExample } from '@prisma/client';

/**
 * 案例相似度检索器类
 * 负责基于向量相似度检索相似案例
 */
export class SimilaritySearcher {
  private cache: Map<string, SimilarCaseMatch[]>;
  private config: SimilaritySearchConfig;

  constructor(config?: Partial<SimilaritySearchConfig>) {
    this.config = {
      method: SimilarityMethod.COSINE,
      topK: 10,
      threshold: 0.7,
      normalizeVectors: true,
      cacheEnabled: true,
      maxCacheSize: 100,
      ...config,
    };
    this.cache = new Map();
  }

  /**
   * 检索相似案例
   */
  public async searchSimilarCases(
    queryEmbedding: number[],
    targetCases: CaseExample[]
  ): Promise<SimilarCaseMatch[]> {
    const startTime = Date.now();

    try {
      // 验证查询向量
      const validation = validateEmbedding(queryEmbedding);
      if (!validation.valid) {
        throw new Error(
          `Invalid query embedding: ${validation.errors?.join(', ')}`
        );
      }

      // 归一化查询向量
      const normalizedQuery = this.config.normalizeVectors
        ? normalizeVector(queryEmbedding)
        : queryEmbedding;

      // 计算所有目标案例的相似度
      const matches: SimilarCaseMatch[] = [];

      for (const targetCase of targetCases) {
        if (!targetCase.embedding || !Array.isArray(targetCase.embedding)) {
          continue;
        }

        const targetEmbedding = this.config.normalizeVectors
          ? normalizeVector(targetCase.embedding as number[])
          : (targetCase.embedding as number[]);

        const similarity = this.calculateSimilarity(
          normalizedQuery,
          targetEmbedding
        );

        if (similarity >= this.config.threshold) {
          matches.push({
            caseExample: targetCase,
            similarity,
            matchingFactors: this.extractMatchingFactors(
              queryEmbedding,
              targetEmbedding
            ),
          });
        }
      }

      // 按相似度排序
      matches.sort((a, b) => b.similarity - a.similarity);

      // 应用top-k限制
      const topKMatches = matches.slice(0, this.config.topK);

      const searchTime = Date.now() - startTime;
      logger.info('Similar case search completed', {
        totalCases: targetCases.length,
        matchedCases: matches.length,
        returnedCases: topKMatches.length,
        searchTime,
      });

      return topKMatches;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to search similar cases', new Error(errorMessage));
      throw error;
    }
  }

  /**
   * 批量计算相似度
   */
  public async batchCalculateSimilarity(
    queryEmbedding: number[],
    targetEmbeddings: Array<{ id: string; embedding: number[] }>
  ): Promise<
    Array<{
      id: string;
      similarity: number;
      error?: string;
    }>
  > {
    const results: Array<{
      id: string;
      similarity: number;
      error?: string;
    }> = [];

    // 归一化查询向量
    const normalizedQuery = this.config.normalizeVectors
      ? normalizeVector(queryEmbedding)
      : queryEmbedding;

    for (const target of targetEmbeddings) {
      try {
        const validation = validateEmbedding(target.embedding);
        if (!validation.valid) {
          results.push({
            id: target.id,
            similarity: 0,
            error: validation.errors?.join(', '),
          });
          continue;
        }

        const normalizedTarget = this.config.normalizeVectors
          ? normalizeVector(target.embedding)
          : target.embedding;

        const similarity = this.calculateSimilarity(
          normalizedQuery,
          normalizedTarget
        );

        results.push({ id: target.id, similarity });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        results.push({
          id: target.id,
          similarity: 0,
          error: errorMessage,
        });
      }
    }

    return results;
  }

  /**
   * 计算相似度
   */
  private calculateSimilarity(vecA: number[], vecB: number[]): number {
    if (this.config.method === SimilarityMethod.COSINE) {
      return cosineSimilarity(vecA, vecB);
    }

    if (this.config.method === SimilarityMethod.EUCLIDEAN) {
      // 欧几里得距离转换为相似度（距离越小，相似度越高）
      const distance = euclideanDistance(vecA, vecB);
      const maxDistance = Math.sqrt(vecA.length) * 2; // 估计最大距离
      return Math.max(0, 1 - distance / maxDistance);
    }

    if (this.config.method === SimilarityMethod.DOT_PRODUCT) {
      // 点积
      let dotProduct = 0;
      for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
      }
      return dotProduct;
    }

    return 0;
  }

  /**
   * 提取匹配因素
   */
  private extractMatchingFactors(vecA: number[], vecB: number[]): string[] {
    const factors: string[] = [];

    // 计算向量差异的分布
    let sumDiff = 0;
    let maxDiff = 0;

    for (let i = 0; i < vecA.length; i++) {
      const diff = Math.abs(vecA[i] - vecB[i]);
      sumDiff += diff;
      maxDiff = Math.max(maxDiff, diff);
    }

    const avgDiff = sumDiff / vecA.length;

    // 根据差异生成匹配因素
    if (avgDiff < 0.1) {
      factors.push('整体高度相似');
    } else if (avgDiff < 0.3) {
      factors.push('整体相似');
    } else {
      factors.push('部分相似');
    }

    if (maxDiff < 0.5) {
      factors.push('关键要素匹配');
    }

    return factors;
  }

  /**
   * 获取缓存
   */
  public getCache(caseId: string): SimilarCaseMatch[] | undefined {
    if (!this.config.cacheEnabled) {
      return undefined;
    }
    return this.cache.get(caseId);
  }

  /**
   * 设置缓存
   */
  public setCache(caseId: string, matches: SimilarCaseMatch[]): void {
    if (!this.config.cacheEnabled) {
      return;
    }

    // 限制缓存大小
    if (this.cache.size >= this.config.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(caseId, matches);
    logger.debug('Similarity cache updated', {
      caseId,
      cacheSize: this.cache.size,
    });
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Similarity cache cleared');
  }

  /**
   * 清除指定缓存
   */
  public clearCacheForCase(caseId: string): boolean {
    return this.cache.delete(caseId);
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<SimilaritySearchConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Similarity searcher config updated', {
      method: this.config.method,
      topK: this.config.topK,
      threshold: this.config.threshold,
    });
  }

  /**
   * 获取配置
   */
  public getConfig(): SimilaritySearchConfig {
    return { ...this.config };
  }

  /**
   * 预热缓存
   */
  public async warmupCache(
    caseIds: string[],
    queryEmbedding: number[],
    targetCases: CaseExample[]
  ): Promise<void> {
    const batchCases = targetCases.filter(c => caseIds.includes(c.id));

    for (const caseId of caseIds) {
      const matches = await this.searchSimilarCases(queryEmbedding, batchCases);
      this.setCache(caseId, matches);
    }

    logger.info('Cache warmup completed', { warmpedCases: caseIds.length });
  }

  /**
   * 计算搜索质量指标
   */
  public calculateQualityMetrics(matches: SimilarCaseMatch[]): {
    avgSimilarity: number;
    maxSimilarity: number;
    minSimilarity: number;
    diversityScore: number;
  } {
    if (matches.length === 0) {
      return {
        avgSimilarity: 0,
        maxSimilarity: 0,
        minSimilarity: 0,
        diversityScore: 0,
      };
    }

    const similarities = matches.map(m => m.similarity);
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
    const maxSimilarity = Math.max(...similarities);
    const minSimilarity = Math.min(...similarities);

    // 计算多样性得分（案例类型的多样性）
    const caseTypes = new Set(matches.map(m => m.caseExample.type));
    const diversityScore = caseTypes.size / matches.length;

    return {
      avgSimilarity,
      maxSimilarity,
      minSimilarity,
      diversityScore,
    };
  }
}

/**
 * 相似度检索器工厂
 */
export class SimilaritySearcherFactory {
  private static instances: Map<string, SimilaritySearcher> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<SimilaritySearchConfig>
  ): SimilaritySearcher {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new SimilaritySearcher(config);
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      instance.clearCache();
      return this.instances.delete(name);
    }
    return false;
  }

  public static getAllInstances(): Map<string, SimilaritySearcher> {
    return new Map(this.instances);
  }

  public static async clearAllInstances(): Promise<void> {
    for (const instance of this.instances.values()) {
      instance.clearCache();
    }
    this.instances.clear();
  }
}

export default SimilaritySearcherFactory;
