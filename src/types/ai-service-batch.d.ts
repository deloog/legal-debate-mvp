// AI服务批量处理和熔断器类型定义
import type { AIRequestConfig, AIResponse } from './ai-service';

// =============================================================================
// 批量处理类型定义
// =============================================================================

/**
 * 批量请求项
 */
export interface BatchRequestItem {
  /** 请求ID */
  requestId: string;
  /** AI请求配置 */
  request: AIRequestConfig;
  /** 解析Promise的resolve函数 */
  resolve: (value: AIResponse) => void;
  /** 解析Promise的reject函数 */
  reject: (error: Error) => void;
  /** 请求时间戳 */
  timestamp: number;
  /** 是否已处理 */
  processed: boolean;
}

/**
 * 批量请求结果
 */
export interface BatchRequestResult {
  /** 请求ID */
  requestId: string;
  /** 成功标志 */
  success: boolean;
  /** 响应数据 */
  response?: AIResponse;
  /** 错误信息 */
  error?: Error;
  /** 处理时间（毫秒） */
  duration: number;
}

/**
 * 批量处理器配置
 */
export interface BatchProcessorConfig {
  /** 最大批次大小 */
  maxBatchSize: number;
  /** 批次等待时间（毫秒） */
  batchTimeout: number;
  /** 最大并发批次数 */
  maxConcurrentBatches: number;
  /** 是否启用优先级队列 */
  enablePriority: boolean;
  /** 是否启用去重 */
  enableDeduplication: boolean;
}

/**
 * 批量处理器统计
 */
export interface BatchProcessorStats {
  /** 总请求数 */
  totalRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 总批次数 */
  totalBatches: number;
  /** 成功批次数 */
  successfulBatches: number;
  /** 失败批次数 */
  failedBatches: number;
  /** 平均批次大小 */
  averageBatchSize: number;
  /** 平均批次处理时间（毫秒） */
  averageBatchDuration: number;
  /** 当前队列长度 */
  currentQueueLength: number;
  /** 当前处理中的批次数 */
  activeBatches: number;
}

/**
 * 批量处理函数类型
 */
export type BatchProcessFunction = (
  requests: BatchRequestItem[]
) => Promise<BatchRequestResult[]>;

// =============================================================================
// 熔断器类型定义
// =============================================================================

/**
 * 熔断器状态
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  /** 熔断阈值（连续失败次数） */
  failureThreshold: number;
  /** 成功阈值（恢复所需连续成功次数） */
  successThreshold: number;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 半开状态超时（毫秒） */
  halfOpenTimeout: number;
  /** 是否启用统计窗口 */
  enableSlidingWindow: boolean;
  /** 统计窗口大小（毫秒） */
  windowDuration: number;
}

/**
 * 熔断器状态信息
 */
export interface CircuitBreakerState {
  /** 当前状态 */
  state: CircuitState;
  /** 失败计数 */
  failureCount: number;
  /** 成功计数 */
  successCount: number;
  /** 最后失败时间 */
  lastFailureTime: number;
  /** 最后状态变更时间 */
  lastStateChangeTime: number;
  /** 调用次数 */
  requestCount: number;
  /** 总成功数 */
  totalSuccessCount: number;
  /** 总失败数 */
  totalFailureCount: number;
}

/**
 * 熔断器统计信息
 */
export interface CircuitBreakerStats {
  /** 当前状态 */
  state: CircuitState;
  /** 总调用次数 */
  totalRequests: number;
  /** 总成功数 */
  totalSuccesses: number;
  /** 总失败数 */
  totalFailures: number;
  /** 成功率 */
  successRate: number;
  /** 平均响应时间（毫秒） */
  averageResponseTime: number;
  /** 最后错误 */
  lastError?: Error;
}

/**
 * 熔断器事件类型
 */
export type CircuitBreakerEvent =
  | 'STATE_CHANGE'
  | 'FAILURE'
  | 'SUCCESS'
  | 'TIMEOUT'
  | 'RESET';

/**
 * 熔断器事件监听器
 */
export type CircuitBreakerEventListener = (
  event: CircuitBreakerEvent,
  state: CircuitBreakerState
) => void;

// =============================================================================
// 重试策略类型定义
// =============================================================================

/**
 * 重试策略配置
 */
export interface RetryStrategyConfig {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 基础延迟（毫秒） */
  baseDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避乘数 */
  backoffMultiplier: number;
  /** 是否启用抖动 */
  enableJitter: boolean;
  /** 抖动范围（0-1） */
  jitterFactor: number;
  /** 是否启用指数退避 */
  enableExponentialBackoff: boolean;
  /** 可重试的错误类型 */
  retryableErrorTypes: string[];
  /** 自定义重试条件 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 自定义延迟计算 */
  calculateDelay?: (attempt: number) => number;
}

/**
 * 重试统计
 */
export interface RetryStats {
  /** 总重试次数 */
  totalRetries: number;
  /** 成功重试数 */
  successfulRetries: number;
  /** 失败重试数 */
  failedRetries: number;
  /** 平均重试次数 */
  averageRetriesPerRequest: number;
  /** 总重试时间（毫秒） */
  totalRetryTime: number;
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
  /** 错误信息（如果失败） */
  error?: Error;
  /** 总耗时（毫秒） */
  duration: number;
}

// =============================================================================
// 并发控制类型定义
// =============================================================================

/**
 * 并发控制器配置
 */
export interface ConcurrencyControlConfig {
  /** 最大并发数 */
  maxConcurrency: number;
  /** 队列最大长度 */
  maxQueueSize: number;
  /** 队列超时时间（毫秒） */
  queueTimeout: number;
  /** 是否启用优先级 */
  enablePriority: boolean;
  /** 是否启用公平调度 */
  enableFairScheduling: boolean;
}

/**
 * 队列任务优先级
 */
export type TaskPriority = 'high' | 'normal' | 'low';

/**
 * 队列任务
 */
export interface QueuedTask<T> {
  /** 任务ID */
  taskId: string;
  /** 执行函数 */
  execute: () => Promise<T>;
  /** 优先级 */
  priority: TaskPriority;
  /** 创建时间 */
  createdAt: number;
  /** 超时时间 */
  timeoutAt: number;
  /** resolve函数 */
  resolve: (value: T) => void;
  /** reject函数 */
  reject: (error: Error) => void;
  /** 执行次数 */
  attempts: number;
  /** 是否已取消 */
  cancelled: boolean;
}

/**
 * 并发控制器统计
 */
export interface ConcurrencyControlStats {
  /** 总任务数 */
  totalTasks: number;
  /** 成功任务数 */
  successfulTasks: number;
  /** 失败任务数 */
  failedTasks: number;
  /** 取消任务数 */
  cancelledTasks: number;
  /** 当前并发数 */
  currentConcurrency: number;
  /** 当前队列长度 */
  currentQueueLength: number;
  /** 平均等待时间（毫秒） */
  averageWaitTime: number;
  /** 平均执行时间（毫秒） */
  averageExecutionTime: number;
  /** 平均重试次数 */
  averageRetries: number;
}
