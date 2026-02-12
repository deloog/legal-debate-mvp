/**
 * API 速率限制中间件
 * 防止DDoS攻击和滥用
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMonitor } from './rate-limit-monitor';

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
 * 请求记录
 */
interface RequestRecord {
  count: number;
  resetTime: number;
}

/**
 * 内存存储（生产环境应使用Redis）
 */
const store = new Map<string, RequestRecord>();

/**
 * 清理过期记录（定期清理以防止内存泄漏）
 */
function cleanExpiredRecords() {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (now > record.resetTime) {
      store.delete(key);
    }
  }
}

// 每5分钟清理一次过期记录
setInterval(cleanExpiredRecords, 5 * 60 * 1000);

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

/**
 * 速率限制中间件工厂函数
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    limitType = 'custom',
  } = config;

  return async function rateLimitMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    const identifier = getClientIdentifier(request);
    const now = Date.now();
    const endpoint = new URL(request.url).pathname;

    // 获取或创建记录
    let record = store.get(identifier);

    if (!record || now > record.resetTime) {
      // 创建新记录
      record = {
        count: 0,
        resetTime: now + windowMs,
      };
      store.set(identifier, record);
    }

    // 增加请求计数
    record.count++;

    // 提取IP和User Agent用于监控
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded
      ? forwarded.split(',')[0].trim()
      : request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // 检查是否超限
    const blocked = record.count > maxRequests;

    // 记录监控事件
    rateLimitMonitor.recordEvent({
      identifier,
      endpoint,
      limitType,
      currentCount: record.count,
      maxRequests,
      blocked,
      userAgent,
      ip,
    });

    if (blocked) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);

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
            'X-RateLimit-Reset': new Date(record.resetTime).toISOString(),
          },
        }
      );
    }

    // 未超限，返回null表示继续处理
    return null;
  };
}

/**
 * 预定义的速率限制器
 */

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
  T extends (...args: any[]) => Promise<NextResponse>,
>(
  rateLimiter: (request: NextRequest) => Promise<NextResponse | null>,
  handler: T
): T {
  return (async (request: NextRequest, ...args: any[]) => {
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
 */
export function getRateLimitStats() {
  const stats = {
    totalClients: store.size,
    clients: [] as Array<{
      identifier: string;
      count: number;
      resetTime: string;
    }>,
  };

  for (const [identifier, record] of store.entries()) {
    stats.clients.push({
      identifier: identifier.substring(0, 30) + '...', // 截断以保护隐私
      count: record.count,
      resetTime: new Date(record.resetTime).toISOString(),
    });
  }

  return stats;
}

/**
 * 手动清除特定客户端的速率限制（管理员功能）
 */
export function clearRateLimit(identifier: string): boolean {
  return store.delete(identifier);
}

/**
 * 清除所有速率限制记录
 */
export function clearAllRateLimits(): void {
  store.clear();
}
