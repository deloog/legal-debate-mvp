import type { AIProvider, AIClientConfig } from "../../types/ai-service";

// =============================================================================
// AI客户端工厂
// =============================================================================

/**
 * 创建不同AI提供商的客户端
 */
export class AIClientFactory {
  /**
   * 创建AI客户端
   */
  public static async createClient(config: AIClientConfig): Promise<any> {
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
  private static async createZhipuClient(config: AIClientConfig): Promise<any> {
    try {
      // 使用OpenAI兼容格式调用智谱清言API
      const { OpenAI } = await import("openai");

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
  private static async createDeepSeekClient(
    config: AIClientConfig,
  ): Promise<any> {
    try {
      // DeepSeek API兼容OpenAI格式，直接使用OpenAI客户端
      const { OpenAI } = await import("openai");

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
  private static async createOpenAIClient(
    config: AIClientConfig,
  ): Promise<any> {
    try {
      const { OpenAI } = await import("openai");

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
  private static async createAnthropicClient(
    config: AIClientConfig,
  ): Promise<any> {
    try {
      const Anthropic = await import("@anthropic-ai/sdk");

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
  private static createMockClient(provider: AIProvider): any {
    return {
      chat: {
        completions: {
          create: async (params: any) => {
            const userMessage =
              params.messages[params.messages.length - 1]?.content || "";

            // 检查是否是文档分析请求
            if (
              userMessage.includes("你是专业法律文档分析专家") ||
              userMessage.includes("extractedData")
            ) {
              // 返回JSON格式的模拟文档分析结果
              return {
                id: `${provider}_mock_${Date.now()}`,
                object: "chat.completion",
                created: Date.now(),
                model: params.model,
                choices: [
                  {
                    index: 0,
                    message: {
                      role: "assistant",
                      content: JSON.stringify({
                        extractedData: {
                          parties: [
                            {
                              type: "plaintiff",
                              name: "王小红",
                              role: "原告",
                              contact: "18600186000",
                              address: "上海市浦东新区陆家嘴环路100号",
                            },
                            {
                              type: "defendant",
                              name: "张大伟",
                              role: "被告",
                              contact: "18700187000",
                              address: "上海市徐汇区淮海中路200号",
                            },
                            {
                              type: "other",
                              name: "赵明",
                              role: "第三人",
                              contact: "18800188000",
                              address: "上海市静安区南京西路300号",
                            },
                          ],
                          claims: [
                            {
                              type: "PAY_PRINCIPAL",
                              content: "支付拖欠货款人民币800,000元",
                              amount: 800000,
                              currency: "CNY",
                            },
                            {
                              type: "PAY_PENALTY",
                              content:
                                "支付违约金（以800,000元为基数，自2023年5月1日起至实际付清之日止，按年利率8%计算）",
                              currency: "CNY",
                            },
                            {
                              type: "LITIGATION_COST",
                              content: "承担本案全部诉讼费用",
                            },
                            {
                              type: "PAY_DAMAGES",
                              content: "赔偿原告因追讨欠款产生的律师费50,000元",
                              amount: 50000,
                              currency: "CNY",
                            },
                          ],
                          timeline: [],
                          summary:
                            "民事借款合同纠纷案，原告王小红诉被告张大伟拖欠货款800,000元，要求支付违约金和律师费。",
                          caseType: "civil",
                          keyFacts: [],
                        },
                        confidence: 0.85,
                        analysisProcess: {
                          ocrErrors: [],
                          entitiesListed: {
                            persons: ["王小红", "张大伟", "赵明"],
                            companies: [],
                            amounts: ["800,000", "50,000"],
                          },
                          roleReasoning: "根据'原告：'和'被告：'关键词识别",
                          claimDecomposition: "复合请求拆解完成",
                          amountNormalization: "已标准化",
                          validationResults: {
                            duplicatesFound: [],
                            roleConflicts: [],
                            missingClaims: [],
                            amountInconsistencies: [],
                          },
                        },
                      }),
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
              };
            }

            // 默认文本响应
            return {
              id: `${provider}_mock_${Date.now()}`,
              object: "chat.completion",
              created: Date.now(),
              model: params.model,
              choices: [
                {
                  index: 0,
                  message: {
                    role: "assistant",
                    content: `Mock response from ${provider} for: ${userMessage}`,
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
            };
          },
        },
      },
      embeddings: {
        create: async (params: any) => ({
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
