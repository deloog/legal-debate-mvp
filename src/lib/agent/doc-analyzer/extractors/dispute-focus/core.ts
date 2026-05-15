/**
 * 争议焦点提取器 - AI识别 + AI审查双层架构
 * AI 失败时直接抛出错误，不降级为关键词兜底。
 */

import type {
  DisputeFocus,
  DisputeFocusCategory,
  ExtractedData,
} from '../../core/types';

// =============================================================================
// 接口定义
// =============================================================================

export interface DisputeFocusExtractionOptions {
  includeInferred?: boolean;
  minConfidence?: number;
  useAIExtraction?: boolean;
  useAIMatching?: boolean;
}

export interface DisputeFocusExtractionOutput {
  disputeFocuses: DisputeFocus[];
  summary: {
    total: number;
    byCategory: Record<DisputeFocusCategory, number>;
    avgImportance: number;
    avgConfidence: number;
    inferredCount: number;
    aiExtractedCount: number;
    ruleExtractedCount: number;
    aiReviewedCount: number;
  };
}

// =============================================================================
// 争议焦点提取器类
// =============================================================================

export class DisputeFocusExtractor {
  /**
   * 从文本中提取争议焦点 — AI识别 + AI审查双层架构
   * AI 失败时直接抛出错误，调用方负责错误处理。
   */
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: DisputeFocusExtractionOptions = {}
  ): Promise<DisputeFocusExtractionOutput> {
    const { aiExtractLayer } = await import('./ai-layer');
    const { aiReviewLayer } = await import('./review-layer');
    const { generateSummary } = await import('./utils');

    let aiExtracted: DisputeFocus[] = [];
    let aiReviewed: DisputeFocus[] = [];

    // 第一层：AI识别
    if (options.useAIExtraction !== false) {
      aiExtracted = await aiExtractLayer(text, extractedData);
    }

    let mergedFocuses = aiExtracted;

    // 第二层：AI审查修正
    if (options.useAIMatching !== false && mergedFocuses.length > 0) {
      aiReviewed = await aiReviewLayer(mergedFocuses, text);
      mergedFocuses = aiReviewed;
    }

    if (options.includeInferred === false) {
      mergedFocuses = mergedFocuses.filter(f => !f._inferred);
    }

    if (options.minConfidence !== undefined) {
      const minConf = options.minConfidence;
      mergedFocuses = mergedFocuses.filter(f => f.confidence >= minConf);
    }

    const summary = generateSummary(mergedFocuses, aiExtracted, [], aiReviewed);

    return { disputeFocuses: mergedFocuses, summary };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

export function createDisputeFocusExtractor(): DisputeFocusExtractor {
  return new DisputeFocusExtractor();
}

export async function extractDisputeFocusesFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: DisputeFocusExtractionOptions
): Promise<DisputeFocus[]> {
  const extractor = createDisputeFocusExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.disputeFocuses;
}
