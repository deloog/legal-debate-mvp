/**
 * 日志工具 - DocAnalyzer专用日志工具
 *
 * 核心功能：
 * - 封装结构化日志系统
 * - 提供DocAnalyzer专用的日志方法
 * - 支持性能监控和指标收集
 */

import { logger } from "../../../agent/security/logger";

export class DocAnalyzerLogger {
  private module: string;

  constructor(module: string = "DocAnalyzer") {
    this.module = module;
  }

  /**
   * 记录调试信息
   */
  debug(message: string, context?: Record<string, any>): void {
    logger.debug(message, { module: this.module, ...context });
  }

  /**
   * 记录一般信息
   */
  info(message: string, context?: Record<string, any>): void {
    logger.info(message, { module: this.module, ...context });
  }

  /**
   * 记录警告信息
   */
  warn(message: string, context?: Record<string, any>): void {
    logger.warn(message, { module: this.module, ...context });
  }

  /**
   * 记录错误信息
   */
  error(message: string, error?: Error, context?: Record<string, any>): void {
    logger.error(message, error, { module: this.module, ...context });
  }

  /**
   * 记录文档分析开始
   */
  logAnalysisStart(documentId: string): void {
    logger.info("文档分析开始", { module: this.module, documentId });
  }

  /**
   * 记录文档分析完成
   */
  logAnalysisComplete(
    documentId: string,
    processingTime: number,
    confidence: number,
  ): void {
    logger.recordDocumentProcessing(true, processingTime, confidence);
    logger.info("文档分析完成", {
      module: this.module,
      documentId,
      processingTime,
      confidence,
    });
  }

  /**
   * 记录文档分析失败
   */
  logAnalysisFailure(
    documentId: string,
    error: Error,
    processingTime: number,
  ): void {
    logger.recordDocumentProcessing(false, processingTime, 0);
    logger.error("文档分析失败", error, {
      module: this.module,
      documentId,
      processingTime,
    });
  }

  /**
   * 记录缓存命中
   */
  logCacheHit(documentId: string): void {
    logger.info("缓存命中", { module: this.module, documentId });
  }

  /**
   * 记录缓存未命中
   */
  logCacheMiss(documentId: string): void {
    logger.debug("缓存未命中", { module: this.module, documentId });
  }

  /**
   * 记录AI调用
   */
  logAICall(provider: string, model: string, tokens: number): void {
    logger.debug("AI调用", {
      module: this.module,
      provider,
      model,
      tokens,
    });
  }

  /**
   * 记录性能指标
   */
  logPerformanceMetric(
    metricName: string,
    value: number,
    unit: string = "ms",
  ): void {
    logger.debug("性能指标", {
      module: this.module,
      metricName,
      value,
      unit,
    });
  }

  /**
   * 创建子模块日志器
   */
  createChildLogger(subModule: string): DocAnalyzerLogger {
    return new DocAnalyzerLogger(`${this.module}:${subModule}`);
  }
}

/**
 * 默认DocAnalyzer日志实例
 */
export const docAnalyzerLogger = new DocAnalyzerLogger("DocAnalyzer");
