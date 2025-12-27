// 熔断器 - 防止级联故障

import type {
  CircuitBreakerConfig,
  CircuitBreakerStateInfo
} from './types';

import { CircuitBreakerState } from './types';

// =============================================================================
// 熔断器类
// =============================================================================

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastStateChange: number = Date.now();

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * 记录成功
   */
  public recordSuccess(): void {
    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // 关闭状态下重置失败计数
        this.failureCount = 0;
        break;

      case CircuitBreakerState.OPEN:
        // 打开状态下不处理成功，等待重置超时
        break;

      case CircuitBreakerState.HALF_OPEN:
        // 半开状态下增加成功计数
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.transitionTo(CircuitBreakerState.CLOSED);
        }
        break;
    }
  }

  /**
   * 记录失败
   */
  public recordFailure(): void {
    this.lastFailureTime = Date.now();

    switch (this.state) {
      case CircuitBreakerState.CLOSED:
        // 关闭状态下增加失败计数
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.transitionTo(CircuitBreakerState.OPEN);
        }
        break;

      case CircuitBreakerState.OPEN:
        // 打开状态下，保持打开状态
        break;

      case CircuitBreakerState.HALF_OPEN:
        // 半开状态下失败，立即打开熔断器
        this.transitionTo(CircuitBreakerState.OPEN);
        break;
    }
  }

  /**
   * 检查是否允许执行
   */
  public canExecute(): boolean {
    // 检查是否需要重置到半开状态
    if (this.state === CircuitBreakerState.OPEN) {
      const timeSinceOpen = Date.now() - this.lastStateChange;
      if (timeSinceOpen >= this.config.resetTimeout) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      }
    }

    return this.state !== CircuitBreakerState.OPEN;
  }

  /**
   * 获取当前状态
   */
  public getState(): CircuitBreakerState {
    // 自动检查是否需要状态转换
    if (this.state === CircuitBreakerState.OPEN) {
      const timeSinceOpen = Date.now() - this.lastStateChange;
      if (timeSinceOpen >= this.config.resetTimeout) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN);
      }
    }

    return this.state;
  }

  /**
   * 获取状态信息
   */
  public getStateInfo(): CircuitBreakerStateInfo {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange
    };
  }

  /**
   * 重置熔断器
   */
  public reset(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * 手动打开熔断器
   */
  public open(): void {
    this.transitionTo(CircuitBreakerState.OPEN);
  }

  /**
   * 手动关闭熔断器
   */
  public close(): void {
    this.transitionTo(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  public getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state === newState) {
      return;
    }

    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    // 状态转换时的额外逻辑
    if (newState === CircuitBreakerState.HALF_OPEN) {
      this.successCount = 0;
    } else if (newState === CircuitBreakerState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    }
  }
}

// =============================================================================
// 熔断器管理器
// =============================================================================

export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * 创建或获取熔断器
   */
  public getOrCreate(key: string, config?: CircuitBreakerConfig): CircuitBreaker {
    let breaker = this.breakers.get(key);

    if (!breaker) {
      breaker = new CircuitBreaker(
        config || this.getDefaultConfig()
      );
      this.breakers.set(key, breaker);
    }

    return breaker;
  }

  /**
   * 获取熔断器
   */
  public get(key: string): CircuitBreaker | undefined {
    return this.breakers.get(key);
  }

  /**
   * 移除熔断器
   */
  public remove(key: string): boolean {
    return this.breakers.delete(key);
  }

  /**
   * 重置所有熔断器
   */
  public resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * 获取所有熔断器状态
   */
  public getAllStates(): Record<string, CircuitBreakerStateInfo> {
    const states: Record<string, CircuitBreakerStateInfo> = {};

    for (const [key, breaker] of this.breakers.entries()) {
      states[key] = breaker.getStateInfo();
    }

    return states;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): CircuitBreakerConfig {
    return {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000
    };
  }

  /**
   * 清理不活跃的熔断器
   */
  public cleanup(maxAge: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, breaker] of this.breakers.entries()) {
      const stateInfo = breaker.getStateInfo();
      const age = now - stateInfo.lastStateChange;

      if (age > maxAge && breaker.getState() === CircuitBreakerState.CLOSED) {
        this.breakers.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 清除所有熔断器
   */
  public clear(): void {
    this.breakers.clear();
  }

  /**
   * 获取统计信息
   */
  public getStatistics(): {
    totalBreakers: number;
    openCount: number;
    halfOpenCount: number;
    closedCount: number;
  } {
    let openCount = 0;
    let halfOpenCount = 0;
    let closedCount = 0;

    for (const breaker of this.breakers.values()) {
      switch (breaker.getState()) {
        case CircuitBreakerState.OPEN:
          openCount++;
          break;
        case CircuitBreakerState.HALF_OPEN:
          halfOpenCount++;
          break;
        case CircuitBreakerState.CLOSED:
          closedCount++;
          break;
      }
    }

    return {
      totalBreakers: this.breakers.size,
      openCount,
      halfOpenCount,
      closedCount
    };
  }
}

// =============================================================================
// 默认熔断器管理器实例
// =============================================================================

export const circuitBreakerManager = new CircuitBreakerManager();
