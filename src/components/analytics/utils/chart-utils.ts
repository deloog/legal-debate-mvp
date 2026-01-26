/**
 * 图表工具函数
 */

import type { PieChartData, LineChartDataPoint } from '@/types/chart';
import { CLIENT_ANALYTICS_COLORS } from '@/types/chart';

/**
 * 计算饼图的起始角度和结束角度
 */
export function calculatePieSliceAngles(
  index: number,
  total: number,
  data: PieChartData[]
): { startAngle: number; endAngle: number } {
  const previousValues = data
    .slice(0, index)
    .reduce((sum, item) => sum + item.value, 0);
  const startAngle = (previousValues / total) * 360 - 90;
  const endAngle = ((previousValues + data[index].value) / total) * 360 - 90;

  return { startAngle, endAngle };
}

/**
 * 计算饼图扇区的坐标
 */
export function calculatePieSliceCoordinates(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): { x1: number; y1: number; x2: number; y2: number; largeArc: number } {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const x1 = centerX + radius * Math.cos(startRad);
  const y1 = centerY + radius * Math.sin(startRad);
  const x2 = centerX + radius * Math.cos(endRad);
  const y2 = centerY + radius * Math.sin(endRad);

  const largeArc = endAngle - startAngle > 180 ? 1 : 0;

  return { x1, y1, x2, y2, largeArc };
}

/**
 * 计算柱状图的最大值
 */
export function calculateMaxValue(data: Array<{ value: number }>): number {
  if (data.length === 0) return 0;
  return Math.max(...data.map(item => item.value));
}

/**
 * 计算柱状图的Y轴刻度
 */
export function calculateYAxisTicks(
  maxValue: number,
  tickCount: number = 5
): number[] {
  const tickValue = Math.ceil(maxValue / tickCount);
  return Array.from({ length: tickCount + 1 }, (_, i) => i * tickValue);
}

/**
 * 计算折线图的数据范围
 */
export function calculateDataRange(data: LineChartDataPoint[]): {
  minValue: number;
  maxValue: number;
} {
  if (data.length === 0) {
    return { minValue: 0, maxValue: 100 };
  }

  const values = data.map(item => item.value);
  return {
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
  };
}

/**
 * 计算折线图的Y坐标
 */
export function calculateLinePointY(
  value: number,
  minValue: number,
  maxValue: number,
  height: number,
  padding: { top: number; bottom: number }
): number {
  const availableHeight = height - padding.top - padding.bottom;
  const valueRange = maxValue - minValue || 1;
  const normalizedValue = (value - minValue) / valueRange;
  return height - padding.bottom - normalizedValue * availableHeight;
}

/**
 * 计算折线图的X坐标
 */
export function calculateLinePointX(
  index: number,
  totalPoints: number,
  width: number,
  padding: { left: number; right: number }
): number {
  const availableWidth = width - padding.left - padding.right;
  const step =
    totalPoints > 1 ? availableWidth / (totalPoints - 1) : availableWidth / 2;
  return padding.left + index * step;
}

/**
 * 计算漏斗图的梯形坐标
 */
export function calculateFunnelCoordinates(
  index: number,
  total: number,
  width: number,
  height: number,
  padding: { top: number; bottom: number }
): { x1: number; y1: number; x2: number; y2: number } {
  const itemHeight = (height - padding.top - padding.bottom) / total;
  const shrinkFactor = 0.85;

  const currentWidth = width * Math.pow(shrinkFactor, index);
  const nextWidth = width * Math.pow(shrinkFactor, index + 1);

  const y1 = padding.top + index * itemHeight;
  const y2 = padding.top + (index + 1) * itemHeight;

  const x1 = (width - currentWidth) / 2;
  const x2 = (width - nextWidth) / 2;

  return { x1: x1 + nextWidth, y1, x2: x2 + nextWidth, y2 };
}

/**
 * 格式化数值为百分比
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 格式化数值为千分位分隔
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

/**
 * 格式化日期
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 格式化月份标签
 */
export function formatMonthLabel(monthString: string): string {
  const date = new Date(monthString);
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' });
}

/**
 * 计算数值总和
 */
export function calculateTotal(data: Array<{ value: number }>): number {
  return data.reduce((sum, item) => sum + item.value, 0);
}

/**
 * 计算百分比
 */
export function calculatePercentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

/**
 * 生成颜色数组
 */
export function generateColors(count: number): string[] {
  const baseColors = [
    CLIENT_ANALYTICS_COLORS.active,
    CLIENT_ANALYTICS_COLORS.inactive,
    CLIENT_ANALYTICS_COLORS.referral,
    CLIENT_ANALYTICS_COLORS.online,
    CLIENT_ANALYTICS_COLORS.event,
    CLIENT_ANALYTICS_COLORS.advertising,
  ];

  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }

  return colors;
}

/**
 * 获取客户状态颜色
 */
export function getClientStatusColor(status: string): string {
  const statusColorMap: Record<string, string> = {
    ACTIVE: CLIENT_ANALYTICS_COLORS.active,
    INACTIVE: CLIENT_ANALYTICS_COLORS.inactive,
    LOST: CLIENT_ANALYTICS_COLORS.lost,
    BLACKLISTED: CLIENT_ANALYTICS_COLORS.blacklisted,
  };
  return statusColorMap[status] || CLIENT_ANALYTICS_COLORS.inactive;
}

/**
 * 获取客户来源颜色
 */
export function getClientSourceColor(source: string): string {
  const sourceColorMap: Record<string, string> = {
    REFERRAL: CLIENT_ANALYTICS_COLORS.referral,
    ONLINE: CLIENT_ANALYTICS_COLORS.online,
    EVENT: CLIENT_ANALYTICS_COLORS.event,
    ADVERTISING: CLIENT_ANALYTICS_COLORS.advertising,
    OTHER: CLIENT_ANALYTICS_COLORS.other,
  };
  return sourceColorMap[source] || CLIENT_ANALYTICS_COLORS.other;
}

/**
 * 获取客户价值等级颜色
 */
export function getClientValueLevelColor(level: string): string {
  const valueColorMap: Record<string, string> = {
    HIGH: CLIENT_ANALYTICS_COLORS.highValue,
    MEDIUM: CLIENT_ANALYTICS_COLORS.mediumValue,
    LOW: CLIENT_ANALYTICS_COLORS.lowValue,
  };
  return valueColorMap[level] || CLIENT_ANALYTICS_COLORS.lowValue;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * 计算文本宽度（近似值）
 */
export function estimateTextWidth(text: string, fontSize: number = 12): number {
  return text.length * fontSize * 0.6;
}

/**
 * 判断是否显示标签
 */
export function shouldShowLabel(
  value: number,
  total: number,
  minPercentage: number = 5
): boolean {
  const percentage = calculatePercentage(value, total);
  return percentage >= minPercentage;
}

/**
 * 计算图表宽度
 */
export function calculateChartWidth(
  dataLength: number,
  baseWidth: number,
  maxWidth: number
): number {
  const calculatedWidth = Math.max(baseWidth, dataLength * 50);
  return Math.min(calculatedWidth, maxWidth);
}

/**
 * 计算图表高度
 */
export function calculateChartHeight(
  dataLength: number,
  baseHeight: number,
  maxHeight: number
): number {
  const calculatedHeight = Math.max(baseHeight, dataLength * 40);
  return Math.min(calculatedHeight, maxHeight);
}

/**
 * 计算柱状图的宽度
 */
export function calculateBarWidth(
  dataLength: number,
  chartWidth: number,
  padding: { left: number; right: number }
): number {
  const availableWidth = chartWidth - padding.left - padding.right;
  const barWidth = availableWidth / dataLength;
  return Math.max(barWidth, 10);
}

/**
 * 计算柱状图的X坐标
 */
export function calculateBarX(
  index: number,
  dataLength: number,
  chartWidth: number,
  padding: { left: number; right: number },
  barWidth: number
): number {
  const availableWidth = chartWidth - padding.left - padding.right;
  const totalBarWidth = availableWidth / dataLength;
  return padding.left + index * totalBarWidth + (totalBarWidth - barWidth) / 2;
}

/**
 * 计算柱状图的高度
 */
export function calculateBarHeight(
  value: number,
  minValue: number,
  maxValue: number,
  maxHeight: number
): number {
  const valueRange = maxValue - minValue || 1;
  const normalizedValue = (value - minValue) / valueRange;
  return normalizedValue * maxHeight;
}

/**
 * 计算柱状图的Y坐标
 */
export function calculateBarY(
  barHeight: number,
  chartHeight: number,
  padding: { top: number; bottom: number }
): number {
  return chartHeight - padding.bottom - barHeight;
}
