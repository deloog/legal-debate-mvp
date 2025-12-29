import { LawArticle } from "@prisma/client";
import { DocumentAnalysisOutput } from "@/lib/agent/doc-analyzer/core/types";
import {
  AIReviewResult,
  SemanticMatchResult,
  RuleValidationResult,
} from "./types";
import { AIServiceFactory } from "@/lib/ai/service-refactored";
import { getAIConfig } from "@/lib/ai/config";
import type { AIRequestConfig } from "@/types/ai-service";
import type { AIService } from "@/lib/ai/service-refactored";

/**
 * AI审查器
 *
 * Layer 3: AI审查
 * 生成适用性报告和置信度
 */
export class AIReviewer {
  private aiService: AIService;
  private initialized: boolean = false;

  /**
   * 初始化AI审查器
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const config = getAIConfig();
      this.aiService = await AIServiceFactory.getInstance(
        "ai-reviewer",
        config,
      );
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize AIReviewer:", error);
      throw error;
    }
  }

  /**
   * 审查单条法条
   */
  public async reviewArticle(
    article: LawArticle,
    caseInfo: DocumentAnalysisOutput,
    semanticMatch: SemanticMatchResult,
    ruleValidation: RuleValidationResult,
  ): Promise<AIReviewResult> {
    const caseContext = this.buildCaseContext(caseInfo);
    const articleContext = this.buildArticleContext(article);
    const analysisContext = this.buildAnalysisContext(
      semanticMatch,
      ruleValidation,
    );

    // 使用AI进行综合分析
    const aiResult = await this.performAIAnalysis(
      caseContext,
      articleContext,
      analysisContext,
    );

    return aiResult;
  }

  /**
   * 批量审查法条
   */
  public async reviewArticles(
    articles: LawArticle[],
    caseInfo: DocumentAnalysisOutput,
    semanticMatches: Map<string, SemanticMatchResult>,
    ruleValidations: Map<string, RuleValidationResult>,
  ): Promise<Map<string, AIReviewResult>> {
    const results = new Map<string, AIReviewResult>();

    for (const article of articles) {
      const semanticMatch = semanticMatches.get(article.id);
      const ruleValidation = ruleValidations.get(article.id);

      if (!semanticMatch || !ruleValidation) {
        console.warn(
          `Missing semantic match or rule validation for article ${article.id}`,
        );
        continue;
      }

      const result = await this.reviewArticle(
        article,
        caseInfo,
        semanticMatch,
        ruleValidation,
      );
      results.set(article.id, result);
    }

    return results;
  }

  /**
   * 执行AI综合分析
   */
  private async performAIAnalysis(
    caseContext: string,
    articleContext: string,
    analysisContext: string,
  ): Promise<AIReviewResult> {
    try {
      const prompt = this.buildReviewPrompt(
        caseContext,
        articleContext,
        analysisContext,
      );

      const request: AIRequestConfig = {
        model: "glm-4-flash",
        messages: [
          {
            role: "system",
            content:
              "你是专业的法律适用性审查专家，擅长评估法条对案件情况的适用性。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 800,
      };

      const response = await this.aiService.chatCompletion(request);
      const result = response.choices[0].message.content;

      return this.parseAIResponse(result);
    } catch (error) {
      console.error("AI review failed:", error);
      // 返回保守结果
      return {
        applicable: false,
        confidence: 0.3,
        reasons: ["AI审查失败，需要人工确认"],
        warnings: ["AI审查失败"],
      };
    }
  }

  /**
   * 构建审查提示词
   */
  private buildReviewPrompt(
    caseContext: string,
    articleContext: string,
    analysisContext: string,
  ): string {
    return `请综合评估法条对案件的适用性，并返回JSON格式结果。

案件情况：
${caseContext}

法条信息：
${articleContext}

前期分析结果：
${analysisContext}

请从以下维度评估：
1. 语义相关性：法条与案件的语义相关程度
2. 规则符合性：时效性、适用范围、法条层级是否符合要求
3. 实际适用性：法条在实际案件中能否作为法律依据
4. 风险评估：使用该法条可能存在的风险或限制

请返回JSON格式（只返回JSON，不要其他内容）：
{
  "applicable": true/false（是否适用），
  "confidence": 数字（0-1之间的置信度），
  "reasons": ["适用原因1", "适用原因2", ...]（适用原因列表），
  "warnings": ["警告信息1", "警告信息2", ...]（警告信息列表，如果无警告则为空数组）
}`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): AIReviewResult {
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        applicable: result.applicable || false,
        confidence: Math.min(Math.max(result.confidence || 0, 0), 1),
        reasons: Array.isArray(result.reasons) ? result.reasons : [],
        warnings: Array.isArray(result.warnings) ? result.warnings : [],
      };
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      return {
        applicable: false,
        confidence: 0.3,
        reasons: [],
        warnings: ["AI响应解析失败"],
      };
    }
  }

  /**
   * 构建案情上下文
   */
  private buildCaseContext(caseInfo: DocumentAnalysisOutput): string {
    const { extractedData } = caseInfo;
    const parts: string[] = [];

    // 案件类型
    if (extractedData.caseType) {
      parts.push(`案件类型：${this.translateCaseType(extractedData.caseType)}`);
    }

    // 当事人
    if (extractedData.parties && extractedData.parties.length > 0) {
      const plaintiffNames = extractedData.parties
        .filter((p) => p.type === "plaintiff")
        .map((p) => p.name)
        .join("、");
      const defendantNames = extractedData.parties
        .filter((p) => p.type === "defendant")
        .map((p) => p.name)
        .join("、");
      parts.push(`原告：${plaintiffNames || "未明确"}`);
      parts.push(`被告：${defendantNames || "未明确"}`);
    }

    // 诉讼请求
    if (extractedData.claims && extractedData.claims.length > 0) {
      const claimTexts = extractedData.claims
        .map((c) => `【${this.translateClaimType(c.type)}】${c.content}`)
        .join("；");
      parts.push(`诉讼请求：${claimTexts}`);
    }

    // 关键事实
    if (extractedData.keyFacts && extractedData.keyFacts.length > 0) {
      const factTexts = extractedData.keyFacts
        .slice(0, 5)
        .map((f) => f.description)
        .join("；");
      parts.push(`关键事实：${factTexts}`);
    }

    // 争议焦点
    if (
      extractedData.disputeFocuses &&
      extractedData.disputeFocuses.length > 0
    ) {
      const disputeTexts = extractedData.disputeFocuses
        .slice(0, 3)
        .map((d) => d.coreIssue)
        .join("；");
      parts.push(`争议焦点：${disputeTexts}`);
    }

    return parts.join("\n");
  }

  /**
   * 构建法条上下文
   */
  private buildArticleContext(article: LawArticle): string {
    const parts: string[] = [];

    parts.push(`法律名称：${article.lawName}`);
    parts.push(`法条编号：${article.articleNumber}`);

    if (article.chapterNumber) {
      parts.push(`章节编号：${article.chapterNumber}`);
    }

    if (article.sectionNumber) {
      parts.push(`节编号：${article.sectionNumber}`);
    }

    parts.push(`法条内容：${article.fullText}`);

    if (article.legalBasis) {
      parts.push(`法律依据：${article.legalBasis}`);
    }

    if (article.category) {
      parts.push(`法律分类：${this.translateLawCategory(article.category)}`);
    }

    return parts.join("\n");
  }

  /**
   * 构建分析上下文
   */
  private buildAnalysisContext(
    semanticMatch: SemanticMatchResult,
    ruleValidation: RuleValidationResult,
  ): string {
    const parts: string[] = [];

    // 语义匹配结果
    parts.push(
      `【语义匹配】\n相关性评分：${(
        semanticMatch.semanticRelevance * 100
      ).toFixed(1)}%`,
    );
    if (semanticMatch.relevanceReason) {
      parts.push(`原因：${semanticMatch.relevanceReason}`);
    }
    if (
      semanticMatch.matchedKeywords &&
      semanticMatch.matchedKeywords.length > 0
    ) {
      parts.push(`匹配关键词：${semanticMatch.matchedKeywords.join("、")}`);
    }

    // 规则验证结果
    parts.push(
      `\n【规则验证】\n综合评分：${(ruleValidation.overallScore * 100).toFixed(
        1,
      )}%`,
    );
    parts.push(`时效性：${ruleValidation.validity.passed ? "通过" : "未通过"}`);
    if (ruleValidation.validity.reason) {
      parts.push(`  原因：${ruleValidation.validity.reason}`);
    }
    parts.push(`适用范围：${ruleValidation.scope.passed ? "通过" : "未通过"}`);
    if (ruleValidation.scope.reason) {
      parts.push(`  原因：${ruleValidation.scope.reason}`);
    }

    return parts.join("\n");
  }

  /**
   * 翻译案件类型
   */
  private translateCaseType(type: string): string {
    const translations: Record<string, string> = {
      civil: "民事案件",
      criminal: "刑事案件",
      administrative: "行政案件",
      commercial: "商事案件",
      labor: "劳动案件",
      intellectual: "知识产权案件",
      other: "其他案件",
    };
    return translations[type] || type;
  }

  /**
   * 翻译诉讼请求类型
   */
  private translateClaimType(type: string): string {
    const translations: Record<string, string> = {
      PAY_PRINCIPAL: "支付本金",
      PAY_INTEREST: "支付利息",
      PAY_PENALTY: "支付违约金",
      PAY_DAMAGES: "赔偿损失",
      LITIGATION_COST: "诉讼费用",
      PERFORMANCE: "履行义务",
      TERMINATION: "解除合同",
      OTHER: "其他请求",
    };
    return translations[type] || type;
  }

  /**
   * 翻译法律分类
   */
  private translateLawCategory(category: string): string {
    const translations: Record<string, string> = {
      CIVIL: "民事",
      CRIMINAL: "刑事",
      ADMINISTRATIVE: "行政",
      COMMERCIAL: "商事",
      ECONOMIC: "经济",
      LABOR: "劳动",
      INTELLECTUAL_PROPERTY: "知识产权",
      PROCEDURE: "程序",
      OTHER: "其他",
    };
    return translations[category] || category;
  }

  /**
   * 清理资源
   */
  public async destroy(): Promise<void> {
    if (this.initialized) {
      this.initialized = false;
    }
  }
}

// 默认导出
export default AIReviewer;
