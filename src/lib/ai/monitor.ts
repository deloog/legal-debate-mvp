import { logger } from '@/lib/logger';
import type {
  AIProvider,
  MonitorConfig,
  PerformanceMetrics,
  MonitorEvent,
  MonitorEventType,
  HealthStatus,
  ServiceStatus,
  AIErrorType,
} from '../../types/ai-service';

// =============================================================================
// AI监控系统实现
// =============================================================================

export class AIMonitor {
  private config: MonitorConfig;
  private metrics: Map<string, PerformanceMetrics[]>;
  private events: MonitorEvent[];
  private healthStatus: Map<AIProvider, HealthStatus>;
  private startTime: number;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertThresholds: Map<string, number> = new Map();

  constructor(config: MonitorConfig) {
    this.config = config;
    this.metrics = new Map();
    this.events = [];
    this.healthStatus = new Map();
    this.startTime = Date.now();

    // 初始化告警阈值
    this.initializeAlertThresholds();

    // 启动监控
    if (config.enabled) {
      this.start();
    }
  }

  // =============================================================================
  // 初始化和配置
  // =============================================================================

  private initializeAlertThresholds(): void {
    if (this.config.alertThresholds) {
      this.alertThresholds.set(
        'responseTime',
        this.config.alertThresholds.responseTime
      );
      this.alertThresholds.set(
        'errorRate',
        this.config.alertThresholds.errorRate
      );
      this.alertThresholds.set(
        'rateLimitHits',
        this.config.alertThresholds.rateLimitHits
      );
      this.alertThresholds.set(
        'queueLength',
        this.config.alertThresholds.queueLength
      );
    }
  }

  public start(): void {
    // 测试环境不启动定时器，避免Jest异步清理错误
    if (process.env.NODE_ENV === 'test') {
      this.logEvent('monitor_start', undefined, undefined, {
        message: 'AI Monitor started (test mode - no interval)',
      });
      return;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);

    this.logEvent('monitor_start', undefined, undefined, {
      message: 'AI Monitor started',
    });
  }

  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    this.logEvent('monitor_stop', undefined, undefined, {
      message: 'AI Monitor stopped',
    });
  }

  public updateConfig(config: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.alertThresholds) {
      this.initializeAlertThresholds();
    }

    // 如果监控状态改变，重新启动
    if (config.enabled !== undefined) {
      if (config.enabled) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  // =============================================================================
  // 指标收集和记录
  // =============================================================================

  public recordRequest(provider: AIProvider, model: string): string {
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    this.logEvent('request_start', provider, model, {
      requestId,
      startTime,
    });

    return requestId;
  }

  public recordResponse(
    requestId: string,
    provider: AIProvider,
    model: string,
    success: boolean,
    responseTime: number,
    tokensUsed: number = 0,
    cacheHit: boolean = false,
    errorType?: string
  ): void {
    const metrics: PerformanceMetrics = {
      provider,
      model,
      timestamp: Date.now(),
      responseTime,
      tokensUsed,
      success,
      errorType: errorType as AIErrorType | undefined,
      cacheHit,
    };

    // 存储指标
    const key = `${provider}:${model}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricsList = this.metrics.get(key)!;
    metricsList.push(metrics);

    // 限制指标数量（保留最近1000条）
    if (metricsList.length > 1000) {
      metricsList.splice(0, metricsList.length - 1000);
    }

    // 更新健康状态
    this.updateHealthStatus(provider, success, responseTime, errorType);

    // 记录事件
    const eventType = success ? 'request_complete' : 'request_error';
    this.logEvent(eventType, provider, model, {
      requestId,
      responseTime,
      tokensUsed,
      cacheHit,
      errorType,
    });

    // 检查告警
    this.checkAlerts(provider);
  }

  public recordProviderSwitch(provider: AIProvider, reason: string): void {
    this.logEvent('provider_switch', provider, undefined, { reason });
  }

  public recordFallbackActivation(
    provider: AIProvider,
    strategy: string
  ): void {
    this.logEvent('fallback_activated', provider, undefined, { strategy });
  }

  public recordRateLimitHit(provider: AIProvider, resetTime?: number): void {
    this.logEvent('rate_limit_hit', provider, undefined, { resetTime });
  }

  public recordCacheHit(provider: AIProvider, key: string): void {
    this.logEvent('cache_hit', provider, undefined, { key });
  }

  public recordCacheMiss(provider: AIProvider, key: string): void {
    this.logEvent('cache_miss', provider, undefined, { key });
  }

  public recordHealthCheck(
    provider: AIProvider,
    healthy: boolean,
    responseTime: number
  ): void {
    this.logEvent('health_check', provider, undefined, {
      healthy,
      responseTime,
    });

    this.updateHealthStatus(provider, healthy, responseTime);
  }

  // =============================================================================
  // 健康状态管理
  // =============================================================================

  private updateHealthStatus(
    provider: AIProvider,
    success: boolean,
    responseTime: number,
    errorType?: string
  ): void {
    let health = this.healthStatus.get(provider);

    if (!health) {
      health = {
        provider,
        healthy: true,
        lastCheck: Date.now(),
        responseTime,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        uptime: Date.now(),
      };
      this.healthStatus.set(provider, health);
      return;
    }

    health.lastCheck = Date.now();
    health.responseTime = responseTime;

    if (success) {
      health.consecutiveSuccesses++;
      health.consecutiveFailures = 0;
    } else {
      health.consecutiveFailures++;
      health.consecutiveSuccesses = 0;
    }

    // 根据响应时间和错误率更新健康状态
    const isHealthy = this.evaluateHealth(
      provider,
      success,
      responseTime,
      errorType
    );

    if (health.healthy !== isHealthy) {
      health.healthy = isHealthy;
      this.logEvent('health_change', provider, undefined, {
        healthy: isHealthy,
        reason: isHealthy ? 'recovered' : 'degraded',
      });
    }
  }

  private evaluateHealth(
    provider: AIProvider,
    _success: boolean,
    responseTime: number,
    errorType?: string
  ): boolean {
    // 如果最近有连续失败，标记为不健康
    const health = this.healthStatus.get(provider);
    if (health && health.consecutiveFailures >= 3) {
      return false;
    }

    // 响应时间过长，标记为不健康
    const responseTimeThreshold =
      this.alertThresholds.get('responseTime') || 10000; // 10秒
    if (responseTime > responseTimeThreshold) {
      return false;
    }

    // 特定错误类型，标记为不健康
    const criticalErrors = [
      'authentication_error',
      'permission_error',
      'insufficient_quota',
    ];
    if (errorType && criticalErrors.includes(errorType)) {
      return false;
    }

    return true;
  }

  // =============================================================================
  // 告警系统
  // =============================================================================

  private checkAlerts(provider: AIProvider): void {
    const recentMetrics = this.getRecentMetrics(provider, 300000); // 最近5分钟

    if (recentMetrics.length === 0) return;

    // 检查响应时间告警
    const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
    const responseTimeThreshold = this.alertThresholds.get('responseTime');
    if (responseTimeThreshold && avgResponseTime > responseTimeThreshold) {
      this.triggerAlert('high_response_time', provider, {
        average: avgResponseTime,
        threshold: responseTimeThreshold,
      });
    }

    // 检查错误率告警
    const errorRate = this.calculateErrorRate(recentMetrics);
    const errorRateThreshold = this.alertThresholds.get('errorRate');
    if (errorRateThreshold && errorRate > errorRateThreshold) {
      this.triggerAlert('high_error_rate', provider, {
        errorRate,
        threshold: errorRateThreshold,
      });
    }

    // 检查速率限制告警
    const rateLimitHits = this.countRateLimitHits(provider, 300000);
    const rateLimitThreshold = this.alertThresholds.get('rateLimitHits');
    if (rateLimitThreshold && rateLimitHits > rateLimitThreshold) {
      this.triggerAlert('rate_limit_exceeded', provider, {
        count: rateLimitHits,
        threshold: rateLimitThreshold,
      });
    }
  }

  private triggerAlert(
    type: string,
    provider: AIProvider,
    data: Record<string, unknown>
  ): void {
    const alert = {
      type,
      provider,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(type),
    };

    // 记录告警事件
    this.logEvent('alert', provider, undefined, alert);

    // 根据严重程度输出不同级别的日志
    const message = `Alert [${type}] for provider ${provider}: ${JSON.stringify(data)}`;

    switch (alert.severity) {
      case 'critical':
        logger.error(`🚨 CRITICAL: ${message}`);
        break;
      case 'warning':
        logger.warn(`⚠️  WARNING: ${message}`);
        break;
      case 'info':
        logger.info(`ℹ️  INFO: ${message}`);
        break;
      default:
        logger.info(`📋 LOG: ${message}`);
    }
  }

  private getAlertSeverity(type: string): 'critical' | 'warning' | 'info' {
    const severityMap: Record<string, 'critical' | 'warning' | 'info'> = {
      high_response_time: 'warning',
      high_error_rate: 'critical',
      rate_limit_exceeded: 'warning',
      provider_down: 'critical',
      authentication_error: 'critical',
      insufficient_quota: 'critical',
    };

    return severityMap[type] || 'info';
  }

  // =============================================================================
  // 事件记录
  // =============================================================================

  private logEvent(
    type: MonitorEventType,
    provider?: AIProvider,
    model?: string,
    data?: Record<string, unknown>
  ): void {
    const event: MonitorEvent = {
      type,
      timestamp: Date.now(),
      provider,
      model,
      data: data || {},
    };

    this.events.push(event);

    // 限制事件数量（保留最近10000条）
    if (this.events.length > 10000) {
      this.events.splice(0, this.events.length - 10000);
    }

    // 根据日志级别输出
    if (this.config.enabled) {
      this.outputLog(event);
    }
  }

  private outputLog(event: MonitorEvent): void {
    const logLevel = this.config.logLevel || 'info';
    const message =
      `[${new Date(event.timestamp).toISOString()}] ${event.type.toUpperCase()}` +
      (event.provider ? ` [${event.provider}]` : '') +
      (event.model ? ` [${event.model}]` : '') +
      (event.data && Object.keys(event.data).length > 0
        ? ` ${JSON.stringify(event.data)}`
        : '');

    switch (logLevel) {
      case 'debug':
        logger.debug(message);
        break;
      case 'info':
        logger.info(message);
        break;
      case 'warn':
        logger.warn(message);
        break;
      case 'error':
        logger.error(message);
        break;
    }
  }

  // =============================================================================
  // 指标计算和统计
  // =============================================================================

  private collectMetrics(): void {
    // 定期收集和聚合指标
    const providers: AIProvider[] = [
      'zhipu',
      'deepseek',
      'openai',
      'anthropic',
    ];

    providers.forEach(provider => {
      const recentMetrics = this.getRecentMetrics(
        provider,
        this.config.metricsInterval
      );
      if (recentMetrics.length > 0) {
        const avgResponseTime =
          this.calculateAverageResponseTime(recentMetrics);
        const errorRate = this.calculateErrorRate(recentMetrics);
        const totalTokens = this.calculateTotalTokens(recentMetrics);

        this.logEvent('metrics_collected', provider, undefined, {
          interval: this.config.metricsInterval,
          requestCount: recentMetrics.length,
          avgResponseTime,
          errorRate,
          totalTokens,
        });
      }
    });

    // 清理过期数据
    this.cleanupExpiredData();
  }

  private cleanupExpiredData(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    const cutoffTime = Date.now() - maxAge;

    // 清理过期指标
    this.metrics.forEach((metricsList, key) => {
      const filteredMetrics = metricsList.filter(m => m.timestamp > cutoffTime);
      if (filteredMetrics.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filteredMetrics);
      }
    });

    // 清理过期事件
    this.events = this.events.filter(e => e.timestamp > cutoffTime);
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getRecentMetrics(
    provider: AIProvider,
    timeWindow: number
  ): PerformanceMetrics[] {
    const cutoffTime = Date.now() - timeWindow;
    const recentMetrics: PerformanceMetrics[] = [];

    this.metrics.forEach((metricsList, key) => {
      if (key.startsWith(`${provider}:`)) {
        const filtered = metricsList.filter(m => m.timestamp > cutoffTime);
        recentMetrics.push(...filtered);
      }
    });

    return recentMetrics;
  }

  private calculateAverageResponseTime(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const totalTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    return totalTime / metrics.length;
  }

  private calculateErrorRate(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;

    const errorCount = metrics.filter(m => !m.success).length;
    return (errorCount / metrics.length) * 100;
  }

  private calculateTotalTokens(metrics: PerformanceMetrics[]): number {
    return metrics.reduce((sum, m) => sum + m.tokensUsed, 0);
  }

  private countRateLimitHits(provider: AIProvider, timeWindow: number): number {
    const cutoffTime = Date.now() - timeWindow;
    return this.events.filter(
      e =>
        e.type === 'rate_limit_hit' &&
        e.provider === provider &&
        e.timestamp > cutoffTime
    ).length;
  }

  // =============================================================================
  // 状态查询方法
  // =============================================================================

  public getServiceStatus(): ServiceStatus {
    const totalRequests = Array.from(this.metrics.values()).reduce(
      (sum, metricsList) => sum + metricsList.length,
      0
    );

    const totalErrors = Array.from(this.metrics.values()).reduce(
      (sum, metricsList) => sum + metricsList.filter(m => !m.success).length,
      0
    );

    const providerStatus = {} as Record<AIProvider, HealthStatus>;
    this.healthStatus.forEach((health, provider) => {
      providerStatus[provider] = health;
    });

    const averageResponseTime = this.calculateAverageResponseTime(
      Array.from(this.metrics.values()).flat()
    );

    return {
      initialized: true,
      healthy: Object.values(providerStatus).some(h => h.healthy),
      totalRequests,
      totalErrors,
      averageResponseTime,
      uptime: Date.now() - this.startTime,
      providerStatus,
      lastUpdate: Date.now(),
    };
  }

  public getMetrics(
    provider?: AIProvider,
    model?: string,
    timeWindow?: number
  ): PerformanceMetrics[] {
    const metrics: PerformanceMetrics[] = [];

    this.metrics.forEach((metricsList, key) => {
      const [keyProvider, keyModel] = key.split(':');

      if (
        (!provider || keyProvider === provider) &&
        (!model || keyModel === model)
      ) {
        let filteredMetrics = metricsList;

        // 如果指定了时间窗口，过滤指标
        if (timeWindow) {
          const cutoffTime = Date.now() - timeWindow;
          filteredMetrics = metricsList.filter(m => m.timestamp > cutoffTime);
        }

        metrics.push(...filteredMetrics);
      }
    });

    return metrics;
  }

  public getEvents(
    eventType?: MonitorEventType,
    timeWindow?: number
  ): MonitorEvent[] {
    let events = this.events;

    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    if (timeWindow) {
      const cutoffTime = Date.now() - timeWindow;
      events = events.filter(e => e.timestamp > cutoffTime);
    }

    return events;
  }

  public getHealthStatus(
    provider?: AIProvider
  ): HealthStatus | Map<AIProvider, HealthStatus> {
    if (provider) {
      return (
        this.healthStatus.get(provider) || {
          provider,
          healthy: false,
          lastCheck: 0,
          responseTime: 0,
          consecutiveFailures: 0,
          consecutiveSuccesses: 0,
          uptime: 0,
        }
      );
    }

    return new Map(this.healthStatus);
  }

  // =============================================================================
  // 报告生成
  // =============================================================================

  public generateReport(timeWindow?: number): string {
    const metrics = this.getMetrics(undefined, undefined, timeWindow);
    const events = this.getEvents(undefined, timeWindow);
    const serviceStatus = this.getServiceStatus();

    const report = {
      timestamp: new Date().toISOString(),
      timeWindow: timeWindow || 'all',
      summary: {
        totalRequests: metrics.length,
        successfulRequests: metrics.filter(m => m.success).length,
        failedRequests: metrics.filter(m => !m.success).length,
        averageResponseTime: this.calculateAverageResponseTime(metrics),
        totalTokens: this.calculateTotalTokens(metrics),
        cacheHits: metrics.filter(m => m.cacheHit).length,
      },
      providerStats: this.getProviderReport(metrics),
      serviceStatus,
      recentEvents: events.slice(-10), // 最近10个事件
    };

    return JSON.stringify(report, null, 2);
  }

  private getProviderReport(
    metrics: PerformanceMetrics[]
  ): Record<string, unknown> {
    interface ProviderStat {
      requests: number;
      successful: number;
      failed: number;
      averageResponseTime: number;
      totalTokens: number;
      cacheHits: number;
      healthy: boolean;
      lastCheck: number;
    }

    const providerStats: Record<string, ProviderStat> = {};

    const providers = Array.from(new Set(metrics.map(m => m.provider)));

    providers.forEach(provider => {
      const providerMetrics = metrics.filter(m => m.provider === provider);
      const health = this.healthStatus.get(provider);

      providerStats[provider] = {
        requests: providerMetrics.length,
        successful: providerMetrics.filter(m => m.success).length,
        failed: providerMetrics.filter(m => !m.success).length,
        averageResponseTime: this.calculateAverageResponseTime(providerMetrics),
        totalTokens: this.calculateTotalTokens(providerMetrics),
        cacheHits: providerMetrics.filter(m => m.cacheHit).length,
        healthy: health?.healthy || false,
        lastCheck: health?.lastCheck || 0,
      };
    });

    return providerStats;
  }
}

// =============================================================================
// 监控器工厂
// =============================================================================

export class MonitorFactory {
  private static instances: Map<string, AIMonitor> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: MonitorConfig
  ): AIMonitor {
    let instance = this.instances.get(name);

    if (!instance) {
      const defaultConfig: MonitorConfig = {
        enabled: true,
        metricsInterval: 60000, // 1分钟
        logLevel: 'info',
        persistMetrics: true,
        alertThresholds: {
          responseTime: 5000, // 5秒
          errorRate: 10, // 10%
          rateLimitHits: 5, // 5次
          queueLength: 100, // 100个请求
        },
      };

      const finalConfig = { ...defaultConfig, ...config };
      instance = new AIMonitor(finalConfig);
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static createCustomInstance(
    name: string,
    config: MonitorConfig
  ): AIMonitor {
    const instance = new AIMonitor(config);
    this.instances.set(name, instance);
    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      instance.stop();
      return this.instances.delete(name);
    }
    return false;
  }

  public static getAllInstances(): Map<string, AIMonitor> {
    return new Map(this.instances);
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export default MonitorFactory;
