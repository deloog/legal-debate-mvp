/**
 * OpenAI客户端封装
 *
 * 功能：
 * 1. 提供统一的OpenAI API调用接口
 * 2. 支持自定义参数
 * 3. 错误处理
 */

import OpenAI from 'openai';

/**
 * OpenAI完成选项
 */
export interface OpenAICompletionOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/**
 * 获取OpenAI客户端实例
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    timeout: 30000,
  });
}

/**
 * 调用OpenAI完成API
 *
 * @param prompt 提示词
 * @param options 选项
 * @returns AI响应内容
 */
export async function getOpenAICompletion(
  prompt: string,
  options: OpenAICompletionOptions = {}
): Promise<string> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: options.model || 'gpt-4',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI API调用失败:', error);
    throw error;
  }
}

/**
 * 批量调用OpenAI完成API
 *
 * @param prompts 提示词列表
 * @param options 选项
 * @returns AI响应内容列表
 */
export async function batchGetOpenAICompletion(
  prompts: string[],
  options: OpenAICompletionOptions = {}
): Promise<string[]> {
  const results = await Promise.all(
    prompts.map(prompt => getOpenAICompletion(prompt, options))
  );

  return results;
}
