// 工作流编排系统 - 类型定义

import type {
  AgentType,
  AgentContext,
  AgentResult,
} from "../../../types/agent";

// =============================================================================
// 工作流定义接口
// =============================================================================

/**
 * 工作流步骤定义
 */
export interface WorkflowStep {
  // 步骤标识
  stepId: string;

  // Agent类型
  agentType: AgentType;

  // 步骤名称
  name: string;

  // 步骤描述
  description?: string;

  // 步骤优先级
  priority?: number;

  // 是否必须执行
  required: boolean;

  // 依赖步骤ID列表
  dependsOn?: string[];

  // 输入数据映射（从上下文中提取）
  inputData?: Record<string, string>;

  // 输出数据键名
  outputKey?: string;
}

/**
 * 工作流条件定义
 */
export interface WorkflowCondition {
  // 条件ID
  conditionId: string;

  // 条件表达式
  expression: string;

  // 条件描述
  description?: string;
}

/**
 * 工作流路由规则定义
 */
export interface WorkflowRoute {
  // 路由ID
  routeId: string;

  // 条件ID
  conditionId?: string;

  // 目标步骤ID
  targetStepId: string;

  // 默认路由标记
  isDefault?: boolean;
}

/**
 * 工作流回退策略定义
 */
export interface FallbackStrategy {
  // 回退策略ID
  strategyId: string;

  // 回退类型
  type: "retry" | "alternate" | "skip" | "abort";

  // 最大重试次数（retry类型）
  maxAttempts?: number;

  // 重试延迟（毫秒）
  retryDelay?: number;

  // 替代步骤ID（alternate类型）
  alternateStepId?: string;

  // 回退Agent类型（alternate类型）
  alternateAgentType?: AgentType;

  // 是否允许跳过
  allowSkip?: boolean;

  // 回退描述
  description?: string;
}

/**
 * 工作流定义接口
 */
export interface WorkflowDefinition {
  // 工作流ID
  workflowId: string;

  // 工作流名称
  name: string;

  // 工作流描述
  description?: string;

  // 工作流步骤
  steps: WorkflowStep[];

  // 工作流条件列表
  conditions?: WorkflowCondition[];

  // 路由规则列表
  routes?: WorkflowRoute[];

  // 执行模式
  executionMode: "sequential" | "parallel" | "mixed";

  // 回退策略
  fallbackStrategy?: FallbackStrategy;

  // 超时配置（毫秒）
  timeout?: number;

  // 是否启用熔断器
  enableCircuitBreaker?: boolean;

  // 工作流版本
  version?: string;

  // 标签
  tags?: string[];
}

// =============================================================================
// 工作流执行状态
// =============================================================================

/**
 * 步骤执行状态
 */
export enum StepStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
  RETRYING = "retrying",
}

/**
 * 工作流执行状态
 */
export enum WorkflowStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

/**
 * 步骤执行结果
 */
export interface StepExecution {
  stepId: string;
  status: StepStatus;
  result?: AgentResult;
  error?: Error;
  startTime: number;
  endTime?: number;
  retryCount: number;
  data?: any;
}

/**
 * 工作流执行上下文
 */
export interface WorkflowContext {
  // 工作流定义
  workflow: WorkflowDefinition;

  // 输入数据
  inputData: Record<string, any>;

  // 执行状态
  status: WorkflowStatus;

  // 步骤执行结果映射
  stepResults: Map<string, StepExecution>;

  // 共享数据（在步骤之间共享）
  sharedData: Map<string, any>;

  // 执行统计
  stats: {
    startTime: number;
    endTime?: number;
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
  };

  // 错误列表
  errors: Array<{
    stepId: string;
    error: Error;
    timestamp: number;
  }>;
}

/**
 * 工作流执行结果
 */
export interface WorkflowExecutionResult {
  // 工作流ID
  workflowId: string;

  // 执行状态
  status: WorkflowStatus;

  // 步骤执行结果
  stepResults: StepExecution[];

  // 最终输出数据
  outputData?: Record<string, any>;

  // 执行统计
  stats: {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    skippedSteps: number;
    totalExecutionTime: number;
    averageStepTime: number;
  };

  // 错误列表
  errors: Array<{
    stepId: string;
    error: Error;
  }>;

  // 执行时间
  startTime: number;
  endTime: number;
  executionTime: number;
}

// =============================================================================
// 熔断器接口
// =============================================================================

/**
 * 熔断器状态
 */
export enum CircuitBreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  // 失败阈值（连续失败多少次后开启熔断）
  failureThreshold: number;

  // 成功阈值（半开状态下多少次成功后关闭熔断）
  successThreshold: number;

  // 超时时间（毫秒）
  timeout: number;

  // 重置时间（毫秒，熔断开启后多久进入半开状态）
  resetTimeout: number;
}

/**
 * 熔断器状态信息
 */
export interface CircuitBreakerStateInfo {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

// =============================================================================
// 动态路由接口
// =============================================================================

/**
 * 条件评估上下文
 */
export interface ConditionEvaluationContext {
  // 步骤执行结果
  stepResults: Map<string, StepExecution>;

  // 共享数据
  sharedData: Map<string, any>;

  // 当前步骤ID
  currentStepId: string;

  // 输入数据
  inputData: Record<string, any>;
}

/**
 * 路由决策结果
 */
export interface RoutingDecision {
  // 目标步骤ID
  targetStepId: string;

  // 路由ID
  routeId: string;

  // 决策原因
  reason?: string;

  // 条件评估结果
  conditionResults?: Map<string, boolean>;
}

// =============================================================================
// 错误处理接口
// =============================================================================

/**
 * 错误处理策略
 */
export enum ErrorHandlingStrategy {
  RETRY = "retry",
  FALLBACK = "fallback",
  CONTINUE = "continue",
  ABORT = "abort",
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  // 是否已处理
  handled: boolean;

  // 处理策略
  strategy: ErrorHandlingStrategy;

  // 是否应该重试
  shouldRetry: boolean;

  // 替代步骤ID（fallback策略）
  fallbackStepId?: string;

  // 错误消息
  message?: string;
}
