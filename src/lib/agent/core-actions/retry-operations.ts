/**
 * 重试操作模块（Retry Operations）
 * 包含：重试机制功能
 */

import type { RetryOperationResult } from "./types";

/**
 * retry_operation - 重试操作
 * 带指数退避的重试机制
 */
export async function retry_operation<T>(params: {
  operation: () => Promise<T>;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}): Promise<RetryOperationResult<T>> {
  const maxAttempts = params.maxAttempts || 3;
  const baseDelay = params.baseDelay || 1000;
  const maxDelay = params.maxDelay || 10000;
  const backoffMultiplier = params.backoffMultiplier || 2;
  const shouldRetry = params.shouldRetry || (() => true);

  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await params.operation();
      return {
        success: true,
        result,
        attempts: attempt,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const err = error as Error;
      if (attempt === maxAttempts || !shouldRetry(err)) {
        return {
          success: false,
          attempts: attempt,
          executionTime: Date.now() - startTime,
          error: err,
        };
      }

      const delay = Math.min(
        baseDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    executionTime: Date.now() - startTime,
    error: new Error("Max retries exceeded"),
  };
}
