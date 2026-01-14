import type {
  RetryStrategyConfig,
  RetryStats,
  RetryResult,
} from '../../types/ai-service-batch';

/**
 * 重试策略类
 * 提供智能的重试机制，包括指数退避和抖动
 */
export class RetryStrategy {
  private config: RetryStrategyConfig;
  private stats: RetryStats;

  constructor(config?: Partial<RetryStrategyConfig>) {
    this.config = this.mergeConfig(config);
    this.stats = this.initializeStats();
  }

  /**
   * 执行带重试策略的函数
   */
  public async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempt = 0;

    for (attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        const result = await this.executeWithTimeout(fn, attempt);
        const duration = Date.now() - startTime;

        if (attempt > 0) {
          this.stats.successfulRetries++;
        }

        return {
          result,
          success: true,
          attempts: attempt + 1,
          duration,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!this.shouldRetry(lastError, attempt)) {
          this.stats.failedRetries++;
          this.stats.totalRetries += attempt;

          throw lastError;
        }

        if (attempt < this.config.maxAttempts - 1) {
          const delay = this.calculateDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    this.stats.failedRetries++;
    this.stats.totalRetries += this.config.maxAttempts - 1;

    throw lastError;
  }

  /**
   * 获取统计信息
   */
  public getStats(): RetryStats {
    return {
      totalRetries: this.stats.totalRetries,
      successfulRetries: this.stats.successfulRetries,
      failedRetries: this.stats.failedRetries,
      averageRetriesPerRequest:
        this.stats.totalRetries > 0
          ? this.stats.totalRetries /
            (this.stats.successfulRetries + this.stats.failedRetries)
          : 0,
      totalRetryTime: this.stats.totalRetryTime,
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<RetryStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats = this.initializeStats();
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    config?: Partial<RetryStrategyConfig>
  ): RetryStrategyConfig {
    const defaultConfig: RetryStrategyConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      enableJitter: true,
      jitterFactor: 0.1,
      enableExponentialBackoff: true,
      retryableErrorTypes: [
        'timeout_error',
        'network_error',
        'rate_limit_error',
      ],
    };
    return { ...defaultConfig, ...config };
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): RetryStats {
    return {
      totalRetries: 0,
      successfulRetries: 0,
      failedRetries: 0,
      averageRetriesPerRequest: 0,
      totalRetryTime: 0,
    };
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: Error, attempt: number): boolean {
    if (attempt >= this.config.maxAttempts - 1) {
      return false;
    }

    if (this.config.shouldRetry) {
      return this.config.shouldRetry(error, attempt);
    }

    const errorMessage = error.message.toLowerCase();
    const errorType = this.inferErrorType(error);

    return (
      this.config.retryableErrorTypes.includes(errorType) ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('rate limit')
    );
  }

  /**
   * 推断错误类型
   */
  private inferErrorType(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('network') || message.includes('connection'))
      return 'network_error';
    if (message.includes('rate limit') || message.includes('too many requests'))
      return 'rate_limit_error';
    if (message.includes('authentication') || message.includes('unauthorized'))
      return 'authentication_error';
    if (message.includes('permission') || message.includes('forbidden'))
      return 'permission_error';
    if (message.includes('not found') || message.includes('does not exist'))
      return 'not_found_error';
    if (message.includes('quota') || message.includes('limit'))
      return 'insufficient_quota';
    if (message.includes('validation') || message.includes('invalid'))
      return 'validation_error';

    return 'unknown_error';
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number): number {
    if (this.config.calculateDelay) {
      return this.config.calculateDelay(attempt);
    }

    let delay = this.config.baseDelay;

    if (this.config.enableExponentialBackoff && attempt > 0) {
      delay =
        this.config.baseDelay *
        Math.pow(this.config.backoffMultiplier, attempt);
    }

    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.enableJitter) {
      delay = this.addJitter(delay);
    }

    return delay;
  }

  /**
   * 添加抖动
   */
  private addJitter(delay: number): number {
    const jitter = delay * this.config.jitterFactor;
    const randomJitter = (Math.random() - 0.5) * 2 * jitter;
    return delay + randomJitter;
  }

  /**
   * 执行带超时的函数
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    attempt: number
  ): Promise<T> {
    const timeout = Math.min(
      this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt),
      this.config.maxDelay
    );

    return Promise.race([fn(), this.createTimeoutPromise(timeout)]);
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 重试策略工厂
 */
export class RetryStrategyFactory {
  private static instances: Map<string, RetryStrategy> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<RetryStrategyConfig>
  ): RetryStrategy {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new RetryStrategy(config);
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static createCustomInstance(
    name: string,
    config: Partial<RetryStrategyConfig>
  ): RetryStrategy {
    const instance = new RetryStrategy(config);
    this.instances.set(name, instance);
    return instance;
  }

  public static removeInstance(name: string): boolean {
    return this.instances.delete(name);
  }

  public static getAllInstances(): Map<string, RetryStrategy> {
    return new Map(this.instances);
  }

  public static resetAll(): void {
    this.instances.forEach(instance => instance.resetStats());
  }

  public static shutdownAll(): void {
    this.instances.clear();
  }
}

export default RetryStrategyFactory;
