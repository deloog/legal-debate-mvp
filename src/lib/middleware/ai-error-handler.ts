/**
 * AI服务错误处理中间件
 * 提供超时控制、重试机制和友好的错误提示
 */

import { logger } from '@/lib/logger';

// =============================================================================
// 错误类型定义
// =============================================================================

/**
 * AI服务超时错误
 */
export class AIServiceTimeoutError extends Error {
  public readonly code: string = 'AI_TIMEOUT';
  public readonly statusCode: number = 408;
  public readonly timestamp: number;

  constructor(public readonly context: string) {
    super(`AI服务调用超时: ${context}`);
    this.name = 'AIServiceTimeoutError';
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, AIServiceTimeoutError.prototype);
  }
}

/**
 * AI服务失败错误
 */
export class AIServiceFailureError extends Error {
  public readonly code: string = 'AI_SERVICE_FAILURE';
  public readonly statusCode: number = 500;
  public readonly timestamp: number;

  constructor(
    public readonly context: string,
    public readonly originalError: Error
  ) {
    super(`AI服务调用失败: ${context}`);
    this.name = 'AIServiceFailureError';
    this.cause = originalError;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, AIServiceFailureError.prototype);
  }
}

/**
 * AI服务繁忙错误
 */
export class AIServiceBusyError extends Error {
  public readonly code: string = 'AI_SERVICE_BUSY';
  public readonly statusCode: number = 503;
  public readonly timestamp: number;

  constructor(public readonly context: string) {
    super(`AI服务繁忙: ${context}`);
    this.name = 'AIServiceBusyError';
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, AIServiceBusyError.prototype);
  }
}

// =============================================================================
// 重试选项
// =============================================================================

export interface RetryOptions {
  /**
   * 最大重试次数，默认3次
   */
  maxRetries?: number;
  /**
   * 操作上下文，用于错误提示
   */
  context?: string;
  /**
   * 是否启用指数退避，默认true
   */
  enableExponentialBackoff?: boolean;
  /**
   * 自定义重试条件判断函数
   */
  shouldRetry?: (error: Error) => boolean;
}

// =============================================================================
// AI服务错误处理器
// =============================================================================

export class AIServiceErrorHandler {
  private static readonly DEFAULT_TIMEOUT_MS = 30000; // 30秒
  private static readonly DEFAULT_MAX_RETRIES = 3; // 最多重试3次

  /**
   * 带超时的Promise执行
   * @param promise 要执行的Promise
   * @param context 操作上下文，用于错误提示
   * @param timeoutMs 超时时间（毫秒），默认30秒
   * @returns Promise执行结果
   * @throws AIServiceTimeoutError 当超时时抛出
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    context: string,
    timeoutMs: number = AIServiceErrorHandler.DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new AIServiceTimeoutError(context));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
      if (error instanceof AIServiceTimeoutError) {
        throw error;
      }
      // 重新抛出原始错误，避免掩盖真实问题
      throw error;
    }
  }

  /**
   * 带重试的异步操作执行
   * @param operation 要执行的操作
   * @param options 重试选项
   * @returns 操作执行结果
   * @throws 当重试次数耗尽时抛出最后一个错误
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = AIServiceErrorHandler.DEFAULT_MAX_RETRIES,
      context = 'AI服务调用',
      enableExponentialBackoff = true,
      shouldRetry = AIServiceErrorHandler.isRetryable,
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // 如果这是最后一次尝试，或者错误不可重试，直接抛出
        if (attempt >= maxRetries || !shouldRetry(error)) {
          throw lastError;
        }

        // 计算延迟时间（指数退避）
        const delay = enableExponentialBackoff
          ? Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
          : 1000; // 固定1秒延迟

        // 等待后再重试
        await new Promise(resolve => setTimeout(resolve, delay));

        logger.warn(`操作重试 (第${attempt + 1}/${maxRetries}次): ${context}`, {
          error: (error as Error).message,
          delay: `${delay}ms`,
        });
      }
    }

    // 理论上不会到达这里，但TypeScript需要
    throw lastError!;
  }

  /**
   * 获取用户友好的错误提示
   * @param error 错误对象
   * @param locale 语言环境，默认zh-CN
   * @returns 友好的错误提示
   */
  static getFriendlyMessage(error: Error, locale: string = 'zh-CN'): string {
    // 超时错误
    if (error instanceof AIServiceTimeoutError) {
      if (locale === 'zh-CN') {
        return '分析时间较长，请耐心等待';
      }
      return 'Analysis is taking longer than expected, please be patient';
    }

    // 服务繁忙错误
    if (error instanceof AIServiceBusyError) {
      if (locale === 'zh-CN') {
        return '当前服务繁忙，请稍后重试';
      }
      return 'Service is currently busy, please try again later';
    }

    // 服务失败错误
    if (error instanceof AIServiceFailureError) {
      if (locale === 'zh-CN') {
        return '当前服务繁忙，请稍后重试';
      }
      return 'Service is currently busy, please try again later';
    }

    // 通用错误提示
    if (locale === 'zh-CN') {
      return '系统处理出现问题，请稍后重试';
    }
    return 'System encountered an issue, please try again later';
  }

  /**
   * 判断错误是否可重试
   * @param error 错误对象
   * @returns 是否可重试
   */
  private static isRetryable(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    // 网络错误可重试
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('etimedout')
    ) {
      return true;
    }

    // 服务端错误（5xx）可重试
    if (error instanceof AIServiceFailureError) {
      return error.statusCode >= 500 && error.statusCode < 600;
    }

    // 429 Too Many Requests可重试
    if (error instanceof AIServiceBusyError) {
      return true;
    }

    // 其他错误不可重试（参数错误、认证错误等）
    return false;
  }
}
