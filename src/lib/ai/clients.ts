import OpenAI from 'openai';
import { logger } from '@/lib/logger';

// AI Models Configuration
export const AI_MODELS = {
  ZHIPU: {
    CHAT: 'glm-4.6',
    EMBEDDING: 'text-embedding-ada-002',
  },
  DEEPSEEK: {
    CHAT: 'deepseek-chat',
    CODING: 'deepseek-coder',
  },
} as const;

// AI Client Configuration
export interface AIConfig {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

// Message interface for AI chat
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Chat options interface
export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  [key: string]: unknown;
}

// Base AI Client Interface
export interface AIClient {
  chat(messages: AIMessage[], options?: ChatOptions): Promise<string>;
  embedding(text: string): Promise<number[]>;
  healthCheck(): Promise<boolean>;
}

// Zhipu AI Client - 使用OpenAI兼容格式
export class ZhipuClient implements AIClient {
  private client: OpenAI;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
      timeout: config.timeout || 30000,
    });
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2000,
        ...options,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('Zhipu AI Chat Error:', error);
      throw new Error(`Zhipu AI chat failed: ${error}`);
    }
  }

  async embedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: AI_MODELS.ZHIPU.EMBEDDING,
        input: text,
      });

      return response.data[0]?.embedding || [];
    } catch (error) {
      logger.error('Zhipu AI Embedding Error:', error);
      throw new Error(`Zhipu AI embedding failed: ${error}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// DeepSeek AI Client - 使用OpenAI兼容格式
export class DeepSeekClient implements AIClient {
  private client: OpenAI;
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      timeout: config.timeout || 30000,
    });
  }

  async chat(messages: AIMessage[], options: ChatOptions = {}) {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 2000,
        ...options,
      });

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('DeepSeek AI Chat Error:', error);
      throw new Error(`DeepSeek AI chat failed: ${error}`);
    }
  }

  async embedding(): Promise<number[]> {
    // DeepSeek might not have embedding API, using placeholder
    throw new Error('DeepSeek embedding not implemented');
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.config.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      });
      return true;
    } catch {
      return false;
    }
  }
}

// AI Client Factory
export class AIClientFactory {
  private static zhipuClient: ZhipuClient | null = null;
  private static deepSeekClient: DeepSeekClient | null = null;

  static getZhipuClient(): ZhipuClient {
    if (!this.zhipuClient) {
      const apiKey = process.env.ZHIPU_API_KEY;
      if (!apiKey) {
        throw new Error('ZHIPU_API_KEY not configured');
      }

      this.zhipuClient = new ZhipuClient({
        apiKey,
        model: AI_MODELS.ZHIPU.CHAT,
        temperature: 0.7,
        maxTokens: 2000,
        timeout: 30000,
      });
    }

    return this.zhipuClient;
  }

  static getDeepSeekClient(): DeepSeekClient {
    if (!this.deepSeekClient) {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        throw new Error('DEEPSEEK_API_KEY not configured');
      }

      this.deepSeekClient = new DeepSeekClient({
        apiKey,
        model: AI_MODELS.DEEPSEEK.CHAT,
        temperature: 0.7,
        maxTokens: 1500, // 减少token数量优化响应时间
        timeout: 60000, // 增加超时时间
      });
    }

    return this.deepSeekClient;
  }

  static getClient(provider: 'zhipu' | 'deepseek'): AIClient {
    switch (provider) {
      case 'zhipu':
        return this.getZhipuClient();
      case 'deepseek':
        return this.getDeepSeekClient();
      default:
        throw new Error(`Unknown AI provider: ${provider}`);
    }
  }
}

// AI Response Types
export interface AIResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface AnalysisResult {
  summary?: string;
  keyPoints?: string[];
  legalStructure?: Record<string, unknown>;
  riskAssessment?: Record<string, unknown>;
  compliance?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// AI Service Class
export class AIService {
  static async analyzeDocument(
    content: string,
    analysisType: string,
    provider: 'zhipu' | 'deepseek' = 'zhipu'
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const client = AIClientFactory.getClient(provider);

    try {
      const prompt = this.getAnalysisPrompt(analysisType, content);
      const response = await client.chat([
        {
          role: 'system',
          content:
            '你是一个专业的法律文档分析助手，请提供准确、详细的分析结果。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return {
        content: response,
        model: provider,
        duration: Date.now() - startTime,
        success: true,
      };
    } catch (error) {
      return {
        content: '',
        model: provider,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private static getAnalysisPrompt(type: string, content: string): string {
    const prompts = {
      DOCUMENT_SUMMARY: `请为以下法律文档提供详细的摘要：\n\n${content}`,
      LEGAL_STRUCTURE: `请分析以下法律文档的结构，识别关键条款和章节：\n\n${content}`,
      KEY_TERMS: `请从以下法律文档中提取关键术语和定义：\n\n${content}`,
      RISK_ASSESSMENT: `请评估以下法律文档的潜在风险和问题：\n\n${content}`,
      COMPLIANCE_CHECK: `请检查以下法律文档的合规性：\n\n${content}`,
    };

    return prompts[type as keyof typeof prompts] || prompts.DOCUMENT_SUMMARY;
  }

  static async healthCheckAll(): Promise<Record<string, boolean>> {
    const zhipuClient = AIClientFactory.getZhipuClient();
    const deepSeekClient = AIClientFactory.getDeepSeekClient();

    const [zhipuHealth, deepSeekHealth] = await Promise.all([
      zhipuClient.healthCheck(),
      deepSeekClient.healthCheck(),
    ]);

    return {
      zhipu: zhipuHealth,
      deepseek: deepSeekHealth,
    };
  }
}
