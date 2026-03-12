/**
 * AI处理器 - 负责AI文档分析
 *
 * 核心功能：
 * - 构建优化的分析提示词
 * - 调用AI服务并处理响应
 * - 分块处理大文档
 * - 超时控制和重试机制
 */

import type {
  AIAnalysisResponse,
  ExtractedData,
  TextChunk,
  Party,
  Claim,
} from '../core/types';
import type { AIRequestConfig, AIResponse } from '../../../../types/ai-service';
import { DEFAULT_CONFIG, ERROR_MESSAGES } from '../core/constants';
import { DocumentParser } from '../../../ai/document-parser';
import { SmartPromptBuilder } from '../prompts/smart-prompt-builder';
import { logger } from '../../../agent/security/logger';

interface AIServiceLike {
  chatCompletion(config: AIRequestConfig): Promise<AIResponse>;
}

export class AIProcessor {
  private config: typeof DEFAULT_CONFIG;
  private parser: DocumentParser;
  private promptBuilder: SmartPromptBuilder;

  constructor(
    config?: Partial<typeof DEFAULT_CONFIG>,
    useMock: boolean = false
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new DocumentParser(useMock);
    this.promptBuilder = new SmartPromptBuilder();
  }

  /**
   * 强制使用真实AI服务（用于准确性测试）
   */
  public forceUseRealAI(): void {
    this.parser.forceUseRealAI();
  }

  /**
   * 获取AI服务实例（用于Reviewer初始化）
   */
  public async getAIService(): Promise<AIServiceLike | null> {
    try {
      const { getUnifiedAIService } =
        await import('../../../ai/unified-service');
      const service = await getUnifiedAIService();
      // 验证服务是否有必需的 chatCompletion 方法
      if (
        service &&
        typeof (service as AIServiceLike).chatCompletion === 'function'
      ) {
        return service as unknown as AIServiceLike;
      }
      logger.warn('AI服务缺少chatCompletion方法');
      return null;
    } catch (error) {
      logger.error(
        '获取AI服务失败',
        error instanceof Error ? error : undefined
      );
      return null;
    }
  }

  /**
   * 处理文档分析
   */
  public async process(text: string): Promise<AIAnalysisResponse> {
    if (text.length > this.config.maxTextChunkSize) {
      return await this.processLargeDocument(text);
    }
    return await this.processWithTimeout(this.analyzeDocument(text));
  }

  /**
   * 分析文档
   */
  private async analyzeDocument(text: string): Promise<AIAnalysisResponse> {
    const prompt = this.buildPrompt(text);
    const aiResponse = await this.parser.analyzeWithAI(prompt);
    return this.parseResponse(aiResponse);
  }

  /**
   * 构建分析提示词
   */
  private buildPrompt(text: string): string {
    // 使用SmartPromptBuilder构建提示词
    return this.promptBuilder.buildPrompt(text);
  }

  /**
   * 解析AI响应
   */
  private parseResponse(response: string): AIAnalysisResponse {
    try {
      const cleaned = this.cleanResponse(response);

      // 尝试解析JSON
      const parsed = JSON.parse(cleaned);

      if (!parsed.extractedData) {
        throw new Error(ERROR_MESSAGES.PARSE_ERROR);
      }

      return {
        extractedData: this.normalizeData(parsed.extractedData),
        confidence: parsed.confidence || 0.8,
        tokenUsed: this.estimateTokens(response),
        analysisProcess: parsed.analysisProcess,
      };
    } catch (error) {
      logger.error('AI响应解析失败，原始响应:', new Error(response));
      logger.error(
        '解析错误:',
        error instanceof Error ? error : new Error(String(error))
      );

      // 尝试从文本中提取JSON
      try {
        const extracted = this.extractJSON(response);
        if (extracted) {
          return extracted;
        }
      } catch (e) {
        logger.error(
          'JSON提取失败',
          e instanceof Error ? e : new Error(String(e))
        );
      }

      // 返回错误响应
      return this.getErrorResponse();
    }
  }

  /**
   * 清理响应文本（改进版，支持多种AI响应格式）
   */
  private cleanResponse(response: string): string {
    let cleaned = response.trim();

    // 移除所有可能的代码块标记
    cleaned = cleaned
      .replace(/```json\s*\n?/gi, '')
      .replace(/```text\s*\n?/gi, '')
      .replace(/```javascript\s*\n?/gi, '')
      .replace(/```js\s*\n?/gi, '')
      .replace(/```\s*$/gi, '')
      .trim();

    // 移除JSON注释（修复AI返回注释导致的解析失败）
    // 支持单行注释 // 和多行注释 /* */
    cleaned = cleaned
      .replace(/\/\/.*$/gm, '') // 移除单行注释
      .replace(/\/\*[\s\S]*?\*\//g, ''); // 移除多行注释

    // 移除JSON对象中的尾随逗号（修复格式问题）
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

    // 提取完整的JSON对象（支持嵌套）
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return cleaned;
  }

  /**
   * 从文本中提取JSON
   */
  private extractJSON(text: string): AIAnalysisResponse | null {
    // 查找JSON对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const cleaned = jsonMatch[0];
    const parsed = JSON.parse(cleaned);

    if (!parsed.extractedData) {
      return null;
    }

    return {
      extractedData: this.normalizeData(parsed.extractedData),
      confidence: parsed.confidence || 0.6,
      tokenUsed: this.estimateTokens(text),
      analysisProcess: parsed.analysisProcess,
    };
  }

  /**
   * 标准化数据
   */
  private normalizeData(data: ExtractedData): ExtractedData {
    return {
      parties:
        data.parties?.map(p => ({ ...p, type: p.type || 'other' })) || [],
      claims:
        data.claims?.map(c => ({ ...c, currency: c.currency || 'CNY' })) || [],
      timeline: data.timeline || [],
      summary: data.summary || '',
      caseType: data.caseType || 'civil',
      keyFacts: data.keyFacts || [],
    };
  }

  /**
   * 处理大文档
   */
  private async processLargeDocument(
    text: string
  ): Promise<AIAnalysisResponse> {
    const chunks = this.splitText(text, this.config.maxTextChunkSize);
    const results: AIAnalysisResponse[] = [];

    for (let i = 0; i < chunks.length; i++) {
      logger.info(`处理分块 ${i + 1}/${chunks.length}`);
      const result = await this.processWithTimeout(
        this.analyzeDocument(chunks[i].text)
      );
      results.push(result);
    }

    return this.mergeResults(results);
  }

  /**
   * 分割文本
   */
  private splitText(text: string, maxSize: number): TextChunk[] {
    const chunks: TextChunk[] = [];
    let pos = 0;

    while (pos < text.length) {
      let end = Math.min(pos + maxSize, text.length);
      if (end < text.length) {
        const match = text.substring(pos, end).match(/[。！？；\n]/g);
        if (match) {
          const lastMatch = match[match.length - 1];
          const lastPos = pos + text.substring(pos, end).lastIndexOf(lastMatch);
          if (lastPos > pos) end = lastPos + 1;
        }
      }
      chunks.push({ text: text.substring(pos, end), start: pos, end });
      pos = end;
    }

    return chunks;
  }

  /**
   * 合并结果
   */
  private mergeResults(results: AIAnalysisResponse[]): AIAnalysisResponse {
    const partyMap = new Map<string, Party>();
    const claims: Claim[] = [];
    let totalConfidence = 0;
    let totalTokens = 0;

    results.forEach(r => {
      r.extractedData.parties?.forEach((p: Party) => {
        const key = `${p.name}_${p.type}`;
        if (!partyMap.has(key)) partyMap.set(key, p);
      });
      if (r.extractedData.claims) claims.push(...r.extractedData.claims);
      totalConfidence += r.confidence;
      totalTokens += r.tokenUsed;
    });

    return {
      extractedData: {
        parties: Array.from(partyMap.values()),
        claims: this.deduplicate(claims),
        timeline: [],
        summary: '分块合并结果',
        caseType: 'civil',
        keyFacts: [],
      },
      confidence: totalConfidence / results.length,
      tokenUsed: totalTokens,
      analysisProcess: {
        ocrErrors: [],
        entitiesListed: { persons: [], companies: [], amounts: [] },
        roleReasoning: '分块处理',
        claimDecomposition: '多分块合并',
        amountNormalization: '已标准化',
        validationResults: {
          duplicatesFound: [],
          roleConflicts: [],
          missingClaims: [],
          amountInconsistencies: [],
        },
      },
    };
  }

  /**
   * 去重
   */
  private deduplicate<T>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter(item => {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        return true;
      }
      return false;
    });
  }

  /**
   * 超时处理
   */
  private async processWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(ERROR_MESSAGES.AI_TIMEOUT)),
          this.config.aiTimeout
        )
      ),
    ]);
  }

  /**
   * 估算Token
   */
  private estimateTokens(text: string): number {
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const other = text.length - chinese;
    return Math.ceil(chinese / 1.5 + other / 4);
  }

  /**
   * 错误响应
   */
  private getErrorResponse(): AIAnalysisResponse {
    return {
      extractedData: {
        parties: [],
        claims: [],
        timeline: [],
        summary: '',
        keyFacts: [],
      },
      confidence: 0.3,
      tokenUsed: 0,
      analysisProcess: {
        ocrErrors: ['JSON解析失败'],
        entitiesListed: { persons: [], companies: [], amounts: [] },
        roleReasoning: '解析失败',
        claimDecomposition: '无法进行',
        amountNormalization: '无法进行',
        validationResults: {
          duplicatesFound: [],
          roleConflicts: [],
          missingClaims: [],
          amountInconsistencies: [],
        },
      },
    };
  }
}
