'use strict';
// =============================================================================
// 日志和监控工具类
// =============================================================================
Object.defineProperty(exports, '__esModule', { value: true });
exports.logger = exports.StructuredLogger = void 0;
class StructuredLogger {
  constructor() {
    this.logs = [];
    this.maxLogSize = 10000;
    this.metrics = {
      documentProcessing: {
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        averageProcessingTime: 0,
        averageConfidence: 0,
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        throughputPerMinute: 0,
      },
      errors: {
        securityErrors: 0,
        validationErrors: 0,
        analysisErrors: 0,
        otherErrors: 0,
      },
    };
    this.responseTimes = [];
  }
  static getInstance() {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }
  createLogEntry(level, message, context, error) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };
  }
  debug(message, context) {
    const entry = this.createLogEntry('debug', message, context);
    this.addLog(entry);
  }
  info(message, context) {
    const entry = this.createLogEntry('info', message, context);
    this.addLog(entry);
  }
  warn(message, context) {
    const entry = this.createLogEntry('warn', message, context);
    this.addLog(entry);
  }
  error(message, error, context) {
    const entry = this.createLogEntry('error', message, context, error);
    this.addLog(entry);
    this.updateErrorMetrics(error);
  }
  addLog(entry) {
    this.logs.push(entry);
    // 保持日志大小在限制内
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
    // 在开发环境中也输出到控制台
    if (process.env.NODE_ENV !== 'production') {
      const logMessage = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
      if (entry.context) {
        console.log(logMessage, entry.context);
      } else {
        console.log(logMessage);
      }
      if (entry.error) {
        console.error(entry.error);
      }
    }
  }
  updateErrorMetrics(error) {
    if (!error) return;
    if (error.name === 'SecurityError') {
      this.metrics.errors.securityErrors++;
    } else if (error.name === 'ValidationError') {
      this.metrics.errors.validationErrors++;
    } else if (error.name === 'AnalysisError') {
      this.metrics.errors.analysisErrors++;
    } else {
      this.metrics.errors.otherErrors++;
    }
  }
  recordDocumentProcessing(success, processingTime, confidence) {
    this.metrics.documentProcessing.totalProcessed++;
    if (success) {
      this.metrics.documentProcessing.successCount++;
    } else {
      this.metrics.documentProcessing.errorCount++;
    }
    // 更新平均处理时间
    const total = this.metrics.documentProcessing.totalProcessed;
    const currentAvg = this.metrics.documentProcessing.averageProcessingTime;
    this.metrics.documentProcessing.averageProcessingTime =
      (currentAvg * (total - 1) + processingTime) / total;
    // 更新平均置信度
    this.metrics.documentProcessing.averageConfidence =
      (this.metrics.documentProcessing.averageConfidence * (total - 1) +
        confidence) /
      total;
    // 记录响应时间用于计算百分位数
    this.responseTimes.push(processingTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    this.updatePerformanceMetrics();
  }
  updatePerformanceMetrics() {
    if (this.responseTimes.length === 0) return;
    // 计算平均响应时间
    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.performance.averageResponseTime =
      sum / this.responseTimes.length;
    // 计算P95响应时间
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.metrics.performance.p95ResponseTime = sorted[p95Index] || 0;
    // 计算吞吐量（每分钟处理的文档数）
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentLogs = this.logs.filter(
      log => log.timestamp >= new Date(oneMinuteAgo).toISOString()
    );
    this.metrics.performance.throughputPerMinute = recentLogs.filter(log =>
      log.message.includes('文档分析完成')
    ).length;
  }
  getLogs(level, limit) {
    let filteredLogs = this.logs;
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }
    return filteredLogs;
  }
  getMetrics() {
    return { ...this.metrics };
  }
  exportLogs() {
    return JSON.stringify(
      {
        logs: this.logs,
        metrics: this.metrics,
        exportTime: new Date().toISOString(),
      },
      null,
      2
    );
  }
  clearLogs() {
    this.logs = [];
    this.metrics = {
      documentProcessing: {
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        averageProcessingTime: 0,
        averageConfidence: 0,
      },
      performance: {
        averageResponseTime: 0,
        p95ResponseTime: 0,
        throughputPerMinute: 0,
      },
      errors: {
        securityErrors: 0,
        validationErrors: 0,
        analysisErrors: 0,
        otherErrors: 0,
      },
    };
    this.responseTimes = [];
  }
}
exports.StructuredLogger = StructuredLogger;
// 默认日志实例
exports.logger = StructuredLogger.getInstance();
