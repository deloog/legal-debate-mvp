/**
 * 数据质量监控模块
 * 综合监控准确性、覆盖率、时效性等指标，生成综合报告
 */

import { logger } from '@/lib/logger';
import { calculateAccuracyMetrics } from './accuracy-monitor';
import { calculateCoverageMetrics } from './coverage-monitor';
import { calculateTimelinessMetrics } from './timeliness-monitor';
import {
  DataQualityReport,
  DataQualityIssue,
  QualityLevel,
  QualityMonitorConfig,
  DEFAULT_QUALITY_MONITOR_CONFIG,
  AccuracyMetrics,
  CoverageMetrics,
  TimelinessMetrics,
} from './types';

// =============================================================================
// 数据质量监控类
// =============================================================================

export class DataQualityMonitor {
  /**
   * 生成数据质量报告
   * @param config 监控配置
   * @returns 数据质量报告
   */
  async generateReport(
    config: Partial<QualityMonitorConfig> = {}
  ): Promise<DataQualityReport> {
    return generateDataQualityReport(config);
  }
}

// =============================================================================
// 综合监控函数
// =============================================================================

/**
 * 生成数据质量报告
 * @param config 监控配置
 * @returns 数据质量报告
 */
export async function generateDataQualityReport(
  config: Partial<QualityMonitorConfig> = {}
): Promise<DataQualityReport> {
  try {
    // 合并配置
    const finalConfig = {
      ...DEFAULT_QUALITY_MONITOR_CONFIG,
      ...config,
    };

    // 计算各项指标
    const accuracy = await calculateAccuracyMetrics({});
    const coverage = await calculateCoverageMetrics({});
    const timeliness = await calculateTimelinessMetrics({});

    // 计算总体评分
    const overallScore = calculateOverallScore(accuracy, coverage, timeliness);

    // 确定质量等级
    const qualityLevel = determineQualityLevel(overallScore);

    // 识别质量问题
    const issues = identifyQualityIssues(
      accuracy,
      coverage,
      timeliness,
      finalConfig
    );

    const report: DataQualityReport = {
      reportTime: new Date(),
      accuracy,
      coverage,
      timeliness,
      overallScore,
      qualityLevel,
      issues,
    };

    logger.info('数据质量报告生成完成', {
      overallScore,
      qualityLevel,
      issuesCount: issues.length,
    });

    return report;
  } catch (error) {
    logger.error('生成数据质量报告失败', { error });
    throw new Error('生成数据质量报告失败');
  }
}

/**
 * 计算总体评分
 * @param accuracy 准确性指标
 * @param coverage 覆盖率指标
 * @param timeliness 时效性指标
 * @returns 总体评分 (0-100)
 */
export function calculateOverallScore(
  accuracy: AccuracyMetrics,
  coverage: CoverageMetrics,
  timeliness: TimelinessMetrics
): number {
  try {
    // 准确性评分 (权重 40%)
    const accuracyScore = calculateAccuracyScore(accuracy);

    // 覆盖率评分 (权重 35%)
    const coverageScore = calculateCoverageScore(coverage);

    // 时效性评分 (权重 25%)
    const timelinessScore = calculateTimelinessScore(timeliness);

    // 计算加权总分
    const overallScore =
      accuracyScore * 0.4 + coverageScore * 0.35 + timelinessScore * 0.25;

    return Math.round(overallScore);
  } catch (error) {
    logger.error('计算总体评分失败', { error });
    return 0;
  }
}

/**
 * 计算准确性评分
 * @param accuracy 准确性指标
 * @returns 准确性评分 (0-100)
 */
function calculateAccuracyScore(accuracy: AccuracyMetrics): number {
  try {
    if (accuracy.totalRelations === 0) {
      return 50; // 无数据时给中等分数
    }

    // 验证率评分 (权重 50%)
    const verificationScore = accuracy.verificationRate * 100;

    // 正面反馈率评分 (权重 50%)
    const feedbackScore =
      accuracy.userFeedbackCount > 0 ? accuracy.positiveFeedbackRate * 100 : 80; // 无反馈时给较高分数

    return verificationScore * 0.5 + feedbackScore * 0.5;
  } catch (error) {
    logger.error('计算准确性评分失败', { error });
    return 0;
  }
}

/**
 * 计算覆盖率评分
 * @param coverage 覆盖率指标
 * @returns 覆盖率评分 (0-100)
 */
function calculateCoverageScore(coverage: CoverageMetrics): number {
  try {
    if (coverage.totalArticles === 0) {
      return 50; // 无法计算
    }

    // 覆盖率评分 (权重 60%)
    const coverageScore = coverage.coverageRate * 100;

    // 孤立法条占比评分 (权重 40%)
    const orphanScore = Math.max(
      0,
      100 - (coverage.orphanArticles / coverage.totalArticles) * 100
    );

    return coverageScore * 0.6 + orphanScore * 0.4;
  } catch (error) {
    logger.error('计算覆盖率评分失败', { error });
    return 0;
  }
}

/**
 * 计算时效性评分
 * @param timeliness 时效性指标
 * @returns 时效性评分 (0-100)
 */
function calculateTimelinessScore(timeliness: TimelinessMetrics): number {
  try {
    if (timeliness.totalRelations === 0) {
      return 50;
    }

    // 待审核率评分 (权重 40%) - 待审核越少越好
    const pendingScore = (1 - timeliness.pendingRate) * 100;

    // 过期关系率评分 (权重 30%) - 过期关系越少越好
    const staleScore = (1 - timeliness.staleRate) * 100;

    // 失效关系率评分 (权重 30%) - 失效关系越少越好
    const expiredScore = (1 - timeliness.expiredRate) * 100;

    return pendingScore * 0.4 + staleScore * 0.3 + expiredScore * 0.3;
  } catch (error) {
    logger.error('计算时效性评分失败', { error });
    return 0;
  }
}

/**
 * 确定质量等级
 * @param score 总体评分
 * @returns 质量等级
 */
export function determineQualityLevel(score: number): QualityLevel {
  if (score >= 80) {
    return 'EXCELLENT';
  } else if (score >= 60) {
    return 'GOOD';
  } else if (score >= 50) {
    return 'FAIR';
  } else {
    return 'POOR';
  }
}

/**
 * 识别质量问题
 * @param accuracy 准确性指标
 * @param coverage 覆盖率指标
 * @param timeliness 时效性指标
 * @param config 监控配置
 * @returns 问题列表
 */
export function identifyQualityIssues(
  accuracy: AccuracyMetrics,
  coverage: CoverageMetrics,
  timeliness: TimelinessMetrics,
  config: QualityMonitorConfig
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // 识别准确性问题
  const accuracyIssues = identifyAccuracyIssues(accuracy, config);
  issues.push(...accuracyIssues);

  // 识别覆盖率问题
  const coverageIssues = identifyCoverageIssues(coverage, config);
  issues.push(...coverageIssues);

  // 识别时效性问题
  const timelinessIssues = identifyTimelinessIssues(timeliness, config);
  issues.push(...timelinessIssues);

  return issues;
}

/**
 * 识别准确性问题
 * @param accuracy 准确性指标
 * @param config 监控配置
 * @returns 问题列表
 */
function identifyAccuracyIssues(
  accuracy: AccuracyMetrics,
  config: QualityMonitorConfig
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // 验证率过低
  if (accuracy.verificationRate < 0.5) {
    issues.push({
      type: 'ACCURACY',
      severity: 'HIGH',
      description: '验证率过低，关系质量无法保证',
      affectedCount: accuracy.totalRelations,
      recommendation: '增加人工审核资源，提高关系验证率',
    });
  } else if (accuracy.verificationRate < 0.7) {
    issues.push({
      type: 'ACCURACY',
      severity: 'MEDIUM',
      description: '验证率偏低，需要关注',
      affectedCount: accuracy.totalRelations,
      recommendation: '持续提升关系验证率',
    });
  }

  // 正面反馈率过低
  if (
    accuracy.userFeedbackCount >= config.accuracy.minFeedbackCount &&
    accuracy.positiveFeedbackRate < config.accuracy.lowQualityThreshold
  ) {
    issues.push({
      type: 'ACCURACY',
      severity: 'HIGH',
      description: '用户正面反馈率过低，关系准确性存在问题',
      affectedCount: accuracy.userFeedbackCount,
      recommendation: '检查低质量关系，优化关系发现算法，提高准确性',
    });
  }

  return issues;
}

/**
 * 识别覆盖率问题
 * @param coverage 覆盖率指标
 * @param config 监控配置
 * @returns 问题列表
 */
function identifyCoverageIssues(
  coverage: CoverageMetrics,
  config: QualityMonitorConfig
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // 覆盖率过低
  if (coverage.coverageRate < config.coverage.minCoverageRate * 0.5) {
    issues.push({
      type: 'COVERAGE',
      severity: 'HIGH',
      description: `覆盖率过低 (${(coverage.coverageRate * 100).toFixed(1)}%)`,
      affectedCount: coverage.totalArticles,
      recommendation: '补充法条关系，提高知识图谱覆盖率',
    });
  } else if (coverage.coverageRate < config.coverage.minCoverageRate) {
    issues.push({
      type: 'COVERAGE',
      severity: 'MEDIUM',
      description: `覆盖率未达标 (${(coverage.coverageRate * 100).toFixed(1)}%)`,
      affectedCount: coverage.totalArticles,
      recommendation: '继续补充法条关系',
    });
  }

  // 孤立法条过多
  if (coverage.orphanArticles > config.coverage.maxOrphanArticles * 2) {
    issues.push({
      type: 'COVERAGE',
      severity: 'HIGH',
      description: `孤立法条数量过多 (${coverage.orphanArticles}个)`,
      affectedCount: coverage.orphanArticles,
      recommendation: '重点补充孤立法条的关系，完善知识图谱结构',
    });
  } else if (coverage.orphanArticles > config.coverage.maxOrphanArticles) {
    issues.push({
      type: 'COVERAGE',
      severity: 'MEDIUM',
      description: `孤立法条数量较多 (${coverage.orphanArticles}个)`,
      affectedCount: coverage.orphanArticles,
      recommendation: '逐步补充孤立法条的关系',
    });
  }

  return issues;
}

/**
 * 识别时效性问题
 * @param timeliness 时效性指标
 * @param config 监控配置
 * @returns 问题列表
 */
function identifyTimelinessIssues(
  timeliness: TimelinessMetrics,
  config: QualityMonitorConfig
): DataQualityIssue[] {
  const issues: DataQualityIssue[] = [];

  // 过期关系过多
  const staleThreshold = config.timeliness.staleThresholdDays;
  if (timeliness.staleRate > 0.2) {
    issues.push({
      type: 'TIMELINESS',
      severity: 'HIGH',
      description: `过期关系比例过高 (${(timeliness.staleRate * 100).toFixed(1)}%)`,
      affectedCount: timeliness.staleRelations,
      recommendation: `及时处理超过${staleThreshold}天的待审核关系`,
    });
  } else if (timeliness.staleRate > 0.1) {
    issues.push({
      type: 'TIMELINESS',
      severity: 'MEDIUM',
      description: `存在较多过期关系 (${timeliness.staleRelations}个)`,
      affectedCount: timeliness.staleRelations,
      recommendation: `定期清理超过${staleThreshold}天的待审核关系`,
    });
  }

  // 失效关系过多
  if (timeliness.expiredRelations > 0) {
    issues.push({
      type: 'TIMELINESS',
      severity: 'MEDIUM',
      description: `存在失效关系 (${timeliness.expiredRelations}个)`,
      affectedCount: timeliness.expiredRelations,
      recommendation: '及时处理涉及失效法条的关系',
    });
  }

  return issues;
}
