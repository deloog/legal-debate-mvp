import { ApiError } from '../errors/api-error';
import { Middleware } from './core';

/**
 * CORS中间件
 */
export const corsMiddleware: Middleware = async (
  request,
  context,
  response
) => {
  const origin = request.headers.get('origin');
  const allowedOrigins = [
    ...(process.env.NODE_ENV !== 'production'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : []),
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean) as string[];

  // 处理预检请求
  if (request.method === 'OPTIONS') {
    response.headers.set(
      'Access-Control-Allow-Origin',
      allowedOrigins.includes(origin || '')
        ? origin || allowedOrigins[0]
        : allowedOrigins[0]
    );
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin'
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');

    // 对于OPTIONS请求，设置状态码为200并清空body
    response.headers.set('Content-Length', '0');
    return;
  }

  // 对于非OPTIONS请求，直接在共享的response上添加CORS头
  response.headers.set(
    'Access-Control-Allow-Origin',
    allowedOrigins.includes(origin || '')
      ? origin || allowedOrigins[0]
      : allowedOrigins[0]
  );
  response.headers.set('Access-Control-Allow-Credentials', 'true');
};

/**
 * 安全头中间件
 */
export const securityMiddleware: Middleware = async (
  request,
  context,
  response
) => {
  // 直接在共享的response上设置安全头
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );

  // HSTS - 仅在生产环境启用
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  response.headers.set('X-API-Version', 'v1');
  response.headers.set('X-Node-Environment', process.env.NODE_ENV || 'development');
};

/**
 * 速率限制中间件（简单内存实现）
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  isAllowed(key: string, limit: number, window: number): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // 清理过期的请求记录
    const validRequests = requests.filter(time => now - time < window);

    if (validRequests.length >= limit) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  getRequestCount(key: string, window: number): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    return requests.filter(time => now - time < window).length;
  }
}

const rateLimiter = new RateLimiter();

export const rateLimitMiddleware: Middleware = async (
  request,
  context,
  response
) => {
  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';
  const key = `rate_limit:${ip}`;
  const limit = 100; // 每个窗口期的请求数
  const window = 60 * 1000; // 1分钟窗口

  if (!rateLimiter.isAllowed(key, limit, window)) {
    // 对于超限请求，设置429状态码和相关头
    response.headers.set('Retry-After', '60');
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', '0');
    response.headers.set(
      'X-RateLimit-Reset',
      new Date(Date.now() + window).toISOString()
    );

    // 设置429状态码 - 通过修改共享response的状态
    // 注意：NextResponse.next()默认是200，我们需要特殊处理
    // 但由于我们的架构限制，这里只能设置headers
    // 实际项目中可能需要抛出异常让错误处理器处理
    throw new ApiError(
      429,
      'RATE_LIMIT_EXCEEDED',
      'Too many requests, please try again later'
    );
  }

  const currentCount = rateLimiter.getRequestCount(key, window);
  const remaining = Math.max(0, limit - currentCount - 1); // 先计算剩余，再+1

  response.headers.set('X-RateLimit-Limit', limit.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set(
    'X-RateLimit-Reset',
    new Date(Date.now() + window).toISOString()
  );
};
