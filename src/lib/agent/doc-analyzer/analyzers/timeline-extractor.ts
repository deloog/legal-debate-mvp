/**
 * TimelineExtractor - 时间线提取器
 *
 * 功能：
 * 1. 从文档中提取时间相关事件
 * 2. 按时间排序构建时间线
 * 3. 识别事件类型（立案、开庭、判决等）
 * 4. 分析时间间隔和周期
 */

import type {
  ExtractedData,
  TimelineEvent,
  TimelineReport,
} from '../core/types';

// =============================================================================
// TimelineExtractor类
// =============================================================================

export class TimelineExtractor {
  private readonly datePatterns: RegExp[];
  private readonly eventPatterns: Map<RegExp, string>;

  constructor() {
    this.datePatterns = this.initializeDatePatterns();
    this.eventPatterns = this.initializeEventPatterns();
  }

  /**
   * 从文档和时间线
   */
  extractTimeline(text: string, extractedData: ExtractedData): TimelineReport {
    // 1. 从文本中提取时间事件
    const textEvents = this.extractEventsFromText(text);

    // 2. 从提取的数据中构建事件
    const extractedEvents = this.buildEventsFromExtractedData(extractedData);

    // 3. 合并去重
    const allEvents = this.mergeEvents(textEvents, extractedEvents);

    // 4. 按时间排序
    const sortedEvents = this.sortEventsByDate(allEvents);

    // 5. 分析时间间隔
    const intervals = this.analyzeIntervals(sortedEvents);

    // 6. 将日期格式统一为ISO格式
    const formattedEvents = this.formatEventsDates(sortedEvents);

    return {
      events: formattedEvents,
      totalEvents: formattedEvents.length,
      dateRange: this.calculateDateRange(formattedEvents),
      averageInterval: this.calculateAverageInterval(intervals),
      intervals,
    };
  }

  /**
   * 将事件日期格式统一为ISO格式
   */
  private formatEventsDates(events: TimelineEvent[]): TimelineEvent[] {
    return events.map(event => ({
      ...event,
      date: this.formatDateToIso(event.date),
    }));
  }

  /**
   * 将日期格式化为ISO格式
   */
  private formatDateToIso(dateStr: string): string {
    // 如果已经是ISO格式，直接返回
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // 处理中文日期：2024年1月15日
    const chineseDateMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (chineseDateMatch) {
      const [, year, month, day] = chineseDateMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 处理点分隔日期：2024.1.15
    const dotDateMatch = dateStr.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (dotDateMatch) {
      const [, year, month, day] = dotDateMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 处理斜杠分隔日期：2024/1/15
    const slashDateMatch = dateStr.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (slashDateMatch) {
      const [, year, month, day] = slashDateMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 无法识别的格式，尝试使用Date解析
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }

    return dateStr;
  }

  /**
   * 从文本中提取事件
   */
  private extractEventsFromText(text: string): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    const lines = text.split('\n');
    let eventId = 1;

    for (const line of lines) {
      const dateMatch = this.findDateInLine(line);
      const eventType = this.detectEventType(line);

      if (dateMatch && eventType) {
        events.push({
          id: `event_${eventId++}`,
          date: this.formatDateToIso(dateMatch),
          event: line.trim(),
          description: line.trim(),
          type: eventType as 'OTHER',
          source: 'TEXT_EXTRACTION',
        });
      }
    }

    return events;
  }

  /**
   * 从提取的数据中构建事件
   */
  private buildEventsFromExtractedData(
    extractedData: ExtractedData
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];
    let eventId = 1;

    // 从诉讼请求中提取可能的日期信息
    for (const claim of extractedData.claims) {
      // 从诉讼请求内容中提取日期
      const dateMatch = this.findDateInLine(claim.content);
      if (dateMatch) {
        events.push({
          id: `event_${eventId++}`,
          date: this.formatDateToIso(dateMatch),
          event: '诉讼请求',
          description: claim.content,
          type: 'OTHER',
          source: 'inferred',
        });
      }
    }

    return events;
  }

  /**
   * 检测事件类型
   */
  private detectEventType(line: string): string {
    if (line.includes('立案') || line.includes('起诉')) {
      return 'FILING';
    }
    if (line.includes('开庭') || line.includes('庭审')) {
      return 'HEARING';
    }
    if (line.includes('判决') || line.includes('裁定')) {
      return 'JUDGMENT';
    }
    if (line.includes('证据') || line.includes('材料')) {
      return 'EVIDENCE';
    }
    if (line.includes('答辩') || line.includes('反驳')) {
      return 'DEFENSE';
    }

    return 'OTHER';
  }

  /**
   * 在行中查找日期
   */
  private findDateInLine(line: string): string | null {
    for (const pattern of this.datePatterns) {
      const match = line.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * 解析日期字符串为Date对象
   */
  private parseDate(dateStr: string): Date | null {
    const isoDate = this.formatDateToIso(dateStr);
    const parsed = new Date(isoDate);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * 合并事件并去重
   */
  private mergeEvents(
    textEvents: TimelineEvent[],
    extractedEvents: TimelineEvent[]
  ): TimelineEvent[] {
    const eventMap = new Map<string, TimelineEvent>();

    // 添加文本提取的事件
    for (const event of textEvents) {
      const key = `${event.date}-${event.type}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, event);
      }
    }

    // 添加提取数据的事件
    for (const event of extractedEvents) {
      const key = `${event.date}-${event.type}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, event);
      }
    }

    return Array.from(eventMap.values());
  }

  /**
   * 按日期排序事件
   */
  private sortEventsByDate(events: TimelineEvent[]): TimelineEvent[] {
    return [...events].sort((a, b) => {
      const dateA = this.parseDate(a.date);
      const dateB = this.parseDate(b.date);
      if (!dateA || !dateB) return 0;
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * 分析时间间隔
   */
  private analyzeIntervals(events: TimelineEvent[]): number[] {
    const intervals: number[] = [];

    for (let i = 1; i < events.length; i++) {
      const prevDate = this.parseDate(events[i - 1].date);
      const currDate = this.parseDate(events[i].date);

      if (prevDate && currDate) {
        const interval = currDate.getTime() - prevDate.getTime();
        // 转换为天数
        intervals.push(interval / (1000 * 60 * 60 * 24));
      }
    }

    return intervals;
  }

  /**
   * 计算平均间隔（天数）
   */
  private calculateAverageInterval(intervals: number[]): number {
    if (intervals.length === 0) return 0;

    const total = intervals.reduce((sum, interval) => sum + interval, 0);
    return Math.round((total / intervals.length) * 100) / 100;
  }

  /**
   * 计算日期范围
   */
  private calculateDateRange(events: TimelineEvent[]): {
    start: string | null;
    end: string | null;
    duration: number | null;
  } {
    if (events.length === 0) {
      return { start: null, end: null, duration: null };
    }

    const sorted = this.sortEventsByDate(events);
    const start = sorted[0].date;
    const end = sorted[sorted.length - 1].date;

    const startDate = this.parseDate(start);
    const endDate = this.parseDate(end);

    if (!startDate || !endDate) {
      return { start, end, duration: null };
    }

    const duration =
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    return {
      start,
      end,
      duration: Math.round(duration * 100) / 100,
    };
  }

  /**
   * 初始化日期模式
   */
  private initializeDatePatterns(): RegExp[] {
    return [
      // 标准日期格式：YYYY-MM-DD
      /\d{4}-\d{2}-\d{2}/g,
      // 中文日期格式：YYYY年MM月DD日
      /\d{4}年\d{1,2}月\d{1,2}日/g,
      // 中文日期格式：YYYY.MM.DD
      /\d{4}\.\d{1,2}\.\d{1,2}/g,
      // 短日期格式：YYYY/MM/DD
      /\d{4}\/\d{1,2}\/\d{1,2}/g,
      // 带中文的日期：2026年1月5日
      /\d{4}年\d{1,2}月\d{1,2}日/g,
    ];
  }

  /**
   * 初始化事件模式
   */
  private initializeEventPatterns(): Map<RegExp, string> {
    const patterns = new Map<RegExp, string>();

    patterns.set(/立案/g, 'FILING');
    patterns.set(/起诉/g, 'FILING');
    patterns.set(/开庭/g, 'HEARING');
    patterns.set(/庭审/g, 'HEARING');
    patterns.set(/判决/g, 'JUDGMENT');
    patterns.set(/裁定/g, 'JUDGMENT');
    patterns.set(/调解/g, 'MEDIATION');
    patterns.set(/送达/g, 'SERVICE');

    return patterns;
  }
}
