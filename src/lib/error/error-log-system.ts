/**
 * Error Log System
 *
 * 错误日志系统主入口
 * 整合所有模块，提供统一的错误处理接口
 */

import { ErrorLogger } from "./error-logger";
import { ErrorRecovery } from "./error-recovery";
import { ErrorAnalyzer } from "./error-analyzer";
import { circuitBreakerManager } from "./circuit-breaker";
import {
  ErrorLog,
  ErrorContext,
  ErrorHandlingOptions,
  ErrorHandlingResult,
  RecoveryMethod,
  TimeRange,
} from "./types";

/**
 * 错误日志系统
 */
export class ErrorLogSystem {
  private logger: ErrorLogger;
  private recovery: ErrorRecovery;
  private analyzer: ErrorAnalyzer;

  constructor() {
    this.logger = new ErrorLogger();
    this.recovery = new ErrorRecovery();
    this.analyzer = new ErrorAnalyzer();
  }

  /**
   * 处理错误（完整流程）
   * @param error 错误对象
   * @param context 错误上下文
   * @param operation 原始操作（用于恢复）
   * @param options 处理选项
   * @returns 处理结果
   */
  async handle<T>(
    error: Error,
    context: ErrorContext,
    operation?: () => Promise<T>,
    options: ErrorHandlingOptions = {},
  ): Promise<ErrorHandlingResult> {
    const startTime = Date.now();

    // 1. 捕获并记录错误
    const errorLog = await this.logger.captureError(error, context);

    // 2. 尝试恢复
    let recoverySuccess = false;
    let fallbackUsed = false;

    if (operation && options.enableLogging !== false) {
      const recoveryResult = await this.recovery.attemptRecovery(
        errorLog,
        operation,
        {
          enableRetry: options.enableRetry,
          maxRetries: options.maxRetries,
          enableBackoff: true,
          fallbackFunction: options.fallbackFunction,
          circuitBreakerName: context.agentName,
        },
      );

      recoverySuccess = recoveryResult.success;
      fallbackUsed = recoveryResult.method === "FALLBACK";

      // 更新错误日志
      if (recoverySuccess) {
        await this.logger.updateErrorLog(errorLog.id!, errorLog);
      }
    }

    // 3. 执行分析（如果启用）
    if (options.enableLearning && !errorLog.learned) {
      const analysis = await this.analyzer.performRootCauseAnalysis(errorLog);

      // 更新学习结果
      await this.logger.updateErrorLog(errorLog.id!, {
        learned: true,
        learningNotes: analysis.rootCause,
        updatedAt: new Date(),
      });
    }

    // 返回处理结果
    return {
      errorLog,
      recoverySuccess,
      recoveryMethod: errorLog.recoveryMethod as RecoveryMethod | undefined,
      fallbackUsed,
      handlingDuration: Date.now() - startTime,
    };
  }

  /**
   * 执行带错误处理的操作
   * @param operation 要执行的操作
   * @param context 错误上下文
   * @param options 处理选项
   * @returns 操作结果
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    options: ErrorHandlingOptions = {},
  ): Promise<T> {
    try {
      // 使用熔断器保护
      const breakerName = context.agentName || "default";
      const breaker = circuitBreakerManager.getBreaker(breakerName);

      const result = await breaker.execute(operation);
      return result;
    } catch (error) {
      const err = error as Error;

      // 处理错误
      const handlingResult = await this.handle(
        err,
        context,
        operation,
        options,
      );

      if (handlingResult.recoverySuccess && handlingResult.errorLog.recovered) {
        return handlingResult.errorLog as T;
      }

      // 恢复失败，抛出原始错误
      throw err;
    }
  }

  /**
   * 获取错误日志
   * @param errorId 错误ID
   * @returns 错误日志
   */
  async getErrorLog(errorId: string): Promise<ErrorLog | null> {
    const { prisma } = await import("@/lib/db/prisma");
    const error = await prisma.errorLog.findUnique({
      where: { id: errorId },
    });

    if (!error) {
      return null;
    }

    return error as unknown as ErrorLog;
  }

  /**
   * 获取错误列表
   * @param filters 过滤器
   * @returns 错误日志列表
   */
  async getErrorLogs(filters?: {
    errorTypes?: string[];
    severities?: string[];
    recovered?: boolean;
    timeRange?: TimeRange;
    limit?: number;
  }): Promise<ErrorLog[]> {
    const { prisma } = await import("@/lib/db/prisma");

    const where: Record<string, unknown> = {};

    if (filters?.errorTypes && filters.errorTypes.length > 0) {
      where.errorType = { in: filters.errorTypes };
    }

    if (filters?.severities && filters.severities.length > 0) {
      where.severity = { in: filters.severities };
    }

    if (filters?.recovered !== undefined) {
      where.recovered = filters.recovered;
    }

    if (filters?.timeRange) {
      where.createdAt = {
        gte: filters.timeRange.start,
        lte: filters.timeRange.end,
      };
    }

    const errors = await prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 100,
    });

    return errors as unknown as ErrorLog[];
  }

  /**
   * 生成错误报告
   * @param timeRange 时间范围
   * @returns 错误报告
   */
  async generateReport(timeRange: TimeRange) {
    return this.analyzer.generateReport(timeRange);
  }

  /**
   * 识别错误模式
   * @param timeRange 时间范围
   * @returns 错误模式列表
   */
  async identifyPatterns(timeRange: TimeRange) {
    return this.analyzer.identifyPatterns(timeRange);
  }

  /**
   * 分析趋势
   * @param timeRange 时间范围
   * @returns 趋势数据
   */
  async analyzeTrends(timeRange: TimeRange) {
    return this.analyzer.analyzeTrends(timeRange);
  }

  /**
   * 重置熔断器
   * @param name 熔断器名称
   */
  resetCircuitBreaker(name: string): void {
    circuitBreakerManager.resetBreaker(name);
  }

  /**
   * 获取熔断器状态
   * @param name 熔断器名称
   * @returns 熔断器状态
   */
  getCircuitBreakerStatus(name: string) {
    const breaker = circuitBreakerManager.getBreaker(name);
    return breaker.getStatus();
  }

  /**
   * 清理旧错误日志
   * @param olderThanDays 保留天数
   * @returns 删除的记录数
   */
  async cleanupOldLogs(olderThanDays: number = 30): Promise<number> {
    const { prisma } = await import("@/lib/db/prisma");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.errorLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * 获取恢复统计
   * @param timeRange 时间范围
   * @returns 恢复统计
   */
  async getRecoveryStats(timeRange: TimeRange) {
    const errorLogs = await this.getErrorLogs({
      timeRange,
      limit: 1000,
    });

    return this.recovery.getRecoveryStats(errorLogs);
  }
}

// 导出单例实例
export const errorLogSystem = new ErrorLogSystem();
