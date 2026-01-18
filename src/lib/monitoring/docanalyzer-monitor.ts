/**
 * DocAnalyzer监控模块
 * 提供质量评分趋势分析、异常告警等功能
 */

export interface QualityMetrics {
  timestamp: number;
  documentId?: string;
  documentType?: string;
  qualityScore: number;
  processingTime: number;
  reviewerCounts: {
    partiesExtracted: number;
    claimsExtracted: number;
    amountsExtracted: number;
  };
  validationResults: {
    isValid: boolean;
    issues: string[];
  };
}

export interface TrendAnalysis {
  period: 'hour' | 'day' | 'week';
  averageQualityScore: number;
  averageProcessingTime: number;
  qualityTrend: 'improving' | 'stable' | 'declining';
  successRate: number;
  issueDistribution: { [key: string]: number };
}

export interface AlertConfig {
  minQualityScore: number;
  maxProcessingTime: number;
  enableAlerts: boolean;
  alertChannels: ('console' | 'log' | 'external')[];
}

export interface Alert {
  timestamp: number;
  level: 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
}

/**
 * DocAnalyzer监控类
 */
export class DocAnalyzerMonitor {
  private metrics: QualityMetrics[] = [];
  private alerts: Alert[] = [];
  private config: AlertConfig = {
    minQualityScore: 0.7,
    maxProcessingTime: 100,
    enableAlerts: true,
    alertChannels: ['console'],
  };

  private readonly MAX_METRICS_STORED = 1000;

  /**
   * 记录质量指标
   */
  recordMetric(metric: QualityMetrics): void {
    this.metrics.push(metric);

    // 限制存储的指标数量
    if (this.metrics.length > this.MAX_METRICS_STORED) {
      this.metrics.shift();
    }

    // 检查是否需要触发告警
    if (this.config.enableAlerts) {
      this.checkAlerts(metric);
    }
  }

  /**
   * 获取质量评分趋势
   */
  getQualityTrend(period: 'hour' | 'day' | 'week' = 'day'): TrendAnalysis {
    const now = Date.now();
    const periodStart = this.getPeriodStart(now, period);

    const periodMetrics = this.metrics.filter(m => m.timestamp >= periodStart);

    if (periodMetrics.length === 0) {
      return {
        period,
        averageQualityScore: 0,
        averageProcessingTime: 0,
        qualityTrend: 'stable',
        successRate: 0,
        issueDistribution: {},
      };
    }

    const averageQualityScore = this.calculateAverage(
      periodMetrics.map(m => m.qualityScore)
    );
    const averageProcessingTime = this.calculateAverage(
      periodMetrics.map(m => m.processingTime)
    );
    const successRate =
      periodMetrics.filter(m => m.validationResults.isValid).length /
      periodMetrics.length;

    const issueDistribution = this.analyzeIssueDistribution(periodMetrics);
    const qualityTrend = this.calculateQualityTrend(periodMetrics);

    return {
      period,
      averageQualityScore,
      averageProcessingTime,
      qualityTrend,
      successRate,
      issueDistribution,
    };
  }

  /**
   * 获取最近N条指标
   */
  getRecentMetrics(count: number = 10): QualityMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * 获取所有告警
   */
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  /**
   * 清除告警
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * 更新告警配置
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取告警配置
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }

  /**
   * 生成监控报告
   */
  generateReport(): string {
    const recentTrend = this.getQualityTrend('day');
    const recentMetrics = this.getRecentMetrics(10);
    const recentAlerts = this.getAlerts().slice(-5);

    let report = 'DocAnalyzer监控报告\n';
    report += '================\n\n';

    report += '质量趋势（24小时）\n';
    report += '----------------\n';
    report += `平均质量评分: ${(recentTrend.averageQualityScore * 100).toFixed(1)}%\n`;
    report += `平均处理时间: ${recentTrend.averageProcessingTime.toFixed(2)}ms\n`;
    report += `成功率: ${(recentTrend.successRate * 100).toFixed(1)}%\n`;
    report += `趋势: ${this.formatTrend(recentTrend.qualityTrend)}\n\n`;

    if (Object.keys(recentTrend.issueDistribution).length > 0) {
      report += '问题分布\n';
      report += '----------------\n';
      const sortedIssues = Object.entries(recentTrend.issueDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      for (const [issue, count] of sortedIssues) {
        report += `  ${issue}: ${count}次\n`;
      }
      report += '\n';
    }

    if (recentAlerts.length > 0) {
      report += '最近告警\n';
      report += '----------------\n';
      for (const alert of recentAlerts) {
        report += `[${alert.level.toUpperCase()}] ${new Date(alert.timestamp).toLocaleTimeString()} ${alert.message}\n`;
      }
      report += '\n';
    }

    report += '最近处理记录\n';
    report += '----------------\n';
    for (const metric of recentMetrics) {
      report += `[${new Date(metric.timestamp).toLocaleTimeString()}] 质量评分: ${(metric.qualityScore * 100).toFixed(1)}%, 耗时: ${metric.processingTime}ms\n`;
    }

    return report;
  }

  /**
   * 获取周期开始时间
   */
  private getPeriodStart(now: number, period: 'hour' | 'day' | 'week'): number {
    switch (period) {
      case 'hour':
        return now - 60 * 60 * 1000;
      case 'day':
        return now - 24 * 60 * 60 * 1000;
      case 'week':
        return now - 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * 分析问题分布
   */
  private analyzeIssueDistribution(metrics: QualityMetrics[]): {
    [key: string]: number;
  } {
    const distribution: { [key: string]: number } = {};

    for (const metric of metrics) {
      for (const issue of metric.validationResults.issues) {
        distribution[issue] = (distribution[issue] || 0) + 1;
      }
    }

    return distribution;
  }

  /**
   * 计算质量趋势
   */
  private calculateQualityTrend(
    metrics: QualityMetrics[]
  ): 'improving' | 'stable' | 'declining' {
    if (metrics.length < 2) return 'stable';

    const half = Math.floor(metrics.length / 2);
    const firstHalf = metrics.slice(0, half);
    const secondHalf = metrics.slice(half);

    const firstAvg = this.calculateAverage(firstHalf.map(m => m.qualityScore));
    const secondAvg = this.calculateAverage(
      secondHalf.map(m => m.qualityScore)
    );

    const diff = secondAvg - firstAvg;

    if (diff > 0.05) return 'improving';
    if (diff < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(metric: QualityMetrics): void {
    // 质量评分过低
    if (metric.qualityScore < this.config.minQualityScore) {
      this.createAlert(
        'warning',
        `质量评分过低: ${(metric.qualityScore * 100).toFixed(1)}%`,
        {
          metric,
          threshold: this.config.minQualityScore,
        }
      );
    }

    // 处理时间过长
    if (metric.processingTime > this.config.maxProcessingTime) {
      this.createAlert('warning', `处理时间过长: ${metric.processingTime}ms`, {
        metric,
        threshold: this.config.maxProcessingTime,
      });
    }

    // 验证失败
    if (
      !metric.validationResults.isValid &&
      metric.validationResults.issues.length > 0
    ) {
      this.createAlert(
        'error',
        `验证失败: ${metric.validationResults.issues.join(', ')}`,
        {
          metric,
        }
      );
    }
  }

  /**
   * 创建告警
   */
  private createAlert(
    level: 'warning' | 'error' | 'critical',
    message: string,
    details?: Record<string, unknown>
  ): void {
    const alert: Alert = {
      timestamp: Date.now(),
      level,
      message,
      details,
    };

    this.alerts.push(alert);

    // 发送到配置的告警渠道
    for (const channel of this.config.alertChannels) {
      this.sendAlert(channel, alert);
    }
  }

  /**
   * 发送告警到指定渠道
   */
  private sendAlert(
    channel: 'console' | 'log' | 'external',
    alert: Alert
  ): void {
    switch (channel) {
      case 'console':
        console.warn(
          `[DocAnalyzer Alert] [${alert.level.toUpperCase()}] ${alert.message}`,
          alert.details || ''
        );
        break;
      case 'log':
        // 实际项目中可以写入日志文件
        break;
      case 'external':
        // 实际项目中可以发送到外部监控系统（如Sentry、DataDog等）
        break;
    }
  }

  /**
   * 格式化趋势
   */
  private formatTrend(trend: 'improving' | 'stable' | 'declining'): string {
    switch (trend) {
      case 'improving':
        return '📈 提升';
      case 'declining':
        return '📉 下降';
      case 'stable':
        return '➡️ 稳定';
    }
  }

  /**
   * 重置监控数据
   */
  reset(): void {
    this.metrics = [];
    this.alerts = [];
  }

  /**
   * 获取监控统计信息
   */
  getStats(): {
    totalMetrics: number;
    totalAlerts: number;
    averageQualityScore: number;
    averageProcessingTime: number;
  } {
    return {
      totalMetrics: this.metrics.length,
      totalAlerts: this.alerts.length,
      averageQualityScore: this.calculateAverage(
        this.metrics.map(m => m.qualityScore)
      ),
      averageProcessingTime: this.calculateAverage(
        this.metrics.map(m => m.processingTime)
      ),
    };
  }
}

// =============================================================================
// 单例模式
// =============================================================================

let monitorInstance: DocAnalyzerMonitor | null = null;

export function getDocAnalyzerMonitor(): DocAnalyzerMonitor {
  if (!monitorInstance) {
    monitorInstance = new DocAnalyzerMonitor();
  }
  return monitorInstance;
}

/**
 * 便捷函数：记录质量指标
 */
export function recordDocAnalyzerMetric(metric: QualityMetrics): void {
  getDocAnalyzerMonitor().recordMetric(metric);
}

/**
 * 便捷函数：获取质量趋势
 */
export function getDocAnalyzerTrend(
  period?: 'hour' | 'day' | 'week'
): TrendAnalysis {
  return getDocAnalyzerMonitor().getQualityTrend(period);
}

/**
 * 便捷函数：生成监控报告
 */
export function generateDocAnalyzerReport(): string {
  return getDocAnalyzerMonitor().generateReport();
}

/**
 * 重置单例实例（主要用于测试）
 */
export function resetDocAnalyzerMonitor(): void {
  monitorInstance = null;
}
