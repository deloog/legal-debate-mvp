/**
 * 时间线事件构建器
 * 事件构建、丰富、合并和相关度判断
 */

import type {
  ExtractedData,
  TimelineEvent,
  TimelineEventType,
} from '../../core/types';
import { determineEventType } from './timeline-parser';

/**
 * 基于规则构建时间线事件
 */
export function buildRuleBasedEvent(
  id: string,
  date: string,
  eventText: string
): TimelineEvent | null {
  const eventType = determineEventType(eventText);
  const importance = calculateImportance(eventText, eventType);
  const evidence = extractEvidence(eventText);

  return {
    id,
    date,
    event: eventText,
    eventType,
    importance,
    evidence,
    source: 'explicit',
  };
}

/**
 * 合并AI和规则匹配结果，去重
 */
export function mergeAndDeduplicate(
  aiEvents: TimelineEvent[],
  ruleEvents: TimelineEvent[]
): TimelineEvent[] {
  const seen = new Set<string>();
  const unique: TimelineEvent[] = [];

  for (const event of aiEvents) {
    const key = `${event.date}_${event.event.substring(0, 10)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  for (const event of ruleEvents) {
    const key = `${event.date}_${event.event.substring(0, 10)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(event);
    }
  }

  return unique;
}

/**
 * 判断两个事件是否相似
 */
export function isSimilarEvent(
  aiEvent: TimelineEvent,
  eventText: string,
  date: string
): boolean {
  if (aiEvent.date !== date) return false;

  const aiDesc = aiEvent.event.toLowerCase();
  const matchedLower = eventText.toLowerCase();

  return (
    aiDesc.includes(matchedLower.substring(0, 5)) ||
    matchedLower.includes(aiDesc.substring(0, 5))
  );
}

/**
 * 计算重要性评分
 */
export function calculateImportance(
  eventText: string,
  eventType?: TimelineEventType
): number {
  let score = 2;

  const typeWeights: Partial<Record<TimelineEventType, number>> = {
    CONTRACT_SIGNED: 3,
    PERFORMANCE_START: 4,
    BREACH_OCCURRED: 5,
    DEMAND_SENT: 3,
    LAWSUIT_FILED: 4,
    FILING: 3,
    HEARING: 4,
    JUDGMENT: 5,
    EVIDENCE: 3,
    OTHER: 2,
  };
  score += typeWeights[eventType || 'OTHER'];

  const highImportanceKeywords = [
    '签订',
    '履行',
    '违约',
    '起诉',
    '判决',
    '终止',
  ];
  if (highImportanceKeywords.some(kw => eventText.includes(kw))) {
    score += 1;
  }

  if (eventText.length < 3) score -= 1;
  if (eventText.length > 10) score += 1;

  return Math.min(5, Math.max(1, score));
}

/**
 * 提取证据
 */
export function extractEvidence(eventText: string): string[] {
  const evidence: string[] = [];

  const patterns = [
    /根据\s*《([^》]+)》/gi,
    /依据\s*([^。，]+)/gi,
    /证据\s*([^。，]+)/gi,
  ];

  for (const pattern of patterns) {
    const matches = eventText.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        evidence.push(match[1].trim());
      }
    }
  }

  return evidence;
}

/**
 * 使用提取的数据丰富事件信息
 */
export function enrichEventsWithExtractedData(
  events: TimelineEvent[],
  extractedData: ExtractedData
): void {
  if (!extractedData.disputeFocuses) return;

  for (const event of events) {
    for (const focus of extractedData.disputeFocuses) {
      if (isEventRelatedToFocus(event.event, focus.description)) {
        if (!event.evidence) event.evidence = [];
        if (focus.legalBasis && !event.evidence.includes(focus.legalBasis)) {
          event.evidence.push(focus.legalBasis);
        }
      }
    }

    if (extractedData.claims) {
      for (const claim of extractedData.claims) {
        if (isEventRelatedToClaim(event.event, claim.content)) {
          if (!event.evidence) event.evidence = [];
          if (claim.legalBasis && !event.evidence.includes(claim.legalBasis)) {
            event.evidence.push(claim.legalBasis);
          }
        }
      }
    }
  }
}

/**
 * 判断事件是否与争议焦点相关
 */
function isEventRelatedToFocus(
  eventText: string,
  focusDescription: string
): boolean {
  const eventKeywords = eventText.split(/[，。；\s]/).map(k => k.trim());
  const focusKeywords = focusDescription.split(/[，。；\s]/).map(k => k.trim());

  return eventKeywords.some(ek =>
    focusKeywords.some(fk => fk.includes(ek) || ek.includes(fk))
  );
}

/**
 * 判断事件是否与诉讼请求相关
 */
function isEventRelatedToClaim(
  eventText: string,
  claimContent: string
): boolean {
  const eventKeywords = eventText.split(/[，。；\s]/).map(k => k.trim());
  const claimKeywords = claimContent.split(/[，。；\s]/).map(k => k.trim());

  return eventKeywords.some(ek =>
    claimKeywords.some(ck => ck.includes(ek) || ek.includes(ck))
  );
}
