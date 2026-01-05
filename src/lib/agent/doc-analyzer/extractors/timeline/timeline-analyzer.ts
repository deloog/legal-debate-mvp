/**
 * 时间线分析器
 * 缺口检测、排序、摘要生成
 */

import type { TimelineEvent, TimelineEventType } from "../../core/types";
import type { GapInfo, TimelineSummary } from "./timeline-types";
import { parseDate } from "./timeline-utils";
import {
  inferEarliestDate,
  inferDateBetween,
  inferDateAfter,
} from "./timeline-utils";

/**
 * 排序事件
 */
export function sortEvents(
  events: TimelineEvent[],
  ascending: boolean = true,
): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);

    if (!dateA) return ascending ? 1 : -1;
    if (!dateB) return ascending ? -1 : 1;

    return ascending
      ? dateA.getTime() - dateB.getTime()
      : dateB.getTime() - dateA.getTime();
  });
}

/**
 * 检测和填充时间线空缺
 */
export function detectAndFillGaps(
  events: TimelineEvent[],
  text: string,
  fill: boolean,
): GapInfo {
  if (events.length === 0) {
    return {
      startDate: undefined,
      endDate: undefined,
      missingTypes: [],
      inferredEvents: [],
      hasGaps: false,
    };
  }

  const sorted = sortEvents(events, true);
  const earliestDate = sorted[0]?.date;
  const latestDate = sorted[sorted.length - 1]?.date;

  const presentTypes = new Set(
    events
      .map((e) => e.eventType)
      .filter((t) => t !== undefined) as TimelineEventType[],
  );
  const requiredTypes: TimelineEventType[] = [
    "CONTRACT_SIGNED",
    "PERFORMANCE_START",
    "BREACH_OCCURRED",
    "DEMAND_SENT",
    "LAWSUIT_FILED",
  ];
  const missingTypes = requiredTypes.filter((t) => !presentTypes.has(t));

  const inferredEvents: TimelineEvent[] = [];

  if (fill && missingTypes.length > 0) {
    let idCounter = 1000;

    if (!presentTypes.has("CONTRACT_SIGNED") && /合同|协议|约定/gi.test(text)) {
      inferredEvents.push({
        id: `event_inferred_${idCounter++}`,
        date: inferEarliestDate(earliestDate),
        event: "签订合同（推断）",
        eventType: "CONTRACT_SIGNED",
        importance: 3,
        source: "inferred",
      });
    }

    if (
      !presentTypes.has("PERFORMANCE_START") &&
      /履行|执行|开始/gi.test(text)
    ) {
      inferredEvents.push({
        id: `event_inferred_${idCounter++}`,
        date: inferDateBetween(
          earliestDate,
          presentTypes.has("BREACH_OCCURRED") ? latestDate : undefined,
        ),
        event: "开始履行（推断）",
        eventType: "PERFORMANCE_START",
        importance: 4,
        source: "inferred",
      });
    }

    if (
      !presentTypes.has("BREACH_OCCURRED") &&
      /违约|未履行|逾期/gi.test(text)
    ) {
      inferredEvents.push({
        id: `event_inferred_${idCounter++}`,
        date: inferDateAfter(earliestDate),
        event: "发生违约（推断）",
        eventType: "BREACH_OCCURRED",
        importance: 5,
        source: "inferred",
      });
    }
  }

  return {
    startDate: earliestDate,
    endDate: latestDate,
    missingTypes,
    inferredEvents,
    hasGaps: missingTypes.length > 0 || inferredEvents.length > 0,
  };
}

/**
 * 生成摘要
 */
export function generateSummary(
  events: TimelineEvent[],
  gapInfo: GapInfo,
  aiExtracted: TimelineEvent[],
  ruleExtracted: TimelineEvent[],
  aiReviewed: TimelineEvent[],
): TimelineSummary {
  const byType: Record<TimelineEventType, number> = {} as Record<
    TimelineEventType,
    number
  >;
  let explicitCount = 0;
  let inferredCount = 0;
  let totalImportance = 0;

  const allTypes: TimelineEventType[] = [
    "CONTRACT_SIGNED",
    "PERFORMANCE_START",
    "BREACH_OCCURRED",
    "DEMAND_SENT",
    "LAWSUIT_FILED",
    "OTHER",
  ];

  for (const type of allTypes) {
    byType[type] = events.filter((e) => e.eventType === type).length;
  }

  for (const event of events) {
    if (event.source === "explicit") explicitCount++;
    if (event.source === "inferred") inferredCount++;
    totalImportance += event.importance || 0;
  }

  return {
    total: events.length,
    explicitCount,
    inferredCount,
    byType,
    avgImportance:
      events.length > 0 ? Math.round(totalImportance / events.length) : 0,
    earliestDate: gapInfo.startDate,
    latestDate: gapInfo.endDate,
    hasGaps: gapInfo.hasGaps,
    aiExtractedCount: aiExtracted.length,
    ruleExtractedCount: ruleExtracted.length,
    aiReviewedCount: aiReviewed.length,
  };
}
