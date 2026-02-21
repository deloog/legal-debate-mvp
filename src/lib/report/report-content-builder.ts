/**
 * 报告内容构建器
 * 构建报告的结构化内容
 */

import type { ReportContent, ReportGenerationConfig } from '@/types/stats';

/**
 * 构建报告内容
 */
export function buildReportContent(
  data: ReportContent,
  _config: ReportGenerationConfig
): ReportContent {
  // 如果没有摘要，生成摘要
  if (!data.summary || data.summary.keyMetrics.length === 0) {
    data.summary = generateSummary(data);
  }

  return data;
}

/**
 * 生成报告摘要
 */
function generateSummary(data: ReportContent): ReportContent['summary'] {
  const keyMetrics: Array<{
    label: string;
    value: number;
    change: number;
    unit: string;
  }> = [];

  const highlights: string[] = [];
  const issues: string[] = [];
  const recommendations: string[] = [];

  // 用户统计关键指标
  if (data.userStats?.summary) {
    keyMetrics.push({
      label: '新增用户',
      value: data.userStats.summary.newUsers,
      change: data.userStats.summary.growthRate,
      unit: '人',
    });

    if (data.userStats.summary.growthRate > 10) {
      highlights.push(
        `用户增长率为${data.userStats.summary.growthRate}%，超过10%目标`
      );
    } else if (data.userStats.summary.growthRate < 0) {
      issues.push('用户出现负增长，需要关注');
    }
  }

  // 案件统计关键指标
  if (data.caseStats?.summary) {
    keyMetrics.push({
      label: '新增案件',
      value: data.caseStats.summary.totalCases,
      change: 0,
      unit: '件',
    });

    if (data.caseStats.summary.averageCompletionTime > 24) {
      issues.push(
        `平均案件处理时间超过24小时，为${data.caseStats.summary.averageCompletionTime.toFixed(2)}小时`
      );
      recommendations.push('优化案件处理流程，减少处理时间');
    }
  }

  // 辩论统计关键指标
  if (data.debateStats?.summary) {
    keyMetrics.push({
      label: '生成辩论',
      value: data.debateStats.summary.totalDebates,
      change: 0,
      unit: '次',
    });

    if (data.debateStats.summary.averageQualityScore < 0.8) {
      issues.push(
        `辩论质量评分低于0.8，为${data.debateStats.summary.averageQualityScore.toFixed(2)}`
      );
      recommendations.push('优化AI参数配置，提升辩论生成质量');
    } else {
      highlights.push(
        `辩论质量评分为${data.debateStats.summary.averageQualityScore.toFixed(2)}，达到目标`
      );
    }
  }

  // 性能统计关键指标
  if (data.performanceStats?.summary) {
    keyMetrics.push({
      label: '系统错误率',
      value: data.performanceStats.summary.errorRate,
      change: 0,
      unit: '%',
    });

    if (data.performanceStats.summary.errorRate > 5) {
      issues.push(
        `系统错误率超过5%，为${data.performanceStats.summary.errorRate.toFixed(2)}%`
      );
      recommendations.push('检查系统日志，排查错误原因');
    }

    if (data.performanceStats.summary.p95ResponseTime > 2000) {
      issues.push(
        `P95响应时间超过2秒，为${data.performanceStats.summary.p95ResponseTime.toFixed(2)}ms`
      );
      recommendations.push('优化系统性能，减少响应时间');
    }
  }

  // 生成通用建议
  if (keyMetrics.length > 0) {
    highlights.push('报告生成成功，数据收集完整');
  }

  return {
    keyMetrics,
    highlights,
    issues,
    recommendations,
  };
}

/**
 * 格式化数字
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toFixed(decimals);
}

/**
 * 格式化百分比
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 格式化日期
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 格式化时间
 */
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
