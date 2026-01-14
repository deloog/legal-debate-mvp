/**
 * 日志相关类型定义
 */

// =============================================================================
// 错误日志类型
// =============================================================================

/**
 * 错误日志查询参数
 */
export interface ErrorLogQueryParams {
  page?: string;
  limit?: string;
  errorType?: string;
  severity?: string;
  userId?: string;
  caseId?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
}

/**
 * 错误日志响应数据
 */
export interface ErrorLogResponse {
  logs: ErrorLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 错误日志项
 */
export interface ErrorLogItem {
  id: string;
  userId: string | null;
  caseId: string | null;
  errorType: string;
  errorCode: string;
  errorMessage: string;
  stackTrace: string | null;
  context: unknown;
  attemptedAction: unknown | null;
  recoveryAttempts: number;
  recovered: boolean;
  recoveryMethod: string | null;
  recoveryTime: number | null;
  learned: boolean;
  learningNotes: string | null;
  severity: string;
  metadata: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 严重程度枚举
 */
export const ERROR_SEVERITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type ErrorSeverity = (typeof ERROR_SEVERITY)[number];

/**
 * 错误类型枚举
 */
export const ERROR_TYPES = [
  'AI_SERVICE_ERROR',
  'AI_TIMEOUT',
  'AI_RATE_LIMIT',
  'AI_QUOTA_EXCEEDED',
  'DATABASE_ERROR',
  'DATABASE_CONNECTION_ERROR',
  'DATABASE_QUERY_ERROR',
  'DATABASE_CONSTRAINT_ERROR',
  'VALIDATION_ERROR',
  'VALIDATION_REQUIRED_FIELD',
  'VALIDATION_FORMAT_ERROR',
  'VALIDATION_BUSINESS_RULE',
  'NETWORK_ERROR',
  'NETWORK_TIMEOUT',
  'NETWORK_CONNECTION_ERROR',
  'FILE_ERROR',
  'FILE_NOT_FOUND',
  'FILE_READ_ERROR',
  'FILE_WRITE_ERROR',
  'AGENT_ERROR',
  'AGENT_TIMEOUT',
  'AGENT_NOT_FOUND',
  'MEMORY_ERROR',
  'MEMORY_NOT_FOUND',
  'MEMORY_EXPIRED',
  'UNKNOWN_ERROR',
] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];

// =============================================================================
// 操作日志类型
// =============================================================================

/**
 * 操作日志查询参数
 */
export interface ActionLogQueryParams {
  page?: string;
  limit?: string;
  actionType?: string;
  actionCategory?: string;
  userId?: string;
  resourceType?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
}

/**
 * 操作日志响应数据
 */
export interface ActionLogResponse {
  logs: ActionLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 操作日志项
 */
export interface ActionLogItem {
  id: string;
  userId: string;
  actionType: string;
  actionCategory: string;
  description: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  requestParams: unknown | null;
  responseStatus: number | null;
  executionTime: number | null;
  metadata: unknown | null;
  createdAt: Date;
}

/**
 * 操作日志类型枚举
 */
export const ACTION_LOG_TYPES = [
  // 用户操作
  'LOGIN',
  'LOGOUT',
  'REGISTER',
  'UPDATE_PROFILE',
  'CHANGE_PASSWORD',
  // 案件操作
  'CREATE_CASE',
  'UPDATE_CASE',
  'DELETE_CASE',
  'VIEW_CASE',
  // 文档操作
  'UPLOAD_DOCUMENT',
  'DELETE_DOCUMENT',
  'ANALYZE_DOCUMENT',
  // 辩论操作
  'CREATE_DEBATE',
  'UPDATE_DEBATE',
  'DELETE_DEBATE',
  'GENERATE_ARGUMENT',
  // 管理操作
  'APPROVE_QUALIFICATION',
  'REJECT_QUALIFICATION',
  'UPDATE_USER_ROLE',
  'BAN_USER',
  'UNBAN_USER',
  // 系统操作
  'EXPORT_DATA',
  'IMPORT_DATA',
  'SYSTEM_CONFIG_UPDATE',
  // 其他操作
  'UNKNOWN',
] as const;
export type ActionLogType = (typeof ACTION_LOG_TYPES)[number];

/**
 * 操作日志分类枚举
 */
export const ACTION_LOG_CATEGORIES = [
  'AUTH',
  'USER',
  'CASE',
  'DOCUMENT',
  'DEBATE',
  'ADMIN',
  'SYSTEM',
  'OTHER',
] as const;
export type ActionLogCategory = (typeof ACTION_LOG_CATEGORIES)[number];

// =============================================================================
// 通用日志统计类型
// =============================================================================

/**
 * 日志统计数据
 */
export interface LogStatistics {
  totalErrorLogs: number;
  totalActionLogs: number;
  errorLogsBySeverity: Record<string, number>;
  errorLogsByType: Record<string, number>;
  actionLogsByCategory: Record<string, number>;
  actionLogsByType: Record<string, number>;
  recentErrors: ErrorLogItem[];
  recentActions: ActionLogItem[];
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 验证严重程度
 */
export function isValidSeverity(severity: string): severity is ErrorSeverity {
  return ERROR_SEVERITY.includes(severity as ErrorSeverity);
}

/**
 * 验证错误类型
 */
export function isValidErrorType(errorType: string): errorType is ErrorType {
  return ERROR_TYPES.includes(errorType as ErrorType);
}

/**
 * 验证操作日志类型
 */
export function isValidActionType(
  actionType: string
): actionType is ActionLogType {
  return ACTION_LOG_TYPES.includes(actionType as ActionLogType);
}

/**
 * 验证操作日志分类
 */
export function isValidActionCategory(
  category: string
): category is ActionLogCategory {
  return ACTION_LOG_CATEGORIES.includes(category as ActionLogCategory);
}
