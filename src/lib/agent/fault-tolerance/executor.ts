// 容错执行器
// 实现Agent容错机制的核心逻辑：重试、降级、熔断

import { ErrorLogger } from "../../error/error-logger";
import { CircuitBreakerManager } from "../../error/circuit-breaker";
import type {
  AgentContext,
  AgentError,
  AgentErrorType,
} from "../../../types/agent";
import type {
  AgentFaultToleranceConfig,
  FaultToleranceResult,
  RetryConfig,
} from "./config";

// =============================================================================
// 容错执行器类
// =============================================================================

/**
 * 容错执行器
 * 负责执行Agent逻辑并应用容错机制（重试、降级、熔断）
 */
export class FaultTolerantExecutor {
  constructor(
    private errorLogger: ErrorLogger,
    private circuitBreakerManager: CircuitBreakerManager,
  ) {}

  /**
   * 执行函数并应用容错机制
   * @param agentName Agent名称
   * @param fn 要执行的函数
   * @param config 容错配置
   * @param context Agent执行上下文
   * @returns 执行结果和容错统计
   */
  async execute<T>(
    agentName: string,
    fn: () => Promise<T>,
    config: AgentFaultToleranceConfig,
    context: AgentContext,
  ): Promise<{ result: T; faultResult: FaultToleranceResult }> {
    const startTime = Date.now();

    // 1. 检查熔断器状态
    if (config.circuitBreaker.enabled) {
      const breaker = this.circuitBreakerManager.getBreaker(
        agentName,
        this.convertToCircuitBreakerConfig(config.circuitBreaker),
      );

      if (breaker.isOpen()) {
        // 熔断器已开启，直接拒绝请求
        const error: AgentError = {
          code: "CIRCUIT_BREAKER_OPEN",
          message: `Circuit breaker is OPEN for agent ${agentName}`,
          type: "EXECUTION_ERROR" as AgentErrorType,
          agentName,
          timestamp: Date.now(),
          retryable: false,
        };

        return {
          result: undefined as T,
          faultResult: {
            success: false,
            totalAttempts: 0,
            fallbackUsed: false,
            circuitBreakerTripped: true,
            finalError: error,
            executionTime: Date.now() - startTime,
          },
        };
      }
    }

    // 2. 执行重试逻辑
    const retryResult = await this.executeWithRetry(
      agentName,
      fn,
      config.retry,
      context,
    );

    // 3. 重试成功
    if (retryResult.success) {
      return {
        result: retryResult.result as T,
        faultResult: {
          success: true,
          totalAttempts: retryResult.attempts,
          fallbackUsed: false,
          circuitBreakerTripped: false,
          executionTime: Date.now() - startTime,
        },
      };
    }

    // 4. 重试失败，尝试降级
    if (config.fallback.enabled && config.fallback.fallbackFunction) {
      try {
        const fallbackResult = await config.fallback.fallbackFunction(
          retryResult.error,
          context,
        );

        // 降级成功（使用类型断言，因为降级结果可能与原始类型不同）
        return {
          result: fallbackResult as T,
          faultResult: {
            success: true,
            totalAttempts: retryResult.attempts,
            fallbackUsed: true,
            fallbackType: config.fallback.fallbackType,
            circuitBreakerTripped: false,
            executionTime: Date.now() - startTime,
          },
        };
      } catch (fallbackError) {
        // 降级也失败，记录错误
        await this.logError(agentName, fallbackError, context);

        return {
          result: undefined as T,
          faultResult: {
            success: false,
            totalAttempts: retryResult.attempts,
            fallbackUsed: true,
            fallbackType: config.fallback.fallbackType,
            circuitBreakerTripped: true,
            finalError: fallbackError,
            executionTime: Date.now() - startTime,
          },
        };
      }
    }

    return {
      result: undefined as T,
      faultResult: {
        success: false,
        totalAttempts: retryResult.attempts,
        fallbackUsed: false,
        circuitBreakerTripped: true,
        finalError: retryResult.error,
        executionTime: Date.now() - startTime,
      },
    };
  }

  /**
   * 执行函数并应用重试逻辑
   * @private
   */
  private async executeWithRetry<T>(
    agentName: string,
    fn: () => Promise<T>,
    config: RetryConfig,
    context: AgentContext,
  ): Promise<{
    success: boolean;
    result?: T;
    error?: unknown;
    attempts: number;
  }> {
    let lastError: unknown;
    const maxAttempts = config.maxRetries;

    // 重试循环
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // 执行函数
        const result = await fn();

        return {
          success: true,
          result,
          attempts: attempt + 1,
        };
      } catch (error) {
        lastError = error;

        // 记录错误到ErrorLogger
        await this.logError(agentName, error, context);

        // 判断是否可重试
        const isRetryable = this.isRetryableError(error, config);

        // 不可重试或达到最大重试次数，退出循环
        if (!isRetryable || attempt >= maxAttempts - 1) {
          break;
        }

        // 计算退避时间
        const backoffIndex = Math.min(attempt, config.backoffMs.length - 1);
        const backoffTime = config.backoffMs[backoffIndex];

        // 等待退避时间
        await this.sleep(backoffTime);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: maxAttempts,
    };
  }

  /**
   * 判断错误是否可重试
   * @private
   */
  private isRetryableError(error: unknown, config: RetryConfig): boolean {
    // 尝试从多个来源提取错误码：
    // 1. AgentError的code属性
    // 2. 标准Error的name属性
    // 3. 错误消息（如new Error('TIMEOUT')中的'TIMEOUT'）
    let errorCode = (error as AgentError)?.code;

    if (!errorCode && error instanceof Error) {
      // 尝试从错误消息中提取（如new Error('TIMEOUT_ERROR')）
      const message = error.message || String(error);
      // 提取第一个冒号前的部分，或者整个消息（如果不包含冒号）
      const match = message.match(/^([^:]+)/);
      errorCode = match ? match[1].trim() : message.trim();
    }

    if (!errorCode) {
      errorCode = String(error);
    }

    const errorCodeUpper = errorCode.toUpperCase();

    // 检查是否在可重试错误列表中（使用精确匹配而非子串匹配）
    return config.retryableErrors.some(
      (retryableCode) => errorCodeUpper === retryableCode.toUpperCase(),
    );
  }

  /**
   * 记录错误到ErrorLogger
   * @private
   */
  private async logError(
    agentName: string,
    error: unknown,
    context: AgentContext,
  ): Promise<void> {
    try {
      await this.errorLogger.captureError(error as Error, {
        agentName,
        taskType: context.taskType,
        operation: context.task,
        executionEnvironment: {
          userId: context.userId,
          caseId: context.metadata?.caseId as string | undefined,
        },
        inputData: context.data,
      });
    } catch (logError) {
      // 错误日志记录失败不影响主流程
      console.error("[FaultTolerantExecutor] Failed to log error:", logError);
    }
  }

  /**
   * 等待指定时间
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 转换配置格式
   * @private
   */
  private convertToCircuitBreakerConfig(config: {
    enabled: boolean;
    failureThreshold: number;
    timeout: number;
    halfOpenRequests: number;
  }): Partial<{
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    halfOpenAttempts: number;
  }> {
    return {
      failureThreshold: Math.max(1, Math.floor(config.failureThreshold * 10)),
      successThreshold: config.halfOpenRequests,
      timeout: config.timeout,
      halfOpenAttempts: config.halfOpenRequests,
    };
  }

  /**
   * 创建重试结果
   * @param success 是否成功
   * @param attempts 执行次数
   * @param result 结果
   * @param error 错误
   * @param executionTime 执行时间
   */
  static createRetryResult<T>(
    success: boolean,
    attempts: number,
    result?: T,
    error?: unknown,
    executionTime?: number,
  ): {
    success: boolean;
    result?: T;
    error?: unknown;
    attempts: number;
    executionTime?: number;
  } {
    return {
      success,
      attempts,
      result,
      error,
      executionTime,
    };
  }

  /**
   * 计算重试成功率
   * @param totalAttempts 总执行次数
   * @param successfulAttempts 成功次数
   */
  static calculateRetrySuccessRate(
    totalAttempts: number,
    successfulAttempts: number,
  ): number {
    if (totalAttempts === 0) return 0;
    return successfulAttempts / totalAttempts;
  }
}

// =============================================================================
// 导出函数
// =============================================================================

export function createFaultTolerantExecutor(): FaultTolerantExecutor {
  const errorLogger = new ErrorLogger();
  const circuitBreakerManager = new CircuitBreakerManager();
  return new FaultTolerantExecutor(errorLogger, circuitBreakerManager);
}
