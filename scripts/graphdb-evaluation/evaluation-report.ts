/**
 * 图数据库评估报告生成器
 * 基于基准测试结果生成详细的评估报告
 */

import { BenchmarkResult } from './benchmark-runner';
import { DataScale } from './types';

/**
 * 评估配置
 */
export interface EvaluationConfig {
  databaseName: string;
  databaseVersion: string;
  hardwareInfo: {
    cpu: string;
    memory: string;
    disk: string;
  };
  datasetScale: DataScale;
  testDate: Date;
}

/**
 * 评估指标
 */
export interface EvaluationMetrics {
  // 时间性能
  avgQueryTime: number; // 平均查询时间
  minQueryTime: number; // 最小查询时间
  maxQueryTime: number; // 最大查询时间
  queryTimeStdDev: number; // 查询时间标准差

  // 吞吐量
  queriesPerSecond: number; // 每秒查询数
  totalQueries: number; // 总查询数

  // 稳定性
  successRate: number; // 成功率
  stabilityScore: number; // 稳定性评分（0-100）

  // 扩展性
  scalabilityScore: number; // 扩展性评分（0-100）

  // 综合评分
  overallScore: number; // 综合评分（0-100）
}

/**
 * 查询性能详情
 */
export interface QueryPerformance {
  queryName: string;
  queryType: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  stdDev: number;
  p50?: number;
  p95?: number;
  p99?: number;
  rank: number; // 性能排名（1最快）
}

/**
 * 评估报告
 */
export interface EvaluationReport {
  config: EvaluationConfig;
  metrics: EvaluationMetrics;
  queryPerformances: QueryPerformance[];
  recommendations: string[];
  timestamp: string;
}

/**
 * 评估报告生成器类
 */
export class EvaluationReportGenerator {
  /**
   * 生成评估报告
   */
  generateReport(
    results: BenchmarkResult[],
    config: EvaluationConfig
  ): EvaluationReport {
    const metrics = this.calculateMetrics(results);
    const queryPerformances = this.analyzeQueryPerformance(results);
    const recommendations = this.generateRecommendations(
      metrics,
      queryPerformances
    );

    return {
      config,
      metrics,
      queryPerformances,
      recommendations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 计算评估指标
   */
  private calculateMetrics(results: BenchmarkResult[]): EvaluationMetrics {
    if (results.length === 0) {
      return {
        avgQueryTime: 0,
        minQueryTime: 0,
        maxQueryTime: 0,
        queryTimeStdDev: 0,
        queriesPerSecond: 0,
        totalQueries: 0,
        successRate: 0,
        stabilityScore: 0,
        scalabilityScore: 0,
        overallScore: 0,
      };
    }

    // 收集所有查询时间
    const allTimes = results.flatMap(r => [
      r.meanTime,
      r.minTime,
      r.maxTime,
      r.medianTime,
    ]);

    const avgQueryTime = allTimes.reduce((a, b) => a + b, 0) / allTimes.length;
    const minQueryTime = Math.min(...allTimes);
    const maxQueryTime = Math.max(...allTimes);
    const queryTimeStdDev = this.calculateStdDev(allTimes, avgQueryTime);

    // 吞吐量计算
    const totalQueries = results.reduce((sum, r) => sum + r.totalRuns, 0);
    const totalTimeMs = results.reduce(
      (sum, r) => sum + r.meanTime * r.totalRuns,
      0
    );
    const queriesPerSecond =
      totalTimeMs > 0 ? (totalQueries / totalTimeMs) * 1000 : 0;

    // 成功率
    const totalSuccess = results.reduce((sum, r) => sum + r.successRuns, 0);
    const successRate =
      totalQueries > 0 ? (totalSuccess / totalQueries) * 100 : 0;

    // 稳定性评分（基于标准差）
    const stabilityScore = this.calculateStabilityScore(
      queryTimeStdDev,
      avgQueryTime
    );

    // 扩展性评分（基于查询类型多样性）
    const scalabilityScore = this.calculateScalabilityScore(results);

    // 综合评分
    const overallScore = this.calculateOverallScore(
      avgQueryTime,
      successRate,
      stabilityScore,
      scalabilityScore
    );

    return {
      avgQueryTime,
      minQueryTime,
      maxQueryTime,
      queryTimeStdDev,
      queriesPerSecond,
      totalQueries,
      successRate,
      stabilityScore,
      scalabilityScore,
      overallScore,
    };
  }

  /**
   * 分析查询性能
   */
  private analyzeQueryPerformance(
    results: BenchmarkResult[]
  ): QueryPerformance[] {
    const performances: QueryPerformance[] = results.map((r, index) => ({
      queryName: r.name,
      queryType: r.type,
      avgTime: r.meanTime,
      minTime: r.minTime,
      maxTime: r.maxTime,
      medianTime: r.medianTime,
      stdDev: r.stdDev,
      p50: r.p50,
      p95: r.p95,
      p99: r.p99,
      rank: 0, // 稍后计算
    }));

    // 按平均时间排名
    performances.sort((a, b) => a.avgTime - b.avgTime);
    performances.forEach((p, index) => {
      p.rank = index + 1;
    });

    return performances;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(
    metrics: EvaluationMetrics,
    performances: QueryPerformance[]
  ): string[] {
    const recommendations: string[] = [];

    // 基于性能指标的建议
    if (metrics.avgQueryTime > 100) {
      recommendations.push(
        `平均查询时间较长（${metrics.avgQueryTime.toFixed(2)}ms），建议优化查询语句或添加索引`
      );
    }

    if (metrics.queryTimeStdDev > metrics.avgQueryTime * 0.5) {
      recommendations.push(
        '查询时间波动较大，建议检查系统资源使用情况或优化查询缓存策略'
      );
    }

    if (metrics.successRate < 95) {
      recommendations.push(
        `查询成功率较低（${metrics.successRate.toFixed(1)}%），建议检查查询语句和数据库配置`
      );
    }

    if (metrics.stabilityScore < 70) {
      recommendations.push(
        `系统稳定性评分较低（${metrics.stabilityScore.toFixed(0)}/100），建议增加系统资源或优化数据库配置`
      );
    }

    // 基于特定查询的建议
    const slowQueries = performances.filter(p => p.avgTime > 100);
    if (slowQueries.length > 0) {
      recommendations.push(
        `以下查询性能较差，建议优先优化：${slowQueries.map(q => q.queryName).join(', ')}`
      );
    }

    const unstableQueries = performances.filter(
      p => p.stdDev > p.avgTime * 0.5
    );
    if (unstableQueries.length > 0) {
      recommendations.push(
        `以下查询时间波动较大，建议检查：${unstableQueries.map(q => q.queryName).join(', ')}`
      );
    }

    // 性能最佳实践建议
    if (recommendations.length === 0) {
      recommendations.push(
        '性能表现良好，建议继续监控并在数据量增长时重新评估'
      );
    }

    recommendations.push('建议定期运行基准测试以监控性能变化');
    recommendations.push('建议根据实际业务场景调整测试查询和数据规模');

    return recommendations;
  }

  /**
   * 计算标准差
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const squareDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquareDiff =
      squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * 计算稳定性评分
   */
  private calculateStabilityScore(stdDev: number, mean: number): number {
    if (mean === 0) return 100;
    const cv = (stdDev / mean) * 100; // 变异系数
    // 标准差越小，稳定性越高
    // 变异系数 < 10%: 90-100分
    // 变异系数 10-20%: 70-90分
    // 变异系数 20-30%: 50-70分
    // 变异系数 > 30%: 0-50分
    if (cv < 10) return 100 - cv;
    if (cv < 20) return 90 - (cv - 10) * 2;
    if (cv < 30) return 70 - (cv - 20) * 2;
    return Math.max(0, 50 - (cv - 30));
  }

  /**
   * 计算扩展性评分
   */
  private calculateScalabilityScore(results: BenchmarkResult[]): number {
    if (results.length === 0) return 0;

    // 基于查询类型多样性评分
    const queryTypes = new Set(results.map(r => r.type));
    const typeDiversityScore = Math.min(100, queryTypes.size * 12.5);

    // 基于结果规模多样性评分
    const resultSizes = results.map(r => r.avgResultCount);
    const sizeVariance = this.calculateStdDev(
      resultSizes,
      this.mean(resultSizes)
    );
    const sizeDiversityScore = Math.min(100, sizeVariance * 10);

    return (typeDiversityScore + sizeDiversityScore) / 2;
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    avgTime: number,
    successRate: number,
    stabilityScore: number,
    scalabilityScore: number
  ): number {
    // 时间性能权重：30%
    const timeScore = Math.max(0, 100 - avgTime * 0.5);

    // 成功率权重：30%
    const successScore = successRate;

    // 稳定性权重：25%
    const stabilityWeighted = stabilityScore * 0.25;

    // 扩展性权重：15%
    const scalabilityWeighted = scalabilityScore * 0.15;

    return (
      timeScore * 0.3 +
      successScore * 0.3 +
      stabilityWeighted +
      scalabilityWeighted
    );
  }

  /**
   * 计算平均值
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 生成Markdown报告
   */
  generateMarkdownReport(report: EvaluationReport): string {
    let markdown = `# 图数据库性能评估报告\n\n`;

    // 基本信息
    markdown += `## 评估信息\n\n`;
    markdown += `- **数据库名称**: ${report.config.databaseName}\n`;
    markdown += `- **数据库版本**: ${report.config.databaseVersion}\n`;
    markdown += `- **评估时间**: ${new Date(report.config.testDate).toLocaleString('zh-CN')}\n`;
    markdown += `- **报告生成时间**: ${new Date(report.timestamp).toLocaleString('zh-CN')}\n\n`;

    // 硬件信息
    markdown += `### 硬件配置\n\n`;
    markdown += `- **CPU**: ${report.config.hardwareInfo.cpu}\n`;
    markdown += `- **内存**: ${report.config.hardwareInfo.memory}\n`;
    markdown += `- **磁盘**: ${report.config.hardwareInfo.disk}\n\n`;

    // 数据集规模
    markdown += `### 数据集规模\n\n`;
    markdown += `- **法条数量**: ${report.config.datasetScale.articleCount}\n`;
    markdown += `- **关系数量**: ${report.config.datasetScale.relationCount}\n`;
    markdown += `- **平均每法条关系数**: ${report.config.datasetScale.avgRelationsPerArticle}\n`;
    markdown += `- **平均度数**: ${report.config.datasetScale.averageDegree}\n\n`;

    // 评估指标
    markdown += `## 评估指标\n\n`;
    markdown += `| 指标 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 平均查询时间 | ${report.metrics.avgQueryTime.toFixed(2)}ms |\n`;
    markdown += `| 最小查询时间 | ${report.metrics.minQueryTime.toFixed(2)}ms |\n`;
    markdown += `| 最大查询时间 | ${report.metrics.maxQueryTime.toFixed(2)}ms |\n`;
    markdown += `| 查询时间标准差 | ${report.metrics.queryTimeStdDev.toFixed(2)}ms |\n`;
    markdown += `| 每秒查询数 | ${report.metrics.queriesPerSecond.toFixed(2)} |\n`;
    markdown += `| 总查询数 | ${report.metrics.totalQueries} |\n`;
    markdown += `| 成功率 | ${report.metrics.successRate.toFixed(1)}% |\n`;
    markdown += `| 稳定性评分 | ${report.metrics.stabilityScore.toFixed(0)}/100 |\n`;
    markdown += `| 扩展性评分 | ${report.metrics.scalabilityScore.toFixed(0)}/100 |\n`;
    markdown += `| **综合评分** | **${report.metrics.overallScore.toFixed(0)}/100** |\n\n`;

    // 性能等级
    const grade = this.getPerformanceGrade(report.metrics.overallScore);
    markdown += `### 性能等级\n\n`;
    markdown += `**${grade}**\n\n`;

    // 查询性能详情
    markdown += `## 查询性能详情\n\n`;
    markdown += `| 排名 | 查询名称 | 类型 | 平均时间 | 最小时间 | 最大时间 | 标准差 |\n`;
    markdown += `|------|---------|------|---------|---------|---------|--------|\n`;

    for (const p of report.queryPerformances) {
      markdown += `| ${p.rank} | ${p.queryName} | ${p.queryType} | ${p.avgTime.toFixed(2)}ms | ${p.minTime.toFixed(2)}ms | ${p.maxTime.toFixed(2)}ms | ${p.stdDev.toFixed(2)}ms |\n`;
    }
    markdown += '\n';

    // 详细性能分析
    markdown += `### 性能分析\n\n`;
    for (const p of report.queryPerformances) {
      markdown += `#### ${p.queryName} (排名 #${p.rank})\n\n`;
      markdown += `- **查询类型**: ${p.queryType}\n`;
      markdown += `- **中位数时间**: ${p.medianTime.toFixed(2)}ms\n`;
      if (p.p50) {
        markdown += `- **P50**: ${p.p50.toFixed(2)}ms\n`;
        markdown += `- **P95**: ${p.p95?.toFixed(2)}ms\n`;
        markdown += `- **P99**: ${p.p99?.toFixed(2)}ms\n`;
      }
      markdown += '\n';
    }

    // 建议
    markdown += `## 优化建议\n\n`;
    for (let i = 0; i < report.recommendations.length; i++) {
      markdown += `${i + 1}. ${report.recommendations[i]}\n`;
    }
    markdown += '\n';

    return markdown;
  }

  /**
   * 生成JSON报告
   */
  generateJsonReport(report: EvaluationReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * 获取性能等级
   */
  private getPerformanceGrade(score: number): string {
    if (score >= 90) return '🥇 优秀 (A+)';
    if (score >= 80) return '🥈 良好 (A)';
    if (score >= 70) return '🥉 中等 (B)';
    if (score >= 60) return '及格 (C)';
    return '❌ 需要改进 (D)';
  }
}
