/**
 * AI操作模块（AI Operations）
 * 包含：AI服务调用、数据库检索
 */

import type { PrismaClient } from '@prisma/client';
import type { AIServiceCallResult, DatabaseSearchResult } from './types';

/**
 * 5. call_ai_service - AI服务调用
 * 调用AI服务（DeepSeek、智谱、OpenAI等）
 */
export async function call_ai_service(
  params: {
    prompt: string;
    provider: 'deepseek' | 'zhipu' | 'openai';
    model?: string;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    systemPrompt?: string;
  },
  aiService: { call: (args: unknown) => Promise<unknown> }
): Promise<AIServiceCallResult> {
  const startTime = Date.now();

  try {
    const response = await aiService.call({
      prompt: params.prompt,
      provider: params.provider,
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.maxTokens,
      stream: params.stream,
      systemPrompt: params.systemPrompt,
    });

    return {
      success: true,
      response: JSON.stringify(response),
      model: params.model || params.provider,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      response: '',
      model: params.model || params.provider,
      executionTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 4. search_database - 数据库检索
 * 通用数据库检索接口
 */
export async function search_database<T = unknown>(
  prisma: PrismaClient,
  params: {
    table: string;
    query?: string;
    filters?: Record<string, unknown>;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }
): Promise<DatabaseSearchResult<T>> {
  const startTime = Date.now();

  await new Promise(resolve => setTimeout(resolve, 10));

  const model = (prisma as unknown as Record<string, unknown>)[
    params.table
  ] as { findMany: (args: unknown) => Promise<unknown> };

  const where: Record<string, unknown> = { ...params.filters };
  if (params.query) {
    where.OR = [{ content: { contains: params.query } }];
  }

  const orderBy = params.orderBy
    ? [{ [params.orderBy]: params.orderDirection || 'asc' }]
    : undefined;

  const result = (await model.findMany({
    where,
    orderBy,
    take: params.limit,
    skip: params.offset,
  })) as T[];

  return {
    items: result,
    totalCount: result.length,
    hasMore: params.limit ? result.length === params.limit : false,
    executionTime: Date.now() - startTime,
  };
}
