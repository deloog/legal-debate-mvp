/**
 * 时间线规则匹配器
 * 第二层：规则匹配兜底
 */

import type { ExtractedData, TimelineEvent } from '../../core/types';
import { getDatePatterns } from './timeline-utils';
import { extractDateEventPairs } from './timeline-parser';
import { buildRuleBasedEvent, isSimilarEvent } from './timeline-event-builder';

/**
 * 规则匹配层 - 使用多种规则模式进行匹配
 */
export function ruleMatchLayer(
  text: string,
  extractedData?: ExtractedData,
  aiExtracted?: TimelineEvent[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let idCounter = aiExtracted ? aiExtracted.length : 0;

  const datePatterns = getDatePatterns();
  const dateEventPairs = extractDateEventPairs(text, datePatterns);

  for (const { date, eventText } of dateEventPairs) {
    const isAlreadyExtracted = aiExtracted?.some(aiEvent =>
      isSimilarEvent(aiEvent, eventText, date)
    );

    if (!isAlreadyExtracted) {
      const id = `rule_event_${idCounter++}`;
      const event = buildRuleBasedEvent(id, date, eventText);
      if (event) events.push(event);
    }
  }

  return events;
}
