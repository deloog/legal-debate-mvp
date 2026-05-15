/**
 * 时间线提取器 — AI识别 + 日期模式辅助 + AI审查
 * 主入口文件，整合所有子模块
 */

import type { ExtractedData, TimelineEvent } from '../../core/types';
import type {
  TimelineExtractionOptions,
  TimelineExtractionOutput,
} from './timeline-types';

import { aiExtractLayer } from './timeline-ai-extractor';
import { aiReviewLayer } from './timeline-ai-reviewer';
import {
  detectAndFillGaps,
  generateSummary,
  sortEvents,
} from './timeline-analyzer';
import {
  enrichEventsWithExtractedData,
  mergeAndDeduplicate,
} from './timeline-event-builder';
import { ruleMatchLayer } from './timeline-rule-matcher';

// 导出所有类型
export type {
  AIExtractionResponse,
  AIReviewResponse,
  DateEventPair,
  GapInfo,
  TimelineExtractionOptions,
  TimelineExtractionOutput,
  TimelineSummary,
} from './timeline-types';

/**
 * 时间线提取器类
 */
export class TimelineExtractor {
  /**
   * 从文本中提取时间线
   * 第一层：AI识别
   * 第二层：日期模式辅助（正则补充 AI 遗漏的日期格式）
   * 第三层：AI审查修正
   */
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: TimelineExtractionOptions = {}
  ): Promise<TimelineExtractionOutput> {
    let aiExtracted: TimelineEvent[] = [];
    let ruleExtracted: TimelineEvent[] = [];
    let aiReviewed: TimelineEvent[] = [];

    // 第一层：AI识别（如果启用）
    if (options.useAIExtraction !== false) {
      aiExtracted = await aiExtractLayer(text, extractedData);
    }

    // 第二层：日期模式辅助（正则补充 AI 遗漏的日期格式）
    ruleExtracted = ruleMatchLayer(text, extractedData, aiExtracted);

    // 合并第一层和第二层的结果，去重
    let mergedEvents = mergeAndDeduplicate(aiExtracted, ruleExtracted);

    // 第三层：AI审查修正（如果启用）
    if (options.useAIMatching !== false && mergedEvents.length > 0) {
      aiReviewed = await aiReviewLayer(mergedEvents, text);
      mergedEvents = aiReviewed;
    }

    // 过滤推断结果
    if (options.includeInferred === false) {
      mergedEvents = mergedEvents.filter(e => e.source !== 'inferred');
    }

    // 过滤低重要性事件
    if (options.minImportance !== undefined) {
      const minImp = options.minImportance;
      mergedEvents = mergedEvents.filter(e => (e.importance || 1) >= minImp);
    }

    // 排序事件
    mergedEvents = sortEvents(mergedEvents, options.sortAscending !== false);

    // 填充时间线空缺
    const gapInfo = detectAndFillGaps(
      mergedEvents,
      text,
      options.fillGaps !== false
    );
    if (gapInfo.inferredEvents.length > 0) {
      mergedEvents = [...mergedEvents, ...gapInfo.inferredEvents];
    }

    // 使用提取的数据丰富事件信息
    if (extractedData) {
      enrichEventsWithExtractedData(mergedEvents, extractedData);
    }

    const summary = generateSummary(
      mergedEvents,
      gapInfo,
      aiExtracted,
      ruleExtracted,
      aiReviewed
    );

    return { events: mergedEvents, summary, gapInfo };
  }
}

/**
 * 创建默认时间线提取器实例
 */
export function createTimelineExtractor(): TimelineExtractor {
  return new TimelineExtractor();
}

/**
 * 从文本中快速提取时间线
 */
export async function extractTimelineFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: TimelineExtractionOptions
): Promise<TimelineEvent[]> {
  const extractor = createTimelineExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.events;
}
