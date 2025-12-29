"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorFactory = exports.AIMonitor = void 0;
// =============================================================================
// AI监控系统实现
// =============================================================================
class AIMonitor {
  constructor(config) {
    this.metricsInterval = null;
    this.alertThresholds = new Map();
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
  initializeAlertThresholds() {
    if (this.config.alertThresholds) {
      this.alertThresholds.set(
        "responseTime",
        this.config.alertThresholds.responseTime,
      );
      this.alertThresholds.set(
        "errorRate",
        this.config.alertThresholds.errorRate,
      );
      this.alertThresholds.set(
        "rateLimitHits",
        this.config.alertThresholds.rateLimitHits,
      );
      this.alertThresholds.set(
        "queueLength",
        this.config.alertThresholds.queueLength,
      );
    }
  }
  start() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.metricsInterval);
    this.logEvent("monitor_start", undefined, undefined, {
      message: "AI Monitor started",
    });
  }
  stop() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    this.logEvent("monitor_stop", undefined, undefined, {
      message: "AI Monitor stopped",
    });
  }
  updateConfig(config) {
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
  recordRequest(provider, model) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    this.logEvent("request_start", provider, model, {
      requestId,
      startTime,
    });
    return requestId;
  }
  recordResponse(
    requestId,
    provider,
    model,
    success,
    responseTime,
    tokensUsed = 0,
    cacheHit = false,
    errorType,
  ) {
    const metrics = {
      provider,
      model,
      timestamp: Date.now(),
      responseTime,
      tokensUsed,
      success,
      errorType: errorType,
      cacheHit,
    };
    // 存储指标
    const key = `${provider}:${model}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    const metricsList = this.metrics.get(key);
    metricsList.push(metrics);
    // 限制指标数量（保留最近1000条）
    if (metricsList.length > 1000) {
      metricsList.splice(0, metricsList.length - 1000);
    }
    // 更新健康状态
    this.updateHealthStatus(provider, success, responseTime, errorType);
    // 记录事件
    const eventType = success ? "request_complete" : "request_error";
    this.logEvent(eventType, provider, model, {
      requestId,
      responseTime,
      tokensUsed,
      cacheHit,
      errorType,
    });
    // 检查告警
    this.checkAlerts(provider, metrics);
  }
  recordProviderSwitch(provider, reason) {
    this.logEvent("provider_switch", provider, undefined, { reason });
  }
  recordFallbackActivation(provider, strategy) {
    this.logEvent("fallback_activated", provider, undefined, { strategy });
  }
  recordRateLimitHit(provider, resetTime) {
    this.logEvent("rate_limit_hit", provider, undefined, { resetTime });
  }
  recordCacheHit(provider, key) {
    this.logEvent("cache_hit", provider, undefined, { key });
  }
  recordCacheMiss(provider, key) {
    this.logEvent("cache_miss", provider, undefined, { key });
  }
  recordHealthCheck(provider, healthy, responseTime) {
    this.logEvent("health_check", provider, undefined, {
      healthy,
      responseTime,
    });
    this.updateHealthStatus(provider, healthy, responseTime);
  }
  // =============================================================================
  // 健康状态管理
  // =============================================================================
  updateHealthStatus(provider, success, responseTime, errorType) {
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
      errorType,
    );
    if (health.healthy !== isHealthy) {
      health.healthy = isHealthy;
      this.logEvent("health_change", provider, undefined, {
        healthy: isHealthy,
        reason: isHealthy ? "recovered" : "degraded",
      });
    }
  }
  evaluateHealth(provider, success, responseTime, errorType) {
    // 如果最近有连续失败，标记为不健康
    const health = this.healthStatus.get(provider);
    if (health && health.consecutiveFailures >= 3) {
      return false;
    }
    // 响应时间过长，标记为不健康
    const responseTimeThreshold =
      this.alertThresholds.get("responseTime") || 10000; // 10秒
    if (responseTime > responseTimeThreshold) {
      return false;
    }
    // 特定错误类型，标记为不健康
    const criticalErrors = [
      "authentication_error",
      "permission_error",
      "insufficient_quota",
    ];
    if (errorType && criticalErrors.includes(errorType)) {
      return false;
    }
    return true;
  }
  // =============================================================================
  // 告警系统
  // =============================================================================
  checkAlerts(provider, metrics) {
    const recentMetrics = this.getRecentMetrics(provider, 300000); // 最近5分钟
    if (recentMetrics.length === 0) return;
    // 检查响应时间告警
    const avgResponseTime = this.calculateAverageResponseTime(recentMetrics);
    const responseTimeThreshold = this.alertThresholds.get("responseTime");
    if (responseTimeThreshold && avgResponseTime > responseTimeThreshold) {
      this.triggerAlert("high_response_time", provider, {
        average: avgResponseTime,
        threshold: responseTimeThreshold,
      });
    }
    // 检查错误率告警
    const errorRate = this.calculateErrorRate(recentMetrics);
    const errorRateThreshold = this.alertThresholds.get("errorRate");
    if (errorRateThreshold && errorRate > errorRateThreshold) {
      this.triggerAlert("high_error_rate", provider, {
        errorRate,
        threshold: errorRateThreshold,
      });
    }
    // 检查速率限制告警
    const rateLimitHits = this.countRateLimitHits(provider, 300000);
    const rateLimitThreshold = this.alertThresholds.get("rateLimitHits");
    if (rateLimitThreshold && rateLimitHits > rateLimitThreshold) {
      this.triggerAlert("rate_limit_exceeded", provider, {
        count: rateLimitHits,
        threshold: rateLimitThreshold,
      });
    }
  }
  triggerAlert(type, provider, data) {
    const alert = {
      type,
      provider,
      timestamp: Date.now(),
      data,
      severity: this.getAlertSeverity(type),
    };
    // 记录告警事件
    this.logEvent("alert", provider, undefined, alert);
    // 根据严重程度输出不同级别的日志
    const message = `Alert [${type}] for provider ${provider}: ${JSON.stringify(data)}`;
    switch (alert.severity) {
      case "critical":
        console.error(`🚨 CRITICAL: ${message}`);
        break;
      case "warning":
        console.warn(`⚠️  WARNING: ${message}`);
        break;
      case "info":
        console.info(`ℹ️  INFO: ${message}`);
        break;
      default:
        console.log(`📋 LOG: ${message}`);
    }
  }
  getAlertSeverity(type) {
    const severityMap = {
      high_response_time: "warning",
      high_error_rate: "critical",
      rate_limit_exceeded: "warning",
      provider_down: "critical",
      authentication_error: "critical",
      insufficient_quota: "critical",
    };
    return severityMap[type] || "info";
  }
  // =============================================================================
  // 事件记录
  // =============================================================================
  logEvent(type, provider, model, data) {
    const event = {
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
  outputLog(event) {
    const logLevel = this.config.logLevel || "info";
    const message =
      `[${new Date(event.timestamp).toISOString()}] ${event.type.toUpperCase()}` +
      (event.provider ? ` [${event.provider}]` : "") +
      (event.model ? ` [${event.model}]` : "") +
      (event.data && Object.keys(event.data).length > 0
        ? ` ${JSON.stringify(event.data)}`
        : "");
    switch (logLevel) {
      case "debug":
        console.debug(message);
        break;
      case "info":
        console.info(message);
        break;
      case "warn":
        console.warn(message);
        break;
      case "error":
        console.error(message);
        break;
    }
  }
  // =============================================================================
  // 指标计算和统计
  // =============================================================================
  collectMetrics() {
    // 定期收集和聚合指标
    const now = Date.now();
    const providers = ["zhipu", "deepseek", "openai", "anthropic"];
    providers.forEach((provider) => {
      const recentMetrics = this.getRecentMetrics(
        provider,
        this.config.metricsInterval,
      );
      if (recentMetrics.length > 0) {
        const avgResponseTime =
          this.calculateAverageResponseTime(recentMetrics);
        const errorRate = this.calculateErrorRate(recentMetrics);
        const totalTokens = this.calculateTotalTokens(recentMetrics);
        this.logEvent("metrics_collected", provider, undefined, {
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
  cleanupExpiredData() {
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    const cutoffTime = Date.now() - maxAge;
    // 清理过期指标
    this.metrics.forEach((metricsList, key) => {
      const filteredMetrics = metricsList.filter(
        (m) => m.timestamp > cutoffTime,
      );
      if (filteredMetrics.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filteredMetrics);
      }
    });
    // 清理过期事件
    this.events = this.events.filter((e) => e.timestamp > cutoffTime);
  }
  // =============================================================================
  // 工具方法
  // =============================================================================
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  getRecentMetrics(provider, timeWindow) {
    const cutoffTime = Date.now() - timeWindow;
    const recentMetrics = [];
    this.metrics.forEach((metricsList, key) => {
      if (key.startsWith(`${provider}:`)) {
        const filtered = metricsList.filter((m) => m.timestamp > cutoffTime);
        recentMetrics.push(...filtered);
      }
    });
    return recentMetrics;
  }
  calculateAverageResponseTime(metrics) {
    if (metrics.length === 0) return 0;
    const totalTime = metrics.reduce((sum, m) => sum + m.responseTime, 0);
    return totalTime / metrics.length;
  }
  calculateErrorRate(metrics) {
    if (metrics.length === 0) return 0;
    const errorCount = metrics.filter((m) => !m.success).length;
    return (errorCount / metrics.length) * 100;
  }
  calculateTotalTokens(metrics) {
    return metrics.reduce((sum, m) => sum + m.tokensUsed, 0);
  }
  countRateLimitHits(provider, timeWindow) {
    const cutoffTime = Date.now() - timeWindow;
    return this.events.filter(
      (e) =>
        e.type === "rate_limit_hit" &&
        e.provider === provider &&
        e.timestamp > cutoffTime,
    ).length;
  }
  // =============================================================================
  // 状态查询方法
  // =============================================================================
  getServiceStatus() {
    const totalRequests = Array.from(this.metrics.values()).reduce(
      (sum, metricsList) => sum + metricsList.length,
      0,
    );
    const totalErrors = Array.from(this.metrics.values()).reduce(
      (sum, metricsList) => sum + metricsList.filter((m) => !m.success).length,
      0,
    );
    const providerStatus = {};
    this.healthStatus.forEach((health, provider) => {
      providerStatus[provider] = health;
    });
    const averageResponseTime = this.calculateAverageResponseTime(
      Array.from(this.metrics.values()).flat(),
    );
    return {
      initialized: true,
      healthy: Object.values(providerStatus).some((h) => h.healthy),
      totalRequests,
      totalErrors,
      averageResponseTime,
      uptime: Date.now() - this.startTime,
      providerStatus,
      lastUpdate: Date.now(),
    };
  }
  getMetrics(provider, model, timeWindow) {
    let metrics = [];
    this.metrics.forEach((metricsList, key) => {
      const [keyProvider, keyModel] = key.split(":");
      if (
        (!provider || keyProvider === provider) &&
        (!model || keyModel === model)
      ) {
        let filteredMetrics = metricsList;
        // 如果指定了时间窗口，过滤指标
        if (timeWindow) {
          const cutoffTime = Date.now() - timeWindow;
          filteredMetrics = metricsList.filter((m) => m.timestamp > cutoffTime);
        }
        metrics.push(...filteredMetrics);
      }
    });
    return metrics;
  }
  getEvents(eventType, timeWindow) {
    let events = this.events;
    if (eventType) {
      events = events.filter((e) => e.type === eventType);
    }
    if (timeWindow) {
      const cutoffTime = Date.now() - timeWindow;
      events = events.filter((e) => e.timestamp > cutoffTime);
    }
    return events;
  }
  getHealthStatus(provider) {
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
  generateReport(timeWindow) {
    const metrics = this.getMetrics(undefined, undefined, timeWindow);
    const events = this.getEvents(undefined, timeWindow);
    const serviceStatus = this.getServiceStatus();
    const report = {
      timestamp: new Date().toISOString(),
      timeWindow: timeWindow || "all",
      summary: {
        totalRequests: metrics.length,
        successfulRequests: metrics.filter((m) => m.success).length,
        failedRequests: metrics.filter((m) => !m.success).length,
        averageResponseTime: this.calculateAverageResponseTime(metrics),
        totalTokens: this.calculateTotalTokens(metrics),
        cacheHits: metrics.filter((m) => m.cacheHit).length,
      },
      providerStats: this.getProviderReport(metrics),
      serviceStatus,
      recentEvents: events.slice(-10), // 最近10个事件
    };
    return JSON.stringify(report, null, 2);
  }
  getProviderReport(metrics) {
    const providerStats = {};
    const providers = Array.from(new Set(metrics.map((m) => m.provider)));
    providers.forEach((provider) => {
      const providerMetrics = metrics.filter((m) => m.provider === provider);
      const health = this.healthStatus.get(provider);
      providerStats[provider] = {
        requests: providerMetrics.length,
        successful: providerMetrics.filter((m) => m.success).length,
        failed: providerMetrics.filter((m) => !m.success).length,
        averageResponseTime: this.calculateAverageResponseTime(providerMetrics),
        totalTokens: this.calculateTotalTokens(providerMetrics),
        cacheHits: providerMetrics.filter((m) => m.cacheHit).length,
        healthy: health?.healthy || false,
        lastCheck: health?.lastCheck || 0,
      };
    });
    return providerStats;
  }
}
exports.AIMonitor = AIMonitor;
// =============================================================================
// 监控器工厂
// =============================================================================
class MonitorFactory {
  static getInstance(name = "default", config) {
    let instance = this.instances.get(name);
    if (!instance) {
      const defaultConfig = {
        enabled: true,
        metricsInterval: 60000, // 1分钟
        logLevel: "info",
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
  static createCustomInstance(name, config) {
    const instance = new AIMonitor(config);
    this.instances.set(name, instance);
    return instance;
  }
  static removeInstance(name) {
    const instance = this.instances.get(name);
    if (instance) {
      instance.stop();
      return this.instances.delete(name);
    }
    return false;
  }
  static getAllInstances() {
    return new Map(this.instances);
  }
}
exports.MonitorFactory = MonitorFactory;
MonitorFactory.instances = new Map();
// =============================================================================
// 默认导出
// =============================================================================
exports.default = MonitorFactory;
