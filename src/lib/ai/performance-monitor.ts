/**
 * AI服务性能监控模块
 *
 * 提供详细的性能指标收集、分析和报告功能
 */

import * as crypto from 'crypto';
import { MONITORING, PERFORMANCE } from '../constants/common';
import { logger } from '@/lib/logger';

// =============================================================================
// 性能指标类型定义
// =============================================================================

export interface PerformanceMetric {
  timestamp: number;
  provider: string;
  model: string;
  operation: string;
  duration: number;
  success: boolean;
  tokenCount?: number;
  cached: boolean;
  errorType?: string;
  requestId?: string;
}

export interface PerformanceSummary {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  cacheHitRate: number;
  errorRate: number;
  tokenEfficiency: number;
  providerStats: Record<string, ProviderStats>;
  operationStats: Record<string, OperationStats>;
}

export interface ProviderStats {
  totalRequests: number;
  averageResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  errorDistribution: Record<string, number>;
}

export interface OperationStats {
  totalRequests: number;
  averageResponseTime: number;
  successRate: number;
  cacheHitRate: number;
}

export interface PerformanceAlert {
  type: 'response_time' | 'error_rate' | 'cache_hit_rate' | 'token_efficiency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  timestamp: number;
}

// =============================================================================
// 性能监控器
// =============================================================================

interface PendingRequest {
  provider: string;
  model: string;
  operation: string;
  startTime: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private maxMetrics: number = MONITORING.MAX_METRICS;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private alertThresholds = {
    responseTime: PERFORMANCE.RESPONSE_TIME_ERROR,
    errorRate: PERFORMANCE.ERROR_RATE_THRESHOLD,
    cacheHitRate: PERFORMANCE.CACHE_HIT_RATE_THRESHOLD,
    tokenEfficiency: PERFORMANCE.TOKEN_EFFICIENCY_THRESHOLD,
  };

  constructor(maxMetrics?: number) {
    if (maxMetrics) {
      this.maxMetrics = maxMetrics;
    }
  }

  // =============================================================================
  // 指标记录方法
  // =============================================================================

  /**
   * 记录性能指标
   */
  public recordMetric(metric: Omit<PerformanceMetric, 'requestId'>): string {
    const requestId = this.generateRequestId();
    const fullMetric: PerformanceMetric = {
      ...metric,
      requestId,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // 限制指标数量
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // 检查告警
    this.checkAlerts(fullMetric);

    logger.info(
      `📊 Performance: ${metric.provider}/${metric.model} - ${metric.operation}: ${metric.duration}ms (${metric.cached ? 'cached' : 'generated'})`
    );

    return requestId;
  }

  /**
   * 记录请求开始
   */
  public startRequest(
    provider: string,
    model: string,
    operation: string
  ): string {
    const requestId = this.generateRequestId();

    // 记录开始时间到临时存储
    this.pendingRequests.set(requestId, {
      provider,
      model,
      operation,
      startTime: Date.now(),
    });

    return requestId;
  }

  /**
   * 记录请求完成
   */
  public endRequest(
    requestId: string,
    success: boolean,
    tokenCount?: number,
    cached: boolean = false,
    errorType?: string
  ): void {
    const pending = this.pendingRequests.get(requestId);

    if (!pending) {
      logger.warn(`No pending request found for ID: ${requestId}`);
      return;
    }

    const duration = Date.now() - pending.startTime;

    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      provider: pending.provider,
      model: pending.model,
      operation: pending.operation,
      duration,
      success,
      tokenCount,
      cached,
      errorType,
      requestId,
    };

    this.metrics.push(metric);
    this.pendingRequests.delete(requestId);

    // 检查告警
    this.checkAlerts(metric);

    logger.info(
      `📊 Performance Complete: ${pending.provider}/${pending.model} - ${pending.operation}: ${duration}ms (${cached ? 'cached' : 'generated'})`
    );
  }

  // =============================================================================
  // 告警管理
  // =============================================================================

  /**
   * 更新告警阈值
   */
  public updateAlertThresholds(
    thresholds: Partial<typeof this.alertThresholds>
  ): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }

  /**
   * 检查告警条件
   */
  private checkAlerts(metric: PerformanceMetric): void {
    const alerts: PerformanceAlert[] = [];

    // 响应时间告警
    if (metric.duration > this.alertThresholds.responseTime) {
      alerts.push({
        type: 'response_time',
        severity:
          metric.duration > this.alertThresholds.responseTime * 2
            ? 'critical'
            : 'high',
        message: `响应时间过长: ${metric.duration}ms`,
        threshold: this.alertThresholds.responseTime,
        actualValue: metric.duration,
        timestamp: Date.now(),
      });
    }

    // 错误率告警
    if (!metric.success) {
      alerts.push({
        type: 'error_rate',
        severity: 'medium',
        message: `请求失败: ${metric.errorType || 'unknown'}`,
        threshold: 0,
        actualValue: 1,
        timestamp: Date.now(),
      });
    }

    this.alerts.push(...alerts);

    // 限制告警数量
    if (this.alerts.length > MONITORING.MAX_ALERTS) {
      this.alerts = this.alerts.slice(-MONITORING.MAX_ALERTS);
    }
  }

  // =============================================================================
  // 统计分析
  // =============================================================================

  /**
   * 获取性能摘要
   */
  public getSummary(timeWindow?: number): PerformanceSummary {
    const cutoffTime = timeWindow ? Date.now() - timeWindow : 0;
    const relevantMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    if (relevantMetrics.length === 0) {
      return this.getEmptySummary();
    }

    const successfulMetrics = relevantMetrics.filter(m => m.success);
    const failedMetrics = relevantMetrics.filter(m => !m.success);
    const durations = successfulMetrics.map(m => m.duration);

    // 基础统计
    const totalRequests = relevantMetrics.length;
    const successfulRequests = successfulMetrics.length;
    const failedRequests = failedMetrics.length;
    const successRate = (successfulRequests / totalRequests) * 100;
    const errorRate = (failedRequests / totalRequests) * 100;

    // 响应时间统计
    const averageResponseTime =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minResponseTime = Math.min(...durations);
    const maxResponseTime = Math.max(...durations);
    const sortedDurations = durations.sort((a, b) => a - b);
    const medianResponseTime =
      sortedDurations[Math.floor(sortedDurations.length / 2)];
    const p95ResponseTime =
      sortedDurations[Math.floor(sortedDurations.length * 0.95)];
    const p99ResponseTime =
      sortedDurations[Math.floor(sortedDurations.length * 0.99)];

    // 缓存统计
    const cachedRequests = relevantMetrics.filter(m => m.cached).length;
    const cacheHitRate = (cachedRequests / totalRequests) * 100;

    // Token效率统计
    const totalTokens = successfulMetrics.reduce(
      (sum, m) => sum + (m.tokenCount || 0),
      0
    );
    const totalTime = successfulMetrics.reduce((sum, m) => sum + m.duration, 0);
    const tokenEfficiency =
      totalTime > 0 ? totalTokens / (totalTime / 1000) : 0; // tokens/second

    // 提供商统计
    const providerStats = this.calculateProviderStats(relevantMetrics);

    // 操作统计
    const operationStats = this.calculateOperationStats(relevantMetrics);

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      successRate,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      medianResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      cacheHitRate,
      errorRate,
      tokenEfficiency,
      providerStats,
      operationStats,
    };
  }

  /**
   * 计算提供商统计
   */
  private calculateProviderStats(
    metrics: PerformanceMetric[]
  ): Record<string, ProviderStats> {
    const stats: Record<string, ProviderStats> = {};

    // 按提供商分组
    const grouped = metrics.reduce(
      (acc, metric) => {
        const key = metric.provider;
        if (!acc[key]) acc[key] = [];
        acc[key].push(metric);
        return acc;
      },
      {} as Record<string, PerformanceMetric[]>
    );

    // 计算每个提供商的统计
    Object.entries(grouped).forEach(([provider, providerMetrics]) => {
      const successful = providerMetrics.filter(m => m.success);
      const durations = successful.map(m => m.duration);
      const cached = providerMetrics.filter(m => m.cached).length;

      const errorDistribution = providerMetrics
        .filter(m => !m.success)
        .reduce(
          (acc, m) => {
            const errorType = m.errorType || 'unknown';
            acc[errorType] = (acc[errorType] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      stats[provider] = {
        totalRequests: providerMetrics.length,
        averageResponseTime:
          durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0,
        successRate: (successful.length / providerMetrics.length) * 100,
        cacheHitRate: (cached / providerMetrics.length) * 100,
        errorDistribution,
      };
    });

    return stats;
  }

  /**
   * 计算操作统计
   */
  private calculateOperationStats(
    metrics: PerformanceMetric[]
  ): Record<string, OperationStats> {
    const stats: Record<string, OperationStats> = {};

    // 按操作分组
    const grouped = metrics.reduce(
      (acc, metric) => {
        const key = metric.operation;
        if (!acc[key]) acc[key] = [];
        acc[key].push(metric);
        return acc;
      },
      {} as Record<string, PerformanceMetric[]>
    );

    // 计算每个操作的统计
    Object.entries(grouped).forEach(([operation, operationMetrics]) => {
      const successful = operationMetrics.filter(m => m.success);
      const durations = successful.map(m => m.duration);
      const cached = operationMetrics.filter(m => m.cached).length;

      stats[operation] = {
        totalRequests: operationMetrics.length,
        averageResponseTime:
          durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0,
        successRate: (successful.length / operationMetrics.length) * 100,
        cacheHitRate: (cached / operationMetrics.length) * 100,
      };
    });

    return stats;
  }

  /**
   * 获取空摘要
   */
  private getEmptySummary(): PerformanceSummary {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      minResponseTime: 0,
      maxResponseTime: 0,
      medianResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      tokenEfficiency: 0,
      providerStats: {},
      operationStats: {},
    };
  }

  // =============================================================================
  // 告警管理
  // =============================================================================

  /**
   * 获取活跃告警
   */
  public getActiveAlerts(timeWindow?: number): PerformanceAlert[] {
    const cutoffTime = timeWindow ? Date.now() - timeWindow : 0;
    return this.alerts.filter(alert => alert.timestamp > cutoffTime);
  }

  /**
   * 清除告警
   */
  public clearAlerts(): void {
    this.alerts = [];
  }

  // =============================================================================
  // 导出和报告
  // =============================================================================

  /**
   * 导出指标数据
   */
  public exportMetrics(timeWindow?: number): PerformanceMetric[] {
    const cutoffTime = timeWindow ? Date.now() - timeWindow : 0;
    return this.metrics.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * 生成性能报告
   */
  public generateReport(timeWindow?: number): string {
    const summary = this.getSummary(timeWindow);
    const activeAlerts = this.getActiveAlerts(timeWindow);

    const report = `
# AI服务性能报告

## 生成时间
${new Date().toISOString()}

## 时间窗口
${timeWindow ? `最近 ${(timeWindow / 60000).toFixed(1)} 分钟` : '全部时间'}

## 总体性能指标
- 总请求数: ${summary.totalRequests}
- 成功请求数: ${summary.successfulRequests}
- 失败请求数: ${summary.failedRequests}
- 成功率: ${summary.successRate.toFixed(2)}%
- 错误率: ${summary.errorRate.toFixed(2)}%

## 响应时间分析
- 平均响应时间: ${summary.averageResponseTime.toFixed(0)}ms (${(summary.averageResponseTime / 1000).toFixed(1)}秒)
- 最小响应时间: ${summary.minResponseTime}ms
- 最大响应时间: ${summary.maxResponseTime}ms
- 中位数响应时间: ${summary.medianResponseTime}ms
- P95响应时间: ${summary.p95ResponseTime}ms
- P99响应时间: ${summary.p99ResponseTime}ms

## 缓存性能
- 缓存命中率: ${summary.cacheHitRate.toFixed(2)}%
- Token效率: ${summary.tokenEfficiency.toFixed(1)} tokens/秒

## 提供商性能
${Object.entries(summary.providerStats)
  .map(
    ([provider, stats]) => `
### ${provider}
- 请求数: ${stats.totalRequests}
- 平均响应时间: ${stats.averageResponseTime.toFixed(0)}ms
- 成功率: ${stats.successRate.toFixed(2)}%
- 缓存命中率: ${stats.cacheHitRate.toFixed(2)}%
- 错误分布: ${Object.entries(stats.errorDistribution)
      .map(([error, count]) => `${error}(${count})`)
      .join(', ')}
`
  )
  .join('\n')}

## 操作性能
${Object.entries(summary.operationStats)
  .map(
    ([operation, stats]) => `
### ${operation}
- 请求数: ${stats.totalRequests}
- 平均响应时间: ${stats.averageResponseTime.toFixed(0)}ms
- 成功率: ${stats.successRate.toFixed(2)}%
- 缓存命中率: ${stats.cacheHitRate.toFixed(2)}%
`
  )
  .join('\n')}

## 活跃告警
${
  activeAlerts.length > 0
    ? activeAlerts
        .map(
          alert => `
### ${alert.type} - ${alert.severity}
- 消息: ${alert.message}
- 阈值: ${alert.threshold}
- 实际值: ${alert.actualValue}
- 时间: ${new Date(alert.timestamp).toISOString()}
`
        )
        .join('\n')
    : '无活跃告警'
}
`;

    return report;
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${crypto.randomBytes(8).toString('hex').substring(0, 8)}`;
  }

  /**
   * 清除旧指标
   */
  public clearOldMetrics(maxAge: number): void {
    const cutoffTime = Date.now() - maxAge;
    const originalLength = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
    const cleared = originalLength - this.metrics.length;

    if (cleared > 0) {
      logger.info(`Cleared ${cleared} old performance metrics`);
    }
  }

  /**
   * 重置所有数据
   */
  public reset(): void {
    this.metrics = [];
    this.alerts = [];
    this.pendingRequests.clear();
    logger.info('Performance monitor reset');
  }
}

// =============================================================================
// 单例工厂
// =============================================================================

let performanceMonitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(maxMetrics?: number): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor(maxMetrics);
  }
  return performanceMonitorInstance;
}

export function resetPerformanceMonitor(): void {
  if (performanceMonitorInstance) {
    performanceMonitorInstance.reset();
    performanceMonitorInstance = null;
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export default PerformanceMonitor;
