/**
 * AI审查器 - 使用AI进行质量审查
 *
 * 核心功能：
 * - 调用AI进行二次验证
 * - 检查数据一致性
 * - 评估法律依据准确性
 * - 生成AI审查报告
 */

import type {
  ExtractedData,
  ReviewResult,
  ReviewIssue,
  ReviewerConfig,
  Correction,
} from '../core/types';
import type { AIRequestConfig, AIResponse } from '../../../../types/ai-service';
import { logger } from '../../../agent/security/logger';

interface AIReviewResponse {
  issues: AIReviewIssue[];
  corrections: AIReviewCorrection[];
}

interface AIReviewIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: string;
  message: string;
  suggestion?: string;
}

interface AIReviewCorrection {
  type: string;
  description: string;
  rule?: string;
}

interface AIServiceLike {
  chatCompletion(config: AIRequestConfig): Promise<AIResponse>;
}

/**
 * AI审查器
 */
export class AIReviewer {
  public readonly name = 'AIReviewer';
  private aiService: AIServiceLike | null = null;
  private initialized = false;

  /**
   * 初始化AI服务
   */
  public async initialize(aiService: AIServiceLike): Promise<void> {
    this.aiService = aiService;
    this.initialized = true;
    logger.info('AIReviewer初始化完成');
  }

  /**
   * 执行审查
   */
  public async review(
    data: ExtractedData,
    fullText: string,
    config?: Partial<ReviewerConfig>
  ): Promise<ReviewResult> {
    logger.debug('AIReviewer开始审查');

    const issues: ReviewIssue[] = [];
    const corrections: Correction[] = [];

    // 如果AI服务未初始化，跳过AI审查
    if (!this.initialized || !this.aiService) {
      logger.warn('AI服务未初始化，跳过AI审查');
      return {
        passed: true,
        score: 1.0,
        issues: [
          {
            severity: 'WARNING',
            category: 'AI',
            message: 'AI服务未初始化，跳过AI审查',
            suggestion: '检查AI服务配置',
          },
        ],
        corrections: [],
        reviewer: this.name,
      };
    }

    try {
      // 构建审查提示词
      const prompt = this.buildReviewPrompt(data, fullText);

      // 调用AI服务进行审查
      const reviewResult = await this.callAIReview(prompt);

      // 解析AI审查结果
      this.parseAIResponse(reviewResult, issues, corrections);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`AI审查失败: ${errorMessage}`);

      // AI审查失败不阻断流程，记录问题
      issues.push({
        severity: 'WARNING',
        category: 'AI',
        message: `AI审查失败：${errorMessage}`,
        suggestion: '后续手动审查',
      });
    }

    // 计算评分
    const score = this.calculateScore(issues);
    const threshold = config?.threshold ?? 0.7;
    const passed = score >= threshold;

    logger.debug('AIReviewer审查完成', {
      score,
      passed,
      issues: issues.length,
      threshold,
    });

    return {
      passed,
      score,
      issues,
      corrections,
      reviewer: this.name,
    };
  }

  /**
   * 构建审查提示词
   */
  private buildReviewPrompt(data: ExtractedData, fullText: string): string {
    const dataSummary = `
**文档原文（前2000字）：**
${fullText.substring(0, 2000)}

**提取的当事人信息：**
${JSON.stringify(data.parties, null, 2)}

**提取的诉讼请求：**
${JSON.stringify(data.claims, null, 2)}
`;

    return `请对以下文档分析结果进行质量审查。

${dataSummary}

请从以下方面进行审查：
1. 当事人识别是否准确？是否遗漏重要当事人？
2. 诉讼请求提取是否完整？是否有重要请求遗漏？
3. 数据是否自相矛盾？
4. 金额提取是否准确？
5. 法律依据是否合理？

请以JSON格式返回审查结果：
{
  "issues": [
    {
      "severity": "ERROR|WARNING|INFO",
      "category": "FORM|LOGIC|COMPLETENESS|LEGAL",
      "message": "问题描述",
      "suggestion": "改进建议"
    }
  ],
  "corrections": [
    {
      "type": "ADD_CLAIM|ADD_PARTY|FIX_AMOUNT|FIX_ROLE",
      "description": "修正描述",
      "rule": "修正规则"
    }
  ]
}

如果一切正常，返回 {"issues": [], "corrections": []}`;
  }

  /**
   * 调用AI进行审查
   */
  private async callAIReview(prompt: string): Promise<AIReviewResponse> {
    if (!this.aiService) {
      throw new Error('AI service not initialized');
    }

    try {
      const response = await this.aiService.chatCompletion({
        model: 'zhipu-pro',
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的法律文档审查专家，负责审查文档分析结果的准确性。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        maxTokens: 1000,
        timeout: 10000,
      });

      const content = response.choices[0]?.message?.content || '';
      return this.parseJSONResponse(content);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`AI审查调用失败: ${errorMessage}`);
      throw new Error(`AI审查调用失败: ${errorMessage}`);
    }
  }

  /**
   * 解析AI的JSON响应
   */
  private parseJSONResponse(content: string): AIReviewResponse {
    try {
      // 尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // 如果没有找到JSON，返回空结果
      return { issues: [], corrections: [] };
    } catch {
      logger.warn('解析AI响应JSON失败', { content });
      return { issues: [], corrections: [] };
    }
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(
    aiResult: AIReviewResponse,
    issues: ReviewIssue[],
    corrections: Correction[]
  ): void {
    // 解析问题
    if (aiResult.issues && Array.isArray(aiResult.issues)) {
      aiResult.issues.forEach((issue: AIReviewIssue) => {
        if (
          this.isValidSeverity(issue.severity) &&
          issue.category &&
          issue.message
        ) {
          issues.push({
            severity: issue.severity,
            category: issue.category,
            message: issue.message,
            suggestion: issue.suggestion,
          });
        }
      });
    }

    // 解析修正建议
    if (aiResult.corrections && Array.isArray(aiResult.corrections)) {
      aiResult.corrections.forEach((correction: AIReviewCorrection) => {
        const correctionType = correction.type as
          | 'ADD_CLAIM'
          | 'ADD_PARTY'
          | 'FIX_AMOUNT'
          | 'FIX_ROLE'
          | 'OTHER';
        if (
          this.isValidCorrectionType(correction.type) &&
          correction.description
        ) {
          corrections.push({
            type: correctionType,
            description: correction.description,
            rule: correction.rule || 'AI_RECOMMENDATION',
          });
        }
      });
    }
  }

  /**
   * 验证严重性级别
   */
  private isValidSeverity(severity: string): boolean {
    return ['ERROR', 'WARNING', 'INFO'].includes(severity);
  }

  /**
   * 验证修正类型
   */
  private isValidCorrectionType(type: string): boolean {
    return [
      'ADD_CLAIM',
      'ADD_PARTY',
      'FIX_AMOUNT',
      'FIX_ROLE',
      'OTHER',
    ].includes(type);
  }

  /**
   * 计算评分
   */
  private calculateScore(issues: ReviewIssue[]): number {
    if (issues.length === 0) {
      return 1.0;
    }

    const errorCount = issues.filter(i => i.severity === 'ERROR').length;
    const warningCount = issues.filter(i => i.severity === 'WARNING').length;

    // AI审查的权重更严格：ERROR=4, WARNING=2
    const penalty = errorCount * 4 + warningCount * 2;
    const score = Math.max(0, 1.0 - penalty / 10);

    return Math.round(score * 100) / 100;
  }

  /**
   * 检查是否已初始化
   */
  public isReady(): boolean {
    return this.initialized && this.aiService !== null;
  }
}
