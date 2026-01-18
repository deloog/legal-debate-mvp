/**
 * Prometheus指标收集模块
 * 提供Prometheus兼容的指标收集功能
 */

import {
  Logger,
  LoggerConfig,
  LogLevel,
  LogFormat,
  LogOutput,
} from '../../../config/winston.config';

/**
 * Prometheus指标类型
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

/**
 * Prometheus指标接口
 */
export interface PrometheusMetric {
  name: string;
  type: MetricType;
  help: string;
  labels: Record<string, string>;
  value: number;
  timestamp?: number;
}

/**
 * Prometheus指标收集器接口
 */
export interface MetricCollector {
  name: string;
  type: MetricType;
  help: string;
  labels: string[];
  collect(): number;
}

/**
 * Prometheus配置接口
 */
export interface PrometheusMonitorConfig {
  enabled: boolean;
  prefix: string;
  labels: Record<string, string>;
  collectInterval: number;
}

/**
 * Prometheus监控类
 */
export class PrometheusMonitor {
  private collectors: Map<string, MetricCollector> = new Map();
  private metrics: PrometheusMetric[] = [];
  private config: PrometheusMonitorConfig;
  private logger: Logger;
  private collectTimer: NodeJS.Timeout | null = null;

  private readonly MAX_METRICS_STORED = 10000;

  constructor(config?: Partial<PrometheusMonitorConfig>) {
    this.config = {
      enabled: true,
      prefix: 'legal_debate_',
      labels: {
        service: 'legal-debate',
        environment: process.env.NODE_ENV || 'development',
      },
      collectInterval: 60000, // 1分钟
      ...config,
    };

    const loggerConfig: LoggerConfig = {
      level: LogLevel.INFO,
      format: LogFormat.JSON,
      output: LogOutput.CONSOLE,
      console: {
        enabled: true,
        colorize: true,
        timestamp: false,
      },
      file: {
        enabled: false,
        directory: './logs',
        filename: 'prometheus.log',
        maxSize: 1048576,
        maxFiles: 5,
        compress: true,
      },
      environment: process.env.NODE_ENV || 'development',
      isProduction: process.env.NODE_ENV === 'production',
      sanitize: {
        enabled: false,
        sensitiveKeys: [],
      },
      performance: {
        async: false,
        bufferSize: 100,
        flushInterval: 5000,
      },
    };

    this.logger = new Logger(loggerConfig);
  }

  /**
   * 注册指标收集器
   */
  registerCollector(collector: MetricCollector): void {
    const fullName = `${this.config.prefix}${collector.name}`;
    this.collectors.set(fullName, collector);
    this.logger.info(`Registered collector: ${fullName}`);
  }

  /**
   * 取消注册指标收集器
   */
  unregisterCollector(name: string): void {
    const fullName = `${this.config.prefix}${name}`;
    this.collectors.delete(fullName);
    this.logger.info(`Unregistered collector: ${fullName}`);
  }

  /**
   * 增加计数器指标
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels: Record<string, string> = {}
  ): void {
    if (!this.config.enabled) return;

    const fullName = `${this.config.prefix}${name}`;
    const metric: PrometheusMetric = {
      name: fullName,
      type: MetricType.COUNTER,
      help: `Counter metric: ${name}`,
      labels: { ...this.config.labels, ...labels },
      value,
      timestamp: Date.now(),
    };

    this.addMetric(metric);
  }

  /**
   * 设置仪表盘指标
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    if (!this.config.enabled) return;

    const fullName = `${this.config.prefix}${name}`;
    const metric: PrometheusMetric = {
      name: fullName,
      type: MetricType.GAUGE,
      help: `Gauge metric: ${name}`,
      labels: { ...this.config.labels, ...labels },
      value,
      timestamp: Date.now(),
    };

    this.addMetric(metric);
  }

  /**
   * 记录直方图指标
   */
  recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    if (!this.config.enabled) return;

    const fullName = `${this.config.prefix}${name}`;
    const metric: PrometheusMetric = {
      name: fullName,
      type: MetricType.HISTOGRAM,
      help: `Histogram metric: ${name}`,
      labels: { ...this.config.labels, ...labels },
      value,
      timestamp: Date.now(),
    };

    this.addMetric(metric);
  }

  /**
   * 记录摘要指标
   */
  recordSummary(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    if (!this.config.enabled) return;

    const fullName = `${this.config.prefix}${name}`;
    const metric: PrometheusMetric = {
      name: fullName,
      type: MetricType.SUMMARY,
      help: `Summary metric: ${name}`,
      labels: { ...this.config.labels, ...labels },
      value,
      timestamp: Date.now(),
    };

    this.addMetric(metric);
  }

  /**
   * 添加指标
   */
  private addMetric(metric: PrometheusMetric): void {
    this.metrics.push(metric);

    // 限制存储的指标数量
    if (this.metrics.length > this.MAX_METRICS_STORED) {
      this.metrics.shift();
    }
  }

  /**
   * 收集所有指标
   */
  collectMetrics(): void {
    for (const [name, collector] of Array.from(this.collectors.entries())) {
      try {
        const value = collector.collect();
        const metric: PrometheusMetric = {
          name,
          type: collector.type,
          help: collector.help,
          labels: { ...this.config.labels },
          value,
          timestamp: Date.now(),
        };

        this.addMetric(metric);
      } catch (error) {
        this.logger.error(
          `Failed to collect metric ${name}`,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  /**
   * 获取Prometheus格式的指标数据
   */
  getPrometheusMetrics(): string {
    const output: string[] = [];

    // 按类型分组指标
    const metricsByType = new Map<MetricType, PrometheusMetric[]>();
    for (const metric of this.metrics) {
      const typeMetrics = metricsByType.get(metric.type) || [];
      typeMetrics.push(metric);
      metricsByType.set(metric.type, typeMetrics);
    }

    // 生成指标数据
    for (const [type, typeMetrics] of Array.from(metricsByType.entries())) {
      output.push(`# TYPE ${type.toLowerCase()} ${type.toLowerCase()}`);

      for (const metric of typeMetrics) {
        const labelString = this.formatLabels(metric.labels);
        output.push(
          `${metric.name}${labelString} ${metric.value} ${
            metric.timestamp || Date.now()
          }`
        );
      }
    }

    return output.join('\n');
  }

  /**
   * 格式化标签
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) {
      return '';
    }

    const labelPairs = entries
      .map(([key, value]) => `${key}="${this.escapeLabelValue(value)}"`)
      .join(',');

    return `{${labelPairs}}`;
  }

  /**
   * 转义标签值
   */
  private escapeLabelValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n');
  }

  /**
   * 获取所有指标
   */
  getAllMetrics(): PrometheusMetric[] {
    return [...this.metrics];
  }

  /**
   * 获取指定名称的指标
   */
  getMetricsByName(name: string): PrometheusMetric[] {
    const fullName = `${this.config.prefix}${name}`;
    return this.metrics.filter(m => m.name === fullName);
  }

  /**
   * 获取指定类型的指标
   */
  getMetricsByType(type: MetricType): PrometheusMetric[] {
    return this.metrics.filter(m => m.type === type);
  }

  /**
   * 清除所有指标
   */
  clearMetrics(): void {
    this.metrics = [];
    this.logger.info('Cleared all metrics');
  }

  /**
   * 启动定时收集
   */
  startCollecting(): void {
    if (this.collectTimer !== null) {
      this.logger.warn('Collection timer is already running');
      return;
    }

    this.collectTimer = setInterval(() => {
      this.collectMetrics();
    }, this.config.collectInterval);

    this.logger.info(
      `Started collecting metrics every ${this.config.collectInterval}ms`
    );
  }

  /**
   * 停止定时收集
   */
  stopCollecting(): void {
    if (this.collectTimer === null) {
      this.logger.warn('Collection timer is not running');
      return;
    }

    clearInterval(this.collectTimer);
    this.collectTimer = null;
    this.logger.info('Stopped collecting metrics');
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PrometheusMonitorConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Updated Prometheus monitor config', {
      enabled: this.config.enabled,
      prefix: this.config.prefix,
      collectInterval: this.config.collectInterval,
    } as never);
  }

  /**
   * 获取配置
   */
  getConfig(): PrometheusMonitorConfig {
    return { ...this.config };
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalCollectors: number;
    totalMetrics: number;
    metricsByType: Record<MetricType, number>;
  } {
    const metricsByType: Record<MetricType, number> = {
      [MetricType.COUNTER]: 0,
      [MetricType.GAUGE]: 0,
      [MetricType.HISTOGRAM]: 0,
      [MetricType.SUMMARY]: 0,
    };

    for (const metric of this.metrics) {
      metricsByType[metric.type]++;
    }

    return {
      totalCollectors: this.collectors.size,
      totalMetrics: this.metrics.length,
      metricsByType,
    };
  }

  /**
   * 销毁监控器
   */
  destroy(): void {
    this.stopCollecting();
    this.clearMetrics();
    this.collectors.clear();
    this.logger.info('Destroyed Prometheus monitor');
  }
}

// =============================================================================
// 单例模式
// =============================================================================

let monitorInstance: PrometheusMonitor | null = null;

/**
 * 获取Prometheus监控实例
 */
export function getPrometheusMonitor(): PrometheusMonitor {
  if (!monitorInstance) {
    monitorInstance = new PrometheusMonitor();
  }
  return monitorInstance;
}

/**
 * 重置Prometheus监控实例（用于测试）
 */
export function resetPrometheusMonitor(): void {
  if (monitorInstance) {
    monitorInstance.destroy();
    monitorInstance = null;
  }
}

// =============================================================================
// 便捷函数
// =============================================================================

/**
 * 增加计数器
 */
export function incrementCounter(
  name: string,
  value?: number,
  labels?: Record<string, string>
): void {
  getPrometheusMonitor().incrementCounter(name, value, labels);
}

/**
 * 设置仪表盘
 */
export function setGauge(
  name: string,
  value: number,
  labels?: Record<string, string>
): void {
  getPrometheusMonitor().setGauge(name, value, labels);
}

/**
 * 记录直方图
 */
export function recordHistogram(
  name: string,
  value: number,
  labels?: Record<string, string>
): void {
  getPrometheusMonitor().recordHistogram(name, value, labels);
}

/**
 * 记录摘要
 */
export function recordSummary(
  name: string,
  value: number,
  labels?: Record<string, string>
): void {
  getPrometheusMonitor().recordSummary(name, value, labels);
}
