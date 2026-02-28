import { logger } from '../../../../config/winston.config';
import type {
  EmbeddingConfig,
  EmbeddingModel,
  EmbeddingResponse,
  TextPreprocessingOptions,
} from '../../../types/embedding';
import { EmbeddingModel as EmbeddingModelEnum } from '../../../types/embedding';
import type { CaseExample } from '@prisma/client';
import { AIServiceFactory } from '../service-refactored';

/**
 * 案例向量嵌入服务类
 * 负责生成案例的向量嵌入
 */
export class CaseEmbedder {
  private aiService!: Awaited<ReturnType<typeof AIServiceFactory.getInstance>>;
  private config: EmbeddingConfig;
  private cache: Map<string, number[]>;

  constructor(config: Partial<EmbeddingConfig> = {}) {
    this.config = {
      model: config.model || EmbeddingModelEnum.ZHIPU_EMBEDDING_2,
      dimension: config.dimension || 1536,
      provider: config.provider || 'zhipu',
    };
    this.cache = new Map();
  }

  /**
   * 初始化AI服务
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.aiService) {
      this.aiService = await AIServiceFactory.getInstance('case-embedder');
    }
  }

  /**
   * 为案例生成向量嵌入
   */
  public async generateEmbedding(
    caseExample: CaseExample
  ): Promise<EmbeddingResponse> {
    try {
      // 预处理文本
      const text = this.preprocessText(caseExample);

      // 检查缓存
      const cacheKey = this.getCacheKey(caseExample.id, text);
      const cachedEmbedding = this.cache.get(cacheKey);
      if (cachedEmbedding) {
        return {
          success: true,
          data: {
            embedding: cachedEmbedding,
            model: this.config.model,
            dimension: this.config.dimension,
            generatedAt: new Date(),
            version: '1.0',
          },
        };
      }

      // 调用AI服务生成向量
      await this.ensureInitialized();
      const embedding = await this.callEmbeddingAPI(text);

      // 缓存结果
      this.cache.set(cacheKey, embedding);

      return {
        success: true,
        data: {
          embedding,
          model: this.config.model,
          dimension: embedding.length,
          generatedAt: new Date(),
          version: '1.0',
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        'Failed to generate embedding',
        error instanceof Error ? error : new Error(errorMessage)
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 批量生成向量嵌入
   */
  public async batchGenerateEmbeddings(caseExamples: CaseExample[]): Promise<{
    results: Array<{
      id: string;
      success: boolean;
      data?: {
        embedding: number[];
        model: EmbeddingModel;
        dimension: number;
        generatedAt: Date;
        version: string;
      };
      error?: string;
    }>;
    total: number;
    successful: number;
    failed: number;
  }> {
    const results: Array<{
      id: string;
      success: boolean;
      data?: {
        embedding: number[];
        model: EmbeddingModel;
        dimension: number;
        generatedAt: Date;
        version: string;
      };
      error?: string;
    }> = [];

    // 并发生成向量，控制并发数
    const batchSize = 5;
    for (let i = 0; i < caseExamples.length; i += batchSize) {
      const batch = caseExamples.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(caseExample => this.generateEmbedding(caseExample))
      );

      for (const [index, result] of batchResults.entries()) {
        if (result.status === 'fulfilled') {
          results.push({
            id: caseExamples[index].id,
            success: result.value.success,
            data: result.value.data,
          });
        } else {
          results.push({
            id: caseExamples[index].id,
            success: false,
            error: result.reason?.message || 'Unknown error',
          });
        }
      }
    }

    const successfulCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    logger.info('Batch embedding generation completed', {
      total: results.length,
      successful: successfulCount,
      failed: failedCount,
    });

    return {
      results,
      total: results.length,
      successful: successfulCount,
      failed: failedCount,
    };
  }

  /**
   * 预处理案例文本
   */
  private preprocessText(caseExample: CaseExample): string {
    const options: TextPreprocessingOptions = {
      includeTitle: true,
      includeFacts: true,
      includeJudgment: true,
      maxLength: 4000,
      separator: '\n\n',
    };

    const parts: string[] = [];

    if (options.includeTitle) {
      parts.push(`标题：${caseExample.title}`);
    }

    if (options.includeFacts && caseExample.facts) {
      parts.push(`事实：${caseExample.facts}`);
    }

    if (options.includeJudgment && caseExample.judgment) {
      parts.push(`判决：${caseExample.judgment}`);
    }

    let text = parts.join(options.separator || '\n\n');

    // 截断超长文本
    if (options.maxLength && text.length > options.maxLength) {
      const originalLength = parts.join(options.separator || '\n\n').length;
      text = text.substring(0, options.maxLength);
      logger.warn('Text truncated for embedding', {
        originalLength,
        truncatedLength: text.length,
      });
    }

    return text.trim();
  }

  /**
   * 调用AI服务生成向量
   */
  private async callEmbeddingAPI(text: string): Promise<number[]> {
    try {
      const response = await this.aiService.chatCompletion({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: `请将以下法律案例文本转换为向量表示，用于相似案例检索。只返回向量的数值数组，不要返回任何解释性文字。\n\n文本内容：\n${text}`,
          },
        ],
        temperature: 0,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        // 尝试从响应中提取向量
        const embedding = this.parseEmbeddingFromResponse(content);
        return embedding;
      }

      throw new Error('Empty response from AI service');
    } catch (error) {
      logger.error(
        'Failed to call embedding API',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 从AI响应中解析向量
   */
  private parseEmbeddingFromResponse(content: string): number[] {
    try {
      // 尝试解析JSON格式的向量
      const match = content.match(/\[([\d\.\-, ]+)\]/);
      if (match) {
        return match[1].split(',').map(Number);
      }

      // 尝试解析JSON格式
      const jsonMatch = content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.embedding)) {
          return parsed.embedding;
        }
        if (Array.isArray(parsed.vector)) {
          return parsed.vector;
        }
      }

      // 如果AI直接返回数组
      const trimmed = content.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return JSON.parse(trimmed);
      }

      throw new Error('Unable to parse embedding from response');
    } catch (error) {
      logger.error(
        'Failed to parse embedding',
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error('Invalid embedding format from AI service');
    }
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(caseId: string, text: string): string {
    return `${caseId}:${this.config.model}:${text.substring(0, 100)}`;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('Embedding cache cleared');
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
  public updateConfig(config: Partial<EmbeddingConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Embedder config updated', {
      model: this.config.model,
      dimension: this.config.dimension,
    });
  }

  /**
   * 降级到OpenAI模型
   */
  public async fallbackToOpenAI(): Promise<void> {
    this.config = {
      model: EmbeddingModelEnum.OPENAI_3_SMALL,
      dimension: 1536,
      provider: 'openai',
    };
    logger.info('Fallback to OpenAI embedding model', {
      model: this.config.model,
      provider: this.config.provider,
    });
  }
}

/**
 * 向量嵌入器工厂
 */
export class CaseEmbedderFactory {
  private static instances: Map<string, CaseEmbedder> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<EmbeddingConfig>
  ): CaseEmbedder {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new CaseEmbedder(config);
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

  public static getAllInstances(): Map<string, CaseEmbedder> {
    return new Map(this.instances);
  }

  public static async clearAllInstances(): Promise<void> {
    for (const instance of this.instances.values()) {
      instance.clearCache();
    }
    this.instances.clear();
  }
}

export default CaseEmbedderFactory;
