import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../../../config/winston.config';
import { CaseEmbedderFactory } from '../ai/case/case-embedder';
import type {
  EmbeddingConfig,
  EmbeddingValidation,
} from '../../types/embedding';
import { validateEmbedding } from '../../types/embedding';

/**
 * 案例向量存储服务类
 * 负责管理案例向量的存储和检索
 */
export class CaseEmbeddingService {
  private prisma: PrismaClient;
  private embedder: ReturnType<typeof CaseEmbedderFactory.getInstance>;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.prisma = new PrismaClient();
    this.embedder = CaseEmbedderFactory.getInstance('default', config);
  }

  /**
   * 为指定案例生成并存储向量
   */
  public async generateAndStoreEmbedding(caseId: string): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> {
    try {
      // 获取案例
      const caseExample = await this.prisma.caseExample.findUnique({
        where: { id: caseId },
      });

      if (!caseExample) {
        return {
          success: false,
          error: `Case example not found: ${caseId}`,
        };
      }

      // 生成向量
      const result = await this.embedder.generateEmbedding(caseExample);

      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to generate embedding',
        };
      }

      // 存储向量
      await this.prisma.caseExample.update({
        where: { id: caseId },
        data: {
          embedding: result.data.embedding as Prisma.InputJsonValue,
        },
      });

      logger.info('Embedding generated and stored', { caseId });
      return {
        success: true,
        embedding: result.data.embedding,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to generate and store embedding',
        new Error(errorMessage),
        {
          caseId,
        }
      );
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量生成并存储向量
   */
  public async batchGenerateAndStore(caseIds: string[]): Promise<{
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
    const results: Array<{
      id: string;
      success: boolean;
      embedding?: number[];
      error?: string;
    }> = [];

    for (const caseId of caseIds) {
      const result = await this.generateAndStoreEmbedding(caseId);
      results.push({
        id: caseId,
        success: result.success,
        embedding: result.embedding,
        error: result.error,
      });
    }

    const successfulCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    logger.info('Batch embedding generation completed', {
      total: results.length,
      successful: successfulCount,
      failed: failedCount,
    });

    return {
      total: results.length,
      successful: successfulCount,
      failed: failedCount,
      results,
    };
  }

  /**
   * 获取案例的向量
   */
  public async getEmbedding(caseId: string): Promise<{
    success: boolean;
    embedding?: number[];
    error?: string;
  }> {
    try {
      const caseExample = await this.prisma.caseExample.findUnique({
        where: { id: caseId },
        select: { embedding: true },
      });

      if (!caseExample) {
        return {
          success: false,
          error: `Case example not found: ${caseId}`,
        };
      }

      if (!caseExample.embedding) {
        return {
          success: false,
          error: `Embedding not found for case: ${caseId}`,
        };
      }

      const embedding = this.extractEmbedding(caseExample.embedding);
      return {
        success: true,
        embedding,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get embedding', new Error(errorMessage), {
        caseId,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 删除案例的向量
   */
  public async deleteEmbedding(caseId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      await this.prisma.caseExample.update({
        where: { id: caseId },
        data: { embedding: Prisma.DbNull },
      });

      logger.info('Embedding deleted', { caseId });
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete embedding', new Error(errorMessage), {
        caseId,
      });
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量删除向量
   */
  public async batchDeleteEmbeddings(caseIds: string[]): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    let successful = 0;
    let failed = 0;

    for (const caseId of caseIds) {
      const result = await this.deleteEmbedding(caseId);
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    logger.info('Batch embedding deletion completed', {
      total: caseIds.length,
      successful,
      failed,
    });

    return {
      total: caseIds.length,
      successful,
      failed,
    };
  }

  /**
   * 验证向量
   */
  public validateEmbedding(embedding: unknown): EmbeddingValidation {
    return validateEmbedding(embedding);
  }

  /**
   * 从数据库中提取向量
   */
  private extractEmbedding(embedding: Prisma.JsonValue): number[] {
    if (Array.isArray(embedding)) {
      return embedding as number[];
    }

    if (typeof embedding === 'object' && embedding !== null) {
      const obj = embedding as Record<string, unknown>;
      if (Array.isArray(obj.embedding)) {
        return obj.embedding as number[];
      }
      if (Array.isArray(obj.vector)) {
        return obj.vector as number[];
      }
    }

    return [];
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.embedder.clearCache();
    logger.info('Embedding cache cleared');
  }

  /**
   * 获取统计信息
   */
  public async getStatistics(): Promise<{
    totalCases: number;
    casesWithEmbedding: number;
    casesWithoutEmbedding: number;
  }> {
    try {
      const [totalCases, casesWithEmbedding] = await Promise.all([
        this.prisma.caseExample.count(),
        this.prisma.caseExample.count({
          where: {
            embedding: {
              not: Prisma.DbNull,
            },
          },
        }),
      ]);

      return {
        totalCases,
        casesWithEmbedding,
        casesWithoutEmbedding: totalCases - casesWithEmbedding,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to get embedding statistics',
        new Error(errorMessage)
      );
      throw error;
    }
  }

  /**
   * 清理资源
   */
  public async dispose(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.embedder.clearCache();
      logger.info('CaseEmbeddingService disposed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to dispose CaseEmbeddingService',
        new Error(errorMessage)
      );
    }
  }
}

/**
 * 向量存储服务工厂
 */
export class CaseEmbeddingServiceFactory {
  private static instances: Map<string, CaseEmbeddingService> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<EmbeddingConfig>
  ): CaseEmbeddingService {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new CaseEmbeddingService(config);
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

  public static getAllInstances(): Map<string, CaseEmbeddingService> {
    return new Map(this.instances);
  }

  public static async disposeAll(): Promise<void> {
    for (const instance of this.instances.values()) {
      await instance.dispose();
    }
    this.instances.clear();
  }
}

export default CaseEmbeddingServiceFactory;
