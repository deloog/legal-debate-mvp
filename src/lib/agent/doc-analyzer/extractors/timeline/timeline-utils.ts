/**
 * 时间线工具函数
 * 日期解析、标准化和推断工具
 */

import type { TimelineEventType } from '../../core/types';

/**
 * 解析日期字符串为Date对象
 */
export function parseDate(dateStr: string): Date | null {
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
        requiresDay: false as boolean,
      },
      {
        pattern: /(\d{4})年/,
        groupMap: { year: 1, month: null, day: null },
        requiresDay: false,
        requiresMonth: false,
      },
    ];

    for (const format of formats) {
      const { pattern, groupMap } = format;
      const match = dateStr.match(pattern);
      if (match) {
        const year = parseInt(match[groupMap.year]);
        let month: number = 1;
        let day: number = 1;

        if (groupMap.month) {
          month = parseInt(match[groupMap.month]);
        }

        if (groupMap.day) {
          day = parseInt(match[groupMap.day]);
        }

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
 * 标准化日期为ISO格式
 * 使用本地日期格式化，避免时区转换导致日期偏移
 */
export function normalizeDate(dateStr: string): string {
  const parsed = parseDate(dateStr);
  if (parsed && !isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

/**
 * 推断最早日期
 */
export function inferEarliestDate(earliestDate?: string): string {
  if (!earliestDate) {
    const now = new Date();
    const threeMonthsAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 3,
      now.getDate()
    );
    return threeMonthsAgo.toISOString().split('T')[0];
  }

  return earliestDate;
}

/**
 * 推断两个日期之间的时间
 */
export function inferDateBetween(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) {
    return startDate || endDate || '';
  }

  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (start && end) {
    const midTime = new Date((start.getTime() + end.getTime()) / 2);
    return midTime.toISOString().split('T')[0];
  }

  return startDate || endDate || '';
}

/**
 * 推断最早日期之后的时间
 */
export function inferDateAfter(startDate?: string): string {
  if (!startDate) return '';

  const start = parseDate(startDate);
  if (start) {
    const oneMonthLater = new Date(
      start.getFullYear(),
      start.getMonth() + 1,
      start.getDate()
    );
    return oneMonthLater.toISOString().split('T')[0];
  }

  return '';
}

/**
 * 获取日期模式列表
 */
export function getDatePatterns(): RegExp[] {
  return [
    /(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?/g,
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g,
    /(\d{4})年(\d{1,2})月(\d{1,2})日?/g,
    /(\d{1,2})月(\d{1,2})日/g,
    /(\d{4})年(\d{1,2})月/g,
    /(\d{4})年/g,
    /(\d{4})[.](\d{1,2})[.](\d{1,2})/g,
  ];
}

/**
 * 获取事件类型模式映射
 */
export function getEventTypePatterns(): Map<TimelineEventType, RegExp[]> {
  const patterns = new Map<TimelineEventType, RegExp[]>();

  patterns.set('CONTRACT_SIGNED', [/签订|签署|订立|达成|协议|合同/gi]);
  patterns.set('PERFORMANCE_START', [/开始.*履行|履行.*义务|执行.*合同/gi]);
  patterns.set('BREACH_OCCURRED', [/违约|未履行|逾期|停止.*履行|拒绝.*履行/gi]);
  patterns.set('DEMAND_SENT', [/催告|发函|通知|要求.*支付|要求.*履行/gi]);
  patterns.set('LAWSUIT_FILED', [
    /起诉|提起.*诉讼|向法院.*起诉|申请.*仲裁|提起诉讼|起诉至法院|诉至法院/gi,
  ]);

  return patterns;
}
