// 容错模块入口
// 导出所有容错相关的类型、函数和类

export {
  // 配置类型
  type RetryConfig,
  type FallbackConfig,
  type CircuitBreakerConfig,
  type AgentFaultToleranceConfig,
  type FaultToleranceResult,

  // 默认配置
  DEFAULT_RETRY_CONFIG,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_FAULT_TOLERANCE_CONFIG,

  // 配置创建函数
  validateFaultToleranceConfig,
  createRetryConfig,
  createFallbackConfig,
  createCircuitBreakerConfig,
  createFaultToleranceConfig,
} from './config';

export {
  // 容错执行器
  FaultTolerantExecutor,
  createFaultTolerantExecutor,
} from './executor';
