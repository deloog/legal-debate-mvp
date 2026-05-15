import { NextResponse } from 'next/server';

export type StandardErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR'
  | string;

export function createErrorResponse(
  code: StandardErrorCode,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    { status }
  );
}

export function createUnauthorizedResponse(message = '请先登录'): NextResponse {
  return createErrorResponse('UNAUTHORIZED', message, 401);
}

export function createForbiddenResponse(message = '权限不足'): NextResponse {
  return createErrorResponse('FORBIDDEN', message, 403);
}

export function createNotFoundResponse(
  message = '请求的资源不存在'
): NextResponse {
  return createErrorResponse('NOT_FOUND', message, 404);
}

export function createServiceUnavailableResponse(
  message = '服务暂时不可用，请稍候重试'
): NextResponse {
  return createErrorResponse('SERVICE_UNAVAILABLE', message, 503);
}
