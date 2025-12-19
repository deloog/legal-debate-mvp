declare module 'deepseek-api' {
  interface DeepSeekConfig {
    apiKey: string;
  }

  interface ChatCompletionRequest {
    model: string;
    messages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    [key: string]: unknown;
  }

  interface ChatCompletionResponse {
    choices: Array<{
      message: {
        content: string;
      };
    }>;
  }

  class DeepSeekAPI {
    constructor(config: DeepSeekConfig);
    chat: {
      completions: {
        create(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
      };
    };
  }

  export default DeepSeekAPI;
}
