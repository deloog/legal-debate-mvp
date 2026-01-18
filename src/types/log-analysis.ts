/**
 * 日志分析相关类型定义
 * 用于日志查询、统计和分析功能
 */

// =============================================================================
// 日志查询类型
// =============================================================================

/**
 * 日志查询基础参数
 */
export interface LogQueryParams {
  startTime?: string;
  endTime?: string;
  logType?: LogType;
  level?: LogLevel;
  userId?: string;
  caseId?: string;
  agentName?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 日志类型枚举
 */
export enum LogType {
  APPLICATION = 'application',
  ERROR = 'error',
  ACTION = 'action',
  SYSTEM = 'system',
}

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * 日志响应数据
 */
export interface LogResponse {
  logs: LogEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 日志条目
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  logType: LogType;
  message: string;
  userId?: string;
  caseId?: string;
  agentName?: string;
  taskId?: string;
  requestId?: string;
  error?: {
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  environment?: string;
  application?: string;
  host?: {
    name: string;
    ip?: string;
  };
  geoip?: {
    country_name?: string;
    city_name?: string;
    location?: {
      lat: number;
      lon: number;
    };
  };
}

// =============================================================================
// 日志统计类型
// =============================================================================

/**
 * 日志统计查询参数
 */
export interface LogStatsQueryParams {
  startTime?: string;
  endTime?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  logType?: LogType;
  groupBy?: 'level' | 'logType' | 'userId' | 'agentName' | 'errorType';
}

/**
 * 日志统计数据
 */
export interface LogStatistics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByType: Record<LogType, number>;
  logsOverTime: TimeSeriesData[];
  topErrors: ErrorStatistics[];
  topActions: ActionStatistics[];
  topAgents: AgentStatistics[];
  errorRate: number;
  avgResponseTime: number;
}

/**
 * 时间序列数据
 */
export interface TimeSeriesData {
  timestamp: string;
  count: number;
  level?: LogLevel;
  logType?: LogType;
}

/**
 * 错误统计数据
 */
export interface ErrorStatistics {
  errorType: string;
  count: number;
  severity: string;
  lastOccurrence: string;
  affectedUsers: number;
}

/**
 * 操作统计数据
 */
export interface ActionStatistics {
  actionType: string;
  actionCategory: string;
  count: number;
  avgExecutionTime: number;
  successRate: number;
}

/**
 * Agent统计数据
 */
export interface AgentStatistics {
  agentName: string;
  taskType?: string;
  logCount: number;
  errorCount: number;
  avgExecutionTime: number;
  successRate: number;
}

// =============================================================================
// 日志分析类型
// =============================================================================

/**
 * 日志分析查询参数
 */
export interface LogAnalysisQueryParams {
  startTime: string;
  endTime: string;
  analysisType: AnalysisType;
  filters?: LogQueryParams;
}

/**
 * 分析类型枚举
 */
export enum AnalysisType {
  ERROR_TRENDS = 'error_trends',
  PERFORMANCE = 'performance',
  USER_BEHAVIOR = 'user_behavior',
  AGENT_PERFORMANCE = 'agent_performance',
  SECURITY = 'security',
  SYSTEM_HEALTH = 'system_health',
}

/**
 * 日志分析结果
 */
export interface LogAnalysisResult {
  analysisType: AnalysisType;
  period: {
    start: string;
    end: string;
  };
  summary: AnalysisSummary;
  details: unknown;
  recommendations: string[];
  alerts: Alert[];
}

/**
 * 分析摘要
 */
export interface AnalysisSummary {
  totalLogs: number;
  criticalIssues: number;
  warnings: number;
  score: number; // 0-100
}

/**
 * 告警信息
 */
export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  affectedResources?: string[];
}

/**
 * 错误趋势分析结果
 */
export interface ErrorTrendsAnalysis {
  errorCount: number;
  errorRate: number;
  topErrors: ErrorStatistics[];
  errorDistribution: Record<string, number>;
  errorTrend: TimeSeriesData[];
  severityDistribution: Record<string, number>;
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysis {
  avgResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  slowOperations: SlowOperation[];
  performanceTrend: TimeSeriesData[];
  bottlenecks: Bottleneck[];
}

/**
 * 慢操作统计
 */
export interface SlowOperation {
  operation: string;
  avgExecutionTime: number;
  count: number;
  threshold: number;
}

/**
 * 瓶颈分析
 */
export interface Bottleneck {
  resource: string;
  metric: string;
  currentValue: number;
  threshold: number;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * 用户行为分析结果
 */
export interface UserBehaviorAnalysis {
  totalUsers: number;
  activeUsers: number;
  topUsers: UserStatistics[];
  userActivityTrend: TimeSeriesData[];
  commonActions: ActionStatistics[];
}

/**
 * 用户统计数据
 */
export interface UserStatistics {
  userId: string;
  actionCount: number;
  lastActivity: string;
  avgSessionDuration: number;
}

/**
 * Agent性能分析结果
 */
export interface AgentPerformanceAnalysis {
  agents: AgentStatistics[];
  performanceRanking: AgentRanking[];
  overallSuccessRate: number;
  overallAvgExecutionTime: number;
}

/**
 * Agent排名
 */
export interface AgentRanking {
  agentName: string;
  rank: number;
  score: number;
  metrics: {
    successRate: number;
    avgExecutionTime: number;
    errorRate: number;
  };
}

/**
 * 安全分析结果
 */
export interface SecurityAnalysis {
  suspiciousActivities: SuspiciousActivity[];
  failedLogins: FailedLogin[];
  accessViolations: AccessViolation[];
  securityScore: number;
}

/**
 * 可疑活动
 */
export interface SuspiciousActivity {
  userId: string;
  activityType: string;
  count: number;
  lastOccurrence: string;
  riskLevel: 'high' | 'medium' | 'low';
}

/**
 * 失败登录
 */
export interface FailedLogin {
  userId?: string;
  ipAddress: string;
  attemptCount: number;
  lastAttempt: string;
  userAgent?: string;
  geoip?: {
    country_name?: string;
    city_name?: string;
  };
}

/**
 * 访问违规
 */
export interface AccessViolation {
  userId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  timestamp: string;
  riskLevel: 'high' | 'medium' | 'low';
}

/**
 * 系统健康分析结果
 */
export interface SystemHealthAnalysis {
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  healthScore: number;
  errorRate: number;
  warningRate: number;
  systemMetrics: SystemMetric[];
  recommendations: string[];
}

/**
 * 系统指标
 */
export interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading';
}

// =============================================================================
// Elasticsearch 索引类型
// =============================================================================

/**
 * Elasticsearch 索引配置
 */
export interface ElasticsearchIndexConfig {
  name: string;
  pattern: string;
  rollover: boolean;
  retentionDays: number;
  aliases: string[];
}

/**
 * 预定义的索引配置
 */
export const INDEX_CONFIGS = {
  [LogType.APPLICATION]: {
    name: 'logs-application',
    pattern: 'logs-application-*',
    rollover: true,
    retentionDays: 30,
    aliases: ['logs-application-current'],
  },
  [LogType.ERROR]: {
    name: 'logs-error',
    pattern: 'logs-error-*',
    rollover: true,
    retentionDays: 90,
    aliases: ['logs-error-current'],
  },
  [LogType.ACTION]: {
    name: 'logs-action',
    pattern: 'logs-action-*',
    rollover: true,
    retentionDays: 30,
    aliases: ['logs-action-current'],
  },
  [LogType.SYSTEM]: {
    name: 'logs-system',
    pattern: 'logs-system-*',
    rollover: true,
    retentionDays: 7,
    aliases: ['logs-system-current'],
  },
} as const;

// =============================================================================
// 工具函数类型
// =============================================================================

/**
 * 日志聚合结果
 */
export interface LogAggregationResult {
  key: string;
  docCount: number;
  avgValue?: number;
  maxValue?: number;
  minValue?: number;
  sum?: number;
}

/**
 * 日志分组字段
 */
export enum LogGroupBy {
  LEVEL = 'level',
  LOG_TYPE = 'logType',
  USER_ID = 'userId',
  CASE_ID = 'caseId',
  AGENT_NAME = 'agentName',
  TASK_TYPE = 'taskType',
  ERROR_TYPE = 'errorType',
  ACTION_TYPE = 'actionType',
}

// =============================================================================
// 类型验证函数
// =============================================================================

/**
 * 验证日志类型
 */
export function isValidLogType(value: string): value is LogType {
  return Object.values(LogType).includes(value as LogType);
}

/**
 * 验证日志级别
 */
export function isValidLogLevel(value: string): value is LogLevel {
  return Object.values(LogLevel).includes(value as LogLevel);
}

/**
 * 验证分析类型
 */
export function isValidAnalysisType(value: string): value is AnalysisType {
  return Object.values(AnalysisType).includes(value as AnalysisType);
}
