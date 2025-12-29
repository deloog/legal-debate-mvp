import type {
  AIProvider,
  AIRequestConfig,
  AIResponse,
  AIError,
  AIErrorType,
} from "../../types/ai-service";

// =============================================================================
// AI请求执行器
// =============================================================================

/**
 * AI请求执行和响应转换
 */
export class AIRequestExecutor {
  private clients: Map<AIProvider, any>;

  constructor(clients: Map<AIProvider, any>) {
    this.clients = clients;
  }

  /**
   * 执行AI请求
   */
  public async executeRequest(
    provider: AIProvider,
    request: AIRequestConfig,
  ): Promise<AIResponse> {
    const client = this.clients.get(provider);

    if (!client) {
      throw new Error(`No client available for provider: ${provider}`);
    }

    let response;

    try {
      // 根据提供商调用对应的聊天完成接口
      switch (provider) {
        case "zhipu":
          response = await this.executeZhipuRequest(client, request);
          break;
        case "deepseek":
          response = await this.executeDeepSeekRequest(client, request);
          break;
        case "openai":
          response = await this.executeOpenAIRequest(client, request);
          break;
        case "anthropic":
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
    client: any,
    request: AIRequestConfig,
  ): Promise<any> {
    return await client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop: request.stop,
    });
  }

  /**
   * 执行DeepSeek请求
   */
  private async executeDeepSeekRequest(
    client: any,
    request: AIRequestConfig,
  ): Promise<any> {
    return await client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop: request.stop,
    });
  }

  /**
   * 执行OpenAI请求
   */
  private async executeOpenAIRequest(
    client: any,
    request: AIRequestConfig,
  ): Promise<any> {
    return await client.chat.completions.create({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop: request.stop,
    });
  }

  /**
   * 执行Anthropic请求
   */
  private async executeAnthropicRequest(
    client: any,
    request: AIRequestConfig,
  ): Promise<any> {
    const response = await client.messages.create({
      model: request.model,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      stream: request.stream,
      stop_sequences: request.stop,
    });

    // 转换Anthropic响应格式为标准格式
    return this.convertAnthropicResponse(response);
  }

  /**
   * 转换响应为统一格式
   */
  private convertResponse(response: any, provider: AIProvider): AIResponse {
    return {
      id: response.id || `${provider}_${Date.now()}`,
      object: response.object || "chat.completion",
      created: response.created || Date.now(),
      model: response.model,
      choices: response.choices || [
        {
          index: 0,
          message: response.message ||
            response.content || {
              role: "assistant",
              content: response.content?.text || response.content,
            },
          finishReason: response.finish_reason || "stop",
          logprobs: response.logprobs || null,
        },
      ],
      usage: response.usage,
      provider,
      duration: 0, // 将在外部设置
      cached: false,
    };
  }

  /**
   * 转换Anthropic响应为OpenAI格式
   */
  private convertAnthropicResponse(response: any): any {
    return {
      id: response.id,
      object: "chat.completion",
      created: Date.now(),
      model: response.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: response.content[0]?.text || "",
          },
          finish_reason: response.stop_reason || "stop",
          logprobs: null,
        },
      ],
      usage: {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens:
          response.usage?.input_tokens + response.usage?.output_tokens,
      },
    };
  }

  /**
   * 创建AI错误对象
   */
  private createAIError(error: Error, provider: AIProvider): AIError {
    return {
      code: error.name || "UNKNOWN_ERROR",
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

    if (message.includes("timeout")) return "timeout_error";
    if (message.includes("network") || message.includes("connection"))
      return "network_error";
    if (message.includes("authentication") || message.includes("unauthorized"))
      return "authentication_error";
    if (message.includes("permission") || message.includes("forbidden"))
      return "permission_error";
    if (message.includes("rate limit") || message.includes("too many requests"))
      return "rate_limit_error";
    if (message.includes("not found") || message.includes("does not exist"))
      return "not_found_error";
    if (message.includes("quota") || message.includes("limit"))
      return "insufficient_quota";
    if (message.includes("validation") || message.includes("invalid"))
      return "validation_error";
    if (message.includes("model") && message.includes("not available"))
      return "model_not_available";

    return "unknown_error";
  }

  /**
   * 判断错误是否可重试
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("connection") ||
      message.includes("rate limit")
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
