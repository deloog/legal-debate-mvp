import type {
  CircuitState,
  CircuitBreakerConfig,
  CircuitBreakerState,
  CircuitBreakerStats,
  CircuitBreakerEvent,
  CircuitBreakerEventListener,
} from '../../types/ai-service-batch';

/**
 * 熔断器类
 * 实现熔断器模式，防止级联故障
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private stats: CircuitBreakerStats;
  private responseTimes: number[];
  private listeners: Set<CircuitBreakerEventListener>;
  private halfOpenTimer: NodeJS.Timeout | null;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = this.mergeConfig(config);
    this.state = this.initializeState();
    this.stats = this.initializeStats();
    this.responseTimes = [];
    this.listeners = new Set();
    this.halfOpenTimer = null;
  }

  /**
   * 执行带熔断保护的函数
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.checkState();

    if (this.state.state === 'OPEN') {
      throw new Error('Circuit breaker is OPEN');
    }

    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.onSuccess(duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.onFailure(error as Error, duration);
      throw error;
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * 获取统计信息
   */
  public getStats(): CircuitBreakerStats {
    return {
      state: this.state.state,
      totalRequests: this.state.requestCount,
      totalSuccesses: this.state.totalSuccessCount,
      totalFailures: this.state.totalFailureCount,
      successRate: this.calculateSuccessRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      lastError: this.stats.lastError,
    };
  }

  /**
   * 重置熔断器
   */
  public reset(): void {
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = null;
    }
    this.state = this.initializeState();
    this.responseTimes = [];
    this.stats = this.initializeStats();
    this.emitEvent('RESET', this.state);
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 添加事件监听器
   */
  public addListener(listener: CircuitBreakerEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * 移除事件监听器
   */
  public removeListener(listener: CircuitBreakerEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * 强制打开熔断器
   */
  public forceOpen(): void {
    if (this.state.state !== 'OPEN') {
      this.transitionTo('OPEN');
    }
  }

  /**
   * 强制关闭熔断器
   */
  public forceClose(): void {
    if (this.state.state !== 'CLOSED') {
      this.transitionTo('CLOSED');
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreakerConfig {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
      halfOpenTimeout: 30000,
      enableSlidingWindow: false,
      windowDuration: 60000,
    };
    return { ...defaultConfig, ...config };
  }

  /**
   * 初始化状态
   */
  private initializeState(): CircuitBreakerState {
    return {
      state: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: 0,
      lastStateChangeTime: Date.now(),
      requestCount: 0,
      totalSuccessCount: 0,
      totalFailureCount: 0,
    };
  }

  /**
   * 初始化统计
   */
  private initializeStats(): CircuitBreakerStats {
    return {
      state: 'CLOSED',
      totalRequests: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      successRate: 1,
      averageResponseTime: 0,
    };
  }

  /**
   * 检查状态
   */
  private checkState(): void {
    const now = Date.now();

    if (this.state.state === 'OPEN') {
      const timeSinceLastFailure = now - this.state.lastFailureTime;
      if (timeSinceLastFailure >= this.config.timeout) {
        this.transitionTo('HALF_OPEN');
      }
    } else if (this.state.state === 'HALF_OPEN') {
      const timeSinceStateChange = now - this.state.lastStateChangeTime;
      if (timeSinceStateChange >= this.config.halfOpenTimeout) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * 处理成功
   */
  private onSuccess(duration: number): void {
    this.state.requestCount++;
    this.state.totalSuccessCount++;
    this.state.successCount++;
    this.responseTimes.push(duration);

    if (this.config.enableSlidingWindow) {
      this.cleanupOldResponseTimes();
    }

    if (this.state.state === 'HALF_OPEN') {
      if (this.state.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    } else {
      this.state.failureCount = 0;
    }

    this.emitEvent('SUCCESS', this.state);
  }

  /**
   * 处理失败
   */
  private onFailure(error: Error, duration: number): void {
    this.state.requestCount++;
    this.state.totalFailureCount++;
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    this.stats.lastError = error;
    this.responseTimes.push(duration);

    if (this.config.enableSlidingWindow) {
      this.cleanupOldResponseTimes();
    }

    this.state.successCount = 0;

    if (this.state.state === 'HALF_OPEN') {
      this.transitionTo('OPEN');
    } else if (
      this.state.state === 'CLOSED' &&
      this.state.failureCount >= this.config.failureThreshold
    ) {
      this.transitionTo('OPEN');
    }

    this.emitEvent('FAILURE', this.state);
  }

  /**
   * 转换状态
   */
  private transitionTo(newState: CircuitState): void {
    this.state.state = newState;
    this.state.lastStateChangeTime = Date.now();

    if (newState === 'CLOSED') {
      this.state.failureCount = 0;
      this.state.successCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.state.successCount = 0;
    }

    this.stats.state = newState;
    this.emitEvent('STATE_CHANGE', this.state);
  }

  /**
   * 计算成功率
   */
  private calculateSuccessRate(): number {
    if (this.state.requestCount === 0) {
      return 1;
    }
    return this.state.totalSuccessCount / this.state.requestCount;
  }

  /**
   * 计算平均响应时间
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) {
      return 0;
    }
    const sum = this.responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimes.length;
  }

  /**
   * 清理旧的响应时间
   */
  private cleanupOldResponseTimes(): void {
    const now = Date.now();
    this.responseTimes = this.responseTimes.filter(
      time => now - time < this.config.windowDuration
    );
  }

  /**
   * 触发事件
   */
  private emitEvent(
    event: CircuitBreakerEvent,
    state: CircuitBreakerState
  ): void {
    this.listeners.forEach(listener => {
      try {
        listener(event, state);
      } catch (error) {
        console.error('Error in circuit breaker event listener:', error);
      }
    });
  }

  /**
   * 关闭熔断器
   */
  public shutdown(): void {
    this.reset();
    this.listeners.clear();
  }
}

/**
 * 熔断器工厂
 */
export class CircuitBreakerFactory {
  private static instances: Map<string, CircuitBreaker> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new CircuitBreaker(config);
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static createCustomInstance(
    name: string,
    config: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const instance = new CircuitBreaker(config);
    this.instances.set(name, instance);
    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      instance.shutdown();
      this.instances.delete(name);
      return true;
    }
    return false;
  }

  public static getAllInstances(): Map<string, CircuitBreaker> {
    return new Map(this.instances);
  }

  public static resetAll(): void {
    this.instances.forEach(instance => instance.reset());
  }

  public static shutdownAll(): void {
    this.instances.forEach(instance => instance.shutdown());
    this.instances.clear();
  }
}

export default CircuitBreakerFactory;
