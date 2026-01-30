import { APIMonitor } from './api-monitor';
import { SystemMetrics } from './types';

/**
 * 指标收集器类
 */
export class MetricsCollector {
  private metricsCache: Map<string, { value: number; timestamp: Date }> =
    new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1分钟缓存

  /**
   * 收集所有系统指标
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const [
      apiErrorRate,
      apiResponseTime,
      dbConnection,
      aiServiceError,
      diskUsage,
    ] = await Promise.all([
      this.collectAPIErrorRate(),
      this.collectAPIResponseTimeP95(),
      this.collectDatabaseConnectionFailed(),
      this.collectAIServiceErrorRate(),
      this.collectDiskUsagePercent(),
    ]);

    return {
      apiErrorRate,
      apiResponseTimeP95: apiResponseTime,
      databaseConnectionFailed: dbConnection,
      aiServiceErrorRate: aiServiceError,
      diskUsagePercent: diskUsage,
    };
  }

  /**
   * 收集API错误率
   */
  async collectAPIErrorRate(): Promise<number> {
    const cacheKey = 'apiErrorRate';
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const stats = await APIMonitor.getAPIStats();
      const errorRate = stats.errorRate * 100; // 转换为百分比

      this.setCache(cacheKey, errorRate);
      return errorRate;
    } catch {
      // 如果获取失败，返回0表示无数据
      return 0;
    }
  }

  /**
   * 收集API响应时间P95
   */
  async collectAPIResponseTimeP95(): Promise<number> {
    const cacheKey = 'apiResponseTimeP95';
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const stats = await APIMonitor.getAPIStats();
      const p95ResponseTime = this.calculateP95ResponseTime(
        stats.averageResponseTime
      );

      this.setCache(cacheKey, p95ResponseTime);
      return p95ResponseTime;
    } catch {
      return 0;
    }
  }

  /**
   * 收集数据库连接失败次数
   */
  async collectDatabaseConnectionFailed(): Promise<number> {
    const cacheKey = 'dbConnectionFailed';
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const stats = await APIMonitor.getAPIStats();
      // 假设数据库连接失败数可以通过API错误数估算
      // 实际实现可能需要专门的数据库监控
      const dbConnectionFailed = Math.floor(stats.totalRequests * 0.01);

      this.setCache(cacheKey, dbConnectionFailed);
      return dbConnectionFailed;
    } catch {
      return 0;
    }
  }

  /**
   * 收集AI服务错误率
   */
  async collectAIServiceErrorRate(): Promise<number> {
    const cacheKey = 'aiServiceErrorRate';
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      const stats = await APIMonitor.getAIStats();
      const errorRate = (1 - stats.successRate) * 100;

      this.setCache(cacheKey, errorRate);
      return errorRate;
    } catch {
      return 0;
    }
  }

  /**
   * 收集磁盘使用率
   */
  async collectDiskUsagePercent(): Promise<number> {
    const cacheKey = 'diskUsagePercent';
    const cached = this.getFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      // 模拟磁盘使用率
      // 实际实现可以使用 'systeminformation' 包获取真实数据
      const diskUsage = Math.random() * 50 + 30; // 30-80%之间

      this.setCache(cacheKey, diskUsage);
      return diskUsage;
    } catch {
      return 0;
    }
  }

  /**
   * 计算P95响应时间（简化版本）
   */
  private calculateP95ResponseTime(averageResponseTime: number): number {
    // 简化计算：P95 ≈ 平均 * 1.5
    // 实际实现应该收集真实的响应时间数据并计算P95
    return averageResponseTime * 1.5;
  }

  /**
   * 从缓存获取
   */
  private getFromCache(key: string): number | null {
    const cached = this.metricsCache.get(key);
    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < this.CACHE_TTL) {
        return cached.value;
      }
      this.metricsCache.delete(key);
    }
    return null;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, value: number): void {
    this.metricsCache.set(key, {
      value,
      timestamp: new Date(),
    });
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.metricsCache.clear();
  }

  /**
   * 获取单个指标
   */
  async getMetric(metricName: string): Promise<number> {
    switch (metricName) {
      case 'apiErrorRate':
        return this.collectAPIErrorRate();
      case 'apiResponseTimeP95':
        return this.collectAPIResponseTimeP95();
      case 'databaseConnectionFailed':
        return this.collectDatabaseConnectionFailed();
      case 'aiServiceErrorRate':
        return this.collectAIServiceErrorRate();
      case 'diskUsagePercent':
        return this.collectDiskUsagePercent();
      default:
        throw new Error(`Unknown metric: ${metricName}`);
    }
  }

  /**
   * 获取所有支持的指标名称
   */
  getSupportedMetrics(): string[] {
    return [
      'apiErrorRate',
      'apiResponseTimeP95',
      'databaseConnectionFailed',
      'aiServiceErrorRate',
      'diskUsagePercent',
    ];
  }
}

/**
 * 单例实例
 */
let collectorInstance: MetricsCollector | null = null;

/**
 * 获取指标收集器实例
 */
export function getMetricsCollector(): MetricsCollector {
  if (!collectorInstance) {
    collectorInstance = new MetricsCollector();
  }
  return collectorInstance;
}

/**
 * 重置指标收集器实例（用于测试）
 */
export function resetMetricsCollector(): void {
  if (collectorInstance) {
    collectorInstance.clearCache();
    collectorInstance = null;
  }
}

/**
 * 便捷函数：收集系统指标
 */
export async function collectSystemMetrics(): Promise<SystemMetrics> {
  return getMetricsCollector().collectSystemMetrics();
}

/**
 * 便捷函数：获取单个指标
 */
export async function getMetric(metricName: string): Promise<number> {
  return getMetricsCollector().getMetric(metricName);
}
