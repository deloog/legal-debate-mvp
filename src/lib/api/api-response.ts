/**
 * API 响应标准化工具
 *
 * 提供统一的响应格式：
 * - 成功响应: { success: true, data: ..., pagination?: ... }
 * - 错误响应: { success: false, error: { code, message, details? } }
 */

import { NextResponse } from 'next/server';

// 错误码定义
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

// HTTP 状态码映射
const errorCodeToStatus: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// 错误信息映射（用户友好的消息）
const errorCodeToMessage: Record<ErrorCode, string> = {
  BAD_REQUEST: '请求参数错误',
  UNAUTHORIZED: '请先登录',
  FORBIDDEN: '权限不足',
  NOT_FOUND: '请求的资源不存在',
  CONFLICT: '资源冲突',
  VALIDATION_ERROR: '数据验证失败',
  INTERNAL_ERROR: '服务器内部错误',
  SERVICE_UNAVAILABLE: '服务暂时不可用',
};

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Record<string, unknown>
) {
  const response: { success: true; data: T; meta?: Record<string, unknown> } = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

/**
 * 创建分页成功响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  }
) {
  return {
    success: true,
    data,
    pagination: {
      ...pagination,
      totalPages: Math.ceil(pagination.total / pagination.pageSize),
    },
  };
}

/**
 * 创建错误响应
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: unknown
) {
  const response: {
    success: false;
    error: {
      code: ErrorCode;
      message: string;
      details?: unknown;
    };
  } = {
    success: false,
    error: {
      code,
      message: customMessage || errorCodeToMessage[code],
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
}

/**
 * 发送错误响应（带 HTTP 状态码）
 */
export function sendError(
  code: ErrorCode,
  customMessage?: string,
  details?: unknown
) {
  const body = createErrorResponse(code, customMessage, details);
  const status = errorCodeToStatus[code];
  return NextResponse.json(body, { status });
}

/**
 * 发送成功响应
 */
export function sendSuccess<T>(data: T, meta?: Record<string, unknown>) {
  const body = createSuccessResponse(data, meta);
  return NextResponse.json(body);
}

/**
 * 发送分页成功响应
 */
export function sendPaginated<T>(
  data: T[],
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  }
) {
  const body = createPaginatedResponse(data, pagination);
  return NextResponse.json(body);
}

/**
 * 验证错误快捷方法
 */
export function sendValidationError(message: string, details?: unknown) {
  return sendError('VALIDATION_ERROR', message, details);
}

/**
 * 未授权错误快捷方法
 */
export function sendUnauthorized(customMessage?: string) {
  return sendError('UNAUTHORIZED', customMessage);
}

/**
 * 权限不足错误快捷方法
 */
export function sendForbidden(customMessage?: string) {
  return sendError('FORBIDDEN', customMessage);
}

/**
 * 资源不存在错误快捷方法
 */
export function sendNotFound(resourceName?: string) {
  const message = resourceName ? `${resourceName} 不存在` : undefined;
  return sendError('NOT_FOUND', message);
}

/**
 * 服务器错误快捷方法
 */
export function sendInternalError(customMessage?: string) {
  return sendError('INTERNAL_ERROR', customMessage);
}
