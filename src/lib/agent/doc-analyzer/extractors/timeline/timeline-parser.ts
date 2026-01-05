/**
 * 时间线解析器
 * 日期、事件和AI响应解析
 */

import type { TimelineEvent, TimelineEventType } from "../../core/types";
import { normalizeDate } from "./timeline-utils";
import { getEventTypePatterns } from "./timeline-utils";

/**
 * 从文本中提取日期
 */
export function extractDate(
  text: string,
  datePatterns: RegExp[],
): {
  date: string;
  matched: boolean;
} {
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        date: normalizeDate(match[0]),
        matched: true,
      };
    }
  }
  return { date: "", matched: false };
}

/**
 * 提取事件文本
 */
export function extractEventText(
  sentence: string,
  date: string,
): string | null {
  let eventText = sentence.replace(date, "").trim();

  if (eventText === sentence) {
    eventText = sentence
      .replace(/\d{4}年\d{1,2}月\d{1,2}日?/g, "")
      .replace(/\d{4}-\d{1,2}-\d{1,2}/g, "")
      .replace(/\d{4}\/\d{1,2}\/\d{1,2}/g, "")
      .replace(/\d{4}\.\d{1,2}\.\d{1,2}/g, "")
      .replace(/\d{4}年\d{1,2}月/g, "")
      .replace(/\d{4}年/g, "")
      .replace(/\d{1,2}月\d{1,2}日/g, "")
      .trim();
  }

  eventText = eventText
    .replace(/^(于|在|自|从|至|到)\s*/g, "")
    .replace(/^(发生|进行|完成|签署|签订|履行|违约|起诉)/g, "")
    .trim();

  if (eventText.length < 2 || /^上述|该|此|其$/.test(eventText)) {
    return null;
  }

  return eventText;
}

/**
 * 确定事件类型
 */
export function determineEventType(eventText: string): TimelineEventType {
  const eventTypePatterns = getEventTypePatterns();

  for (const [type, patterns] of eventTypePatterns) {
    for (const pattern of patterns) {
      if (pattern.test(eventText)) {
        return type;
      }
    }
  }
  return "OTHER";
}

/**
 * 从文本中提取日期事件对
 */
export function extractDateEventPairs(
  text: string,
  datePatterns: RegExp[],
): Array<{ date: string; eventText: string }> {
  const pairs: Array<{ date: string; eventText: string }> = [];
  const segments = text.split(/[。！？；，\n]/).filter((s) => s.trim());

  for (const segment of segments) {
    const dateMatch = extractDate(segment, datePatterns);
    if (!dateMatch.matched) continue;

    const eventText = extractEventText(segment, dateMatch.date);

    if (eventText) {
      pairs.push({
        date: dateMatch.date,
        eventText,
      });
    }
  }

  return pairs;
}

/**
 * 从文本中提取JSON（支持多种格式）
 */
export function extractJSONFromText(text: string): string {
  let extracted = text.trim();

  if (extracted.includes("```json")) {
    extracted = extracted.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
  } else if (extracted.includes("```")) {
    extracted = extracted.replace(/```\s*/g, "").replace(/```\s*$/g, "");
  }

  const objectMatch = extracted.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    extracted = objectMatch[0];
  }

  return extracted.trim();
}

/**
 * 清理JSON字符串（修复常见格式问题）
 */
export function cleanJSONString(jsonStr: string): string {
  let cleaned = jsonStr.trim();

  cleaned = cleaned.replace(/,\s*}/g, "}");
  cleaned = cleaned.replace(/,\s*\]/g, "]");
  cleaned = cleaned.replace(/'([^']*)'/g, '"$1"');
  cleaned = cleaned.replace(/\/\/.*$/gm, "");
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  cleaned = cleaned.replace(/\n\s*\n/g, "\n");

  return cleaned.trim();
}

/**
 * 解析AI提取响应
 */
export function parseAIExtractionResponse(aiResponse: string): TimelineEvent[] {
  try {
    let cleanedResponse = aiResponse.trim();

    const responsePreview = cleanedResponse.substring(0, 1000);
    console.log("[AI响应解析] 原始响应预览:", responsePreview);

    cleanedResponse = extractJSONFromText(cleanedResponse);
    cleanedResponse = cleanJSONString(cleanedResponse);

    const parsed = JSON.parse(cleanedResponse);
    console.log(
      "[AI响应解析] JSON解析成功，字段数:",
      Object.keys(parsed).length,
    );

    if (!parsed.timelineEvents || !Array.isArray(parsed.timelineEvents)) {
      console.warn("[AI响应解析] timelineEvents字段缺失或类型错误");
      return [];
    }

    const events = parsed.timelineEvents.map((item: unknown, index: number) => {
      const eventItem = item as {
        date?: string;
        event?: string;
        eventType?: TimelineEventType;
        importance?: number;
        evidence?: string[];
      };

      if (!eventItem.date && !eventItem.event) {
        console.warn(`[AI响应解析] 事件${index}缺少必需字段`, item);
      }

      return {
        id: `ai_event_${index}`,
        date: eventItem.date || "",
        event: eventItem.event || "",
        eventType: eventItem.eventType,
        importance: Math.min(
          5,
          Math.max(1, Math.round(eventItem.importance || 3)),
        ),
        evidence: Array.isArray(eventItem.evidence) ? eventItem.evidence : [],
        source: "explicit",
      };
    });

    console.log("[AI响应解析] 成功解析事件数:", events.length);
    return events;
  } catch (error) {
    console.error("[AI响应解析] 完整解析失败:", {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: aiResponse.substring(0, 500),
    });

    console.log("[AI响应解析] 尝试部分解析...");
    return parsePartialAIExtraction(aiResponse);
  }
}

/**
 * 部分解析AI提取响应（容错机制）
 */
export function parsePartialAIExtraction(aiResponse: string): TimelineEvent[] {
  console.log("[AI响应解析] 部分解析模式启动");
  const events: TimelineEvent[] = [];

  try {
    const dateMatches = Array.from(
      aiResponse.matchAll(/"date"\s*:\s*"([^"]+)"/gi),
    );
    const eventMatches = Array.from(
      aiResponse.matchAll(/"event"\s*:\s*"([^"]+)"/gi),
    );
    const typeMatches = Array.from(
      aiResponse.matchAll(/"eventType"\s*:\s*"([^"]+)"/gi),
    );
    const importanceMatches = Array.from(
      aiResponse.matchAll(/"importance"\s*:\s*(\d+)/gi),
    );

    if (dateMatches.length > 0 && eventMatches.length > 0) {
      const count = Math.min(
        dateMatches.length,
        eventMatches.length,
        typeMatches.length,
        importanceMatches.length,
      );

      for (let i = 0; i < count; i++) {
        const date = normalizeDate(dateMatches[i][1]);
        const event = eventMatches[i][1];
        const eventType = typeMatches[i]?.[1] as TimelineEventType;
        const importance = importanceMatches[i]?.[1]
          ? Math.min(5, Math.max(1, parseInt(importanceMatches[i][1])))
          : 3;

        if (date && event && event.length > 2) {
          events.push({
            id: `ai_partial_${i}`,
            date,
            event,
            eventType: eventType || determineEventType(event),
            importance,
            evidence: [],
            source: "explicit",
          });
        }
      }

      console.log(`[AI响应解析] 部分解析成功，提取${events.length}个事件`);
    } else {
      console.warn("[AI响应解析] 部分解析失败，未找到有效的事件数据");
    }
  } catch (error) {
    console.error("[AI响应解析] 部分解析异常:", error);
  }

  return events;
}
