// AI服务基础设施类型定义

// =============================================================================
// 基础类型定义
// =============================================================================

// AI服务提供商
export type AIProvider = 'zhipu' | 'deepseek' | 'openai' | 'anthropic';

// AI模型类型
export type AIModelType = 'chat' | 'embedding' | 'completion' | 'coding';

// 消息角色
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

// =============================================================================
// 请求和响应类型
// =============================================================================

// AI消息接口
export interface AIMessage {
  id?: string;
  role: MessageRole;
  content: string;
  name?: string;
  functionCall?: FunctionCall;
  metadata?: Record<string, unknown>;
}

// 函数调用
export interface FunctionCall {
  name: string;
  arguments: string;
}

// AI请求配置
export interface AIRequestConfig {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  stream?: boolean;
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  user?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  provider?: AIProvider; // 添加提供商字段
}

// 函数定义
export interface FunctionDefinition {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// AI响应
export interface AIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: AIChoice[];
  usage?: TokenUsage;
  provider: AIProvider;
  duration: number;
  cached?: boolean;
  metadata?: Record<string, unknown>;
}

// AI选择
export interface AIChoice {
  index: number;
  message: AIMessage;
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter';
  logprobs?: null;
}

// Token使用情况
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// 嵌入响应
export interface EmbeddingResponse {
  object: 'list';
  data: EmbeddingData[];
  model: string;
  usage: TokenUsage;
  provider: AIProvider;
  duration: number;
}

// 嵌入数据
export interface EmbeddingData {
  object: 'embedding';
  embedding: number[];
  index: number;
}

// =============================================================================
// 错误处理类型
// =============================================================================

// AI错误类型
export interface AIError {
  code: string;
  message: string;
  type: AIErrorType;
  provider: AIProvider;
  statusCode?: number;
  requestId?: string;
  details?: Record<string, unknown>;
  timestamp: number;
  retryable: boolean;
}

// AI错误类型枚举
export type AIErrorType =
  | 'authentication_error'
  | 'permission_error'
  | 'not_found_error'
  | 'rate_limit_error'
  | 'api_error'
  | 'timeout_error'
  | 'network_error'
  | 'validation_error'
  | 'insufficient_quota'
  | 'model_not_available'
  | 'content_filter'
  | 'unknown_error';

// 重试策略
export interface RetryStrategy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: AIErrorType[];
}

// =============================================================================
// 配置类型
// =============================================================================

// AI客户端配置
export interface AIClientConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retryStrategy?: RetryStrategy;
  rateLimits?: RateLimits;
  headers?: Record<string, string>;
  proxy?: {
    host: string;
    port: number;
    auth?: {
      username: string;
      password: string;
    };
  };
}

// 速率限制
export interface RateLimits {
  requestsPerSecond?: number;
  requestsPerMinute?: number;
  tokensPerMinute?: number;
  tokensPerDay?: number;
}

// 负载均衡配置
export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  failureThreshold: number;
  recoveryThreshold: number;
  weights?: Record<AIProvider, number>;
  roundRobin?: boolean;
}

// 负载均衡策略
export type LoadBalancingStrategy =
  | 'round_robin'
  | 'weighted_round_robin'
  | 'least_connections'
  | 'least_response_time'
  | 'random'
  | 'provider_priority';

// 监控配置
export interface MonitorConfig {
  enabled: boolean;
  metricsInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  persistMetrics: boolean;
  alertThresholds?: AlertThresholds;
}

// 告警阈值
export interface AlertThresholds {
  responseTime: number;
  errorRate: number;
  rateLimitHits: number;
  queueLength: number;
}

// 降级配置
export interface FallbackConfig {
  enabled: boolean;
  strategies: FallbackStrategy[];
  cacheFallback: {
    enabled: boolean;
    ttl: number;
    maxAge: number;
  };
  simplifiedMode: {
    enabled: boolean;
    maxTokens: number;
    simplifiedPrompts: boolean;
  };
  localProcessing: {
    enabled: boolean;
    capabilities: string[];
  };
}

// 降级策略
export interface FallbackStrategy {
  priority: number;
  condition: FallbackCondition;
  action: FallbackAction;
}

// 降级条件
export type FallbackCondition =
  | 'provider_error'
  | 'rate_limit'
  | 'timeout'
  | 'high_latency'
  | 'manual_trigger'
  | 'all_providers_down';

// 降级行动
export type FallbackAction =
  | 'switch_provider'
  | 'use_cache'
  | 'simplified_request'
  | 'local_processing'
  | 'return_error';

// =============================================================================
// 监控和指标类型
// =============================================================================

// 性能指标
export interface PerformanceMetrics {
  provider: AIProvider;
  model: string;
  timestamp: number;
  responseTime: number;
  tokensUsed: number;
  success: boolean;
  errorType?: AIErrorType;
  cacheHit: boolean;
  queueTime?: number;
}

// 健康状态
export interface HealthStatus {
  provider: AIProvider;
  healthy: boolean;
  lastCheck: number;
  responseTime: number;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastError?: AIError;
  uptime: number;
}

// 负载均衡状态
export interface LoadBalancerStatus {
  strategy: LoadBalancingStrategy;
  currentProvider: AIProvider;
  providerStats: ProviderStats[];
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
}

// 提供商统计
export interface ProviderStats {
  provider: AIProvider;
  weight: number;
  activeConnections: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastUsed: number;
  healthy: boolean;
}

// 监控事件
export interface MonitorEvent {
  type: MonitorEventType;
  timestamp: number;
  provider?: AIProvider;
  model?: string;
  data: Record<string, unknown>;
}

// 监控事件类型
export type MonitorEventType =
  | 'request_start'
  | 'request_complete'
  | 'request_error'
  | 'provider_switch'
  | 'fallback_activated'
  | 'health_check'
  | 'rate_limit_hit'
  | 'cache_hit'
  | 'cache_miss'
  | 'monitor_start'
  | 'monitor_stop'
  | 'health_change'
  | 'alert'
  | 'metrics_collected';

// =============================================================================
// 服务管理类型
// =============================================================================

// AI服务配置
export interface AIServiceConfig {
  clients: AIClientConfig[];
  loadBalancer: LoadBalancerConfig;
  monitor: MonitorConfig;
  fallback: FallbackConfig;
  defaultProvider?: AIProvider;
  defaultModel?: string;
  globalTimeout?: number;
  enableMetrics?: boolean;
}

// 服务状态
export interface ServiceStatus {
  initialized: boolean;
  healthy: boolean;
  totalRequests: number;
  totalErrors: number;
  averageResponseTime: number;
  uptime: number;
  providerStatus: Record<AIProvider, HealthStatus>;
  lastUpdate: number;
}

// =============================================================================
// 工具类型和辅助函数
// =============================================================================

// 提取AI响应的内容类型
export type ResponseContent = string | FunctionCall;

// 提取函数参数类型
export type ExtractFunctionParams<T extends FunctionDefinition> =
  T['parameters']['properties'];

// 条件类型：如果T是数组，返回T[number]，否则返回T
export type ArrayElement<T> = T extends (infer U)[] ? U : T;

// 深度部分类型
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// 选择性必需类型
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// 省略并扩展类型
export type OmitAndExtend<T, K extends keyof T, E> = Omit<T, K> & E;
