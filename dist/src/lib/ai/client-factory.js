"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIClientFactory = void 0;
// =============================================================================
// AI客户端工厂
// =============================================================================
/**
 * 创建不同AI提供商的客户端
 */
class AIClientFactory {
  /**
   * 创建AI客户端
   */
  static async createClient(config) {
    switch (config.provider) {
      case "zhipu":
        return this.createZhipuClient(config);
      case "deepseek":
        return this.createDeepSeekClient(config);
      case "openai":
        return this.createOpenAIClient(config);
      case "anthropic":
        return this.createAnthropicClient(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
  /**
   * 创建智谱清言客户端（使用OpenAI兼容格式）
   */
  static async createZhipuClient(config) {
    try {
      // 使用OpenAI兼容格式调用智谱清言API
      const { OpenAI } = await Promise.resolve().then(() =>
        __importStar(require("openai")),
      );
      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || "https://open.bigmodel.cn/api/paas/v4/",
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn(
        "OpenAI client not available for Zhipu, using mock client. Error:",
        error,
      );
      return this.createMockClient("zhipu");
    }
  }
  /**
   * 创建DeepSeek客户端
   */
  static async createDeepSeekClient(config) {
    try {
      // DeepSeek API兼容OpenAI格式，直接使用OpenAI客户端
      const { OpenAI } = await Promise.resolve().then(() =>
        __importStar(require("openai")),
      );
      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL || "https://api.deepseek.com/v1",
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn(
        "DeepSeek client not available, using mock client. Error:",
        error,
      );
      return this.createMockClient("deepseek");
    }
  }
  /**
   * 创建OpenAI客户端
   */
  static async createOpenAIClient(config) {
    try {
      const { OpenAI } = await Promise.resolve().then(() =>
        __importStar(require("openai")),
      );
      return new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn(
        "OpenAI client not available, using mock client. Error:",
        error,
      );
      return this.createMockClient("openai");
    }
  }
  /**
   * 创建Anthropic客户端
   */
  static async createAnthropicClient(config) {
    try {
      const Anthropic = await Promise.resolve().then(() =>
        __importStar(require("@anthropic-ai/sdk")),
      );
      return new Anthropic.default({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        timeout: config.timeout || 30000,
      });
    } catch (error) {
      console.warn(
        "Anthropic client not available, using mock client. Error:",
        error,
      );
      return this.createMockClient("anthropic");
    }
  }
  /**
   * 创建模拟客户端用于开发测试
   */
  static createMockClient(provider) {
    return {
      chat: {
        completions: {
          create: async (params) => ({
            id: `${provider}_mock_${Date.now()}`,
            object: "chat.completion",
            created: Date.now(),
            model: params.model,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: `Mock response from ${provider} for: ${params.messages[params.messages.length - 1]?.content || "unknown"}`,
                },
                finish_reason: "stop",
                logprobs: null,
              },
            ],
            usage: {
              prompt_tokens: 10,
              completion_tokens: 20,
              total_tokens: 30,
            },
          }),
        },
      },
      embeddings: {
        create: async (params) => ({
          object: "list",
          data: [
            {
              object: "embedding",
              embedding: new Array(1536).fill(0).map(() => Math.random()),
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
exports.AIClientFactory = AIClientFactory;
