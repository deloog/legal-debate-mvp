/**
 * 统一AI服务管理器
 *
 * 整合通用AI服务（智谱、DeepSeek等）和法律专用服务（法律之星）
 * 提供统一的接口供上层业务调用
 */

import type {
  Argument,
  CaseInfo,
  DebateGenerationResult,
  LegalReference,
} from "../../types/debate";
import { AICacheManager } from "./cache-manager";
import { getAIConfig } from "./config";
import { DebatePromptOptimizer } from "./debate-prompt-optimizer";
import { LawStarClient, createLawStarClient } from "./lawstar-client";
import { getLawStarConfig } from "./lawstar-config";
import { AIService, AIServiceFactory } from "./service";

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

export interface DebateGeneratorConfig {
  usePromptOptimizer: boolean;
  enableLogicalVerification: boolean;
  minLogicalScore: number;
  maxRetries: number;
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
  private debateConfig: DebateGeneratorConfig;
  private promptOptimizer: DebatePromptOptimizer | null = null;
  private initialized: boolean = false;
  private cacheManager: AICacheManager;
  private useRealAPI: boolean = false;

  constructor(
    config?: Partial<UnifiedAIServiceConfig>,
    debateConfig?: Partial<DebateGeneratorConfig>,
    useRealAPI: boolean = false,
  ) {
    this.config = {
      enableGeneralAI: config?.enableGeneralAI !== false,
      enableLegalAI: config?.enableLegalAI !== false,
    };
    this.debateConfig = {
      usePromptOptimizer: debateConfig?.usePromptOptimizer !== false,
      enableLogicalVerification:
        debateConfig?.enableLogicalVerification !== false,
      minLogicalScore: debateConfig?.minLogicalScore ?? 0.9,
      maxRetries: debateConfig?.maxRetries ?? 3,
    };
    this.cacheManager = new AICacheManager();
    this.useRealAPI = useRealAPI;
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

      // 初始化辩论提示词优化器
      if (this.debateConfig.usePromptOptimizer && this.generalAIService) {
        this.promptOptimizer = new DebatePromptOptimizer(
          this.generalAIService,
          {
            enableCoT: true,
            enableFewShot: true,
            maxExamples: 2,
            complexityLevel: "advanced",
          },
        );
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
      const aiConfig = getAIConfig(this.useRealAPI);
      this.generalAIService = await AIServiceFactory.getInstance(
        "default",
        aiConfig,
        this.useRealAPI,
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
   * 辩论生成（使用DeepSeek，支持逻辑性验证和重试）
   */
  public async generateDebate(caseInfo: {
    title: string;
    description: string;
    legalReferences?: string[];
  }): Promise<AIResponse>;
  public async generateDebate(
    caseInfo: CaseInfo,
    legalReferences?: LegalReference[],
  ): Promise<DebateGenerationResult>;
  public async generateDebate(
    caseInfo:
      | CaseInfo
      | { title: string; description: string; legalReferences?: string[] },
    legalReferences?: LegalReference[] | undefined,
  ): Promise<AIResponse | DebateGenerationResult> {
    this.ensureInitialized();
    this.ensureGeneralAIAvailable();

    // 兼容旧API：如果使用旧格式调用
    const isOldAPI =
      "legalReferences" in caseInfo &&
      !legalReferences &&
      Array.isArray(
        (
          caseInfo as {
            title: string;
            description: string;
            legalReferences?: string[];
          }
        ).legalReferences,
      );
    const oldFormatCase = isOldAPI ? caseInfo : null;
    const newFormatCase = isOldAPI ? null : caseInfo;

    if (isOldAPI && oldFormatCase) {
      // 旧API：直接返回AIResponse
      return this.generateDebateLegacy(
        oldFormatCase as {
          title: string;
          description: string;
          legalReferences?: string[];
        },
      );
    }

    // 新API：返回DebateGenerationResult，支持逻辑验证
    if (!newFormatCase) {
      throw new Error("Invalid arguments");
    }

    return this.generateDebateEnhanced(newFormatCase, legalReferences || []);
  }

  /**
   * 旧版辩论生成（保持兼容）
   */
  private async generateDebateLegacy(caseInfo: {
    title: string;
    description: string;
    legalReferences?: string[];
  }): Promise<AIResponse> {
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

    const response = await this.generalAIService!.chatCompletion({
      model: "deepseek-chat",
      provider: "deepseek",
      messages: [
        {
          role: "system",
          content: "你是一个专业的法律辩论助手，请提供简洁、结构化的辩论论点。",
        },
        {
          role: "user",
          content: `案件：${caseInfo.title}
描述：${caseInfo.description}
${caseInfo.legalReferences ? `法条：${caseInfo.legalReferences.join("、")}` : ""}

请分别列出原告和被告的3-4个核心论点，每个论点包含：主张、法律依据、事实依据。`,
        },
      ],
      temperature: 0.5,
      maxTokens: 2000,
      topP: 0.9,
    });

    await this.cacheManager.cacheDebate(caseInfo, response);

    return response;
  }

  /**
   * 增强版辩论生成（支持逻辑验证和重试）
   */
  private async generateDebateEnhanced(
    caseInfo: CaseInfo,
    legalReferences: LegalReference[],
  ): Promise<DebateGenerationResult> {
    let attempts = 0;
    let bestResult: DebateGenerationResult | null = null;

    while (attempts < this.debateConfig.maxRetries) {
      attempts++;

      try {
        const result = await this.generateDebateInternal(
          caseInfo,
          legalReferences,
        );

        if (this.debateConfig.enableLogicalVerification) {
          const logicalScore =
            this.calculateLogicalScore(result.plaintiffArguments) +
            this.calculateLogicalScore(result.defendantArguments);

          const avgLogicalScore = logicalScore / 2;

          if (avgLogicalScore >= this.debateConfig.minLogicalScore) {
            bestResult = result;
            break;
          }

          if (
            !bestResult ||
            avgLogicalScore >
              (this.calculateLogicalScore(bestResult.plaintiffArguments) +
                this.calculateLogicalScore(bestResult.defendantArguments)) /
                2
          ) {
            bestResult = result;
          }
        } else {
          bestResult = result;
          break;
        }
      } catch (error) {
        if (attempts === this.debateConfig.maxRetries) {
          throw error;
        }
      }
    }

    if (!bestResult) {
      throw new Error("无法生成满足要求的辩论论点");
    }

    const executionTime = Date.now();

    return {
      ...bestResult,
      metadata: {
        generatedAt: new Date(),
        model: "deepseek-chat",
        tokensUsed: 1500,
        executionTime,
        confidence: this.calculateOverallScore(bestResult),
      },
    };
  }

  /**
   * 内部辩论生成方法
   */
  private async generateDebateInternal(
    caseInfo: CaseInfo,
    legalReferences: LegalReference[],
  ): Promise<DebateGenerationResult> {
    const legalTexts = legalReferences.map((ref) => ref.fullText).join("\n\n");
    const prompt = await this.buildPrompt(caseInfo, legalTexts);

    const response = await this.generalAIService!.chatCompletion({
      model: "deepseek-chat",
      provider: "deepseek",
      messages: [
        {
          role: "system",
          content: this.debateConfig.usePromptOptimizer
            ? (await this.promptOptimizer?.generateOptimizedPrompt(caseInfo))
                .systemPrompt
            : "你是专业的法律辩论生成助手，擅长生成逻辑清晰、法律依据准确的辩论论点。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      maxTokens: 2000,
    });

    return this.parseDebateResponse(
      response.choices[0].message.content || "",
      legalReferences,
    );
  }

  /**
   * 构建提示词
   */
  private async buildPrompt(
    caseInfo: CaseInfo,
    legalTexts: string,
  ): Promise<string> {
    if (this.debateConfig.usePromptOptimizer && this.promptOptimizer) {
      const optimized = await this.promptOptimizer.generateOptimizedPrompt(
        caseInfo,
        legalTexts.split("\n\n").filter((t) => t),
      );
      return optimized.userPrompt;
    }

    return `案件：${caseInfo.title}
案情描述：${caseInfo.description}

相关法条：
${legalTexts}

请分别列出原告和被告的3-4个核心论点，每个论点包含：
1. 论点内容
2. 法律依据
3. 事实依据
4. 推理过程

请确保：
- 论点逻辑清晰，推理完整
- 法律依据准确，引用具体法条
- 事实依据与案情一致
- 正反方论点平衡

请以JSON格式返回：
{
  "plaintiffArguments": [
    {
      "side": "plaintiff",
      "content": "论点内容",
      "legalBasis": "法律依据",
      "reasoning": "推理过程"
    }
  ],
  "defendantArguments": [...]
}`;
  }

  /**
   * 解析辩论响应
   */
  private parseDebateResponse(
    response: string,
    legalReferences: LegalReference[],
  ): DebateGenerationResult {
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        if (
          (parsed.plaintiffArguments?.length > 0 ||
            parsed.defendantArguments?.length > 0) &&
          parsed.plaintiffArguments?.every(this.isValidArgument) &&
          parsed.defendantArguments?.every(this.isValidArgument)
        ) {
          console.log("JSON解析成功");
          return {
            plaintiffArguments: parsed.plaintiffArguments || [],
            defendantArguments: parsed.defendantArguments || [],
            legalBasis: legalReferences,
            metadata: {
              generatedAt: new Date(),
              model: "deepseek-chat",
              tokensUsed: 0,
              confidence: 0,
            },
          };
        }
      } catch (error) {
        console.error("JSON解析失败，尝试其他解析方法:", error);
      }
    }

    console.log("尝试从文本提取论点");
    return this.extractArgumentsFromText(response, legalReferences);
  }

  /**
   * 验证论点对象是否有效
   */
  private isValidArgument(arg: unknown): arg is Argument {
    return (
      typeof arg === "object" &&
      arg !== null &&
      "content" in arg &&
      typeof arg.content === "string" &&
      "side" in arg &&
      typeof arg.side === "string"
    );
  }

  /**
   * 从文本中提取论点
   */
  private extractArgumentsFromText(
    text: string,
    legalReferences: LegalReference[],
  ): DebateGenerationResult {
    const plaintiffArguments: Argument[] = [];
    const defendantArguments: Argument[] = [];

    const plaintiffSection = this.extractSection(text, [
      "原告",
      "申请人",
      "指控方",
      " Plaintiff",
    ]);

    const defendantSection = this.extractSection(text, [
      "被告",
      "被申请人",
      "辩护方",
      " Defendant",
    ]);

    const plaintiffMatches =
      plaintiffSection.match(/\d+\.\s*(.+?)(?=\n|$)/g) || [];
    for (const match of plaintiffMatches) {
      const content = match.replace(/^\d+\.\s*/, "").trim();
      if (content.length > 5) {
        plaintiffArguments.push({
          side: "plaintiff",
          content,
          legalBasis: this.extractLegalBasis(content),
          reasoning: this.extractReasoning(content),
        });
      }
    }

    const defendantMatches =
      defendantSection.match(/\d+\.\s*(.+?)(?=\n|$)/g) || [];
    for (const match of defendantMatches) {
      const content = match.replace(/^\d+\.\s*/, "").trim();
      if (content.length > 5) {
        defendantArguments.push({
          side: "defendant",
          content,
          legalBasis: this.extractLegalBasis(content),
          reasoning: this.extractReasoning(content),
        });
      }
    }

    console.log(
      `提取到 ${plaintiffArguments.length} 个原告论点，${defendantArguments.length} 个被告论点`,
    );

    return {
      plaintiffArguments,
      defendantArguments,
      legalBasis: legalReferences,
      metadata: {
        generatedAt: new Date(),
        model: "deepseek-chat",
        tokensUsed: 0,
        confidence: 0,
      },
    };
  }

  /**
   * 提取文本中的某个部分
   */
  private extractSection(text: string, keywords: string[]): string {
    const lowerText = text.toLowerCase();
    const keywordIndices: Array<{ index: number; end: number }> = [];

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      let index = lowerText.indexOf(lowerKeyword);

      while (index >= 0) {
        keywordIndices.push({ index, end: index + keyword.length });
        index = lowerText.indexOf(lowerKeyword, index + 1);
      }
    }

    if (keywordIndices.length === 0) {
      return text;
    }

    keywordIndices.sort((a, b) => a.index - b.index);
    const firstKeyword = keywordIndices[0];

    let endIndex = text.length;
    for (const nextKeyword of keywordIndices.slice(1)) {
      if (nextKeyword.index > firstKeyword.end) {
        endIndex = nextKeyword.index;
        break;
      }
    }

    return text.substring(firstKeyword.end, endIndex).trim();
  }

  /**
   * 提取法律依据
   */
  private extractLegalBasis(content: string): string | undefined {
    const legalMatch = content.match(
      /根据|依据|依照|按照.+?(?:法|条例|规定|解释)/,
    );

    if (legalMatch) {
      const sentence = content.substring(legalMatch.index);
      const endIndex = sentence.search(/[。\n]/);
      return endIndex >= 0
        ? sentence.substring(0, endIndex).trim()
        : sentence.trim();
    }

    return undefined;
  }

  /**
   * 提取推理过程
   */
  private extractReasoning(content: string): string | undefined {
    const connectorMatch = content.match(
      /(因此|所以|基于此|由此可见|综上所述)/,
    );

    if (connectorMatch) {
      return content.substring(connectorMatch.index).trim();
    }

    return undefined;
  }

  /**
   * 计算逻辑性得分（优化版）
   */
  private calculateLogicalScore(args: Argument[]): number {
    if (args.length === 0) return 0;

    let totalScore = 0;

    // 更全面的逻辑连接词列表
    const logicalConnectors = [
      "因此",
      "基于此",
      "根据",
      "由于",
      "因为",
      "所以",
      "据此",
      "基于",
      "鉴于",
      "鉴于上述",
      "由此可见",
      "综上所述",
      "从而",
      "进而",
      "故此",
    ];

    for (const arg of args) {
      let score = 0.4; // 基础分降低，增加其他评分维度

      // 法律依据（0.25分）
      if (arg.legalBasis) {
        score += 0.25;
        // 额外奖励：引用具体法条号（如"第509条"）
        if (/第\d+条/.test(arg.legalBasis)) {
          score += 0.05;
        }
      }

      // 推理过程（0.2分）
      if (arg.reasoning) {
        score += 0.2;
        // 推理长度评估
        if (arg.reasoning.length > 30) {
          score += 0.05;
        }
        // 推理深度：检测推理步骤（逗号分隔的多个要点）
        const reasoningSteps = arg.reasoning
          .split(/[，。；,.;]/)
          .filter((s) => s.trim().length > 2);
        if (reasoningSteps.length >= 2) {
          score += 0.05;
        }
      }

      // 逻辑连接词（0.15分）
      let hasConnector = false;
      let connectorCount = 0;
      for (const connector of logicalConnectors) {
        if (arg.content.includes(connector)) {
          hasConnector = true;
          connectorCount++;
        }
      }
      if (hasConnector) {
        score += Math.min(0.15, connectorCount * 0.05);
      }

      // 因果关系检测（0.1分）
      if (this.hasCausalRelation(arg.content)) {
        score += 0.1;
      }

      totalScore += Math.min(score, 1);
    }

    return totalScore / args.length;
  }

  /**
   * 检测因果关系
   */
  private hasCausalRelation(content: string): boolean {
    const causalPatterns = [
      /导致|引起|造成|产生/g,
      /基于.*?所以/g,
      /因为.*?因此/g,
      /由于.*?所以/g,
      /根据.*?故此/g,
    ];
    return causalPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * 计算综合得分
   */
  private calculateOverallScore(result: DebateGenerationResult): number {
    const plaintiffScore = this.calculateLogicalScore(
      result.plaintiffArguments,
    );
    const defendantScore = this.calculateLogicalScore(
      result.defendantArguments,
    );

    const logicalConsistency = (plaintiffScore + defendantScore) / 2;

    const factualAccuracy = this.calculateFactualAccuracy(result);

    const completeness = this.calculateCompleteness(result);

    const normalizedLogical = Math.min(1, Math.max(0, logicalConsistency));
    const normalizedFactual = Math.min(1, Math.max(0, factualAccuracy));
    const normalizedCompleteness = Math.min(1, Math.max(0, completeness));

    const weightedScore =
      normalizedLogical * 0.35 +
      normalizedFactual * 0.4 +
      normalizedCompleteness * 0.25;

    return Math.min(1, Math.max(0, weightedScore));
  }

  /**
   * 计算事实准确性
   */
  private calculateFactualAccuracy(result: DebateGenerationResult): number {
    let totalScore = 0;
    const totalArguments =
      result.plaintiffArguments.length + result.defendantArguments.length;

    if (totalArguments === 0) return 0;

    for (const arg of [
      ...result.plaintiffArguments,
      ...result.defendantArguments,
    ]) {
      let score = 0;

      score += arg.legalBasis ? 0.4 : 0;
      score += arg.reasoning ? 0.4 : 0;
      score += arg.content ? 0.2 : 0;

      totalScore += score;
    }

    return Math.min(1, totalScore / totalArguments);
  }

  /**
   * 计算完整度
   */
  private calculateCompleteness(result: DebateGenerationResult): number {
    const plaintiffCount = result.plaintiffArguments.length;
    const defendantCount = result.defendantArguments.length;

    const countScore =
      (plaintiffCount >= 3 && defendantCount >= 3 ? 1 : 0) * 0.4;

    let qualityScore = 0;

    for (const arg of [
      ...result.plaintiffArguments,
      ...result.defendantArguments,
    ]) {
      qualityScore += arg.content && arg.legalBasis && arg.reasoning ? 1 : 0;
    }

    const totalArguments = plaintiffCount + defendantCount;
    const avgQuality = totalArguments > 0 ? qualityScore / totalArguments : 0;

    return Math.min(1, countScore + avgQuality * 0.6);
  }

  /**
   * 配置辩论生成器
   */
  public configureDebateGenerator(
    config: Partial<DebateGeneratorConfig>,
  ): void {
    this.debateConfig = { ...this.debateConfig, ...config };
  }

  /**
   * 获取辩论生成器配置
   */
  public getDebateGeneratorConfig(): DebateGeneratorConfig {
    return { ...this.debateConfig };
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
    combined: Array<{
      lawId: string;
      source: "keyword" | "semantic";
      relevanceScore?: number;
      similarity?: number;
      score?: number;
      lawName?: string;
      title?: string;
    }>;
  }> {
    this.ensureInitialized();
    this.ensureLegalAIAvailable();

    const results: {
      keywordResults?: LawStarRegulationResponse;
      semanticResults?: LawStarVectorResponse;
      combined: Array<{
        lawId: string;
        lawName: string;
        source: "keyword" | "semantic";
        relevanceScore?: number;
        similarity?: number;
        score?: number;
        title?: string;
      }>;
    } = {
      combined: [],
    };

    // 并行执行关键词和语义查询
    const promises: Array<
      Promise<LawStarRegulationResponse | LawStarVectorResponse>
    > = [];

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
            lawId: item.lawId,
            lawName: item.lawName,
            source: "keyword",
            title: item.lawName,
          });
        }
      }
    }

    if (results.semanticResults) {
      for (const match of results.semanticResults.data.result) {
        if (!seenIds.has(match.lawId)) {
          seenIds.add(match.lawId);
          results.combined.push({
            lawId: match.lawId,
            lawName: match.lawName,
            source: "semantic",
            relevanceScore: match.score,
            similarity: match.score,
            score: match.score,
            title: match.lawName,
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
    legalReferences: {
      keywordResults?: LawStarRegulationResponse;
      semanticResults?: LawStarVectorResponse;
      combined: Array<{
        lawId: string;
        source: "keyword" | "semantic";
        relevanceScore?: number;
        similarity?: number;
        score?: number;
        lawName?: string;
        title?: string;
      }>;
    };
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
let accuracyTestServiceInstance: UnifiedAIService | null = null;

export async function getUnifiedAIService(
  config?: Partial<UnifiedAIServiceConfig>,
  useRealAPI: boolean = false,
): Promise<UnifiedAIService> {
  // 如果明确请求使用真实API（准确性测试），使用专用实例
  if (useRealAPI) {
    if (!accuracyTestServiceInstance) {
      accuracyTestServiceInstance = new UnifiedAIService(
        config,
        undefined,
        true,
      );
      await accuracyTestServiceInstance.initialize();
    }
    return accuracyTestServiceInstance;
  }

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
