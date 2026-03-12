/**
 * 日志操作模块（Logging Operations）
 * 包含：行动记录、输出验证、错误处理功能
 */

import {
  type ActionLayer,
  type ActionStatus,
  type ActionType,
  type ErrorSeverity,
  type ErrorType,
  Prisma,
  type PrismaClient,
} from '@prisma/client';
import type {
  HandleErrorResult,
  LogActionResult,
  VerifyOutputResult,
} from './types';

/**
 * 将字符串 actionType 映射到 Prisma ActionType 枚举
 */
function mapToActionType(actionType: string): ActionType {
  const validActionTypes: Record<string, ActionType> = {
    ANALYZE: 'ANALYZE',
    RETRIEVE: 'RETRIEVE',
    GENERATE: 'GENERATE',
    VERIFY: 'VERIFY',
    TRANSFORM: 'TRANSFORM',
    COMMUNICATE: 'COMMUNICATE',
    MIGRATE_WORKING_TO_HOT: 'MIGRATE_WORKING_TO_HOT',
    MIGRATE_HOT_TO_COLD: 'MIGRATE_HOT_TO_COLD',
  };

  const upperCaseType = actionType.toUpperCase();
  return validActionTypes[upperCaseType] || 'GENERATE'; // 默认使用 GENERATE
}

/**
 * 将字符串 status 映射到 Prisma ActionStatus 枚举
 */
function mapToActionStatus(
  status: 'success' | 'failure' | 'partial'
): ActionStatus {
  const statusMap: Record<string, ActionStatus> = {
    success: 'COMPLETED',
    failure: 'FAILED',
    partial: 'RUNNING',
  };
  return statusMap[status] || 'COMPLETED';
}

/**
 * 将错误名称映射到 Prisma ErrorType 枚举
 */
function mapToErrorType(errorName: string): ErrorType {
  const errorTypeMap: Record<string, ErrorType> = {
    Error: 'UNKNOWN_ERROR',
    TypeError: 'UNKNOWN_ERROR',
    ReferenceError: 'UNKNOWN_ERROR',
    RangeError: 'UNKNOWN_ERROR',
    SyntaxError: 'UNKNOWN_ERROR',
    NetworkError: 'NETWORK_ERROR',
    TimeoutError: 'NETWORK_TIMEOUT',
    ValidationError: 'VALIDATION_ERROR',
    AIError: 'AI_SERVICE_ERROR',
    DatabaseError: 'DATABASE_ERROR',
  };
  return errorTypeMap[errorName] || 'UNKNOWN_ERROR';
}

/**
 * log_action - 行动记录
 * 记录Agent行动到数据库
 */
export async function log_action(
  prisma: PrismaClient,
  params: {
    actionType: string;
    actionName: string;
    agentName?: string;
    input?: unknown;
    output?: unknown;
    status: 'success' | 'failure' | 'partial';
    executionTime?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<LogActionResult> {
  const actionType = mapToActionType(params.actionType);
  const status = mapToActionStatus(params.status);
  const actionLayer: ActionLayer = 'CORE';

  const record = await prisma.agentAction.create({
    data: {
      actionType,
      actionName: params.actionName,
      agentName: params.agentName || 'CoreAction',
      actionLayer,
      parameters: (params.input ?? null) as Prisma.InputJsonValue,
      result: (params.output ?? null) as Prisma.InputJsonValue,
      status,
      executionTime: params.executionTime || 0,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return {
    success: true,
    recordId: record.id,
  };
}

/**
 * verify_output - 输出验证
 * 验证输出是否符合预期
 */
export async function verify_output(
  output: unknown,
  validationCriteria: unknown
): Promise<VerifyOutputResult> {
  const issues: Array<{
    type: string;
    message: string;
    severity: string;
  }> = [];

  if (output === null || output === undefined) {
    issues.push({
      type: 'MISSING_OUTPUT',
      message: 'Output is null or undefined',
      severity: 'error',
    });
  }

  if (typeof output !== typeof validationCriteria) {
    issues.push({
      type: 'TYPE_MISMATCH',
      message: 'Output type mismatch',
      severity: 'warning',
    });
  }

  if (
    typeof output === 'object' &&
    output !== null &&
    !Array.isArray(output) &&
    typeof validationCriteria === 'object' &&
    validationCriteria !== null &&
    !Array.isArray(validationCriteria)
  ) {
    const criteria = validationCriteria as Record<string, unknown>;
    const out = output as Record<string, unknown>;

    if (
      criteria.minArgumentLength !== undefined &&
      typeof criteria.minArgumentLength === 'number'
    ) {
      const argLength =
        out.argument !== undefined ? String(out.argument).length : 0;
      if (argLength < criteria.minArgumentLength) {
        issues.push({
          type: 'LENGTH_MISMATCH',
          message: `Argument length ${argLength} is less than minimum ${criteria.minArgumentLength}`,
          severity: 'error',
        });
      }
    }

    if (
      criteria.minSupportingPoints !== undefined &&
      typeof criteria.minSupportingPoints === 'number'
    ) {
      const points = out.points !== undefined ? Number(out.points) : 0;
      if (points < criteria.minSupportingPoints) {
        issues.push({
          type: 'INSUFFICIENT_POINTS',
          message: `Supporting points ${points} is less than minimum ${criteria.minSupportingPoints}`,
          severity: 'warning',
        });
      }
    }
  }

  const score = issues.length === 0 ? 1 : Math.max(0, 1 - issues.length * 0.1);

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    score,
    issues,
    passed: score >= 0.9,
  };
}

/**
 * handle_error - 错误处理
 * 记录错误到数据库
 */
export async function handle_error(
  prisma: PrismaClient,
  params: {
    error: Error;
    context?: unknown;
    agentName?: string;
    actionName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<HandleErrorResult> {
  const errorType = mapToErrorType(params.error.name);
  const severity: ErrorSeverity = 'MEDIUM';

  const errorLog = await prisma.errorLog.create({
    data: {
      errorType,
      errorCode: params.error.name,
      errorMessage: params.error.message,
      attemptedAction: (params.actionName ||
        'unknown') as Prisma.InputJsonValue,
      context: (params.context ?? {}) as Prisma.InputJsonValue,
      stackTrace: params.error.stack || '',
      severity,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  return {
    handled: true,
    errorId: errorLog.id,
    actionTaken: 'logged',
    recovered: false,
    retryable: params.error.name !== 'ValidationError',
  };
}
