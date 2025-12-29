// =============================================================================
// 日志和监控工具类
// =============================================================================

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

export interface Metrics {
  documentProcessing: {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    averageProcessingTime: number;
    averageConfidence: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    throughputPerMinute: number;
  };
  errors: {
    securityErrors: number;
    validationErrors: number;
    analysisErrors: number;
    otherErrors: number;
  };
}

export class StructuredLogger {
  private static instance: StructuredLogger;
  private logs: LogEntry[] = [];
  private maxLogSize: number = 10000;
  private metrics: Metrics = {
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
  private responseTimes: number[] = [];

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private createLogEntry(
    level: LogEntry["level"],
    message: string,
    context?: Record<string, any>,
    error?: Error,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
    };
  }

  debug(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry("debug", message, context);
    this.addLog(entry);
  }

  info(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry("info", message, context);
    this.addLog(entry);
  }

  warn(message: string, context?: Record<string, any>): void {
    const entry = this.createLogEntry("warn", message, context);
    this.addLog(entry);
  }

  error(message: string, error?: Error, context?: Record<string, any>): void {
    const entry = this.createLogEntry("error", message, context, error);
    this.addLog(entry);
    this.updateErrorMetrics(error);
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    // 保持日志大小在限制内
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // 在开发环境中也输出到控制台
    if (process.env.NODE_ENV !== "production") {
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

  private updateErrorMetrics(error?: Error): void {
    if (!error) return;

    if (error.name === "SecurityError") {
      this.metrics.errors.securityErrors++;
    } else if (error.name === "ValidationError") {
      this.metrics.errors.validationErrors++;
    } else if (error.name === "AnalysisError") {
      this.metrics.errors.analysisErrors++;
    } else {
      this.metrics.errors.otherErrors++;
    }
  }

  recordDocumentProcessing(
    success: boolean,
    processingTime: number,
    confidence: number,
  ): void {
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

  private updatePerformanceMetrics(): void {
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
      (log) => log.timestamp >= new Date(oneMinuteAgo).toISOString(),
    );
    this.metrics.performance.throughputPerMinute = recentLogs.filter((log) =>
      log.message.includes("文档分析完成"),
    ).length;
  }

  getLogs(level?: LogEntry["level"], limit?: number): LogEntry[] {
    let filteredLogs = this.logs;

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  getMetrics(): Metrics {
    return { ...this.metrics };
  }

  exportLogs(): string {
    return JSON.stringify(
      {
        logs: this.logs,
        metrics: this.metrics,
        exportTime: new Date().toISOString(),
      },
      null,
      2,
    );
  }

  clearLogs(): void {
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

// 默认日志实例
export const logger = StructuredLogger.getInstance();
