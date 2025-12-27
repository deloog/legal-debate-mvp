// Agent系统核心类型定义

// =============================================================================
// 基础类型定义
// =============================================================================

// Agent类型枚举 - 对应10大专业Agent
export enum AgentType {
  DOC_ANALYZER = 'doc_analyzer',
  EVIDENCE_ANALYZER = 'evidence_analyzer',
  RESEARCHER = 'researcher',
  STRATEGIST = 'strategist',
  WRITER = 'writer',
  REVIEWER = 'reviewer',
  SCHEDULER = 'scheduler',
  REPORTER = 'reporter',
  SUMMARIZER = 'summarizer',
  COORDINATOR = 'coordinator'
}

// Agent状态枚举
export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  DISABLED = 'disabled'
}

// 任务优先级
export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// =============================================================================
// 核心接口定义
// =============================================================================

// Agent执行上下文
export interface AgentContext {
  // 任务信息
  task: string;
  taskType?: string;
  priority: TaskPriority;
  
  // 输入数据
  data: Record<string, any>;
  
  // 上下文信息
  userId?: string;
  sessionId?: string;
  requestId?: string;
  
  // 元数据
  metadata?: Record<string, any>;
  
  // 历史结果（用于增量分析）
  previousResults?: AgentResult[];
  
  // 配置选项
  options?: AgentOptions;
}

// Agent配置选项
export interface AgentOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableCache?: boolean;
  cacheTTL?: number;
  customSettings?: Record<string, any>;
}

// Agent执行结果
export interface AgentResult {
  // 基本信息
  success: boolean;
  agentName: string;
  executionTime: number;
  
  // 输出数据
  data?: any;
  output?: string;
  structuredOutput?: Record<string, any>;
  
  // 元信息
  confidence?: number;
  tokensUsed?: number;
  cost?: number;
  
  // 上下文信息
  context?: {
    inputSummary?: string;
    processingSteps?: string[];
    warnings?: string[];
  };
  
  // 错误信息
  error?: AgentError;
  
  // 缓存信息
  cached?: boolean;
  cacheKey?: string;
}

// Agent错误定义
export interface AgentError {
  code: string;
  message: string;
  type: AgentErrorType;
  agentName: string;
  timestamp: number;
  retryable: boolean;
  details?: Record<string, any>;
  stack?: string;
}

// Agent错误类型
export enum AgentErrorType {
  VALIDATION_ERROR = 'validation_error',
  EXECUTION_ERROR = 'execution_error',
  TIMEOUT_ERROR = 'timeout_error',
  NETWORK_ERROR = 'network_error',
  AI_SERVICE_ERROR = 'ai_service_error',
  DATABASE_ERROR = 'database_error',
  CONFIGURATION_ERROR = 'configuration_error',
  PERMISSION_ERROR = 'permission_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  UNKNOWN_ERROR = 'unknown_error'
}

// Agent验证结果
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
  sanitizedData?: any;
}

// =============================================================================
// Agent元数据和注册信息
// =============================================================================

// Agent元数据
export interface AgentMetadata {
  name: string;
  type: AgentType;
  version: string;
  description: string;
  
  // 能力描述
  capabilities: string[];
  supportedTasks: string[];
  
  // 依赖关系
  dependencies?: AgentType[];
  
  // 性能指标
  averageExecutionTime?: number;
  successRate?: number;
  
  // 配置要求
  requiredConfig?: string[];
  optionalConfig?: string[];
  
  // 状态信息
  status: AgentStatus;
  lastUsed?: number;
  totalExecutions?: number;
}

// Agent注册信息
export interface AgentRegistration {
  metadata: AgentMetadata;
  instance: Agent;
  registeredAt: number;
  updatedBy?: string;
}

// =============================================================================
// Agent统计和监控
// =============================================================================

// Agent执行统计
export interface AgentStats {
  agentName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecutionTime: number;
  totalTokensUsed: number;
  totalCost: number;
  errorRate: number;
  cacheHitRate: number;
}

// Agent性能指标
export interface AgentMetrics {
  agentName: string;
  timestamp: number;
  executionTime: number;
  success: boolean;
  tokensUsed: number;
  cost: number;
  memoryUsage?: number;
  cpuUsage?: number;
  cacheHit: boolean;
}

// =============================================================================
// 主要Agent接口
// =============================================================================

// 核心Agent接口
export interface Agent {
  // 基本信息
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly description: string;
  
  // 执行方法
  execute(context: AgentContext): Promise<AgentResult>;
  
  // 验证方法（可选）
  validateInput?(input: any): ValidationResult;
  
  // 初始化和清理方法
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
  
  // 健康检查
  healthCheck?(): Promise<boolean>;
  
  // 配置管理
  configure?(config: Record<string, any>): Promise<void>;
  
  // 元数据获取
  getMetadata?(): AgentMetadata;
}

// Agent工厂接口
export interface AgentFactory {
  createAgent(agentType: AgentType, config?: Record<string, any>): Promise<Agent>;
  getSupportedTypes(): AgentType[];
}

// =============================================================================
// 工具类型定义
// =============================================================================

// Agent事件类型
export enum AgentEventType {
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  EXECUTION_STARTED = 'execution_started',
  EXECUTION_COMPLETED = 'execution_completed',
  EXECUTION_FAILED = 'execution_failed',
  CONFIGURATION_CHANGED = 'configuration_changed',
  STATUS_CHANGED = 'status_changed'
}

// Agent事件
export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  agentName: string;
  data?: any;
}

// Agent工作流配置
export interface AgentWorkflowConfig {
  agents: AgentType[];
  executionMode: 'sequential' | 'parallel' | 'mixed';
  timeout?: number;
  retryPolicy?: {
    maxAttempts: number;
    backoffMultiplier: number;
    baseDelay: number;
  };
  errorHandling?: 'stop' | 'continue' | 'retry';
}
