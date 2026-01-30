/**
 * AI Service Mock - 内存测试用
 * 提供Mock的AI服务，避免测试调用真实AI API
 */

import type { AIRequestConfig } from '@/types/ai-service';

/**
 * Mock AI响应
 */
export interface MockAIResponse {
  success: boolean;
  data: unknown;
  error?: string;
}

/**
 * Mock摘要生成结果
 */
export interface MockSummaryResult {
  summary: string;
  keyPoints: string[];
  originalSize: number;
  summarySize: number;
}

/**
 * Mock错误分析结果
 */
export interface MockErrorAnalysis {
  errorType: string;
  rootCause: string;
  suggestedActions: string[];
  confidence: number;
}

/**
 * 创建Mock AI Service（简化版，用于测试）
 */
export function createMockAIService(): Record<string, jest.Mock> {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    chatCompletion: jest.fn().mockResolvedValue({
      id: 'mock-response-id',
      model: 'mock-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'mock response content',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    }),
    healthCheck: jest.fn().mockResolvedValue(true),
    shutdown: jest.fn().mockResolvedValue(undefined),
    getServiceStatus: jest.fn(),
    updateConfig: jest.fn(),
    getAvailableProviders: jest.fn().mockReturnValue([]),
    isProviderAvailable: jest.fn().mockReturnValue(true),
    getProviderStats: jest.fn(),
    getMetrics: jest.fn().mockReturnValue([]),
    getFallbackStats: jest.fn(),
    serializeError: jest.fn().mockReturnValue('mock-error'),
    createUserFriendlyError: jest.fn().mockReturnValue('mock-error-message'),
    generateErrorSummary: jest.fn(),
  };
}

/**
 * 创建Mock摘要生成响应
 */
export function createMockSummaryResult(
  overrides?: Partial<MockSummaryResult>
): MockSummaryResult {
  return {
    summary: '这是测试摘要',
    keyPoints: ['关键点1', '关键点2', '关键点3'],
    originalSize: 1000,
    summarySize: 200,
    ...overrides,
  };
}

/**
 * 创建Mock错误分析响应
 */
export function createMockErrorAnalysis(
  overrides?: Partial<MockErrorAnalysis>
): MockErrorAnalysis {
  return {
    errorType: '当事人识别错误',
    rootCause: '提示词不够明确',
    suggestedActions: ['优化提示词模板', '增加Few-Shot示例', '调整温度参数'],
    confidence: 0.85,
    ...overrides,
  };
}

/**
 * Mock AI服务生成摘要
 */
export async function mockGenerateSummary(
  text: string,
  result?: MockSummaryResult
): Promise<MockSummaryResult> {
  return result || createMockSummaryResult();
}

/**
 * Mock AI服务分析错误
 */
export async function mockAnalyzeError(
  errorId: string,
  result?: MockErrorAnalysis
): Promise<MockErrorAnalysis> {
  return result || createMockErrorAnalysis();
}

/**
 * Mock AI响应生成
 */
export function createMockAIResponse(
  overrides?: Partial<MockAIResponse>
): MockAIResponse {
  return {
    success: true,
    data: { content: 'mock response' },
    ...overrides,
  };
}

/**
 * Mock AI请求配置
 */
export function createMockAIRequestConfig(
  overrides?: Partial<AIRequestConfig>
): AIRequestConfig {
  return {
    model: 'mock-model',
    messages: [],
    temperature: 0.7,
    maxTokens: 1000,
    ...overrides,
  };
}
