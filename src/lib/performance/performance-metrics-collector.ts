/**
 * 性能指标收集器
 * 收集和计算API性能指标（P50、P95、P99等）
 */

/**
 * 单次指标记录
 */
export interface MetricRecord {
  /** 响应时间（毫秒） */
  value: number;
  /** 记录时间戳 */
  timestamp: number;
  /** 是否成功 */
  success?: boolean;
}

/**
 * 百分位数结果
 */
export interface PercentileResult {
  /** 百分位数值 */
  value: number;
  /** 数据点数量 */
  count: number;
  /** 是否通过阈值 */
  passed: boolean;
  /** 实际值 */
  actual: number;
}

/**
 * 性能统计结果
 */
export interface PerformanceStats {
  /** 平均响应时间 */
  average: number;
  /** 最小响应时间 */
  min: number;
  /** 最大响应时间 */
  max: number;
  /** 数据点数量 */
  count: number;
  /** 成功率（0-1） */
  successRate: number;
  /** 错误率（0-1） */
  errorRate: number;
  /** 缓存命中率（0-1） */
  cacheHitRate: number;
}

/**
 * 阈值验证配置
 */
export interface ThresholdConfig {
  /** P50阈值（毫秒） */
  p50: number;
  /** P95阈值（毫秒） */
  p95: number;
  /** P99阈值（毫秒） */
  p99: number;
}

/**
 * 阈值验证结果
 */
export interface ThresholdValidation {
  /** P50验证 */
  p50: PercentileResult;
  /** P95验证 */
  p95: PercentileResult;
  /** P99验证 */
  p99: PercentileResult;
  /** 是否全部通过 */
  allPassed: boolean;
}

/**
 * 性能指标收集器
 */
export class PerformanceMetricsCollector {
  /** 按操作名称分组的指标 */
  private metrics: Map<string, MetricRecord[]> = new Map();

  /** 按操作名称分组的成功次数 */
  private successCounts: Map<string, number> = new Map();

  /** 按操作名称分组的失败次数 */
  private failureCounts: Map<string, number> = new Map();

  /** 按操作名称分组的缓存命中次数 */
  private cacheHitCounts: Map<string, number> = new Map();

  /** 按操作名称分组的缓存未命中次数 */
  private cacheMissCounts: Map<string, number> = new Map();

  /** 最大响应时间（毫秒） */
  private static readonly MAX_RESPONSE_TIME = 3600000; // 1小时

  /**
   * 记录指标
   * @param operationName 操作名称
   * @param value 响应时间（毫秒）
   */
  recordMetric(operationName: string, value: number): void {
    // 验证响应时间
    if (value < 0) {
      throw new Error('响应时间不能为负数');
    }

    if (value > PerformanceMetricsCollector.MAX_RESPONSE_TIME) {
      throw new Error(
        `响应时间不能超过1小时（${PerformanceMetricsCollector.MAX_RESPONSE_TIME}毫秒）`
      );
    }

    // 获取或创建指标数组
    let metrics = this.metrics.get(operationName);
    if (!metrics) {
      metrics = [];
      this.metrics.set(operationName, metrics);
    }

    // 记录指标
    metrics.push({
      value,
      timestamp: Date.now(),
    });

    // 限制数组大小（最多1000条）
    if (metrics.length > 1000) {
      metrics.shift();
    }
  }

  /**
   * 记录成功
   * @param operationName 操作名称
   */
  recordSuccess(operationName: string): void {
    const count = this.successCounts.get(operationName) || 0;
    this.successCounts.set(operationName, count + 1);
  }

  /**
   * 记录失败
   * @param operationName 操作名称
   */
  recordFailure(operationName: string): void {
    const count = this.failureCounts.get(operationName) || 0;
    this.failureCounts.set(operationName, count + 1);
  }

  /**
   * 记录缓存命中
   * @param operationName 操作名称
   */
  recordCacheHit(operationName: string): void {
    const count = this.cacheHitCounts.get(operationName) || 0;
    this.cacheHitCounts.set(operationName, count + 1);
  }

  /**
   * 记录缓存未命中
   * @param operationName 操作名称
   */
  recordCacheMiss(operationName: string): void {
    const count = this.cacheMissCounts.get(operationName) || 0;
    this.cacheMissCounts.set(operationName, count + 1);
  }

  /**
   * 获取指定操作的所有指标
   * @param operationName 操作名称
   * @returns 指标数组
   */
  getMetrics(operationName: string): MetricRecord[] {
    return this.metrics.get(operationName) || [];
  }

  /**
   * 获取统计信息
   * @param operationName 操作名称
   * @returns 统计信息
   */
  getStats(operationName: string): PerformanceStats {
    const metrics = this.metrics.get(operationName) || [];

    // 计算平均值
    let average = 0;
    let min = 0;
    let max = 0;

    if (metrics.length > 0) {
      const sum = metrics.reduce((acc, m) => acc + m.value, 0);
      average = sum / metrics.length;
      min = Math.min(...metrics.map(m => m.value));
      max = Math.max(...metrics.map(m => m.value));
    }

    // 计算成功率和错误率
    const successCount = this.successCounts.get(operationName) || 0;
    const failureCount = this.failureCounts.get(operationName) || 0;
    const totalCount = successCount + failureCount;

    let successRate = 0;
    let errorRate = 0;

    if (totalCount > 0) {
      successRate = successCount / totalCount;
      errorRate = failureCount / totalCount;
    }

    // 计算缓存命中率
    const cacheHit = this.cacheHitCounts.get(operationName) || 0;
    const cacheMiss = this.cacheMissCounts.get(operationName) || 0;
    const totalCacheHits = cacheHit + cacheMiss;

    let cacheHitRate = 0;

    if (totalCacheHits > 0) {
      cacheHitRate = cacheHit / totalCacheHits;
    }

    return {
      average,
      min,
      max,
      count: metrics.length,
      successRate,
      errorRate,
      cacheHitRate,
    };
  }

  /**
   * 获取百分位数
   * @param operationName 操作名称
   * @param percentile 百分位数（0-100）
   * @returns 百分位数结果
   */
  getPercentile(operationName: string, percentile: number): PercentileResult {
    // 验证百分位数
    if (percentile < 0 || percentile > 100) {
      throw new Error('百分位数必须在0-100之间');
    }

    const metrics = this.metrics.get(operationName) || [];

    // 排序
    const sorted = [...metrics].sort((a, b) => a.value - b.value);

    // 计算百分位数
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const value = sorted.length > 0 && index >= 0 ? sorted[index].value : 0;

    return {
      value,
      count: sorted.length,
      passed: false, // 默认值，需要调用 validateThresholds 来设置
      actual: value,
    };
  }

  /**
   * 验证阈值
   * @param operationName 操作名称
   * @param thresholds 阈值配置
   * @returns 验证结果
   */
  validateThresholds(
    operationName: string,
    thresholds: ThresholdConfig
  ): ThresholdValidation {
    const p50 = this.getPercentile(operationName, 50);
    const p95 = this.getPercentile(operationName, 95);
    const p99 = this.getPercentile(operationName, 99);

    // 设置是否通过
    p50.passed = p50.value <= thresholds.p50;
    p95.passed = p95.value <= thresholds.p95;
    p99.passed = p99.value <= thresholds.p99;

    const allPassed = p50.passed && p95.passed && p99.passed;

    return {
      p50,
      p95,
      p99,
      allPassed,
    };
  }

  /**
   * 获取报告
   * @returns 所有操作的统计报告
   */
  getReport(): Record<string, PerformanceStats> {
    const report: Record<string, PerformanceStats> = {};

    for (const operationName of this.metrics.keys()) {
      report[operationName] = this.getStats(operationName);
    }

    return report;
  }

  /**
   * 清空指定操作的指标
   * @param operationName 操作名称
   */
  clearMetrics(operationName: string): void {
    this.metrics.delete(operationName);
    this.successCounts.delete(operationName);
    this.failureCounts.delete(operationName);
    this.cacheHitCounts.delete(operationName);
    this.cacheMissCounts.delete(operationName);
  }

  /**
   * 清空所有指标
   */
  clearAll(): void {
    this.metrics.clear();
    this.successCounts.clear();
    this.failureCounts.clear();
    this.cacheHitCounts.clear();
    this.cacheMissCounts.clear();
  }
}
