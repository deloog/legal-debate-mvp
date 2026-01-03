/**
 * Circuit Breaker
 *
 * 熔断器模式实现
 * 防止级联失败，保护系统稳定性
 */

import { CircuitState, CircuitBreakerConfig, RecoveryMethod } from "./types";

/**
 * 熔断器
 */
export class CircuitBreaker {
  private state: CircuitState;
  private failureCount: number;
  private successCount: number;
  private lastFailureTime: number;
  private halfOpenAttempts: number;
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      successThreshold: config.successThreshold ?? 3,
      timeout: config.timeout ?? 60000, // 默认1分钟
      halfOpenAttempts: config.halfOpenAttempts ?? 2,
    };

    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * 执行操作（带熔断保护）
   * @param operation 要执行的操作
   * @returns 操作结果
   * @throws 当熔断器打开时抛出异常
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(
        `Circuit breaker is OPEN. Last failed at: ${new Date(
          this.lastFailureTime,
        ).toISOString()}`,
      );
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 检查熔断器是否打开
   * @returns 是否打开
   */
  isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      // 检查是否超时
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.transitionToHalfOpen();
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * 获取当前状态
   * @returns 熔断器状态
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 获取失败计数
   * @returns 失败次数
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * 获取成功计数
   * @returns 成功次数
   */
  getSuccessCount(): number {
    return this.successCount;
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * 处理成功
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts++;
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    } else {
      // 关闭状态下，重置失败计数
      this.failureCount = 0;
    }
  }

  /**
   * 处理失败
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // 半开状态下失败，立即打开熔断器
      this.transitionToOpen();
    } else if (
      this.state === CircuitState.CLOSED &&
      this.failureCount >= this.config.failureThreshold
    ) {
      this.transitionToOpen();
    }
  }

  /**
   * 转换到关闭状态
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * 转换到打开状态
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * 转换到半开状态
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.halfOpenAttempts = 0;
  }

  /**
   * 获取恢复方法（当熔断器打开时）
   * @returns 恢复方法
   */
  getRecoveryMethod(): RecoveryMethod {
    return RecoveryMethod.CIRCUIT_BREAKER;
  }

  /**
   * 获取熔断器状态信息
   * @returns 状态信息
   */
  getStatus(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    halfOpenAttempts: number;
    lastFailureTime?: number;
    canRetry: boolean;
  } {
    // 如果是OPEN状态，检查是否超时并自动切换到HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.timeout) {
        this.transitionToHalfOpen();
      }
    }

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      halfOpenAttempts: this.halfOpenAttempts,
      lastFailureTime:
        this.lastFailureTime > 0 ? this.lastFailureTime : undefined,
      canRetry: !this.isOpen(),
    };
  }
}

/**
 * 熔断器管理器
 * 管理多个熔断器实例
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * 获取或创建熔断器
   * @param name 熔断器名称
   * @param config 配置
   * @returns 熔断器实例
   */
  getBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
  ): CircuitBreaker {
    let breaker = this.breakers.get(name);

    if (!breaker) {
      breaker = new CircuitBreaker(config);
      this.breakers.set(name, breaker);
    }

    return breaker;
  }

  /**
   * 重置指定熔断器
   * @param name 熔断器名称
   */
  resetBreaker(name: string): void {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * 获取所有熔断器状态
   * @returns 所有熔断器状态
   */
  getAllStatus(): Map<
    string,
    {
      state: CircuitState;
      failureCount: number;
      successCount: number;
      halfOpenAttempts: number;
      lastFailureTime?: number;
      canRetry: boolean;
    }
  > {
    const status = new Map();

    for (const [name, breaker] of this.breakers.entries()) {
      status.set(name, breaker.getStatus());
    }

    return status;
  }

  /**
   * 移除指定熔断器
   * @param name 熔断器名称
   */
  removeBreaker(name: string): void {
    this.breakers.delete(name);
  }

  /**
   * 清空所有熔断器
   */
  clear(): void {
    this.breakers.clear();
  }
}

// 导出单例实例
export const circuitBreakerManager = new CircuitBreakerManager();
