/**
 * Redis适配器用于速率限制
 * 生产环境推荐使用Redis来存储速率限制数据（支持分布式部署）
 *
 * 安装依赖：
 * npm install ioredis
 * npm install -D @types/ioredis
 *
 * 配置环境变量：
 * REDIS_URL=redis://localhost:6379
 * REDIS_RATE_LIMIT_PREFIX=ratelimit:
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMonitor } from './rate-limit-monitor';

/**
 * Redis客户端类型（避免直接依赖ioredis）
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: string,
    duration: number
  ): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/**
 * 速率限制配置接口
 */
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  message?: string; // 超限提示信息
  limitType?: 'strict' | 'moderate' | 'lenient' | 'custom'; // 限制类型（用于监控）
}

/**
 * 获取客户端标识符（IP + User Agent）
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const shortUA = userAgent.substring(0, 50);

  return `${ip}:${shortUA}`;
}

/**
 * 创建基于Redis的速率限制器
 */
export function createRedisRateLimiter(
  redisClient: RedisClient,
  config: RateLimitConfig,
  keyPrefix: string = 'ratelimit:'
) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    limitType = 'custom',
  } = config;

  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    try {
      const identifier = getClientIdentifier(request);
      const endpoint = new URL(request.url).pathname;
      const key = `${keyPrefix}${identifier}`;
      const now = Date.now();
      const windowSeconds = Math.ceil(windowMs / 1000);

      // 获取当前计数
      const currentStr = await redisClient.get(key);
      let current = currentStr ? parseInt(currentStr, 10) : 0;

      // 获取过期时间
      const ttl = await redisClient.ttl(key);

      // 如果key不存在或已过期，重置计数
      if (ttl === -2 || ttl === -1) {
        // -2表示key不存在，-1表示key没有设置过期时间
        current = 0;
        await redisClient.set(key, '1', 'EX', windowSeconds);
        current = 1;
      } else {
        // 增加计数
        current = await redisClient.incr(key);

        // 如果这是第一次增加，设置过期时间
        if (current === 1) {
          await redisClient.expire(key, windowSeconds);
        }
      }

      // 提取IP和User Agent用于监控
      const forwarded = request.headers.get('x-forwarded-for');
      const ip = forwarded
        ? forwarded.split(',')[0].trim()
        : request.headers.get('x-real-ip') || 'unknown';
      const userAgent = request.headers.get('user-agent') || undefined;

      // 检查是否超限
      const blocked = current > maxRequests;

      // 记录监控事件
      rateLimitMonitor.recordEvent({
        identifier,
        endpoint,
        limitType,
        currentCount: current,
        maxRequests,
        blocked,
        userAgent,
        ip,
      });

      if (blocked) {
        const resetTime = now + (ttl > 0 ? ttl * 1000 : windowMs);
        const retryAfter = ttl > 0 ? ttl : windowSeconds;

        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message,
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            },
          }
        );
      }

      // 未超限，返回null表示继续处理
      return null;
    } catch (error) {
      // Redis错误时回退到允许请求（避免Redis故障导致服务不可用）
      console.error('[RateLimit] Redis error, allowing request:', error);
      return null;
    }
  };
}

/**
 * 创建预定义的Redis速率限制器
 */
export function createRedisLimiters(redisClient: RedisClient) {
  return {
    /**
     * 严格限制（登录、注册等敏感操作）
     * 每分钟最多5次请求
     */
    strictRateLimiter: createRedisRateLimiter(redisClient, {
      windowMs: 60 * 1000,
      maxRequests: 5,
      limitType: 'strict',
      message: '请求过于频繁，请稍后再试（每分钟最多5次）',
    }),

    /**
     * 中等限制（普通API）
     * 每分钟最多30次请求
     */
    moderateRateLimiter: createRedisRateLimiter(redisClient, {
      windowMs: 60 * 1000,
      maxRequests: 30,
      limitType: 'moderate',
      message: '请求过于频繁，请稍后再试（每分钟最多30次）',
    }),

    /**
     * 宽松限制（公开API）
     * 每分钟最多100次请求
     */
    lenientRateLimiter: createRedisRateLimiter(redisClient, {
      windowMs: 60 * 1000,
      maxRequests: 100,
      limitType: 'lenient',
      message: '请求过于频繁，请稍后再试（每分钟最多100次）',
    }),
  };
}

/**
 * 应用速率限制到API路由（与内存版本兼容）
 */
export function withRateLimit<
  T extends (...args: any[]) => Promise<NextResponse>,
>(
  rateLimiter: (request: NextRequest) => Promise<NextResponse | null>,
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
    const limitResponse = await rateLimiter(request);
    if (limitResponse) {
      return limitResponse;
    }
    return handler(request, ...args);
  }) as T;
}

/**
 * 使用示例：
 *
 * ```typescript
 * // 1. 创建Redis客户端
 * import Redis from 'ioredis';
 * const redis = new Redis(process.env.REDIS_URL);
 *
 * // 2. 创建速率限制器
 * import { createRedisLimiters, withRateLimit } from '@/lib/middleware/rate-limit-redis';
 * const { strictRateLimiter } = createRedisLimiters(redis);
 *
 * // 3. 应用到API路由
 * export const POST = withRateLimit(strictRateLimiter, async (request) => {
 *   // 你的API逻辑
 * });
 * ```
 */
