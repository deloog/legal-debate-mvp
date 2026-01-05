/**
 * 时间线提取器类型定义
 */

import type { TimelineEvent, TimelineEventType } from "../../core/types";

/**
 * 时间线提取选项
 */
export interface TimelineExtractionOptions {
  includeInferred?: boolean;
  minImportance?: number;
  sortAscending?: boolean;
  fillGaps?: boolean;
  useAIExtraction?: boolean;
  useAIMatching?: boolean;
}

/**
 * 时间线提取输出
 */
export interface TimelineExtractionOutput {
  events: TimelineEvent[];
  summary: TimelineSummary;
  gapInfo: GapInfo;
}

/**
 * 时间线摘要信息
 */
export interface TimelineSummary {
  total: number;
  explicitCount: number;
  inferredCount: number;
  byType: Record<TimelineEventType, number>;
  avgImportance: number;
  earliestDate?: string;
  latestDate?: string;
  hasGaps: boolean;
  aiExtractedCount: number;
  ruleExtractedCount: number;
  aiReviewedCount: number;
}

/**
 * 时间线缺口信息
 */
export interface GapInfo {
  startDate?: string;
  endDate?: string;
  missingTypes: TimelineEventType[];
  inferredEvents: TimelineEvent[];
  hasGaps: boolean;
}

/**
 * AI提取响应格式
 */
export interface AIExtractionResponse {
  timelineEvents: Array<{
    date: string;
    event: string;
    eventType: TimelineEventType;
    importance: number;
    evidence: string[];
  }>;
}

/**
 * AI审查响应格式
 */
export interface AIReviewResponse {
  reviewedEvents: Array<{
    id: string;
    date: string;
    event: string;
    eventType: TimelineEventType;
    importance: number;
    evidence: string[];
  }>;
  invalidIds: string[];
}

/**
 * 日期事件对
 */
export interface DateEventPair {
  date: string;
  eventText: string;
}
