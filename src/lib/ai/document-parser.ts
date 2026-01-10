import { getUnifiedAIService } from "./unified-service";
import { AIProvider } from "../../types/ai-service";

// 定义模型类型枚举
export enum AIModelType {
  GLM4_FLASH = "glm-4-flash",
  GLM4 = "glm-4",
  DEEPSEEK_CHAT = "deepseek-chat",
}

// =============================================================================
// DocumentParser - 文档解析服务
// 专门用于解析法律文档的AI服务
// =============================================================================

export interface DocumentParseRequest {
  documentId: string;
  textContent: string;
  extractOptions?: {
    extractParties?: boolean;
    extractClaims?: boolean;
    extractTimeline?: boolean;
    generateSummary?: boolean;
  };
}

export interface DocumentParseResponse {
  success: boolean;
  data?: {
    extractedData: {
      parties: Array<{
        type: "plaintiff" | "defendant" | "other";
        name: string;
        role?: string;
        contact?: string;
        address?: string;
      }>;
      claims: Array<{
        type: string;
        content: string;
        amount?: number;
        evidence?: string[];
        legalBasis?: string;
      }>;
      timeline?: Array<{
        date: string;
        event: string;
        description?: string;
      }>;
      summary?: string;
      caseType?:
        | "civil"
        | "criminal"
        | "administrative"
        | "commercial"
        | "labor"
        | "intellectual"
        | "other";
      keyFacts?: string[];
    };
    confidence: number;
    tokenUsed: number;
  };
  error?: string;
  metadata: {
    model: string;
    responseTime: number;
    textLength: number;
  };
}

export class DocumentParser {
  private aiProvider: AIProvider = "zhipu";
  private aiModel: string = "glm-4-flash";
  private useMock: boolean;
  private forceRealAI: boolean = false;

  constructor(useMock: boolean = false) {
    this.useMock = useMock;
  }

  /**
   * 强制使用真实AI服务（用于准确性测试）
   */
  public forceUseRealAI(): void {
    this.forceRealAI = true;
  }

  /**
   * 检查是否使用Mock模式
   */
  private shouldUseMock(): boolean {
    // 如果强制使用真实AI，返回false
    if (this.forceRealAI) {
      return false;
    }
    // 检查环境变量
    if (process.env.USE_MOCK_AI === "true") {
      return true;
    }
    // 检查测试环境
    if (process.env.NODE_ENV === "test") {
      return true;
    }
    // 使用构造函数传入的配置
    return this.useMock;
  }

  /**
   * 生成Mock响应（用于测试环境）
   */
  private generateMockResponse(): string {
    // 生成标准的Mock响应
    return JSON.stringify({
      extractedData: {
        parties: [
          {
            type: "plaintiff",
            name: "张三",
            role: "原告",
            contact: "13800138000",
            address: "北京市朝阳区",
          },
          {
            type: "defendant",
            name: "某科技公司",
            role: "被告",
            contact: "010-12345678",
            address: "上海市浦东新区",
          },
        ],
        claims: [
          {
            type: "PAY_PRINCIPAL",
            content: "判令被告支付货款100000元",
            amount: 100000,
            evidence: ["合同协议", "付款凭证"],
            legalBasis: "民法典第579条",
          },
          {
            type: "PAY_INTEREST",
            content: "判令被告支付利息（按年利率6%计算）",
            amount: null,
            evidence: ["合同约定"],
            legalBasis: "民法典第676条",
          },
          {
            type: "LITIGATION_COST",
            content: "判令被告承担本案诉讼费用",
            amount: null,
            evidence: [],
            legalBasis: "诉讼费用交纳办法",
          },
        ],
        timeline: [
          {
            date: "2024-01-15",
            event: "签订合同",
            description: "双方签订服务合同",
          },
          {
            date: "2024-06-20",
            event: "发生争议",
            description: "因合同履行问题产生纠纷",
          },
        ],
        summary:
          "本案为服务合同纠纷，原告张三请求被告某科技公司支付货款及利息。",
        caseType: "civil",
        keyFacts: [
          "双方签订服务合同",
          "被告未按时支付货款",
          "原告多次催要无果",
        ],
      },
      confidence: 0.95,
    });
  }

  // =============================================================================
  // 主要分析方法
  // =============================================================================

  async analyzeWithAI(prompt: string): Promise<string> {
    // 如果是Mock模式，直接返回预设的Mock响应
    if (this.shouldUseMock()) {
      console.log("使用Mock模式进行文档分析");
      return this.generateMockResponse();
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [尝试 ${attempt}/${maxRetries}] 调用AI服务...`);

        const unifiedService = await getUnifiedAIService(
          undefined,
          this.forceRealAI,
        );

        const response = await unifiedService.chatCompletion({
          model: this.aiModel,
          provider: this.aiProvider,
          messages: [
            {
              role: "system",
              content:
                "你是一个专业的法律文档分析专家，专门从法律文档中提取结构化信息。",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.1,
          maxTokens: 4000,
        });

        if (response.choices && response.choices.length > 0) {
          console.log(`✅ [尝试 ${attempt}/${maxRetries}] AI调用成功`);
          return response.choices[0].message.content;
        } else {
          throw new Error("AI服务返回了空响应");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(
          `❌ [尝试 ${attempt}/${maxRetries}] AI调用失败:`,
          lastError.message,
        );

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const waitTime = attempt * 1000; // 递增等待时间：1秒、2秒、3秒
          console.log(`⏳ 等待 ${waitTime}ms 后重试...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // 所有重试都失败，返回友好错误信息
    throw new Error(
      `AI分析当前繁忙，请稍后再试。技术详情：${lastError?.message || "未知错误"}`,
    );
  }

  // =============================================================================
  // 文档解析方法
  // =============================================================================

  async parseDocument(
    request: DocumentParseRequest,
  ): Promise<DocumentParseResponse> {
    const startTime = Date.now();

    try {
      // 构建分析提示词
      const prompt = this.buildDocumentAnalysisPrompt(
        request.textContent,
        request.extractOptions,
      );

      // 调用AI服务
      const aiResponse = await this.analyzeWithAI(prompt);

      // 解析AI返回结果
      const parseResult = this.parseAIResponse(aiResponse);

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: parseResult,
        metadata: {
          model: this.aiModel,
          responseTime,
          textLength: request.textContent.length,
        },
      };
    } catch {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        error: "文档解析失败",
        metadata: {
          model: this.aiModel,
          responseTime,
          textLength: request.textContent.length,
        },
      };
    }
  }

  // =============================================================================
  // 提示词构建方法
  // =============================================================================

  private buildDocumentAnalysisPrompt(
    textContent: string,
    options?: DocumentParseRequest["extractOptions"],
  ): string {
    const analysisTasks = [];

    if (options?.extractParties !== false) {
      analysisTasks.push("当事人信息提取");
    }

    if (options?.extractClaims !== false) {
      analysisTasks.push("诉讼请求识别");
    }

    if (options?.extractTimeline !== false) {
      analysisTasks.push("时间线整理");
    }

    if (options?.generateSummary === true) {
      analysisTasks.push("案件摘要生成");
    }

    return `你是一个专业的法律文档分析专家。请对以下法律文档进行分析，完成以下任务：

分析任务：${analysisTasks.join("、")}

文档内容：
${textContent}

请按照以下JSON格式返回分析结果，确保数据结构化且准确：

{
  "extractedData": {
    "parties": [
      {
        "type": "plaintiff|defendant|other",
        "name": "当事人姓名",
        "role": "职务或角色",
        "contact": "联系方式",
        "address": "地址"
      }
    ],
    "claims": [
      {
        "type": "请求类型",
        "content": "请求内容描述",
        "amount": 金额(数字),
        "evidence": ["证据描述"],
        "legalBasis": "法律依据"
      }
    ],
    "timeline": [
      {
        "date": "YYYY-MM-DD格式",
        "event": "事件描述",
        "description": "详细说明"
      }
    ],
    "summary": "案件简要总结",
    "caseType": "civil|criminal|administrative|commercial|labor|intellectual|other",
    "keyFacts": ["关键事实1", "关键事实2"]
  },
  "confidence": 0.95
}

注意事项：
1. 当事人信息必须准确识别原告、被告等角色
2. 诉讼请求要完整提取，包括金额和具体诉求
3. 时间线按时间顺序排列
4. 置信度基于信息提取的完整性和准确性评估
5. 只返回JSON格式，不要包含其他说明文字`;
  }

  // =============================================================================
  // AI响应解析方法
  // =============================================================================

  private parseAIResponse(aiResponse: string): {
    extractedData: DocumentParseResponse["data"]["extractedData"];
    confidence: number;
    tokenUsed: number;
  } {
    try {
      // 清理AI响应中的代码块标记（改进版）
      let cleanedResponse = aiResponse.trim();

      // 移除所有可能的代码块标记
      cleanedResponse = cleanedResponse
        .replace(/```json\s*\n?/gi, "")
        .replace(/```text\s*\n?/gi, "")
        .replace(/```javascript\s*\n?/gi, "")
        .replace(/```js\s*\n?/gi, "")
        .replace(/```\s*$/gi, "")
        .trim();

      // 提取完整的JSON对象（支持嵌套）
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      // 尝试解析JSON响应
      const parsed = JSON.parse(cleanedResponse);

      // 验证响应结构
      if (!parsed.extractedData) {
        throw new Error("AI响应格式不正确：缺少extractedData字段");
      }

      return {
        extractedData: {
          parties: parsed.extractedData.parties || [],
          claims: parsed.extractedData.claims || [],
          timeline: parsed.extractedData.timeline || [],
          summary: parsed.extractedData.summary,
          caseType: parsed.extractedData.caseType,
          keyFacts: parsed.extractedData.keyFacts || [],
        },
        confidence: parsed.confidence || 0.8,
        tokenUsed: this.estimateTokenUsage(aiResponse),
      };
    } catch (error) {
      console.error("AI响应解析失败:", error);
      console.error("原始响应:", aiResponse);

      // JSON解析失败时的降级处理
      return {
        extractedData: {
          parties: [],
          claims: [],
          timeline: [],
          summary: "AI响应解析失败，请手动分析",
          keyFacts: [],
        },
        confidence: 0.3,
        tokenUsed: this.estimateTokenUsage(aiResponse),
      };
    }
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  private estimateTokenUsage(text: string): number {
    // 简单的token估算：中文字符按1.5个字符计算，英文按4个字符计算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  // =============================================================================
  // 配置管理方法
  // =============================================================================

  updateConfig(newConfig: { provider?: AIProvider; model?: string }): void {
    if (newConfig.provider) {
      this.aiProvider = newConfig.provider;
    }
    if (newConfig.model) {
      this.aiModel = newConfig.model;
    }
  }

  getConfig(): { provider: AIProvider; model: string } {
    return {
      provider: this.aiProvider,
      model: this.aiModel,
    };
  }
}
