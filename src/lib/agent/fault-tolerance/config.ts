// 容错配置模块
// 定义Agent容错机制的各种配置选项

import type { AgentContext } from '../../../types/agent';

// =============================================================================
// 容错配置类型定义
// =============================================================================

/**
 * 重试配置
 * 控制Agent执行失败时的重试行为
 */
export interface RetryConfig {
  /** 最大重试次数（包含首次执行） */
  maxRetries: number;
  /** 退避时间数组（毫秒）- 指数退避策略 */
  backoffMs: number[];
  /** 可重试的错误类型/错误码 */
  retryableErrors: string[];
}

/**
 * 降级配置
 * 控制重试失败后的降级行为
 */
export interface FallbackConfig {
  /** 是否启用降级功能 */
  enabled: boolean;
  /** 降级类型 */
  fallbackType?: 'SIMPLE' | 'CACHED' | 'RULE_BASED' | 'TEMPLATE' | 'LOCAL';
  /** 降级函数（由具体Agent提供） */
  fallbackFunction?: (
    error: unknown,
    context: AgentContext
  ) => Promise<unknown>;
}

/**
 * 熔断器配置
 * 控制熔断器状态转换的阈值
 */
export interface CircuitBreakerConfig {
  /** 是否启用熔断器 */
  enabled: boolean;
  /** 失败阈值（0-1之间）- 例如0.3表示失败率30%时熔断 */
  failureThreshold: number;
  /** 熔断开启后的恢复等待时间（毫秒） */
  timeout: number;
  /** 半开状态下的测试请求数 */
  halfOpenRequests: number;
}

/**
 * Agent容错配置
 * 综合配置所有容错机制
 */
export interface AgentFaultToleranceConfig {
  /** 重试配置 */
  retry: RetryConfig;
  /** 降级配置 */
  fallback: FallbackConfig;
  /** 熔断器配置 */
  circuitBreaker: CircuitBreakerConfig;
}

/**
 * 容错执行结果
 * 记录容错机制的执行情况
 */
export interface FaultToleranceResult {
  /** 是否执行成功 */
  success: boolean;
  /** 总执行次数（包含重试） */
  totalAttempts: number;
  /** 是否使用了降级方案 */
  fallbackUsed: boolean;
  /** 降级类型 */
  fallbackType?: string;
  /** 是否触发熔断器 */
  circuitBreakerTripped: boolean;
  /** 最终错误（如果失败） */
  finalError?: unknown;
  /** 执行耗时（毫秒） */
  executionTime: number;
}

// =============================================================================
// 默认配置
// =============================================================================

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: [1000, 2000, 4000],
  retryableErrors: [
    'TIMEOUT',
    'NETWORK',
    'AI_SERVICE',
    'RATE_LIMIT',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ],
};

/**
 * 默认降级配置
 */
export const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enabled: false,
  fallbackType: 'SIMPLE',
};

/**
 * 默认熔断器配置
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 0.3, // 失败率30%
  timeout: 300000, // 5分钟
  halfOpenRequests: 3,
};

/**
 * 默认容错配置
 */
export const DEFAULT_FAULT_TOLERANCE_CONFIG: AgentFaultToleranceConfig = {
  retry: DEFAULT_RETRY_CONFIG,
  fallback: DEFAULT_FALLBACK_CONFIG,
  circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG,
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 验证容错配置
 */
export function validateFaultToleranceConfig(
  config: AgentFaultToleranceConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 验证重试配置
  if (config.retry.maxRetries < 0) {
    errors.push('maxRetries must be non-negative');
  }

  if (config.retry.backoffMs.length === 0) {
    errors.push('backoffMs array must not be empty');
  }

  for (const ms of config.retry.backoffMs) {
    if (ms < 0) {
      errors.push('backoffMs values must be positive');
    }
  }

  if (config.retry.retryableErrors.length === 0) {
    errors.push('retryableErrors array must not be empty');
  }

  // 验证降级配置
  if (config.fallback.enabled && !config.fallback.fallbackFunction) {
    errors.push('fallbackFunction is required when fallback is enabled');
  }

  // 验证熔断器配置
  if (config.circuitBreaker.enabled) {
    if (
      config.circuitBreaker.failureThreshold < 0 ||
      config.circuitBreaker.failureThreshold > 1
    ) {
      errors.push('failureThreshold must be between 0 and 1');
    }

    if (config.circuitBreaker.timeout < 0) {
      errors.push('timeout must be positive');
    }

    if (config.circuitBreaker.halfOpenRequests < 0) {
      errors.push('halfOpenRequests must be non-negative');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 创建重试配置
 */
export function createRetryConfig(
  overrides: Partial<RetryConfig> = {}
): RetryConfig {
  return {
    ...DEFAULT_RETRY_CONFIG,
    ...overrides,
  };
}

/**
 * 创建降级配置
 */
export function createFallbackConfig(
  overrides: Partial<FallbackConfig> = {}
): FallbackConfig {
  return {
    ...DEFAULT_FALLBACK_CONFIG,
    ...overrides,
  };
}

/**
 * 创建熔断器配置
 */
export function createCircuitBreakerConfig(
  overrides: Partial<CircuitBreakerConfig> = {}
): CircuitBreakerConfig {
  return {
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    ...overrides,
  };
}

/**
 * 创建完整容错配置
 */
export function createFaultToleranceConfig(
  overrides: Partial<AgentFaultToleranceConfig> = {}
): AgentFaultToleranceConfig {
  const config: AgentFaultToleranceConfig = {
    retry: {
      ...DEFAULT_RETRY_CONFIG,
      ...overrides.retry,
    },
    fallback: {
      ...DEFAULT_FALLBACK_CONFIG,
      ...overrides.fallback,
    },
    circuitBreaker: {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...overrides.circuitBreaker,
    },
  };

  // 验证配置
  const validation = validateFaultToleranceConfig(config);
  if (!validation.valid) {
    throw new Error(
      `Invalid fault tolerance config: ${validation.errors.join(', ')}`
    );
  }

  return config;
}
