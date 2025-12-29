/**
 * 统一AI服务管理器
 *
 * 整合通用AI服务（智谱、DeepSeek等）和法律专用服务（法律之星）
 * 提供统一的接口供上层业务调用
 */

import { AIService, AIServiceFactory } from "./service";
import { LawStarClient, createLawStarClient } from "./lawstar-client";
import { getAIConfig } from "./config";
import { getLawStarConfig } from "./lawstar-config";
import { AICacheManager } from "./cache-manager";

import type { AIRequestConfig, AIResponse } from "../../types/ai-service";
import type {
  LawStarRegulationRequest,
  LawStarRegulationResponse,
  LawStarVectorRequest,
  LawStarVectorResponse,
} from "../../types/lawstar-api";

// =============================================================================
// 统一服务类型定义
// =============================================================================

export interface UnifiedAIServiceConfig {
  enableGeneralAI: boolean;
  enableLegalAI: boolean;
}

export interface ServiceStatus {
  generalAI: {
    available: boolean;
    providers: string[];
    healthy: boolean;
  };
  legalAI: {
    available: boolean;
    regulation: boolean;
    vector: boolean;
    healthy: boolean;
  };
  overall: {
    healthy: boolean;
    lastCheck: number;
  };
}

// =============================================================================
// 统一AI服务管理器
// =============================================================================

export class UnifiedAIService {
  private generalAIService: AIService | null = null;
  private legalAIService: LawStarClient | null = null;
  private config: UnifiedAIServiceConfig;
  private initialized: boolean = false;
  private cacheManager: AICacheManager;

  constructor(config?: Partial<UnifiedAIServiceConfig>) {
    this.config = {
      enableGeneralAI: config?.enableGeneralAI !== false,
      enableLegalAI: config?.enableLegalAI !== false,
    };
    this.cacheManager = new AICacheManager();
  }

  // =============================================================================
  // 初始化方法
  // =============================================================================

  public async initialize(): Promise<void> {
    try {
      // 初始化通用AI服务
      if (this.config.enableGeneralAI) {
        await this.initializeGeneralAI();
      }

      // 初始化法律AI服务
      if (this.config.enableLegalAI) {
        await this.initializeLegalAI();
      }

      this.initialized = true;
      console.log("Unified AI Service initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Unified AI Service:", error);
      throw error;
    }
  }

  private async initializeGeneralAI(): Promise<void> {
    try {
      const aiConfig = getAIConfig();
      this.generalAIService = await AIServiceFactory.getInstance(
        "default",
        aiConfig,
      );
      console.log("General AI Service initialized");
    } catch (error) {
      console.error("Failed to initialize General AI Service:", error);
      throw error;
    }
  }

  private async initializeLegalAI(): Promise<void> {
    try {
      const lawStarConfig = getLawStarConfig();
      this.legalAIService = createLawStarClient(lawStarConfig);
      console.log("Legal AI Service (Law Star) initialized");
    } catch (error) {
      console.error("Failed to initialize Legal AI Service:", error);
      throw error;
    }
  }

  // =============================================================================
  // 通用AI服务方法
  // =============================================================================

  /**
   * 聊天完成（使用通用AI）
   */
  public async chatCompletion(request: AIRequestConfig): Promise<AIResponse> {
    this.ensureInitialized();
    this.ensureGeneralAIAvailable();

    return this.generalAIService!.chatCompletion(request);
  }

  /**
   * 文档解析（使用智谱清言）
   */
  public async parseDocument(
    content: string,
    options?: {
      extractKeyInfo?: boolean;
      identifyLegalIssues?: boolean;
    },
  ): Promise<AIResponse> {
    this.ensureInitialized();
    this.ensureGeneralAIAvailable();

    const systemPrompt = `你是一个专业的法律文档分析助手。请分析以下文档内容：
${options?.extractKeyInfo ? "- 提取关键信息（当事人、案由、诉求等）" : ""}
${options?.identifyLegalIssues ? "- 识别法律问题和争议焦点" : ""}`;

    return this.generalAIService!.chatCompletion({
      model: "glm-4-flash",
      provider: "zhipu", // 明确指定提供商
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });
  }

  /**
   * 辩论生成（使用DeepSeek）
   */
  public async generateDebate(caseInfo: {
    title: string;
    description: string;
    legalReferences?: string[];
  }): Promise<AIResponse> {
    this.ensureInitialized();
    this.ensureGeneralAIAvailable();

    // 1. 首先检查缓存
    const cachedResponse = await this.cacheManager.checkDebateCache(caseInfo);
    if (cachedResponse) {
      console.log("Using cached debate response");
      return {
        ...cachedResponse,
        cached: true,
        provider: "deepseek",
      };
    }

    // 优化后的提示词设计 - 更简洁直接
    const prompt = `案件：${caseInfo.title}
描述：${caseInfo.description}
${caseInfo.legalReferences ? `法条：${caseInfo.legalReferences.join("、")}` : ""}

请分别列出原告和被告的3-4个核心论点，每个论点包含：主张、法律依据、事实依据。`;

    const response = await this.generalAIService!.chatCompletion({
      model: "deepseek-chat",
      provider: "deepseek", // 明确指定提供商
      messages: [
        {
          role: "system",
          content: "你是一个专业的法律辩论助手，请提供简洁、结构化的辩论论点。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.5, // 降低随机性，提高一致性
      maxTokens: 2000, // 减少输出长度，优化响应时间
      topP: 0.9, // 添加topP参数控制生成质量
    });

    // 2. 缓存响应结果
    await this.cacheManager.cacheDebate(caseInfo, response);

    return response;
  }

  // =============================================================================
  // 法律AI服务方法
  // =============================================================================

  /**
   * 法规查询（使用法律之星）
   */
  public async searchLegalRegulations(
    request: LawStarRegulationRequest,
  ): Promise<LawStarRegulationResponse> {
    this.ensureInitialized();
    this.ensureLegalAIAvailable();

    return this.legalAIService!.searchRegulations(request);
  }

  /**
   * 向量查询（使用法律之星）
   */
  public async searchLegalByVector(
    request: LawStarVectorRequest,
  ): Promise<LawStarVectorResponse> {
    this.ensureInitialized();
    this.ensureLegalAIAvailable();

    return this.legalAIService!.vectorSearch(request);
  }

  /**
   * 智能法律检索（结合关键词和语义）
   */
  public async smartLegalSearch(query: {
    keyword?: string;
    semanticQuery?: string;
    lawType?: string;
    topK?: number;
  }): Promise<{
    keywordResults?: LawStarRegulationResponse;
    semanticResults?: LawStarVectorResponse;
    combined: any[];
  }> {
    this.ensureInitialized();
    this.ensureLegalAIAvailable();

    const results: {
      keywordResults?: LawStarRegulationResponse;
      semanticResults?: LawStarVectorResponse;
      combined: any[];
    } = {
      combined: [],
    };

    // 并行执行关键词和语义查询
    const promises: Promise<any>[] = [];

    if (query.keyword) {
      promises.push(
        this.legalAIService!.searchRegulations({
          keyword: query.keyword,
          lawType: query.lawType,
          pageSize: query.topK || 10,
        }).then((res) => {
          results.keywordResults = res;
          return res;
        }),
      );
    }

    if (query.semanticQuery) {
      promises.push(
        this.legalAIService!.vectorSearch({
          query: query.semanticQuery,
          lawType: query.lawType,
          topK: query.topK || 10,
        }).then((res) => {
          results.semanticResults = res;
          return res;
        }),
      );
    }

    await Promise.allSettled(promises);

    // 合并结果（去重）
    const seenIds = new Set<string>();

    if (results.keywordResults) {
      for (const item of results.keywordResults.data.lawdata) {
        if (!seenIds.has(item.lawId)) {
          seenIds.add(item.lawId);
          results.combined.push({
            ...item,
            source: "keyword",
          });
        }
      }
    }

    if (results.semanticResults) {
      for (const match of results.semanticResults.data.result) {
        if (!seenIds.has(match.lawId)) {
          seenIds.add(match.lawId);
          results.combined.push({
            ...match,
            source: "semantic",
          });
        }
      }
    }

    // 按相关性排序
    results.combined.sort((a, b) => {
      const scoreA = a.relevanceScore || a.similarity || 0;
      const scoreB = b.relevanceScore || b.similarity || 0;
      return scoreB - scoreA;
    });

    return results;
  }

  // =============================================================================
  // 组合服务方法
  // =============================================================================

  /**
   * 完整的案件分析流程
   * 1. 文档解析
   * 2. 法律检索
   * 3. 辩论生成
   */
  public async analyzeCaseComplete(document: {
    content: string;
    title: string;
  }): Promise<{
    documentAnalysis: AIResponse;
    legalReferences: any;
    debatePoints: AIResponse;
  }> {
    this.ensureInitialized();

    // 1. 文档解析
    const documentAnalysis = await this.parseDocument(document.content, {
      extractKeyInfo: true,
      identifyLegalIssues: true,
    });

    // 2. 提取关键词进行法律检索
    const keywords = this.extractKeywords(
      documentAnalysis.choices[0].message.content,
    );
    const legalReferences = await this.smartLegalSearch({
      keyword: keywords.join(" "),
      semanticQuery: document.content.substring(0, 500),
      topK: 5,
    });

    // 3. 生成辩论论点
    const debatePoints = await this.generateDebate({
      title: document.title,
      description: documentAnalysis.choices[0].message.content,
      legalReferences: legalReferences.combined.map(
        (ref) => ref.lawName || ref.title,
      ),
    });

    return {
      documentAnalysis,
      legalReferences,
      debatePoints,
    };
  }

  /**
   * 从文本中提取关键词（简单实现）
   */
  private extractKeywords(text: string): string[] {
    // 简单的关键词提取逻辑
    const keywords: string[] = [];
    const legalTerms = [
      "合同",
      "侵权",
      "违约",
      "赔偿",
      "诉讼",
      "仲裁",
      "民法",
      "刑法",
    ];

    for (const term of legalTerms) {
      if (text.includes(term)) {
        keywords.push(term);
      }
    }

    return keywords.length > 0 ? keywords : ["法律"];
  }

  // =============================================================================
  // 状态和健康检查
  // =============================================================================

  /**
   * 获取服务状态
   */
  public async getServiceStatus(): Promise<ServiceStatus> {
    const status: ServiceStatus = {
      generalAI: {
        available: false,
        providers: [],
        healthy: false,
      },
      legalAI: {
        available: false,
        regulation: false,
        vector: false,
        healthy: false,
      },
      overall: {
        healthy: false,
        lastCheck: Date.now(),
      },
    };

    // 检查通用AI服务
    if (this.generalAIService) {
      try {
        const aiStatus = this.generalAIService.getServiceStatus();
        status.generalAI.available = true;
        status.generalAI.providers =
          this.generalAIService.getAvailableProviders();
        status.generalAI.healthy = aiStatus.healthy;
      } catch (error) {
        console.error("Failed to get general AI status:", error);
      }
    }

    // 检查法律AI服务
    if (this.legalAIService) {
      try {
        const lawStarHealthy = await this.legalAIService.healthCheck();
        status.legalAI.available = true;
        status.legalAI.regulation = true;
        status.legalAI.vector = true;
        status.legalAI.healthy = lawStarHealthy;
      } catch (error) {
        console.error("Failed to get legal AI status:", error);
      }
    }

    // 计算整体健康状态
    status.overall.healthy =
      (status.generalAI.available ? status.generalAI.healthy : true) &&
      (status.legalAI.available ? status.legalAI.healthy : true);

    return status;
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const status = await this.getServiceStatus();
      return status.overall.healthy;
    } catch {
      return false;
    }
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        "Unified AI Service not initialized. Call initialize() first.",
      );
    }
  }

  private ensureGeneralAIAvailable(): void {
    if (!this.generalAIService) {
      throw new Error("General AI Service is not available");
    }
  }

  private ensureLegalAIAvailable(): void {
    if (!this.legalAIService) {
      throw new Error("Legal AI Service is not available");
    }
  }

  /**
   * 关闭服务
   */
  public async shutdown(): Promise<void> {
    if (this.generalAIService) {
      await this.generalAIService.shutdown();
    }
    this.initialized = false;
    console.log("Unified AI Service shut down");
  }
}

// =============================================================================
// 单例工厂
// =============================================================================

let unifiedServiceInstance: UnifiedAIService | null = null;

export async function getUnifiedAIService(
  config?: Partial<UnifiedAIServiceConfig>,
): Promise<UnifiedAIService> {
  if (!unifiedServiceInstance) {
    unifiedServiceInstance = new UnifiedAIService(config);
    await unifiedServiceInstance.initialize();
  }
  return unifiedServiceInstance;
}

export function resetUnifiedAIService(): void {
  if (unifiedServiceInstance) {
    unifiedServiceInstance.shutdown();
    unifiedServiceInstance = null;
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export default UnifiedAIService;
