/**
 * AI服务重试处理器
 *
 * 为文档解析API提供智能重试机制
 * 支持多次重试、递增超时、自动降级到Mock
 */

import { fallbackDocAnalysis, validateMockResult } from './mock-doc-analyzer';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 重试选项
 */
export interface RetryOptions {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 超时时间列表（毫秒） */
  timeouts: number[];
  /** 是否启用降级 */
  enableFallback: boolean;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 重试时是否记录详细日志 */
  verboseLogging?: boolean;
}

/**
 * 重试结果
 */
export interface RetryResult<T> {
  /** 最终结果 */
  result: T;
  /** 是否成功 */
  success: boolean;
  /** 重试次数 */
  attempts: number;
  /** 是否降级到Mock */
  isFallback?: boolean;
  /** 错误信息（如果失败） */
  error?: Error;
  /** 执行时间（毫秒） */
  duration: number;
}

// =============================================================================
// 错误类型判断
// =============================================================================

/**
 * 判断错误是否为超时错误
 *
 * @param error - 错误对象
 * @returns 是否为超时错误
 */
export function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  const timeoutKeywords = [
    'timeout',
    'timed out',
    'time out',
    'exceeded timeout',
    '请求超时',
    '超时',
  ];

  return timeoutKeywords.some(keyword => errorMessage.includes(keyword));
}

/**
 * 判断错误是否为网络错误
 *
 * @param error - 错误对象
 * @returns 是否为网络错误
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  const networkKeywords = [
    'network',
    'network error',
    'connection refused',
    'connection timeout',
    '连接失败',
    '网络错误',
    'econnrefused',
    'enotfound',
  ];

  return networkKeywords.some(keyword => errorMessage.includes(keyword));
}

/**
 * 判断错误是否可重试
 *
 * @param error - 错误对象
 * @returns 是否可重试
 */
export function isRetryableError(error: unknown): boolean {
  return isTimeoutError(error) || isNetworkError(error);
}

// =============================================================================
// 核心重试函数
// =============================================================================

/**
 * 带重试机制的AI服务调用
 *
 * @param requestFn - 请求函数
 * @param options - 重试选项
 * @returns 重试结果
 */
export async function retryWithFallback<T>(
  requestFn: () => Promise<T>,
  options: RetryOptions
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 2,
    timeouts = [60000, 30000],
    enableFallback = true,
    retryDelay = 1000,
    verboseLogging = false,
  } = options;

  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  for (attempts = 0; attempts < maxAttempts; attempts++) {
    const attemptStartTime = Date.now();
    const timeout = timeouts[attempts] || timeouts[timeouts.length - 1];

    try {
      if (verboseLogging) {
        logger.info(
          `[重试处理] 第${attempts + 1}/${maxAttempts}次尝试，超时${timeout}ms`
        );
      }

      // 执行请求
      const result = await Promise.race([
        requestFn(),
        createTimeoutPromise(timeout),
      ]);

      const duration = Date.now() - startTime;

      if (verboseLogging) {
        logger.info(
          `[重试处理] 第${attempts + 1}次尝试成功，耗时${duration}ms`
        );
      }

      return {
        result,
        success: true,
        attempts: attempts + 1,
        isFallback: false,
        duration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const attemptDuration = Date.now() - attemptStartTime;

      if (verboseLogging) {
        logger.error(
          `[重试处理] 第${attempts + 1}次尝试失败: ${lastError.message}，耗时${attemptDuration}ms`
        );
      }

      // 判断是否继续重试
      const shouldContinue =
        attempts < maxAttempts - 1 && isRetryableError(lastError);

      if (!shouldContinue) {
        // 最后一次失败，检查是否启用降级
        if (enableFallback) {
          logger.warn('[重试处理] 所有重试失败，启用Mock降级');
          const totalDuration = Date.now() - startTime;

          try {
            // 使用Mock降级
            const fallbackResult = fallbackDocAnalysis();

            // 验证Mock数据
            const isValid = validateMockResult(fallbackResult);

            return {
              result: fallbackResult as unknown as T,
              success: isValid,
              attempts: attempts + 1,
              isFallback: true,
              duration: totalDuration,
            };
          } catch (fallbackError) {
            logger.error(`[重试处理] Mock降级失败: ${fallbackError}`);

            return {
              result: null as unknown as T,
              success: false,
              attempts: attempts + 1,
              isFallback: true,
              error: lastError,
              duration: Date.now() - startTime,
            };
          }
        }

        // 不启用降级，直接返回错误
        return {
          result: null as unknown as T,
          success: false,
          attempts: attempts + 1,
          isFallback: false,
          error: lastError,
          duration: Date.now() - startTime,
        };
      }

      // 等待后重试
      if (verboseLogging) {
        logger.info(`[重试处理] 等待${retryDelay}ms后重试`);
      }

      await sleep(retryDelay);
    }
  }

  // 理论上不会到达这里，但TypeScript需要
  return {
    result: null as unknown as T,
    success: false,
    attempts: maxAttempts,
    isFallback: false,
    error: lastError,
    duration: Date.now() - startTime,
  };
}

/**
 * 文档分析专用重试函数
 *
 * @param requestFn - 文档分析请求函数
 * @returns 重试结果
 */
export async function retryDocAnalysis<T>(
  requestFn: () => Promise<T>
): Promise<RetryResult<T>> {
  return retryWithFallback(requestFn, {
    maxAttempts: 2,
    timeouts: [60000, 30000], // 第1次60秒，第2次30秒
    enableFallback: true,
    retryDelay: 1000,
    verboseLogging: true,
  });
}

/**
 * 延迟函数
 *
 * @param ms - 延迟毫秒数
 * @returns Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 创建超时Promise
 *
 * @param timeoutMs - 超时毫秒数
 * @returns 超时Promise
 */
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}

// =============================================================================
// 配置工厂函数
// =============================================================================

/**
 * 获取E2E测试重试配置
 *
 * @returns 重试选项
 */
export function getE2ERetryConfig(): RetryOptions {
  return {
    maxAttempts: 2,
    timeouts: [60000, 30000],
    enableFallback: true,
    retryDelay: 1000,
    verboseLogging: true,
  };
}

/**
 * 获取生产环境重试配置
 *
 * @returns 重试选项
 */
export function getProductionRetryConfig(): RetryOptions {
  return {
    maxAttempts: 5,
    timeouts: [60000, 60000, 60000, 60000, 60000],
    enableFallback: true,
    retryDelay: 2000,
    verboseLogging: false,
  };
}

/**
 * 获取开发环境重试配置
 *
 * @returns 重试选项
 */
export function getDevelopmentRetryConfig(): RetryOptions {
  return {
    maxAttempts: 3,
    timeouts: [45000, 30000, 20000],
    enableFallback: false, // 开发环境不降级
    retryDelay: 1500,
    verboseLogging: true,
  };
}

/**
 * 根据环境自动选择重试配置
 *
 * @returns 重试选项
 */
export function getRetryConfig(): RetryOptions {
  const isE2ETest =
    process.env.TEST_TYPE === 'e2e' || process.env.PLAYWRIGHT_TEST === 'true';
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (isE2ETest) {
    return getE2ERetryConfig();
  }

  switch (nodeEnv) {
    case 'production':
      return getProductionRetryConfig();
    case 'development':
    default:
      return getDevelopmentRetryConfig();
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export const retryHandler = {
  retryWithFallback,
  retryDocAnalysis,
  isTimeoutError,
  isNetworkError,
  isRetryableError,
  getE2ERetryConfig,
  getProductionRetryConfig,
  getDevelopmentRetryConfig,
  getRetryConfig,
};
