/**
 * 时间线提取器 - 三层架构：AI识别+算法兜底+AI审查
 * 目标：时间线提取完整
 */

import { getUnifiedAIService } from "@/lib/ai/unified-service";
import type {
  TimelineEvent,
  TimelineEventType,
  ExtractedData,
} from "../core/types";

// =============================================================================
// 接口定义
// =============================================================================

export interface TimelineExtractionOptions {
  includeInferred?: boolean;
  minImportance?: number;
  sortAscending?: boolean;
  fillGaps?: boolean;
  useAIExtraction?: boolean; // 是否启用AI提取
  useAIMatching?: boolean; // 是否启用AI审查
}

export interface TimelineExtractionOutput {
  events: TimelineEvent[];
  summary: {
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
  };
  gapInfo: GapInfo;
}

export interface GapInfo {
  startDate?: string;
  endDate?: string;
  missingTypes: TimelineEventType[];
  inferredEvents: TimelineEvent[];
  hasGaps: boolean;
}

// =============================================================================
// 时间线提取器类 - 三层架构
// =============================================================================

export class TimelineExtractor {
  private readonly datePatterns: RegExp[];
  private readonly eventTypePatterns: Map<TimelineEventType, RegExp[]>;

  constructor() {
    this.datePatterns = this.initializeDatePatterns();
    this.eventTypePatterns = this.initializeEventTypePatterns();
  }

  /**
   * 从文本中提取时间线 - 三层架构
   * 第一层：AI识别
   * 第二层：规则匹配兜底
   * 第三层：AI审查修正
   */
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: TimelineExtractionOptions = {},
  ): Promise<TimelineExtractionOutput> {
    let aiExtracted: TimelineEvent[] = [];
    let ruleExtracted: TimelineEvent[] = [];
    let aiReviewed: TimelineEvent[] = [];

    // 第一层：AI识别（如果启用）
    if (options.useAIExtraction !== false) {
      aiExtracted = await this.aiExtractLayer(text, extractedData);
    }

    // 第二层：规则匹配兜底
    ruleExtracted = this.ruleMatchLayer(text, extractedData, aiExtracted);

    // 合并第一层和第二层的结果，去重
    let mergedEvents = this.mergeAndDeduplicate(aiExtracted, ruleExtracted);

    // 第三层：AI审查修正（如果启用）
    if (options.useAIMatching !== false && mergedEvents.length > 0) {
      aiReviewed = await this.aiReviewLayer(mergedEvents, text);
      mergedEvents = aiReviewed;
    }

    // 过滤推断结果
    if (options.includeInferred === false) {
      mergedEvents = mergedEvents.filter((e) => e.source !== "inferred");
    }

    // 过滤低重要性事件
    if (options.minImportance !== undefined) {
      mergedEvents = mergedEvents.filter(
        (e) => (e.importance || 1) >= options.minImportance,
      );
    }

    // 排序事件
    mergedEvents = this.sortEvents(
      mergedEvents,
      options.sortAscending !== false,
    );

    // 填充时间线空缺
    const gapInfo = this.detectAndFillGaps(
      mergedEvents,
      text,
      options.fillGaps !== false,
    );
    if (gapInfo.inferredEvents.length > 0) {
      mergedEvents = [...mergedEvents, ...gapInfo.inferredEvents];
    }

    // 使用提取的数据丰富事件信息
    if (extractedData) {
      this.enrichEventsWithExtractedData(mergedEvents, extractedData, text);
    }

    const summary = this.generateSummary(
      mergedEvents,
      gapInfo,
      aiExtracted,
      ruleExtracted,
      aiReviewed,
    );

    return { events: mergedEvents, summary, gapInfo };
  }

  // =============================================================================
  // 第一层：AI识别
  // =============================================================================

  /**
   * AI识别层 - 使用DeepSeek进行智能识别
   */
  private async aiExtractLayer(
    text: string,
    extractedData?: ExtractedData,
  ): Promise<TimelineEvent[]> {
    try {
      const unifiedService = await getUnifiedAIService();

      const prompt = this.buildAIExtractionPrompt(text, extractedData);

      const response = await unifiedService.chatCompletion({
        model: "deepseek-chat",
        provider: "deepseek",
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的法律事件时间线识别专家。请从法律文档中准确提取事件时间线。",
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
        return this.parseAIExtractionResponse(
          response.choices[0].message.content || "",
        );
      }

      return [];
    } catch (error) {
      console.error("AI识别层失败:", error);
      return [];
    }
  }

  /**
   * 构建AI识别提示词
   * 优化提示词，强制JSON格式输出
   */
  private buildAIExtractionPrompt(
    text: string,
    extractedData?: ExtractedData,
  ): string {
    let contextInfo = "";

    if (
      extractedData?.disputeFocuses &&
      extractedData.disputeFocuses.length > 0
    ) {
      contextInfo += `\n争议焦点信息：\n${extractedData.disputeFocuses.map((d) => d.description).join("\n")}`;
    }

    return `请从以下法律文档中准确提取事件时间线，并严格按照指定的JSON格式返回结果。

文档内容：
${text}
${contextInfo}

【重要】你必须严格按照以下JSON格式返回结果，不要包含任何其他文字、说明或解释：

{
  "timelineEvents": [
    {
      "date": "YYYY-MM-DD",
      "event": "事件描述",
      "eventType": "CONTRACT_SIGNED|PERFORMANCE_START|BREACH_OCCURRED|DEMAND_SENT|LAWSUIT_FILED|OTHER",
      "importance": 5,
      "evidence": ["证据1", "证据2"]
    }
  ]
}

事件类型说明：
- CONTRACT_SIGNED: 合同签订/签署
- PERFORMANCE_START: 开始履行
- BREACH_OCCURRED: 发生违约
- DEMAND_SENT: 发送催告/通知
- LAWSUIT_FILED: 提起诉讼
- OTHER: 其他事件

示例输出格式（请严格参考）：
{
  "timelineEvents": [
    {
      "date": "2024-01-15",
      "event": "双方签订合同",
      "eventType": "CONTRACT_SIGNED",
      "importance": 5,
      "evidence": ["合同文本"]
    },
    {
      "date": "2024-02-01",
      "event": "被告违约",
      "eventType": "BREACH_OCCURRED",
      "importance": 4,
      "evidence": []
    }
  ]
}

提取要点：
1. 仔细提取文档中的所有日期和对应事件
2. 事件描述要简洁准确
3. 重要性评分范围1-5，数值越大越重要
4. 【关键】只返回上面的JSON格式，绝对不要包含其他任何说明文字、引言、解释或总结`;
  }

  /**
   * 解析AI识别响应 - 增强容错性和错误日志
   */
  private parseAIExtractionResponse(aiResponse: string): TimelineEvent[] {
    try {
      let cleanedResponse = aiResponse.trim();

      // 记录原始响应的前1000字符用于调试
      const responsePreview = cleanedResponse.substring(0, 1000);
      console.log("[AI响应解析] 原始响应预览:", responsePreview);

      // Level 1: 尝试标准JSON解析（带代码块）
      cleanedResponse = this.extractJSONFromText(cleanedResponse);

      // Level 2: 尝试清理和修复JSON
      cleanedResponse = this.cleanJSONString(cleanedResponse);

      const parsed = JSON.parse(cleanedResponse);
      console.log(
        "[AI响应解析] JSON解析成功，字段数:",
        Object.keys(parsed).length,
      );

      if (!parsed.timelineEvents || !Array.isArray(parsed.timelineEvents)) {
        console.warn("[AI响应解析] timelineEvents字段缺失或类型错误");
        return [];
      }

      const events = parsed.timelineEvents.map((item: any, index: number) => {
        // 验证必需字段
        if (!item.date && !item.event) {
          console.warn(`[AI响应解析] 事件${index}缺少必需字段`, item);
        }

        return {
          id: `ai_event_${index}`,
          date: item.date || "",
          event: item.event || "",
          eventType: item.eventType,
          importance: Math.min(
            5,
            Math.max(1, Math.round(item.importance || 3)),
          ),
          evidence: Array.isArray(item.evidence) ? item.evidence : [],
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

      // Level 3: 尝试部分解析
      console.log("[AI响应解析] 尝试部分解析...");
      return this.parsePartialAIExtraction(aiResponse);
    }
  }

  // =============================================================================
  // 第二层：规则匹配兜底
  // =============================================================================

  /**
   * 规则匹配层 - 使用多种规则模式进行匹配
   */
  private ruleMatchLayer(
    text: string,
    extractedData?: ExtractedData,
    aiExtracted?: TimelineEvent[],
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    let idCounter = aiExtracted ? aiExtracted.length : 0;

    // 先从文本中提取所有日期和事件
    const dateEventPairs = this.extractDateEventPairs(text);

    // 构建事件对象
    for (const { date, eventText } of dateEventPairs) {
      // 检查是否已被AI提取层覆盖
      const isAlreadyExtracted = aiExtracted?.some((aiEvent) =>
        this.isSimilarEvent(aiEvent, eventText, date),
      );

      if (!isAlreadyExtracted) {
        const id = `rule_event_${idCounter++}`;
        const event = this.buildRuleBasedEvent(id, date, eventText, text);
        if (event) events.push(event);
      }
    }

    return events;
  }

  /**
   * 判断两个事件是否相似
   */
  private isSimilarEvent(
    aiEvent: TimelineEvent,
    eventText: string,
    date: string,
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
   * 基于规则构建时间线事件
   */
  private buildRuleBasedEvent(
    id: string,
    date: string,
    eventText: string,
    fullText: string,
  ): TimelineEvent | null {
    const eventType = this.determineEventType(eventText, fullText);
    const importance = this.calculateImportance(eventText, eventType);
    const evidence = this.extractEvidence(eventText, fullText);

    return {
      id,
      date,
      event: eventText,
      eventType,
      importance,
      evidence,
      source: "explicit",
    };
  }

  /**
   * 提取日期和事件对
   * 优化支持连续多个日期提取
   */
  private extractDateEventPairs(text: string): Array<{
    date: string;
    eventText: string;
  }> {
    const pairs: Array<{ date: string; eventText: string }> = [];

    // 分割句子，按分隔符和逗号分割以支持连续日期
    const segments = text.split(/[。！？；，\n]/).filter((s) => s.trim());

    for (const segment of segments) {
      // 尝试提取日期
      const dateMatch = this.extractDate(segment);
      if (!dateMatch) continue;

      // 提取事件文本，确保包含有意义的内容
      const eventText = this.extractEventText(segment, dateMatch.date);

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
   * 提取日期
   */
  private extractDate(text: string): { date: string; matched: boolean } {
    for (const pattern of this.datePatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          date: this.normalizeDate(match[0]),
          matched: true,
        };
      }
    }
    return { date: "", matched: false };
  }

  /**
   * 提取事件文本
   */
  private extractEventText(sentence: string, date: string): string | null {
    // 尝试移除日期
    let eventText = sentence.replace(date, "").trim();

    // 如果标准化日期无法匹配（如"2024年"被标准化为"2024-01-01"），尝试使用正则移除日期
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
  private determineEventType(
    eventText: string,
    fullText: string,
  ): TimelineEventType | undefined {
    for (const [type, patterns] of this.eventTypePatterns) {
      for (const pattern of patterns) {
        if (pattern.test(eventText)) {
          return type;
        }
      }
    }
    return "OTHER";
  }

  /**
   * 计算重要性评分
   */
  private calculateImportance(
    eventText: string,
    eventType?: TimelineEventType,
  ): number {
    let score = 2;

    const typeWeights: Record<TimelineEventType, number> = {
      CONTRACT_SIGNED: 3,
      PERFORMANCE_START: 4,
      BREACH_OCCURRED: 5,
      DEMAND_SENT: 3,
      LAWSUIT_FILED: 4,
      OTHER: 2,
    };
    score += typeWeights[eventType || "OTHER"];

    const highImportanceKeywords = [
      "签订",
      "履行",
      "违约",
      "起诉",
      "判决",
      "终止",
    ];
    if (highImportanceKeywords.some((kw) => eventText.includes(kw))) {
      score += 1;
    }

    if (eventText.length < 3) score -= 1;
    if (eventText.length > 10) score += 1;

    return Math.min(5, Math.max(1, score));
  }

  /**
   * 提取证据
   */
  private extractEvidence(eventText: string, fullText: string): string[] {
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

  // =============================================================================
  // 合并和去重
  // =============================================================================

  /**
   * 合并AI和规则匹配结果，去重
   */
  private mergeAndDeduplicate(
    aiEvents: TimelineEvent[],
    ruleEvents: TimelineEvent[],
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

  // =============================================================================
  // 第三层：AI审查
  // =============================================================================

  /**
   * AI审查层 - 对时间线事件进行审查和修正
   */
  private async aiReviewLayer(
    events: TimelineEvent[],
    originalText: string,
  ): Promise<TimelineEvent[]> {
    try {
      const unifiedService = await getUnifiedAIService();

      const prompt = this.buildAIReviewPrompt(events, originalText);

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
        return this.parseAIReviewResponse(
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
  private buildAIReviewPrompt(
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
  private parseAIReviewResponse(
    aiResponse: string,
    originalEvents: TimelineEvent[],
  ): TimelineEvent[] {
    try {
      let cleanedResponse = aiResponse.trim();

      // 记录原始响应的前1000字符用于调试
      const responsePreview = cleanedResponse.substring(0, 1000);
      console.log("[AI审查响应解析] 原始响应预览:", responsePreview);

      // Level 1: 尝试标准JSON解析（带代码块）
      cleanedResponse = this.extractJSONFromText(cleanedResponse);

      // Level 2: 尝试清理和修复JSON
      cleanedResponse = this.cleanJSONString(cleanedResponse);

      const parsed = JSON.parse(cleanedResponse);
      console.log("[AI审查响应解析] JSON解析成功");

      const invalidIds = new Set(parsed.invalidIds || []);
      const reviewedItems = parsed.reviewedEvents || [];

      const result = reviewedItems
        .map((item: any) => {
          const original = originalEvents.find((e) => e.id === item.id);

          return {
            id: item.id,
            date: item.date || original?.date || "",
            event: item.event || original?.event || "",
            eventType: item.eventType || original?.eventType,
            importance: Math.min(
              5,
              Math.max(1, Math.round(item.importance || 3)),
            ),
            evidence: Array.isArray(item.evidence)
              ? item.evidence
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

      // 审查失败时返回原始事件
      console.log("[AI审查响应解析] 使用原始事件");
      return originalEvents;
    }
  }

  // =============================================================================
  // AI响应解析辅助方法
  // =============================================================================

  /**
   * 从文本中提取JSON（支持多种格式）
   */
  private extractJSONFromText(text: string): string {
    let extracted = text.trim();

    // 移除markdown代码块标记
    if (extracted.includes("```json")) {
      extracted = extracted.replace(/```json\s*/g, "").replace(/```\s*$/g, "");
    } else if (extracted.includes("```")) {
      extracted = extracted.replace(/```\s*/g, "").replace(/```\s*$/g, "");
    }

    // 尝试提取第一个完整的JSON对象
    const objectMatch = extracted.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      extracted = objectMatch[0];
    }

    return extracted.trim();
  }

  /**
   * 清理JSON字符串（修复常见格式问题）
   */
  private cleanJSONString(jsonStr: string): string {
    let cleaned = jsonStr.trim();

    // 移除多余的逗号
    cleaned = cleaned.replace(/,\s*}/g, "}");
    cleaned = cleaned.replace(/,\s*\]/g, "]");

    // 修复单引号为双引号
    cleaned = cleaned.replace(/'([^']*)'/g, '"$1"');

    // 移除注释（如果存在）
    cleaned = cleaned.replace(/\/\/.*$/gm, "");
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");

    // 统一换行符
    cleaned = cleaned.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // 移除不必要的空白
    cleaned = cleaned.replace(/\n\s*\n/g, "\n");

    return cleaned.trim();
  }

  /**
   * 部分解析AI提取响应（容错机制）
   */
  private parsePartialAIExtraction(aiResponse: string): TimelineEvent[] {
    console.log("[AI响应解析] 部分解析模式启动");
    const events: TimelineEvent[] = [];

    try {
      // 尝试使用正则表达式提取关键信息
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
          const date = this.normalizeDate(dateMatches[i][1]);
          const event = eventMatches[i][1];
          const eventType = typeMatches[i]?.[1] as TimelineEventType;
          const importance = importanceMatches[i]?.[1]
            ? Math.min(5, Math.max(1, parseInt(importanceMatches[i][1])))
            : 3;

          // 验证提取的信息是否有效
          if (date && event && event.length > 2) {
            events.push({
              id: `ai_partial_${i}`,
              date,
              event,
              eventType:
                eventType || this.determineEventType(event, aiResponse),
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

  // =============================================================================
  // 其他辅助方法
  // =============================================================================

  /**
   * 使用提取的数据丰富事件信息
   */
  private enrichEventsWithExtractedData(
    events: TimelineEvent[],
    extractedData: ExtractedData,
    text: string,
  ): void {
    if (!extractedData.disputeFocuses) return;

    for (const event of events) {
      for (const focus of extractedData.disputeFocuses) {
        if (this.isEventRelatedToFocus(event.event, focus.description, text)) {
          if (!event.evidence) event.evidence = [];
          if (focus.legalBasis && !event.evidence.includes(focus.legalBasis)) {
            event.evidence.push(focus.legalBasis);
          }
        }
      }

      if (extractedData.claims) {
        for (const claim of extractedData.claims) {
          if (this.isEventRelatedToClaim(event.event, claim.content, text)) {
            if (!event.evidence) event.evidence = [];
            if (
              claim.legalBasis &&
              !event.evidence.includes(claim.legalBasis)
            ) {
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
  private isEventRelatedToFocus(
    eventText: string,
    focusDescription: string,
    fullText: string,
  ): boolean {
    const eventKeywords = eventText.split(/[，。；\s]/).map((k) => k.trim());
    const focusKeywords = focusDescription
      .split(/[，。；\s]/)
      .map((k) => k.trim());

    return eventKeywords.some((ek) =>
      focusKeywords.some((fk) => fk.includes(ek) || ek.includes(fk)),
    );
  }

  /**
   * 判断事件是否与诉讼请求相关
   */
  private isEventRelatedToClaim(
    eventText: string,
    claimContent: string,
    fullText: string,
  ): boolean {
    const eventKeywords = eventText.split(/[，。；\s]/).map((k) => k.trim());
    const claimKeywords = claimContent.split(/[，。；\s]/).map((k) => k.trim());

    return eventKeywords.some((ek) =>
      claimKeywords.some((ck) => ck.includes(ek) || ek.includes(ck)),
    );
  }

  /**
   * 排序事件
   */
  private sortEvents(
    events: TimelineEvent[],
    ascending: boolean = true,
  ): TimelineEvent[] {
    return [...events].sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);

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
  private detectAndFillGaps(
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

    const sorted = this.sortEvents(events, true);
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

      if (
        !presentTypes.has("CONTRACT_SIGNED") &&
        /合同|协议|约定/gi.test(text)
      ) {
        inferredEvents.push({
          id: `event_inferred_${idCounter++}`,
          date: this.inferEarliestDate(earliestDate),
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
          date: this.inferDateBetween(
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
          date: this.inferDateAfter(earliestDate),
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
   * 解析日期
   */
  private parseDate(dateStr: string): Date | null {
    try {
      // 先尝试直接解析
      const directParsed = new Date(dateStr);
      if (!isNaN(directParsed.getTime())) {
        return directParsed;
      }

      const formats = [
        {
          pattern: /(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/,
          groupMap: { year: 1, month: 2, day: 3 },
        },
        {
          pattern: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
          groupMap: { year: 1, month: 2, day: 3 },
        },
        {
          pattern: /(\d{4})年(\d{1,2})月(\d{1,2})日?/,
          groupMap: { year: 1, month: 2, day: 3 },
        },
        {
          pattern: /(\d{4})年(\d{1,2})月/,
          groupMap: { year: 1, month: 2, day: null },
          requiresDay: false,
        },
        // 添加只匹配年份的模式（如"2024年"）
        {
          pattern: /(\d{4})年/,
          groupMap: { year: 1, month: null, day: null },
          requiresDay: false,
          requiresMonth: false,
        },
      ];

      for (const format of formats) {
        const { pattern, groupMap, requiresDay = true } = format;
        const match = dateStr.match(pattern);
        if (match) {
          const year = parseInt(match[groupMap.year]);
          let month: number = 1; // 默认1月
          let day: number = 1; // 默认1号

          // 处理月份
          if (groupMap.month) {
            month = parseInt(match[groupMap.month]);
          }

          // 处理日
          if (groupMap.day) {
            day = parseInt(match[groupMap.day]);
          }

          // 验证日期有效性
          if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
            const date = new Date(year, month - 1, day);
            if (!isNaN(date.getTime())) {
              return date;
            }
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 标准化日期
   * 使用本地日期格式化，避免时区转换导致日期偏移
   */
  private normalizeDate(dateStr: string): string {
    const parsed = this.parseDate(dateStr);
    if (parsed && !isNaN(parsed.getTime())) {
      // 使用本地日期格式化，避免toISOString()导致的时区转换
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return dateStr;
  }

  /**
   * 推断最早日期
   */
  private inferEarliestDate(earliestDate?: string): string {
    if (!earliestDate) {
      const now = new Date();
      const threeMonthsAgo = new Date(
        now.getFullYear(),
        now.getMonth() - 3,
        now.getDate(),
      );
      return threeMonthsAgo.toISOString().split("T")[0];
    }

    return earliestDate;
  }

  /**
   * 推断两个日期之间的时间
   */
  private inferDateBetween(startDate?: string, endDate?: string): string {
    if (!startDate || !endDate) {
      return startDate || endDate || "";
    }

    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);

    if (start && end) {
      const midTime = new Date((start.getTime() + end.getTime()) / 2);
      return midTime.toISOString().split("T")[0];
    }

    return startDate || endDate || "";
  }

  /**
   * 推断最早日期之后的时间
   */
  private inferDateAfter(startDate?: string): string {
    if (!startDate) return "";

    const start = this.parseDate(startDate);
    if (start) {
      const oneMonthLater = new Date(
        start.getFullYear(),
        start.getMonth() + 1,
        start.getDate(),
      );
      return oneMonthLater.toISOString().split("T")[0];
    }

    return "";
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    events: TimelineEvent[],
    gapInfo: GapInfo,
    aiExtracted: TimelineEvent[],
    ruleExtracted: TimelineEvent[],
    aiReviewed: TimelineEvent[],
  ): {
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
  } {
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

  /**
   * 初始化日期模式
   */
  private initializeDatePatterns(): RegExp[] {
    return [
      /(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/g,
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g,
      /(\d{4})年(\d{1,2})月(\d{1,2})日?/g,
      /(\d{1,2})月(\d{1,2})日/g,
      /(\d{4})年(\d{1,2})月/g,
      /(\d{4})年/g, // 添加只匹配年份的模式
      // 添加YYYY.MM.DD格式支持
      /(\d{4})[.](\d{1,2})[.](\d{1,2})/g,
    ];
  }

  /**
   * 初始化事件类型模式
   */
  private initializeEventTypePatterns(): Map<TimelineEventType, RegExp[]> {
    const patterns = new Map<TimelineEventType, RegExp[]>();

    patterns.set("CONTRACT_SIGNED", [/签订|签署|订立|达成|协议|合同/gi]);
    patterns.set("PERFORMANCE_START", [/开始.*履行|履行.*义务|执行.*合同/gi]);
    patterns.set("BREACH_OCCURRED", [
      /违约|未履行|逾期|停止.*履行|拒绝.*履行/gi,
    ]);
    patterns.set("DEMAND_SENT", [/催告|发函|通知|要求.*支付|要求.*履行/gi]);
    // 增强LAWSUIT_FILED模式，添加更多匹配关键词
    patterns.set("LAWSUIT_FILED", [
      /起诉|提起.*诉讼|向法院.*起诉|申请.*仲裁|提起诉讼|起诉至法院|诉至法院/gi,
    ]);

    return patterns;
  }
}

// =============================================================================
// 工具函数
// =============================================================================

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
  options?: TimelineExtractionOptions,
): Promise<TimelineEvent[]> {
  const extractor = createTimelineExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.events;
}
