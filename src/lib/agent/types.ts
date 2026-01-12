// Agent系统内部类型定义和工具函数

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentError,
  AgentErrorType,
  AgentStats,
  AgentEvent,
  AgentEventType,
} from '../../types/agent';

import { AgentType, AgentStatus, TaskPriority } from '../../types/agent';

import * as crypto from 'crypto';

// =============================================================================
// 内部工具类型
// =============================================================================

// Agent执行状态
export interface AgentExecutionState {
  agentName: string;
  status: AgentStatus;
  startTime?: number;
  endTime?: number;
  context?: AgentContext;
  result?: AgentResult;
  error?: AgentError;
}

// Agent缓存配置
export interface AgentCacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  keyPrefix: string;
}

// Agent日志级别
export enum AgentLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

// Agent日志条目
export interface AgentLogEntry {
  level: AgentLogLevel;
  timestamp: number;
  agentName: string;
  message: string;
  data?: any;
  error?: Error;
}

// =============================================================================
// Agent配置管理
// =============================================================================

// Agent系统配置
export interface AgentSystemConfig {
  // 全局设置
  defaultTimeout: number;
  maxConcurrentExecutions: number;
  enableMetrics: boolean;
  enableCaching: boolean;

  // 缓存配置
  cache: AgentCacheConfig;

  // 重试配置
  retry: {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };

  // 监控配置
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    retentionDays: number;
  };

  // 日志配置
  logging: {
    level: AgentLogLevel;
    enableConsole: boolean;
    enableFile: boolean;
    filePath?: string;
  };
}

// =============================================================================
// Agent执行工具函数
// =============================================================================

// 创建Agent错误
export function createAgentError(
  code: string,
  message: string,
  type: AgentErrorType,
  agentName: string,
  retryable: boolean = false,
  details?: Record<string, any>
): AgentError {
  return {
    code,
    message,
    type,
    agentName,
    timestamp: Date.now(),
    retryable,
    details,
    stack: new Error().stack,
  };
}

// 创建Agent结果
export function createAgentResult(
  agentName: string,
  data?: any,
  options: {
    success?: boolean;
    executionTime?: number;
    confidence?: number;
    tokensUsed?: number;
    cost?: number;
    output?: string;
    structuredOutput?: Record<string, any>;
    context?: any;
    cached?: boolean;
    cacheKey?: string;
    error?: AgentError;
  } = {}
): AgentResult {
  return {
    success: options.success !== false,
    agentName,
    executionTime: options.executionTime || 0,
    data,
    output: options.output,
    structuredOutput: options.structuredOutput,
    confidence: options.confidence,
    tokensUsed: options.tokensUsed,
    cost: options.cost,
    context: options.context,
    cached: options.cached,
    cacheKey: options.cacheKey,
    error: options.error,
  };
}

// 验证Agent上下文
export function validateAgentContext(context: AgentContext): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!context.task || typeof context.task !== 'string') {
    errors.push('Task is required and must be a string');
  }

  if (!context.data || typeof context.data !== 'object') {
    errors.push('Data is required and must be an object');
  }

  if (!Object.values(TaskPriority).includes(context.priority)) {
    errors.push('Priority must be a valid TaskPriority value');
  }

  if (context.options && typeof context.options !== 'object') {
    errors.push('Options must be an object if provided');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 生成缓存键
export function generateCacheKey(context: AgentContext): string {
  const keyData = {
    agentName: context.taskType || 'unknown',
    task: context.task,
    data: context.data,
    options: context.options,
  };

  return crypto
    .createHash('sha256')
    .update(JSON.stringify(keyData))
    .digest('hex');
}

// 计算执行统计
export function calculateExecutionStats(
  startTime: number,
  endTime: number,
  success: boolean,
  previousStats?: AgentStats
): Partial<AgentStats> {
  const executionTime = endTime - startTime;
  const totalExecutions = (previousStats?.totalExecutions || 0) + 1;
  const successfulExecutions =
    (previousStats?.successfulExecutions || 0) + (success ? 1 : 0);
  const failedExecutions =
    (previousStats?.failedExecutions || 0) + (success ? 0 : 1);

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageExecutionTime: previousStats
      ? (previousStats.averageExecutionTime * (totalExecutions - 1) +
          executionTime) /
        totalExecutions
      : executionTime,
    lastExecutionTime: endTime,
    errorRate: totalExecutions > 0 ? failedExecutions / totalExecutions : 0,
  };
}

// =============================================================================
// Agent事件系统
// =============================================================================

// Agent事件监听器
export type AgentEventListener = (event: AgentEvent) => void;

// Agent事件管理器
export interface AgentEventManager {
  on(event: AgentEventType, listener: AgentEventListener): void;
  off(event: AgentEventType, listener: AgentEventListener): void;
  emit(event: AgentEvent): void;
}

// 创建Agent事件
export function createAgentEvent(
  type: AgentEventType,
  agentName: string,
  data?: any
): AgentEvent {
  return {
    type,
    timestamp: Date.now(),
    agentName,
    data,
  };
}

// =============================================================================
// 类型守卫
// =============================================================================

// 检查是否为有效的AgentType
export function isValidAgentType(type: string): type is AgentType {
  return Object.values(AgentType).includes(type as AgentType);
}

// 检查是否为有效的AgentStatus
export function isValidAgentStatus(status: string): status is AgentStatus {
  return Object.values(AgentStatus).includes(status as AgentStatus);
}

// 检查是否为有效的TaskPriority
export function isValidTaskPriority(
  priority: string
): priority is TaskPriority {
  return Object.values(TaskPriority).includes(priority as TaskPriority);
}

// 检查是否为有效的Agent实例
export function isValidAgent(obj: any): obj is Agent {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.name === 'string' &&
    typeof obj.type === 'string' &&
    typeof obj.version === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.execute === 'function'
  );
}

// =============================================================================
// 导出默认配置
// =============================================================================

export const DEFAULT_AGENT_CONFIG: AgentSystemConfig = {
  defaultTimeout: 30000, // 30秒
  maxConcurrentExecutions: 5,
  enableMetrics: true,
  enableCaching: true,
  cache: {
    enabled: true,
    ttl: 300000, // 5分钟
    maxSize: 1000,
    keyPrefix: 'agent_',
  },
  retry: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  monitoring: {
    enabled: true,
    metricsInterval: 60000, // 1分钟
    retentionDays: 7,
  },
  logging: {
    level: AgentLogLevel.INFO,
    enableConsole: true,
    enableFile: false,
  },
};
