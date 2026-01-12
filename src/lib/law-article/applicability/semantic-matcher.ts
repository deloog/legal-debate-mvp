import { LawArticle } from '@prisma/client';
import { DocumentAnalysisOutput } from '@/lib/agent/doc-analyzer/core/types';
import { SemanticMatchResult } from './types';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getAIConfig } from '@/lib/ai/config';
import type { AIRequestConfig } from '@/types/ai-service';
import type { AIService } from '@/lib/ai/service-refactored';

/**
 * 语义匹配器
 *
 * Layer 1: AI语义匹配
 * 分析法条与案情的语义相关性
 */
export class SemanticMatcher {
  private aiService: AIService;
  private initialized: boolean = false;

  /**
   * 初始化语义匹配器
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const config = getAIConfig();
      this.aiService = await AIServiceFactory.getInstance(
        'semantic-matcher',
        config
      );
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize SemanticMatcher:', error);
      throw error;
    }
  }

  /**
   * 分析单条法条与案情的语义相关性
   */
  public async matchArticle(
    article: LawArticle,
    caseInfo: DocumentAnalysisOutput
  ): Promise<SemanticMatchResult> {
    const caseContext = this.buildCaseContext(caseInfo);
    const articleContext = this.buildArticleContext(article);

    // 首先进行关键词匹配（基础层）
    const keywordMatch = this.matchKeywords(article, caseContext);
    const keywordScore = this.calculateKeywordScore(keywordMatch);

    // 如果关键词相关性太低，可以跳过AI分析
    if (keywordScore < 0.1) {
      return {
        semanticRelevance: keywordScore * 0.5,
        relevanceReason: '关键词匹配度极低，法条与案情相关性较弱',
        matchedKeywords: keywordMatch.matchedKeywords,
      };
    }

    // 使用AI进行语义分析（高级层）
    const aiResult = await this.performSemanticAnalysis(
      caseContext,
      articleContext
    );

    // 合并关键词匹配和AI分析结果
    const finalScore = this.combineScores(keywordScore, aiResult.score);

    return {
      semanticRelevance: finalScore,
      relevanceReason: aiResult.reason,
      matchedKeywords: keywordMatch.matchedKeywords,
    };
  }

  /**
   * 批量分析法条与案情的语义相关性
   */
  public async matchArticles(
    articles: LawArticle[],
    caseInfo: DocumentAnalysisOutput
  ): Promise<Map<string, SemanticMatchResult>> {
    const results = new Map<string, SemanticMatchResult>();

    for (const article of articles) {
      const result = await this.matchArticle(article, caseInfo);
      results.set(article.id, result);
    }

    return results;
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
        .filter(p => p.type === 'plaintiff')
        .map(p => p.name)
        .join('、');
      const defendantNames = extractedData.parties
        .filter(p => p.type === 'defendant')
        .map(p => p.name)
        .join('、');
      parts.push(`原告：${plaintiffNames || '未明确'}`);
      parts.push(`被告：${defendantNames || '未明确'}`);
    }

    // 诉讼请求
    if (extractedData.claims && extractedData.claims.length > 0) {
      const claimTexts = extractedData.claims
        .map(c => `【${this.translateClaimType(c.type)}】${c.content}`)
        .join('；');
      parts.push(`诉讼请求：${claimTexts}`);
    }

    // 关键事实
    if (extractedData.keyFacts && extractedData.keyFacts.length > 0) {
      const factTexts = extractedData.keyFacts
        .slice(0, 5) // 最多取5个关键事实
        .map(f => f.description)
        .join('；');
      parts.push(`关键事实：${factTexts}`);
    }

    // 争议焦点
    if (
      extractedData.disputeFocuses &&
      extractedData.disputeFocuses.length > 0
    ) {
      const disputeTexts = extractedData.disputeFocuses
        .slice(0, 3) // 最多取3个争议焦点
        .map(d => d.coreIssue)
        .join('；');
      parts.push(`争议焦点：${disputeTexts}`);
    }

    // 案件摘要
    if (extractedData.summary) {
      parts.push(`案件摘要：${extractedData.summary}`);
    }

    return parts.join('\n');
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

    if (article.issuingAuthority) {
      parts.push(`发布机关：${article.issuingAuthority}`);
    }

    return parts.join('\n');
  }

  /**
   * 关键词匹配
   */
  private matchKeywords(
    article: LawArticle,
    caseContext: string
  ): { matchedKeywords: string[]; score: number } {
    const keywordMap = this.getKeywordMapping();
    const matchedKeywords: string[] = [];
    let score = 0;

    // 检查法条内容中的关键词
    for (const [keyword, weight] of Object.entries(keywordMap)) {
      if (
        article.fullText.includes(keyword) ||
        article.lawName.includes(keyword) ||
        article.legalBasis?.includes(keyword)
      ) {
        matchedKeywords.push(keyword);
        score += weight;
      }
    }

    // 检查案情中的关键词
    for (const [keyword, weight] of Object.entries(keywordMap)) {
      if (caseContext.includes(keyword)) {
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
          score += weight * 0.5; // 案情中的关键词权重减半
        }
      }
    }

    // 归一化评分
    score = Math.min(score / 3, 1);

    return { matchedKeywords, score };
  }

  /**
   * 计算关键词匹配分数
   */
  private calculateKeywordScore(match: {
    matchedKeywords: string[];
    score: number;
  }): number {
    return match.score;
  }

  /**
   * 执行AI语义分析
   */
  private async performSemanticAnalysis(
    caseContext: string,
    articleContext: string
  ): Promise<{ score: number; reason: string }> {
    try {
      const prompt = this.buildAnalysisPrompt(caseContext, articleContext);

      const request: AIRequestConfig = {
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content:
              '你是专业的法律语义分析专家，擅长分析法条与案件情况的语义相关性。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      };

      const response = await this.aiService.chatCompletion(request);
      const result = response.choices[0].message.content;

      return this.parseAIResponse(result);
    } catch (error) {
      console.error('AI semantic analysis failed:', error);
      // 返回保守分数
      return {
        score: 0.3,
        reason: 'AI分析失败，使用保守评分',
      };
    }
  }

  /**
   * 构建分析提示词
   */
  private buildAnalysisPrompt(
    caseContext: string,
    articleContext: string
  ): string {
    return `作为专业的法律语义分析专家，请从多个维度系统评估法条与案件的语义相关性。

【案件情况】
${caseContext}

【法条信息】
${articleContext}

【评估维度】
1. 事实相关性：法条描述的法律事实与案件事实的匹配程度
2. 法律关系相关性：法条调整的法律关系与案件法律关系的一致性
3. 请求匹配度：法条内容是否直接或间接支持案件中的诉讼请求
4. 法律领域匹配：法条所属法律领域与案件类型的契合度

【评分标准】
- 0.9-1.0：高度相关，直接适用，核心法律依据
- 0.7-0.9：相关度较高，可作为重要法律依据
- 0.5-0.7：有一定相关性，可作为补充法律依据
- 0.3-0.5：相关性较弱，需结合其他法条使用
- 0-0.3：相关性极低，基本不适用

【输出要求】
请严格按以下JSON格式返回（只返回JSON，不要任何其他内容）：
{
  "score": 数字（0-1之间的相关性评分，保留2位小数），
  "reason": "相关性原因说明（50-100字，简明扼要）"
}`;
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): { score: number; reason: string } {
    try {
      // 尝试提取JSON部分
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]);
      return {
        score: Math.min(Math.max(result.score || 0, 0), 1),
        reason: result.reason || '',
      };
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      return {
        score: 0.3,
        reason: 'AI响应解析失败',
      };
    }
  }

  /**
   * 合并关键词分数和AI分数
   */
  private combineScores(keywordScore: number, aiScore: number): number {
    // AI分析权重更高（70%），关键词匹配权重较低（30%）
    return keywordScore * 0.3 + aiScore * 0.7;
  }

  /**
   * 获取关键词映射
   */
  private getKeywordMapping(): Record<string, number> {
    return {
      // 合同相关
      合同: 0.3,
      约定: 0.25,
      违约: 0.3,
      履行: 0.25,
      解除: 0.2,
      终止: 0.2,
      撤销: 0.2,

      // 责任相关
      责任: 0.3,
      赔偿: 0.25,
      损害: 0.25,
      义务: 0.2,
      权利: 0.2,
      救济: 0.15,

      // 民事诉讼
      民事: 0.2,
      诉讼: 0.2,
      请求: 0.2,
      举证: 0.15,
      期限: 0.15,

      // 特定概念
      侵权: 0.3,
      债务: 0.25,
      利息: 0.25,
      违约金: 0.3,
      滞纳金: 0.2,
      罚款: 0.15,

      // 程序相关
      上诉: 0.15,
      抗辩: 0.2,
      质证: 0.15,
      送达: 0.1,
      执行: 0.15,
    };
  }

  /**
   * 翻译案件类型
   */
  private translateCaseType(type: string): string {
    const translations: Record<string, string> = {
      civil: '民事案件',
      criminal: '刑事案件',
      administrative: '行政案件',
      commercial: '商事案件',
      labor: '劳动案件',
      intellectual: '知识产权案件',
      other: '其他案件',
    };
    return translations[type] || type;
  }

  /**
   * 翻译诉讼请求类型
   */
  private translateClaimType(type: string): string {
    const translations: Record<string, string> = {
      PAY_PRINCIPAL: '支付本金',
      PAY_INTEREST: '支付利息',
      PAY_PENALTY: '支付违约金',
      PAY_DAMAGES: '赔偿损失',
      LITIGATION_COST: '诉讼费用',
      PERFORMANCE: '履行义务',
      TERMINATION: '解除合同',
      OTHER: '其他请求',
    };
    return translations[type] || type;
  }

  /**
   * 翻译法律分类
   */
  private translateLawCategory(category: string): string {
    const translations: Record<string, string> = {
      CIVIL: '民事',
      CRIMINAL: '刑事',
      ADMINISTRATIVE: '行政',
      COMMERCIAL: '商事',
      LABOR: '劳动',
      INTELLECTUAL_PROPERTY: '知识产权',
      PROCEDURE: '程序',
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
export default SemanticMatcher;
