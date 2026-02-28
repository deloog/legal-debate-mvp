/**
 * API 速率限制中间件
 * 防止DDoS攻击和滥用
 * 当 REDIS_URL 已配置时自动切换到 Redis（支持多实例/分布式部署），
 * 否则回退到内存存储（单实例/开发环境）
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMonitor } from './rate-limit-monitor';
import { logger } from '@/lib/logger';

/**
 * 速率限制配置接口
 */
interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  message?: string; // 超限提示信息
  limitType?: 'strict' | 'moderate' | 'lenient' | 'custom'; // 限制类型（用于监控）
  skipSuccessfulRequests?: boolean; // 是否跳过成功的请求
  skipFailedRequests?: boolean; // 是否跳过失败的请求
}

/**
 * 请求记录（内存存储使用）
 */
interface RequestRecord {
  count: number;
  resetTime: number;
}

// =============================================================================
// 内存存储（Redis 不可用时的回退方案）
// =============================================================================

const memStore = new Map<string, RequestRecord>();

// 每5分钟清理过期记录，防止内存泄漏
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of memStore.entries()) {
      if (now > record.resetTime) {
        memStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

// =============================================================================
// Redis 客户端（延迟初始化，仅当 REDIS_URL 已配置时启用）
// =============================================================================

interface RedisLike {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

let _redisPromise: Promise<RedisLike | null> | null = null;

/**
 * 获取 Redis 客户端（懒加载单例）
 * 生产环境设置 REDIS_URL 后自动启用 Redis 限流
 */
function getRedis(): Promise<RedisLike | null> {
  if (_redisPromise) return _redisPromise;

  _redisPromise = (async (): Promise<RedisLike | null> => {
    if (!process.env.REDIS_URL) return null;
    try {
      const { default: Redis } = await import('ioredis');
      const client = new Redis(process.env.REDIS_URL, {
        enableReadyCheck: false,
        maxRetriesPerRequest: 1,
        lazyConnect: false,
      });
      logger.info('[RateLimit] Redis 限流已启用');
      return client;
    } catch (error) {
      logger.warn('[RateLimit] Redis 初始化失败，回退到内存限流', {
        error: String(error),
      });
      return null;
    }
  })();

  return _redisPromise;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取客户端标识符（IP + User Agent）
 */
function getClientIdentifier(request: NextRequest): string {
  // 优先使用 X-Forwarded-For（代理/负载均衡器传递的真实IP）
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';

  // 添加User Agent以区分同一IP的不同客户端
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const shortUA = userAgent.substring(0, 50); // 截断以防止过长

  return `${ip}:${shortUA}`;
}

// =============================================================================
// 核心：速率限制器工厂函数
// =============================================================================

/**
 * 速率限制中间件工厂函数
 * 自动选择 Redis 或内存后端
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    limitType = 'custom',
  } = config;

  const windowSeconds = Math.ceil(windowMs / 1000);

  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    const identifier = getClientIdentifier(request);
    const endpoint = new URL(request.url).pathname;
    const now = Date.now();

    // 提取IP和User Agent用于监控
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    let current: number;
    let resetTime: number;

    const redis = await getRedis();

    if (redis) {
      // Redis 限流（支持分布式/多实例部署）
      try {
        const key = `ratelimit:${identifier}`;
        current = await redis.incr(key);
        if (current === 1) {
          // 第一次请求时设置过期时间
          await redis.expire(key, windowSeconds);
        }
        const ttl = await redis.ttl(key);
        resetTime = now + (ttl > 0 ? ttl * 1000 : windowMs);
      } catch (error) {
        // Redis 操作失败时放行请求，避免限流故障导致服务中断
        logger.error('[RateLimit] Redis 操作失败，放行本次请求', {
          error: String(error),
        });
        return null;
      }
    } else {
      // 内存限流（单实例/开发环境回退）
      let record = memStore.get(identifier);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs };
        memStore.set(identifier, record);
      }
      record.count++;
      current = record.count;
      resetTime = record.resetTime;
    }

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
      const retryAfter = Math.ceil((resetTime - now) / 1000);

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
  };
}

// =============================================================================
// 预定义的速率限制器
// =============================================================================

/**
 * 严格限制（登录、注册等敏感操作）
 * 每分钟最多5次请求
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 5,
  limitType: 'strict',
  message: '请求过于频繁，请稍后再试（每分钟最多5次）',
});

/**
 * 中等限制（普通API）
 * 每分钟最多30次请求
 */
export const moderateRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 30,
  limitType: 'moderate',
  message: '请求过于频繁，请稍后再试（每分钟最多30次）',
});

/**
 * 宽松限制（公开API）
 * 每分钟最多100次请求
 */
export const lenientRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1分钟
  maxRequests: 100,
  limitType: 'lenient',
  message: '请求过于频繁，请稍后再试（每分钟最多100次）',
});

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 应用速率限制到API路由
 *
 * 使用示例：
 * ```typescript
 * import { withRateLimit, strictRateLimiter } from '@/lib/middleware/rate-limit';
 *
 * export const POST = withRateLimit(strictRateLimiter, async (request) => {
 *   // 你的API逻辑
 * });
 * ```
 */
export function withRateLimit<
  TArgs extends unknown[],
  T extends (request: NextRequest, ...args: TArgs) => Promise<NextResponse>,
>(
  rateLimiter: (request: NextRequest) => Promise<NextResponse | null>,
  handler: T
): T {
  return (async (request: NextRequest, ...args: TArgs) => {
    // 先进行速率限制检查
    const limitResponse = await rateLimiter(request);
    if (limitResponse) {
      return limitResponse;
    }

    // 未超限，执行原始处理器
    return handler(request, ...args);
  }) as T;
}

/**
 * 获取速率限制状态（用于监控）
 * 注意：使用 Redis 后端时仅返回内存状态（Redis 侧数据请直接查询 Redis）
 */
export function getRateLimitStats() {
  return {
    backend: process.env.REDIS_URL ? 'redis' : 'memory',
    totalClients: memStore.size,
    clients: Array.from(memStore.entries()).map(([identifier, record]) => ({
      identifier: identifier.substring(0, 30) + '...', // 截断以保护隐私
      count: record.count,
      resetTime: new Date(record.resetTime).toISOString(),
    })),
  };
}

/**
 * 手动清除特定客户端的速率限制（管理员功能，仅对内存后端有效）
 */
export function clearRateLimit(identifier: string): boolean {
  return memStore.delete(identifier);
}

/**
 * 清除所有速率限制记录（仅对内存后端有效）
 */
export function clearAllRateLimits(): void {
  memStore.clear();
}
