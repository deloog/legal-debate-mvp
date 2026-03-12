/**
 * 通知发送频率限制器
 *
 * 防止短信/邮件发送被滥用，保护用户隐私和系统资源
 */

import { logger } from '@/lib/logger';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

interface RateLimitConfig {
  // 时间窗口（毫秒）
  windowMs: number;
  // 最大请求数
  maxRequests: number;
  // 冷却时间（毫秒）
  cooldownMs: number;
}

// 默认配置：每小时最多10条，冷却时间1分钟
const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1小时
  maxRequests: 10,
  cooldownMs: 60 * 1000, // 1分钟
};

// 内存存储（生产环境应使用 Redis）
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * 生成限流键
 */
function generateKey(identifier: string, type: 'SMS' | 'EMAIL'): string {
  return `${type}:${identifier}`;
}

/**
 * 清理过期的限流记录
 */
function cleanupExpiredEntries(windowMs: number): void {
  const now = Date.now();
  const cutoff = now - windowMs;

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastAttempt < cutoff) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * 检查是否超过频率限制
 */
export function checkRateLimit(
  identifier: string,
  type: 'SMS' | 'EMAIL',
  config: Partial<RateLimitConfig> = {}
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
} {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const key = generateKey(identifier, type);
  const now = Date.now();

  // 定期清理过期记录
  if (Math.random() < 0.01) {
    cleanupExpiredEntries(fullConfig.windowMs);
  }

  const entry = rateLimitStore.get(key);

  if (!entry) {
    // 首次请求
    rateLimitStore.set(key, {
      count: 1,
      firstAttempt: now,
      lastAttempt: now,
    });

    return {
      allowed: true,
      remaining: fullConfig.maxRequests - 1,
      resetTime: now + fullConfig.windowMs,
    };
  }

  // 检查是否在时间窗口内
  const windowStart = now - fullConfig.windowMs;

  if (entry.firstAttempt < windowStart) {
    // 窗口已过期，重置计数
    entry.count = 1;
    entry.firstAttempt = now;
    entry.lastAttempt = now;

    return {
      allowed: true,
      remaining: fullConfig.maxRequests - 1,
      resetTime: now + fullConfig.windowMs,
    };
  }

  // 检查冷却时间
  const timeSinceLastAttempt = now - entry.lastAttempt;
  if (timeSinceLastAttempt < fullConfig.cooldownMs) {
    const retryAfter = fullConfig.cooldownMs - timeSinceLastAttempt;

    logger.warn(`通知发送触发冷却限制`, {
      identifier: identifier.substring(0, 3) + '***',
      type,
      retryAfter,
    });

    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.firstAttempt + fullConfig.windowMs,
      retryAfter,
    };
  }

  // 检查是否超过最大请求数
  if (entry.count >= fullConfig.maxRequests) {
    logger.warn(`通知发送触发频率限制`, {
      identifier: identifier.substring(0, 3) + '***',
      type,
      count: entry.count,
      windowMs: fullConfig.windowMs,
    });

    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.firstAttempt + fullConfig.windowMs,
    };
  }

  // 允许发送，更新计数
  entry.count++;
  entry.lastAttempt = now;

  return {
    allowed: true,
    remaining: fullConfig.maxRequests - entry.count,
    resetTime: entry.firstAttempt + fullConfig.windowMs,
  };
}

/**
 * 重置频率限制（用于测试或手动解锁）
 */
export function resetRateLimit(
  identifier: string,
  type: 'SMS' | 'EMAIL'
): void {
  const key = generateKey(identifier, type);
  rateLimitStore.delete(key);
  logger.info(`频率限制已重置`, { identifier: identifier.substring(0, 3) + '***', type });
}

/**
 * 获取频率限制状态
 */
export function getRateLimitStatus(
  identifier: string,
  type: 'SMS' | 'EMAIL'
): {
  limited: boolean;
  count: number;
  remaining: number;
  resetTime: number;
} | null {
  const key = generateKey(identifier, type);
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      limited: false,
      count: 0,
      remaining: DEFAULT_CONFIG.maxRequests,
      resetTime: Date.now() + DEFAULT_CONFIG.windowMs,
    };
  }

  const now = Date.now();
  const windowStart = now - DEFAULT_CONFIG.windowMs;

  if (entry.firstAttempt < windowStart) {
    return {
      limited: false,
      count: 0,
      remaining: DEFAULT_CONFIG.maxRequests,
      resetTime: now + DEFAULT_CONFIG.windowMs,
    };
  }

  return {
    limited: entry.count >= DEFAULT_CONFIG.maxRequests,
    count: entry.count,
    remaining: Math.max(0, DEFAULT_CONFIG.maxRequests - entry.count),
    resetTime: entry.firstAttempt + DEFAULT_CONFIG.windowMs,
  };
}

/**
 * 清理所有限流记录
 */
export function clearAllRateLimits(): void {
  rateLimitStore.clear();
  logger.info('所有频率限制记录已清除');
}
