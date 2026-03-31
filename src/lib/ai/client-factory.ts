import type { AIProvider, AIClientConfig } from '../../types/ai-service';
import { logger } from '../agent/security/logger';

// =============================================================================
// AI客户端工厂
// =============================================================================

/**
 * 通用AI提供商客户端接口（兼容 OpenAI SDK 形状，支持 zhipu/deepseek/openai）。
 * 工厂方法通过 `unknown` 中转断言来兼容各 SDK 的具体类型。
 */
export interface AIProviderClient {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<unknown>;
    };
  };
  embeddings: {
    create: (params: Record<string, unknown>) => Promise<unknown>;
  };
}

/**
 * 创建不同AI提供商的客户端
 */
export class AIClientFactory {
  /**
   * 创建AI客户端
   */
  public static async createClient(config: AIClientConfig): Promise<unknown> {
    switch (config.provider) {
      case 'zhipu':
        return this.createZhipuClient(config);
      case 'deepseek':
        return this.createDeepSeekClient(config);
      case 'openai':
        return this.createOpenAIClient(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * 创建智谱清言客户端（使用OpenAI兼容格式）
   */
  private static async createZhipuClient(
    config: AIClientConfig
  ): Promise<AIProviderClient> {
    try {
      // 使用OpenAI兼容格式调用智谱清言API
      const { OpenAI } = await import('openai');

      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4/',
        timeout: config.timeout || 30000,
      }) as unknown as AIProviderClient;
    } catch (error) {
      logger.warn('OpenAI client not available for Zhipu, using mock client', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createMockClient('zhipu');
    }
  }

  /**
   * 创建DeepSeek客户端
   */
  private static async createDeepSeekClient(
    config: AIClientConfig
  ): Promise<AIProviderClient> {
    try {
      // DeepSeek API兼容OpenAI格式，直接使用OpenAI客户端
      const { OpenAI } = await import('openai');

      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || 'https://api.deepseek.com/v1',
        timeout: config.timeout || 30000,
      }) as unknown as AIProviderClient;
    } catch (error) {
      logger.warn('DeepSeek client not available, using mock client', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createMockClient('deepseek');
    }
  }

  /**
   * 创建OpenAI客户端
   */
  private static async createOpenAIClient(
    config: AIClientConfig
  ): Promise<AIProviderClient> {
    try {
      const { OpenAI } = await import('openai');

      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      }) as unknown as AIProviderClient;
    } catch (error) {
      logger.warn('OpenAI client not available, using mock client', {
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createMockClient('openai');
    }
  }

  /**
   * 创建模拟客户端用于开发测试
   */
  private static createMockClient(provider: AIProvider): AIProviderClient {
    return {
      chat: {
        completions: {
          create: async (_params: Record<string, unknown>) => {
            // AI 提供商客户端加载失败时的降级响应
            // 不返回任何伪造业务数据，调用方应检查 isFallback 标记后自行处理
            logger.warn(`${provider} AI客户端不可用，返回空降级响应`);
            return {
              id: `${provider}_unavailable_${Date.now()}`,
              object: 'chat.completion',
              created: Date.now(),
              model: 'unavailable',
              choices: [
                {
                  index: 0,
                  message: {
                    role: 'assistant',
                    content: '',
                  },
                  finish_reason: 'stop',
                  logprobs: null,
                },
              ],
              usage: {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              },
              _isFallback: true,
            };
          },
        },
      },
      embeddings: {
        create: async (params: Record<string, unknown>) => ({
          object: 'list',
          data: [
            {
              object: 'embedding',
              embedding: new Array(1536).fill(0),
              index: 0,
            },
          ],
          model: params.model,
          usage: {
            prompt_tokens: 10,
            total_tokens: 10,
          },
        }),
      },
    };
  }
}
