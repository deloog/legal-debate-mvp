/**
 * ErrorLog System Types
 *
 * 错误日志系统的核心类型定义
 * 包含错误类型、严重程度、错误日志、恢复记录等
 */

/**
 * 错误类型枚举
 */
export enum ErrorType {
  // AI服务相关错误
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_RATE_LIMIT = 'AI_RATE_LIMIT',
  AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED',

  // 数据库相关错误
  DATABASE_ERROR = 'DATABASE_ERROR',
  DATABASE_CONNECTION_ERROR = 'DATABASE_CONNECTION_ERROR',
  DATABASE_QUERY_ERROR = 'DATABASE_QUERY_ERROR',
  DATABASE_CONSTRAINT_ERROR = 'DATABASE_CONSTRAINT_ERROR',

  // 验证相关错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_FORMAT_ERROR = 'VALIDATION_FORMAT_ERROR',
  VALIDATION_BUSINESS_RULE = 'VALIDATION_BUSINESS_RULE',

  // 网络相关错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_CONNECTION_ERROR = 'NETWORK_CONNECTION_ERROR',

  // 文件相关错误
  FILE_ERROR = 'FILE_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',

  // Agent相关错误
  AGENT_ERROR = 'AGENT_ERROR',
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',

  // 记忆相关错误
  MEMORY_ERROR = 'MEMORY_ERROR',
  MEMORY_NOT_FOUND = 'MEMORY_NOT_FOUND',
  MEMORY_EXPIRED = 'MEMORY_EXPIRED',

  // 其他错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
  CRITICAL = 'CRITICAL', // 严重错误，系统不可用
  HIGH = 'HIGH', // 高级错误，功能受影响
  MEDIUM = 'MEDIUM', // 中级错误，部分功能受限
  LOW = 'LOW', // 低级错误，可容忍
}

/**
 * 恢复方法类型
 */
export enum RecoveryMethod {
  RETRY = 'RETRY', // 重试
  RETRY_WITH_BACKOFF = 'RETRY_WITH_BACKOFF', // 指数退避重试
  FALLBACK = 'FALLBACK', // 降级处理
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER', // 熔断
  IGNORE = 'IGNORE', // 忽略
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION', // 人工介入
}

/**
 * 熔断器状态枚举
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // 关闭状态，正常工作
  OPEN = 'OPEN', // 开启状态，熔断中
  HALF_OPEN = 'HALF_OPEN', // 半开状态，尝试恢复
}

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  failureThreshold: number; // 失败阈值（次数）
  successThreshold: number; // 成功阈值（次数）
  timeout: number; // 超时时间（毫秒）
  halfOpenAttempts: number; // 半开状态尝试次数
}

/**
 * 错误上下文
 */
export interface ErrorContext {
  // Agent信息
  agentName?: string;
  agentType?: string;

  // 任务信息
  taskId?: string;
  taskType?: string;

  // 操作信息
  operation?: string;

  // 输入数据（脱敏后）
  inputData?: Record<string, unknown>;

  // 执行环境
  executionEnvironment?: {
    userId?: string;
    caseId?: string;
    debateId?: string;
    environment?: string; // development, staging, production
    requestId?: string;
  };

  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * 恢复尝试记录
 */
export interface RecoveryAttempt {
  attemptNumber: number;
  method: RecoveryMethod;
  success: boolean;
  duration: number; // 毫秒
  timestamp: Date;
  errorMessage?: string;
  fallbackUsed?: boolean;
}

/**
 * 错误日志（对应数据库error_logs表）
 */
export interface ErrorLog {
  // 基本信息
  id?: string; // 数据库ID
  userId?: string;
  caseId?: string;
  errorType: ErrorType;
  errorCode?: string;

  // 错误内容
  errorMessage: string;
  stackTrace?: string;

  // 上下文
  context: ErrorContext;
  attemptedAction?: Record<string, unknown>;

  // 严重程度
  severity: ErrorSeverity;

  // 恢复记录
  recoveryAttempts: number;
  recovered: boolean;
  recoveryMethod?: string;
  recoveryTime?: number;

  // 学习记录
  learned: boolean;
  learningNotes?: string;
  metadata?: Record<string, unknown>;

  // 时间戳
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * 错误模式
 */
export interface ErrorPattern {
  patternId: string;
  errorType: ErrorType;
  frequency: number; // 发生次数
  commonCauses: string[];
  rootCause: string;
  averageRecoveryTime: number; // 平均恢复时间（毫秒）
  lastOccurredAt: Date;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
}

/**
 * 根因分析结果
 */
export interface RootCauseAnalysis {
  analysisId: string;
  errorLogId: string;
  rootCause: string;
  confidence: number; // 0-1
  contributingFactors: string[];
  suggestedFixes: string[];
  analyzedAt: Date;
  aiGenerated: boolean;
}

/**
 * 错误统计
 */
export interface ErrorStatistics {
  timeRange: {
    start: Date;
    end: Date;
  };

  // 总体统计
  totalErrors: number;
  recoveredErrors: number;
  unrecoveredErrors: number;
  recoveryRate: number;

  // 按类型统计
  byType: Map<ErrorType, number>;

  // 按严重程度统计
  bySeverity: Map<ErrorSeverity, number>;

  // 按Agent统计
  byAgent: Map<string, number>;

  // 趋势
  trend: {
    hourly: number[]; // 过去24小时
    daily: number[]; // 过去7天
  };
}

/**
 * 错误过滤器
 */
export interface ErrorFilters {
  errorTypes?: ErrorType[];
  severities?: ErrorSeverity[];
  agents?: string[];
  recovered?: boolean;
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * 时间范围
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * 错误处理选项
 */
export interface ErrorHandlingOptions {
  enableRetry?: boolean;
  maxRetries?: number;
  enableFallback?: boolean;
  fallbackFunction?: () => Promise<unknown>;
  enableCircuitBreaker?: boolean;
  enableLearning?: boolean;
  enableLogging?: boolean;
}

/**
 * 错误处理结果
 */
export interface ErrorHandlingResult {
  errorLog: ErrorLog;
  recoverySuccess: boolean;
  recoveryMethod?: RecoveryMethod;
  fallbackUsed: boolean;
  handlingDuration: number; // 毫秒
}

/**
 * 恢复结果
 */
export interface RecoveryResult {
  success: boolean;
  method: RecoveryMethod;
  attempts: number;
  totalDuration: number; // 毫秒
  fallbackUsed: boolean;
  finalResult?: unknown;
  error?: Error;
}

/**
 * 学习结果（与MemoryAgent的LearningResult一致）
 */
export interface LearningResult {
  learningId: string;
  errorId: string;
  pattern: ErrorPattern;
  learningNotes: string;
  preventionMeasures: PreventionMeasure[];
  knowledgeUpdated: boolean;
  learnedAt: Date;
}

/**
 * 预防措施
 */
export interface PreventionMeasure {
  measureId: string;
  description: string;
  priority: number;
  implementation: string;
  estimatedEffectiveness: number; // 0-1
}
