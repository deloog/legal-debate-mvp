import { NextResponse } from 'next/server';

import type { PaginationMeta } from './pagination';

/**
 * 成功响应接口
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    version?: string;
    pagination?: PaginationMeta;
    [key: string]: any;
  };
}

/**
 * 创建成功响应
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Omit<SuccessResponse<T>['meta'], 'timestamp' | 'version'>
): NextResponse {
  const responseBody = {
    success: true as const,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: 'v1',
      ...meta,
    },
  };

  // 使用NextResponse.json的第二个参数显式设置headers
  const response = NextResponse.json(responseBody, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return response;
}

/**
 * 创建分页响应
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta
): NextResponse {
  return createSuccessResponse(data, {
    pagination,
  });
}

/**
 * 创建创建成功响应（201状态码）
 */
export function createCreatedResponse<T>(
  data: T,
  meta?: Omit<SuccessResponse<T>['meta'], 'timestamp' | 'version'>
): NextResponse {
  const response = createSuccessResponse(data, meta);
  return new NextResponse(response.body, {
    status: 201,
    headers: response.headers,
  });
}

/**
 * 创建无内容响应（204状态码）
 */
export function createNoContentResponse(): NextResponse {
  const response = new NextResponse(null, { 
    status: 204,
  });
  // 204响应不应该有Content-Type头部
  return response;
}

/**
 * 创建部分内容响应（206状态码）
 */
export function createPartialResponse<T>(
  data: T,
  meta?: Omit<SuccessResponse<T>['meta'], 'timestamp' | 'version'>
): NextResponse {
  const response = createSuccessResponse(data, meta);
  return new NextResponse(response.body, {
    status: 206,
    headers: response.headers,
  });
}
