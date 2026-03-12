import { LawArticle } from '@prisma/client';
import { AIServiceFactory } from '@/lib/ai/service-refactored';
import { getAIConfig } from '@/lib/ai/config';
import type { AIRequestConfig } from '@/types/ai-service';
import type { AIService } from '@/lib/ai/service-refactored';
import { logger } from '@/lib/logger';
import type { AIReviewResult } from './types';

/**
 * AI适用性分析器 — Phase 1
 *
 * 每条法条发起一次 AI 调用，在同一个 prompt 中完成：
 * 1. 语义相关性评估
 * 2. 适用性判断（是否可作为法律依据）
 * 3. 综合评分 + 原因 + 风险警告
 *
 * 批量处理时并行执行，通过 concurrency 参数限制同时进行的 AI 调用数量。
 */
export class AIReviewer {
  private aiService!: AIService;
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const config = getAIConfig();
      this.aiService = await AIServiceFactory.getInstance(
        'applicability-analyzer',
        config
      );
      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize AIReviewer:', error);
      throw error;
    }
  }

  /**
   * 分析单条法条的适用性（语义 + 适用性，单次 AI 调用）
   */
  public async analyzeArticle(
    article: LawArticle,
    caseContext: string
  ): Promise<AIReviewResult> {
    try {
      const config = getAIConfig();
      const request: AIRequestConfig = {
        model: config.defaultModel ?? 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content:
              '你是专业的法律适用性分析专家，擅长综合评估法条对案件的语义相关性和实际适用性。',
          },
          {
            role: 'user',
            content: this.buildPrompt(article, caseContext),
          },
        ],
        temperature: 0.2,
        maxTokens: 600,
      };

      const response = await this.aiService.chatCompletion(request);
      const raw = response.choices[0].message.content;
      return this.parseResponse(raw);
    } catch (error) {
      logger.error(
        `AI applicability analysis failed for article ${article.id}:`,
        error
      );
      return {
        applicable: false,
        score: 0.3,
        confidence: 0.3,
        reasons: ['AI分析失败，需要人工确认'],
        warnings: ['AI分析失败'],
      };
    }
  }

  /**
   * 批量分析法条（并行，受 concurrency 限制）
   */
  public async analyzeArticles(
    articles: LawArticle[],
    caseContext: string,
    concurrency = 5
  ): Promise<Map<string, AIReviewResult>> {
    const results = new Map<string, AIReviewResult>();

    // 按 concurrency 分批并行处理
    for (let i = 0; i < articles.length; i += concurrency) {
      const batch = articles.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(article =>
          this.analyzeArticle(article, caseContext).then(result => ({
            id: article.id,
            result,
          }))
        )
      );
      for (const { id, result } of batchResults) {
        results.set(id, result);
      }
    }

    return results;
  }

  /**
   * 构建单次综合分析 prompt
   */
  private buildPrompt(article: LawArticle, caseContext: string): string {
    const lawLines = [
      `法律名称：${article.lawName}`,
      `法条编号：${article.articleNumber}`,
      article.chapterNumber ? `章节：${article.chapterNumber}` : null,
      `法条内容：${article.fullText}`,
      article.legalBasis ? `法律依据：${article.legalBasis}` : null,
      article.category ? `法律分类：${article.category}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return `请综合评估以下法条对案件的适用性，给出明确判断。

【案件情况】
${caseContext}

【法条信息】
${lawLines}

【评估要求】
1. 评估法条与案件事实、法律关系、诉讼请求的语义相关性
2. 判断法条能否作为本案的主要或补充法律依据
3. 识别使用该法条的潜在风险或限制条件

【评分标准】
- score 0.7~1.0：高度相关，可直接适用
- score 0.5~0.7：有一定相关性，可作补充依据（applicable=true 的分界）
- score 0.3~0.5：相关性较弱
- score 0~0.3：基本不适用

【输出格式】（只返回 JSON，不要任何其他内容）
{
  "applicable": true或false（score≥0.5时为true），
  "score": 0到1之间的数字（保留2位小数），
  "confidence": 0到1之间的置信度（保留2位小数），
  "reasons": ["原因1", "原因2"]（最多5条，每条20~50字），
  "warnings": ["警告1"]（如有风险必须列出，无则为空数组）
}`;
  }

  /**
   * 解析 AI 响应 JSON
   */
  private parseResponse(response: string): AIReviewResult {
    try {
      // 提取 JSON：先尝试精确匹配，再回退到宽松匹配
      const jsonMatch =
        response.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/s) ??
        response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in AI response');

      const parsed: Record<string, unknown> = JSON.parse(jsonMatch[0]);
      const score = Math.min(Math.max(Number(parsed.score) || 0, 0), 1);
      return {
        applicable: Boolean(parsed.applicable),
        score,
        confidence: Math.min(
          Math.max(Number(parsed.confidence) || score, 0),
          1
        ),
        reasons: Array.isArray(parsed.reasons)
          ? (parsed.reasons as unknown[]).filter(
              (r): r is string => typeof r === 'string'
            )
          : [],
        warnings: Array.isArray(parsed.warnings)
          ? (parsed.warnings as unknown[]).filter(
              (w): w is string => typeof w === 'string'
            )
          : [],
      };
    } catch (error) {
      logger.error('Failed to parse AI applicability response:', error);
      return {
        applicable: false,
        score: 0.3,
        confidence: 0.3,
        reasons: [],
        warnings: ['AI响应解析失败'],
      };
    }
  }

  public async destroy(): Promise<void> {
    this.initialized = false;
  }
}

export default AIReviewer;
