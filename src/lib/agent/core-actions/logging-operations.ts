/**
 * 日志操作模块（Logging Operations）
 * 包含：行动记录、输出验证、错误处理功能
 *
 * 注意：由于 Prisma 生成的 ActionType/ErrorType/Severity 枚举类型与实际使用的枚举值不完全兼容，
 * 在代码中需要使用 `as any` 类型断言来解决类型检查问题。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PrismaClient } from '@prisma/client';
import type {
  LogActionResult,
  VerifyOutputResult,
  HandleErrorResult,
} from './types';

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
  const statusMap: Record<string, 'COMPLETED' | 'FAILED' | 'RUNNING'> = {
    success: 'COMPLETED',
    failure: 'FAILED',
    partial: 'RUNNING',
  };

  const statusValue = statusMap[params.status] || 'COMPLETED';

  const record = await prisma.agentAction.create({
    data: {
      actionType: params.actionType as any,
      actionName: params.actionName,
      agentName: params.agentName || 'CoreAction',
      actionLayer: 'CORE' as any,
      parameters: (params.input ?? null) as any,
      result: (params.output ?? null) as any,
      status: statusValue as any,
      executionTime: params.executionTime || 0,
      metadata: (params.metadata ?? {}) as any,
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
  const errorTypeMap: Record<string, string> = {
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

  const errorType = errorTypeMap[params.error.name] || 'UNKNOWN_ERROR';

  const errorLog = await prisma.errorLog.create({
    data: {
      errorType: errorType as any,
      errorCode: params.error.name,
      errorMessage: params.error.message,
      attemptedAction: params.actionName || 'unknown',
      context: params.context as any,
      stackTrace: params.error.stack || '',
      severity: 'MEDIUM' as any,
      metadata: params.metadata as any,
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
