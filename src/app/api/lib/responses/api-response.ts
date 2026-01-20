import { NextResponse } from 'next/server';

// 导出所有响应相关功能
export * from './success';
export * from './pagination';

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

  // 2. 创建NextResponse实例
  const response = new NextResponse(data, {
    status: options.status || 200,
  });

  // 3. 直接设置headers到response对象
  response.headers.set('Content-Type', finalContentType);
  response.headers.set(
    'Content-Disposition',
    `attachment; filename="${filename}"`
  );

  // 4. 设置额外的headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * 创建流式响应
 */
export function createStreamResponse(
  stream: ReadableStream,
  contentType: string = 'application/json',
  options: { status?: number; headers?: Record<string, string> } = {}
): NextResponse {
  // 1. 创建NextResponse实例
  const response = new NextResponse(stream, {
    status: options.status || 200,
  });

  // 2. 直接设置headers到response对象
  response.headers.set('Content-Type', contentType);
  response.headers.set('Transfer-Encoding', 'chunked');

  // 3. 设置额外的headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  return response;
}

/**
 * 创建缓存响应
 */
export function createCachedResponse<T>(
  data: T,
  maxAge: number = 3600,
  meta?: Record<string, unknown>
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
  meta?: Record<string, unknown>
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
  details?: Record<string, unknown>,
  meta?: Record<string, unknown>
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
