/**
 * 统一API响应工具函数
 * 用于确保所有API返回一致的响应格式
 */

import { NextResponse } from 'next/server';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 成功响应数据
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  message: string;
  data?: T;
}

/**
 * 错误响应数据
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
}

/**
 * API响应数据
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// =============================================================================
// 响应构建函数
// =============================================================================

/**
 * 构建成功响应
 */
export function successResponse<T = unknown>(
  data?: T,
  message: string = '操作成功'
): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      message,
      data,
    },
    { status: 200 }
  );
}

/**
 * 构建创建成功响应（201状态码）
 */
export function createdResponse<T = unknown>(
  data: T,
  message: string = '创建成功'
): NextResponse<ApiResponse<T>> {
  return NextResponse.json<ApiResponse<T>>(
    {
      success: true,
      message,
      data,
    },
    { status: 201 }
  );
}

/**
 * 构建错误响应
 */
export function errorResponse(
  message: string,
  status: number = 400,
  error?: string
): NextResponse<ErrorResponse> {
  return NextResponse.json<ErrorResponse>(
    {
      success: false,
      message,
      error,
    },
    { status }
  );
}

/**
 * 构建未认证响应（401）
 */
export function unauthorizedResponse(
  message: string = '未认证，请先登录'
): NextResponse<ErrorResponse> {
  return errorResponse(message, 401, 'UNAUTHORIZED');
}

/**
 * 构建禁止访问响应（403）
 */
export function forbiddenResponse(
  message: string = '无权限访问此资源'
): NextResponse<ErrorResponse> {
  return errorResponse(message, 403, 'FORBIDDEN');
}

/**
 * 构建未找到响应（404）
 */
export function notFoundResponse(
  message: string = '资源不存在'
): NextResponse<ErrorResponse> {
  return errorResponse(message, 404, 'NOT_FOUND');
}

/**
 * 构建服务器错误响应（500）
 */
export function serverErrorResponse(
  message: string = '服务器内部错误'
): NextResponse<ErrorResponse> {
  return errorResponse(message, 500, 'INTERNAL_SERVER_ERROR');
}
