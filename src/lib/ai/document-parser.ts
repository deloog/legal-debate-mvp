import { getUnifiedAIService } from "./unified-service";
import type { AIServiceConfig } from "../../types/ai-service";
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

  constructor() {
    // 默认配置
  }

  // =============================================================================
  // 主要分析方法
  // =============================================================================

  async analyzeWithAI(prompt: string): Promise<string> {
    try {
      const unifiedService = await getUnifiedAIService();

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
        return response.choices[0].message.content;
      } else {
        throw new Error("AI服务返回了空响应");
      }
    } catch (error) {
      console.error("DocumentParser AI分析失败:", error);
      throw new Error(
        `AI分析失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
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
      // 清理AI响应中的代码块标记
      let cleanedResponse = aiResponse.trim();

      // 移除可能的代码块标记
      if (cleanedResponse.includes("```json")) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, "")
          .replace(/```\s*$/, "");
      }
      if (cleanedResponse.includes("```")) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, "")
          .replace(/```\s*$/, "");
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
