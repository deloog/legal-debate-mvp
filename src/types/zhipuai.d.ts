declare module 'zhipuai' {
  // =============================================================================
  // 基础配置类型
  // =============================================================================

  export interface ZhipuConfig {
    apiKey: string;
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
  }

  // =============================================================================
  // 聊天相关类型
  // =============================================================================

  export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    stop?: string | string[];
    presence_penalty?: number;
    frequency_penalty?: number;
    user?: string;
    tools?: Tool[];
    tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    response_format?: { type: 'text' | 'json_object' };
  }

  export interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
  }

  export interface Tool {
    type: 'function';
    function: {
      name: string;
      description?: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required?: string[];
      };
    };
  }

  export interface ToolCall {
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }

  export interface ChatCompletionResponse {
    id: string;
    object: 'chat.completion';
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage?: TokenUsage;
    system_fingerprint?: string;
  }

  export interface ChatCompletionChoice {
    index: number;
    message: ChatMessage;
    finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    logprobs?: null;
  }

  // =============================================================================
  // 流式响应类型
  // =============================================================================

  export interface ChatCompletionChunk {
    id: string;
    object: 'chat.completion.chunk';
    created: number;
    model: string;
    choices: ChatCompletionChunkChoice[];
    system_fingerprint?: string;
  }

  export interface ChatCompletionChunkChoice {
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
    logprobs?: null;
  }

  // =============================================================================
  // 嵌入相关类型
  // =============================================================================

  export interface EmbeddingRequest {
    model: string;
    input: string | string[];
    encoding_format?: 'float' | 'base64';
    dimensions?: number;
    user?: string;
  }

  export interface EmbeddingResponse {
    object: 'list';
    data: Embedding[];
    model: string;
    usage: TokenUsage;
  }

  export interface Embedding {
    object: 'embedding';
    embedding: number[];
    index: number;
  }

  // =============================================================================
  // Token使用情况
  // =============================================================================

  export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  }

  // =============================================================================
  // 错误类型
  // =============================================================================

  export interface ZhipuError {
    error: {
      message: string;
      type: string;
      param?: string;
      code?: string;
    };
  }

  // =============================================================================
  // 主类定义
  // =============================================================================

  export class ZhipuAI {
    constructor(config: ZhipuConfig);

    // 聊天完成接口
    chat: {
      completions: {
        create(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
      };
    };

    // 嵌入接口
    embeddings: {
      create(request: EmbeddingRequest): Promise<EmbeddingResponse>;
    };

    // 模型列表接口（如果支持）
    models?: {
      list(): Promise<ModelListResponse>;
    };

    // 账户信息接口（如果支持）
    billing?: {
      usage(): Promise<UsageResponse>;
    };
  }

  // =============================================================================
  // 额外响应类型
  // =============================================================================

  export interface Model {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
  }

  export interface ModelListResponse {
    object: 'list';
    data: Model[];
  }

  export interface UsageResponse {
    object: 'usage';
    total_usage: number;
    // 其他可能的字段
    [key: string]: unknown;
  }

  // =============================================================================
  // 默认导出
  // =============================================================================

  export default ZhipuAI;
}
