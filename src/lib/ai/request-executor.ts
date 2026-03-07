import type {
  AIProvider,
  AIRequestConfig,
  AIResponse,
  AIError,
  AIErrorType,
} from '../../types/ai-service';
import type { AIProviderClient as AIClient } from './client-factory';

// =============================================================================
// AI请求执行器
// =============================================================================

/**
 * AI请求执行和响应转换
 */
export class AIRequestExecutor {
  private clients: Map<AIProvider, unknown>;

  constructor(clients: Map<AIProvider, unknown>) {
    this.clients = clients;
  }

  /**
   * 执行AI请求
   */
  public async executeRequest(
    provider: AIProvider,
    request: AIRequestConfig
  ): Promise<AIResponse> {
    const rawClient = this.clients.get(provider);

    if (!rawClient) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    const client = rawClient as AIClient;
    let response;

    try {
      // 根据提供商调用对应的聊天完成接口
      switch (provider) {
        case 'zhipu':
          response = await this.executeZhipuRequest(client, request);
          break;
        case 'deepseek':
          response = await this.executeDeepSeekRequest(client, request);
          break;
        case 'openai':
          response = await this.executeOpenAIRequest(client, request);
          break;
        case 'anthropic':
          response = await this.executeAnthropicRequest(client, request);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // 转换为标准AI响应格式
      return this.convertResponse(response, provider);
    } catch (error) {
      throw this.createAIError(error as Error, provider);
    }
  }

  /**
   * 执行智谱清言请求
   */
  private async executeZhipuRequest(
    client: AIClient,
    request: AIRequestConfig
  ): Promise<unknown> {
    return await client.chat.completions.create({
      model: request.model,
      messages: request.messages as unknown,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop: request.stop,
    } as Record<string, unknown>);
  }

  /**
   * 执行DeepSeek请求
   */
  private async executeDeepSeekRequest(
    client: AIClient,
    request: AIRequestConfig
  ): Promise<unknown> {
    return await client.chat.completions.create({
      model: request.model,
      messages: request.messages as unknown,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop: request.stop,
    } as Record<string, unknown>);
  }

  /**
   * 执行OpenAI请求
   */
  private async executeOpenAIRequest(
    client: AIClient,
    request: AIRequestConfig
  ): Promise<unknown> {
    return await client.chat.completions.create({
      model: request.model,
      messages: request.messages as unknown,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop: request.stop,
    } as Record<string, unknown>);
  }

  /**
   * 执行Anthropic请求
   */
  private async executeAnthropicRequest(
    client: AIClient,
    request: AIRequestConfig
  ): Promise<unknown> {
    const messagesApi = client.messages;
    if (!messagesApi) {
      throw new Error('Anthropic messages API not available on this client');
    }
    const response = await messagesApi.create({
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })) as unknown,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop_sequences: request.stop,
    } as Record<string, unknown>);

    // 转换Anthropic响应格式为标准格式
    return this.convertAnthropicResponse(response);
  }

  /**
   * 转换响应为统一格式
   */
  private convertResponse(response: unknown, provider: AIProvider): AIResponse {
    const r = response as Record<string, unknown>;
    return {
      id: (r.id as string) || `${provider}_${Date.now()}`,
      object: (r.object as string) || 'chat.completion',
      created: (r.created as number) || Date.now(),
      model: r.model as string,
      choices: (r.choices as AIResponse['choices']) || [
        {
          index: 0,
          message: (r.message as AIResponse['choices'][number]['message']) ||
            (r.content as AIResponse['choices'][number]['message']) || {
              role: 'assistant' as const,
              content:
                ((r.content as Record<string, unknown>)?.text as string) ||
                (r.content as string),
            },
          finishReason:
            (r.finish_reason as AIResponse['choices'][number]['finishReason']) ||
            'stop',
          logprobs: (r.logprobs as null) || null,
        },
      ],
      usage: r.usage as AIResponse['usage'],
      provider,
      duration: 0, // 将在外部设置
      cached: false,
    };
  }

  /**
   * 转换Anthropic响应为OpenAI格式
   */
  private convertAnthropicResponse(response: unknown): Record<string, unknown> {
    const r = response as Record<string, unknown>;
    const content = r.content as Array<Record<string, unknown>> | undefined;
    const usage = r.usage as Record<string, number> | undefined;
    return {
      id: r.id,
      object: 'chat.completion',
      created: Date.now(),
      model: r.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content?.[0]?.text || '',
          },
          finish_reason: r.stop_reason || 'stop',
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: usage?.input_tokens,
        completion_tokens: usage?.output_tokens,
        total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
      },
    };
  }

  /**
   * 创建AI错误对象
   */
  private createAIError(error: Error, provider: AIProvider): AIError {
    return {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      type: this.inferErrorType(error),
      provider,
      timestamp: Date.now(),
      retryable: this.isRetryableError(error),
    };
  }

  /**
   * 推断错误类型
   */
  private inferErrorType(error: Error): AIErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('network') || message.includes('connection'))
      return 'network_error';
    if (message.includes('authentication') || message.includes('unauthorized'))
      return 'authentication_error';
    if (message.includes('permission') || message.includes('forbidden'))
      return 'permission_error';
    if (message.includes('rate limit') || message.includes('too many requests'))
      return 'rate_limit_error';
    if (message.includes('not found') || message.includes('does not exist'))
      return 'not_found_error';
    if (message.includes('quota') || message.includes('limit'))
      return 'insufficient_quota';
    if (message.includes('validation') || message.includes('invalid'))
      return 'validation_error';
    if (message.includes('model') && message.includes('not available'))
      return 'model_not_available';

    return 'unknown_error';
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('rate limit')
    );
  }

  /**
   * 获取可用的提供商列表
   */
  public getAvailableProviders(): AIProvider[] {
    return Array.from(this.clients.keys());
  }

  /**
   * 检查提供商是否可用
   */
  public isProviderAvailable(provider: AIProvider): boolean {
    return this.clients.has(provider);
  }
}
