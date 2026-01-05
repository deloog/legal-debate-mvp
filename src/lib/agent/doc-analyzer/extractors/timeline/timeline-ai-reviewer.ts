/**
 * 时间线AI审查器
 * 第三层：AI审查修正
 */

import type { TimelineEvent, TimelineEventType } from "../../core/types";
import { getUnifiedAIService } from "@/lib/ai/unified-service";
import { extractJSONFromText, cleanJSONString } from "./timeline-parser";

/**
 * AI审查层 - 对时间线事件进行审查和修正
 */
export async function aiReviewLayer(
  events: TimelineEvent[],
  originalText: string,
): Promise<TimelineEvent[]> {
  try {
    const unifiedService = await getUnifiedAIService();

    const prompt = buildAIReviewPrompt(events, originalText);

    const response = await unifiedService.chatCompletion({
      model: "deepseek-chat",
      provider: "deepseek",
      messages: [
        {
          role: "system",
          content:
            "你是一个专业的法律时间线审查专家。请审查和修正时间线事件识别结果。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    if (response.choices && response.choices.length > 0) {
      return parseAIReviewResponse(
        response.choices[0].message.content || "",
        events,
      );
    }

    return events;
  } catch (error) {
    console.error("AI审查层失败:", error);
    return events;
  }
}

/**
 * 构建AI审查提示词
 */
function buildAIReviewPrompt(
  events: TimelineEvent[],
  originalText: string,
): string {
  const eventList = events
    .map(
      (e, index) =>
        `${index + 1}. ${e.date} - ${e.event} [${e.eventType}]
   - 重要性: ${e.importance}`,
    )
    .join("\n");

  return `请审查以下从法律文档中识别的时间线事件列表，确保其准确性和完整性。

原始文档内容：
${originalText.substring(0, 1000)}...

已识别的时间线事件：
${eventList}

请按照以下JSON格式返回审查后的时间线事件列表：

{
  "reviewedEvents": [
    {
      "id": "原ID",
      "date": "修正后的日期",
      "event": "修正后的事件描述",
      "eventType": "修正后的事件类型",
      "importance": 5,
      "evidence": ["补充证据"]
    }
  ],
  "invalidIds": ["需要删除的ID列表"]
}

审查要点：
1. 检查每个事件的日期是否准确
2. 修正不准确的日期和事件描述
3. 调整事件类型分类
4. 调整重要性评分
5. 删除重复或无效的事件
6. 补充遗漏的事件（如有）
7. 确保时间线符合文档内容的逻辑顺序

注意事项：
1. 保持原有的ID，以便追溯
2. 只返回JSON格式，不要包含其他说明文字`;
}

/**
 * 解析AI审查响应 - 增强容错性和错误日志
 */
function parseAIReviewResponse(
  aiResponse: string,
  originalEvents: TimelineEvent[],
): TimelineEvent[] {
  try {
    let cleanedResponse = aiResponse.trim();

    const responsePreview = cleanedResponse.substring(0, 1000);
    console.log("[AI审查响应解析] 原始响应预览:", responsePreview);

    cleanedResponse = extractJSONFromText(cleanedResponse);
    cleanedResponse = cleanJSONString(cleanedResponse);

    const parsed = JSON.parse(cleanedResponse);
    console.log("[AI审查响应解析] JSON解析成功");

    const invalidIds = new Set(parsed.invalidIds || []);
    const reviewedItems = parsed.reviewedEvents || [];

    const result = reviewedItems
      .map((item: unknown) => {
        const reviewedItem = item as {
          id?: string;
          date?: string;
          event?: string;
          eventType?: string;
          importance?: number;
          evidence?: string[];
        };
        const original = originalEvents.find((e) => e.id === reviewedItem.id);

        return {
          id: reviewedItem.id,
          date: reviewedItem.date || original?.date || "",
          event: reviewedItem.event || original?.event || "",
          eventType: (reviewedItem.eventType ||
            original?.eventType) as TimelineEventType,
          importance: Math.min(
            5,
            Math.max(1, Math.round(reviewedItem.importance || 3)),
          ),
          evidence: Array.isArray(reviewedItem.evidence)
            ? reviewedItem.evidence
            : original?.evidence || [],
          source: original?.source || "explicit",
        };
      })
      .filter((item) => !invalidIds.has(item.id));

    console.log(
      `[AI审查响应解析] 成功解析${result.length}个事件，删除${invalidIds.size}个无效事件`,
    );
    return result;
  } catch (error) {
    console.error("[AI审查响应解析] 完整解析失败:", {
      error: error instanceof Error ? error.message : String(error),
      responsePreview: aiResponse.substring(0, 500),
    });

    console.log("[AI审查响应解析] 使用原始事件");
    return originalEvents;
  }
}
