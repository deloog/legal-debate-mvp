import { Middleware } from './core';
import { logger } from '@/lib/logger';

/**
 * 请求日志中间件
 */
export const loggingMiddleware: Middleware = async (request, context) => {
  const { method, url } = request;
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  // 记录请求开始
  logger.info('API Request Started:', {
    requestId: context.requestId,
    method,
    url,
    userAgent,
    ip,
    timestamp: new Date().toISOString(),
  });

  // 不要返回新的response，继续执行链
};

/**
 * 响应时间中间件
 */
export const responseTimeMiddleware: Middleware = async (
  request,
  context,
  response
) => {
  // 在共享的response上设置响应时间头
  response.headers.set(
    'X-Response-Time',
    `${Date.now() - context.startTime}ms`
  );
  response.headers.set('X-Request-ID', context.requestId);

  // 不要返回新的response，继续执行链
};

/**
 * API版本中间件
 */
export const versionMiddleware: Middleware = async (
  request,
  context,
  response
) => {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/').filter(Boolean);

  // 查找版本号（支持 /api/v1/xxx, /v1/xxx 等格式）
  let version = 'v1'; // 默认版本
  for (const segment of pathSegments) {
    const versionMatch = segment.match(/^v(\d+)$/);
    if (versionMatch) {
      version = versionMatch[0];
      break;
    }
  }

  // 在共享的response上设置版本头
  response.headers.set('API-Version', version);
  response.headers.set('X-API-Version', version);

  // 不要返回新的response，继续执行链
};
