import { NextResponse } from 'next/server';

// 导入具体函数以避免循环依赖
import {
  createSuccessResponse,
  createPaginatedResponse,
  createCreatedResponse,
  createNoContentResponse,
  createPartialResponse,
} from './success';

// 导出所有响应相关功能
export * from './success';
export * from './pagination';

/**
 * 重新导出常用响应函数以保持向后兼容
 */
export {
  createSuccessResponse,
  createPaginatedResponse,
  createCreatedResponse,
  createNoContentResponse,
  createPartialResponse,
} from './success';

export type { PaginationMeta } from './pagination';
export { buildPaginationOptions, calculatePaginationStats } from './pagination';

/**
 * 创建重定向响应
 */
export function createRedirectResponse(
  url: string,
  status: number = 302
): NextResponse {
  // 处理相对URL，转换为绝对URL
  if (url.startsWith('/')) {
    // 在测试环境中使用localhost，生产环境中可以从request获取
    const baseUrl =
      process.env.NODE_ENV === 'test'
        ? 'http://localhost:3000'
        : process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    url = baseUrl + url;
  }

  // 确保绝对URL有尾部斜杠（如果没有路径的话）
  if (!url.includes('/', 8) && !url.endsWith('/')) {
    url = url + '/';
  }

  return NextResponse.redirect(url, status);
}

/**
 * 创建文件下载响应
 */
export function createDownloadResponse(
  data: ArrayBuffer | ReadableStream | Blob,
  filename: string,
  contentType?: string,
  options: { status?: number; headers?: Record<string, string> } = {}
): NextResponse {
  // 1. 根据数据类型选择正确的Content-Type
  let finalContentType: string;
  if (contentType) {
    finalContentType = contentType;
  } else if (data instanceof Blob) {
    finalContentType = data.type || 'application/octet-stream';
  } else if (data instanceof ArrayBuffer) {
    finalContentType = 'application/octet-stream';
  } else {
    // ReadableStream
    finalContentType = 'application/octet-stream';
  }

  // 2. 创建正确的Headers对象
  const headers = new Headers(options.headers);
  headers.set('Content-Type', finalContentType);
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);

  // 3. 使用NextResponse构造函数，而非NextResponse.json()
  return new NextResponse(data, {
    status: options.status || 200,
    headers,
  });
}

/**
 * 创建流式响应
 */
export function createStreamResponse(
  stream: ReadableStream,
  contentType: string = 'application/json',
  options: { status?: number; headers?: Record<string, string> } = {}
): NextResponse {
  // 1. 创建正确的Headers对象
  const headers = new Headers(options.headers);
  headers.set('Content-Type', contentType);
  headers.set('Transfer-Encoding', 'chunked');

  // 2. 使用NextResponse构造函数，而非NextResponse.json()
  return new NextResponse(stream, {
    status: options.status || 200,
    headers,
  });
}

/**
 * 创建缓存响应
 */
export function createCachedResponse<T>(
  data: T,
  maxAge: number = 3600,
  meta?: any
): NextResponse {
  // 直接创建响应而不使用createSuccessResponse，避免自动添加timestamp
  const response = NextResponse.json({
    success: true,
    data,
    meta: meta || {}, // 不自动添加timestamp
  });
  response.headers.set('Cache-Control', `public, max-age=${maxAge}`);

  return response;
}

/**
 * 创建条件响应（ETag支持）
 */
export function createConditionalResponse<T>(
  data: T,
  etag?: string | null,
  meta?: any
): NextResponse {
  // 直接创建响应而不使用createSuccessResponse，避免自动添加timestamp
  const response = NextResponse.json({
    success: true,
    data,
    meta: meta || {}, // 不自动添加timestamp
  });

  // 只有当etag是字符串时才设置ETag头部
  // undefined和null都不设置
  if (typeof etag === 'string') {
    response.headers.set('ETag', etag);
  }

  return response;
}

/**
 * 创建健康检查响应
 */
export function createHealthResponse(
  status: 'healthy' | 'unhealthy' | 'degraded',
  details?: any,
  meta?: any
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString(),
        ...details,
      },
      meta: {
        status, // 在meta中也包含status字段
        timestamp: new Date().toISOString(),
        version: 'v1',
        ...meta,
      },
    },
    {
      status: status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503,
    }
  );
}
