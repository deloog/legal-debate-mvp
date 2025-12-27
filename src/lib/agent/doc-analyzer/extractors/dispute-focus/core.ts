/**
 * 争议焦点提取器 - 核心类型定义
 * 目标：争议焦点识别准确率>90%
 */

import type {
  DisputeFocus,
  DisputeFocusCategory,
  ExtractedData
} from '../../core/types';

// =============================================================================
// 接口定义
// =============================================================================

export interface DisputeFocusExtractionOptions {
  includeInferred?: boolean;
  minConfidence?: number;
  useAIExtraction?: boolean; // 是否启用AI提取
  useAIMatching?: boolean; // 是否启用AI审查
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
  protected rulePatterns: Map<DisputeFocusCategory, RegExp[]>;

  constructor(rulePatterns?: Map<DisputeFocusCategory, RegExp[]>) {
    this.rulePatterns = rulePatterns || this.initializeDefaultPatterns();
  }

  /**
   * 初始化默认规则模式
   */
  private initializeDefaultPatterns(): Map<DisputeFocusCategory, RegExp[]> {
    // 动态导入以避免循环依赖
    const { initializeRulePatterns } = require('./rule-layer');
    return initializeRulePatterns();
  }

  /**
   * 从文本中提取争议焦点 - 三层架构
   * 第一层：AI识别
   * 第二层：规则匹配兜底
   * 第三层：AI审查修正
   */
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: DisputeFocusExtractionOptions = {}
  ): Promise<DisputeFocusExtractionOutput> {
    const { aiExtractLayer } = await import('./ai-layer');
    const { ruleMatchLayer } = await import('./rule-layer');
    const { mergeAndDeduplicate } = await import('./utils');
    const { aiReviewLayer } = await import('./review-layer');

    let aiExtracted: DisputeFocus[] = [];
    let ruleExtracted: DisputeFocus[] = [];
    let aiReviewed: DisputeFocus[] = [];

    // 第一层：AI识别（如果启用）
    if (options.useAIExtraction !== false) {
      aiExtracted = await aiExtractLayer(text, extractedData, this.rulePatterns);
    }

    // 第二层：规则匹配兜底
    ruleExtracted = ruleMatchLayer(text, extractedData, aiExtracted, this.rulePatterns);

    // 合并第一层和第二层的结果，去重
    let mergedFocuses = mergeAndDeduplicate(aiExtracted, ruleExtracted);

    // 第三层：AI审查修正（如果启用）
    if (options.useAIMatching !== false && mergedFocuses.length > 0) {
      aiReviewed = await aiReviewLayer(mergedFocuses, text);
      mergedFocuses = aiReviewed;
    }

    // 过滤推断结果
    if (options.includeInferred === false) {
      mergedFocuses = mergedFocuses.filter(f => !f._inferred);
    }

    // 过滤低置信度结果
    if (options.minConfidence !== undefined) {
      mergedFocuses = mergedFocuses.filter(f => f.confidence >= options.minConfidence);
    }

    const { generateSummary } = await import('./utils');
    const summary = generateSummary(
      mergedFocuses,
      aiExtracted,
      ruleExtracted,
      aiReviewed
    );

    return { disputeFocuses: mergedFocuses, summary };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认争议焦点提取器实例
 */
export function createDisputeFocusExtractor(): DisputeFocusExtractor {
  return new DisputeFocusExtractor();
}

/**
 * 从文本中快速提取争议焦点（使用完整三层架构）
 */
export async function extractDisputeFocusesFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: DisputeFocusExtractionOptions
): Promise<DisputeFocus[]> {
  const extractor = createDisputeFocusExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.disputeFocuses;
}
