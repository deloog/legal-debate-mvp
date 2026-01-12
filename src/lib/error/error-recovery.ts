/**
 * Error Recovery
 *
 * 错误恢复模块
 * 提供多种恢复方法：重试、退避、降级、熔断
 */

import { ErrorLog, RecoveryMethod, ErrorType } from './types';
import { circuitBreakerManager } from './circuit-breaker';

/**
 * 错误恢复器
 */
export class ErrorRecovery {
  /**
   * 尝试恢复错误
   * @param errorLog 错误日志
   * @param operation 原始操作
   * @param options 恢复选项
   * @returns 恢复结果
   */
  async attemptRecovery<T>(
    errorLog: ErrorLog,
    operation: () => Promise<T>,
    options: {
      enableRetry?: boolean;
      maxRetries?: number;
      enableBackoff?: boolean;
      fallbackFunction?: () => Promise<T>;
      circuitBreakerName?: string;
    } = {}
  ): Promise<{ success: boolean; result?: T; method?: RecoveryMethod }> {
    const {
      enableRetry = true,
      maxRetries = 3,
      enableBackoff = true,
      fallbackFunction,
      circuitBreakerName,
    } = options;

    // 1. 如果已恢复，直接返回
    if (errorLog.recovered) {
      return {
        success: true,
        method: (errorLog.recoveryMethod as RecoveryMethod) || undefined,
      };
    }

    // 2. 尝试熔断器保护的操作
    if (circuitBreakerName) {
      const result = await this.tryWithCircuitBreaker(
        errorLog,
        operation,
        circuitBreakerName
      );
      if (result.success) {
        return result;
      }
    }

    // 3. 尝试重试
    if (enableRetry && this.shouldRetry(errorLog.errorType)) {
      const retryResult = await this.retryWithBackoff(
        errorLog,
        operation,
        maxRetries,
        enableBackoff
      );
      if (retryResult.success) {
        return retryResult;
      }
    }

    // 4. 尝试降级
    if (fallbackFunction) {
      const fallbackResult = await this.tryFallback(errorLog, fallbackFunction);
      if (fallbackResult.success) {
        return fallbackResult;
      }
    }

    // 5. 所有恢复方法都失败
    return {
      success: false,
    };
  }

  /**
   * 判断是否应该重试
   * @param errorType 错误类型
   * @returns 是否应该重试
   */
  private shouldRetry(errorType: ErrorType): boolean {
    const retryableTypes = [
      ErrorType.NETWORK_ERROR,
      ErrorType.NETWORK_TIMEOUT,
      ErrorType.AI_TIMEOUT,
      ErrorType.DATABASE_CONNECTION_ERROR,
      ErrorType.DATABASE_ERROR,
    ];

    return retryableTypes.includes(errorType);
  }

  /**
   * 带指数退避的重试
   * @param errorLog 错误日志
   * @param operation 操作
   * @param maxRetries 最大重试次数
   * @param enableBackoff 是否启用退避
   * @returns 恢复结果
   */
  private async retryWithBackoff<T>(
    errorLog: ErrorLog,
    operation: () => Promise<T>,
    maxRetries: number,
    enableBackoff: boolean
  ): Promise<{ success: boolean; result?: T; method?: RecoveryMethod }> {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.executeWithDelay(
          operation,
          attempt,
          enableBackoff
        );

        // 更新恢复状态
        errorLog.recovered = true;
        errorLog.recoveryMethod = enableBackoff
          ? RecoveryMethod.RETRY_WITH_BACKOFF
          : RecoveryMethod.RETRY;
        errorLog.recoveryAttempts = attempt;
        errorLog.recoveryTime = Date.now() - startTime;

        return {
          success: true,
          result,
          method: errorLog.recoveryMethod as RecoveryMethod,
        };
      } catch {
        errorLog.recoveryAttempts = attempt;
      }
    }

    // 所有重试都失败
    return {
      success: false,
    };
  }

  /**
   * 执行带延迟的操作
   * @param operation 操作
   * @param attempt 尝试次数
   * @param enableBackoff 是否启用退避
   * @returns 操作结果
   */
  private async executeWithDelay<T>(
    operation: () => Promise<T>,
    attempt: number,
    enableBackoff: boolean
  ): Promise<T> {
    if (enableBackoff && attempt > 1) {
      // 指数退避：2^(attempt-1) * 100ms
      const delay = Math.pow(2, attempt - 1) * 100;
      await this.sleep(delay);
    }

    return operation();
  }

  /**
   * 尝试熔断器保护的操作
   * @param errorLog 错误日志
   * @param operation 操作
   * @param breakerName 熔断器名称
   * @returns 恢复结果
   */
  private async tryWithCircuitBreaker<T>(
    errorLog: ErrorLog,
    operation: () => Promise<T>,
    breakerName: string
  ): Promise<{ success: boolean; result?: T; method?: RecoveryMethod }> {
    const breaker = circuitBreakerManager.getBreaker(breakerName);
    const startTime = Date.now();

    try {
      const result = await breaker.execute(operation);

      // 更新恢复状态
      errorLog.recovered = true;
      errorLog.recoveryMethod = RecoveryMethod.CIRCUIT_BREAKER;
      errorLog.recoveryAttempts = 1;
      errorLog.recoveryTime = Date.now() - startTime;

      return {
        success: true,
        result,
        method: RecoveryMethod.CIRCUIT_BREAKER,
      };
    } catch {
      errorLog.recoveryAttempts = 1;

      return {
        success: false,
      };
    }
  }

  /**
   * 尝试降级处理
   * @param errorLog 错误日志
   * @param fallbackFunction 降级函数
   * @returns 恢复结果
   */
  private async tryFallback<T>(
    errorLog: ErrorLog,
    fallbackFunction: () => Promise<T>
  ): Promise<{ success: boolean; result?: T; method?: RecoveryMethod }> {
    const startTime = Date.now();

    try {
      const result = await fallbackFunction();

      // 更新恢复状态
      errorLog.recovered = true;
      errorLog.recoveryMethod = RecoveryMethod.FALLBACK;
      errorLog.recoveryAttempts = 1;
      errorLog.recoveryTime = Date.now() - startTime;

      return {
        success: true,
        result,
        method: RecoveryMethod.FALLBACK,
      };
    } catch {
      errorLog.recoveryAttempts = 1;

      return {
        success: false,
      };
    }
  }

  /**
   * 忽略错误
   * @param errorLog 错误日志
   */
  ignore(errorLog: ErrorLog): void {
    errorLog.recoveryAttempts = 1;
    errorLog.recovered = true;
    errorLog.recoveryMethod = RecoveryMethod.IGNORE;
  }

  /**
   * 标记为需要人工介入
   * @param errorLog 错误日志
   */
  markForManualIntervention(errorLog: ErrorLog): void {
    errorLog.recoveryAttempts = 1;
    errorLog.recovered = false;
    errorLog.recoveryMethod = RecoveryMethod.MANUAL_INTERVENTION;
  }

  /**
   * 休眠指定毫秒
   * @param ms 毫秒数
   * @returns Promise
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取恢复统计信息
   * @param errorLogs 错误日志列表
   * @returns 统计信息
   */
  getRecoveryStats(errorLogs: ErrorLog[]): {
    total: number;
    recovered: number;
    unrecovered: number;
    recoveryRate: number;
    byMethod: Record<RecoveryMethod, number>;
    avgRecoveryTime: number;
  } {
    const recovered = errorLogs.filter(log => log.recovered);
    const unrecovered = errorLogs.filter(log => !log.recovered);

    const byMethod: Record<RecoveryMethod, number> = {
      [RecoveryMethod.RETRY]: 0,
      [RecoveryMethod.RETRY_WITH_BACKOFF]: 0,
      [RecoveryMethod.FALLBACK]: 0,
      [RecoveryMethod.CIRCUIT_BREAKER]: 0,
      [RecoveryMethod.IGNORE]: 0,
      [RecoveryMethod.MANUAL_INTERVENTION]: 0,
    };

    for (const log of recovered) {
      const method =
        (log.recoveryMethod as RecoveryMethod) || RecoveryMethod.IGNORE;
      byMethod[method] = (byMethod[method] || 0) + 1;
    }

    // 计算平均恢复时间
    let totalRecoveryTime = 0;
    let recoveredWithTime = 0;

    for (const log of recovered) {
      if (log.recoveryTime) {
        totalRecoveryTime += log.recoveryTime;
        recoveredWithTime++;
      }
    }

    const avgRecoveryTime =
      recoveredWithTime > 0 ? totalRecoveryTime / recoveredWithTime : 0;

    return {
      total: errorLogs.length,
      recovered: recovered.length,
      unrecovered: unrecovered.length,
      recoveryRate:
        errorLogs.length > 0 ? recovered.length / errorLogs.length : 0,
      byMethod,
      avgRecoveryTime,
    };
  }
}
