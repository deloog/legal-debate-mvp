/**
 * IP过滤器 - 黑名单和白名单功能
 * 用于阻止恶意IP或限制访问到特定IP
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * IP过滤规则类型
 */
export type IPFilterRule = {
  ip: string;
  reason?: string;
  addedAt: Date;
  expiresAt?: Date; // 可选的过期时间
};

/**
 * IP过滤配置
 */
export interface IPFilterConfig {
  mode: 'blacklist' | 'whitelist' | 'off';
  blockMessage?: string;
}

/**
 * IP过滤器类
 */
class IPFilter {
  private blacklist: Map<string, IPFilterRule> = new Map();
  private whitelist: Map<string, IPFilterRule> = new Map();
  private config: IPFilterConfig = {
    mode: 'blacklist', // 默认黑名单模式
    blockMessage: '访问被拒绝',
  };

  /**
   * 设置过滤模式
   */
  setMode(mode: IPFilterConfig['mode']): void {
    this.config.mode = mode;
  }

  /**
   * 获取当前模式
   */
  getMode(): IPFilterConfig['mode'] {
    return this.config.mode;
  }

  /**
   * 添加IP到黑名单
   */
  addToBlacklist(ip: string, reason?: string, expiresInMinutes?: number): void {
    const rule: IPFilterRule = {
      ip,
      reason,
      addedAt: new Date(),
      expiresAt: expiresInMinutes
        ? new Date(Date.now() + expiresInMinutes * 60 * 1000)
        : undefined,
    };

    this.blacklist.set(ip, rule);

    if (process.env.NODE_ENV !== 'test') {
      logger.warn('[IPFilter] IP added to blacklist:', {
        ip,
        reason,
        expires: rule.expiresAt?.toISOString(),
      });
    }
  }

  /**
   * 从黑名单移除IP
   */
  removeFromBlacklist(ip: string): boolean {
    const removed = this.blacklist.delete(ip);
    if (removed && process.env.NODE_ENV !== 'test') {
      logger.info('[IPFilter] IP removed from blacklist:', { ip });
    }
    return removed;
  }

  /**
   * 添加IP到白名单
   */
  addToWhitelist(ip: string, reason?: string): void {
    const rule: IPFilterRule = {
      ip,
      reason,
      addedAt: new Date(),
    };

    this.whitelist.set(ip, rule);

    if (process.env.NODE_ENV !== 'test') {
      logger.info('[IPFilter] IP added to whitelist:', { ip, reason });
    }
  }

  /**
   * 从白名单移除IP
   */
  removeFromWhitelist(ip: string): boolean {
    return this.whitelist.delete(ip);
  }

  /**
   * 检查IP是否在黑名单中
   */
  isBlacklisted(ip: string): boolean {
    const rule = this.blacklist.get(ip);

    if (!rule) {
      return false;
    }

    // 检查是否过期
    if (rule.expiresAt && new Date() > rule.expiresAt) {
      this.blacklist.delete(ip);
      return false;
    }

    return true;
  }

  /**
   * 检查IP是否在白名单中
   */
  isWhitelisted(ip: string): boolean {
    return this.whitelist.has(ip);
  }

  /**
   * 检查IP是否应该被阻止
   */
  shouldBlock(ip: string): { blocked: boolean; reason?: string } {
    // 如果过滤器关闭，不阻止任何IP
    if (this.config.mode === 'off') {
      return { blocked: false };
    }

    // 白名单模式：只允许白名单中的IP
    if (this.config.mode === 'whitelist') {
      if (this.isWhitelisted(ip)) {
        return { blocked: false };
      }
      return {
        blocked: true,
        reason: 'IP不在白名单中',
      };
    }

    // 黑名单模式：阻止黑名单中的IP
    if (this.config.mode === 'blacklist') {
      if (this.isBlacklisted(ip)) {
        const rule = this.blacklist.get(ip);
        return {
          blocked: true,
          reason: rule?.reason || '该IP已被封禁',
        };
      }
      return { blocked: false };
    }

    return { blocked: false };
  }

  /**
   * 获取黑名单列表
   */
  getBlacklist(): IPFilterRule[] {
    return Array.from(this.blacklist.values()).filter(rule => {
      // 过滤掉已过期的规则
      if (rule.expiresAt && new Date() > rule.expiresAt) {
        this.blacklist.delete(rule.ip);
        return false;
      }
      return true;
    });
  }

  /**
   * 获取白名单列表
   */
  getWhitelist(): IPFilterRule[] {
    return Array.from(this.whitelist.values());
  }

  /**
   * 批量添加IP到黑名单
   */
  batchAddToBlacklist(ips: string[], reason?: string): void {
    ips.forEach(ip => this.addToBlacklist(ip, reason));
  }

  /**
   * 批量添加IP到白名单
   */
  batchAddToWhitelist(ips: string[], reason?: string): void {
    ips.forEach(ip => this.addToWhitelist(ip, reason));
  }

  /**
   * 清空黑名单
   */
  clearBlacklist(): void {
    this.blacklist.clear();
    if (process.env.NODE_ENV !== 'test') {
      logger.info('[IPFilter] Blacklist cleared');
    }
  }

  /**
   * 清空白名单
   */
  clearWhitelist(): void {
    this.whitelist.clear();
    if (process.env.NODE_ENV !== 'test') {
      logger.info('[IPFilter] Whitelist cleared');
    }
  }

  /**
   * 清理过期的黑名单条目
   */
  cleanupExpired(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [ip, rule] of this.blacklist.entries()) {
      if (rule.expiresAt && now > rule.expiresAt) {
        this.blacklist.delete(ip);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0 && process.env.NODE_ENV === 'development') {
      logger.info('[IPFilter] Cleaned up expired blacklist entries', {
        cleanedCount,
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      mode: this.config.mode,
      blacklistSize: this.blacklist.size,
      whitelistSize: this.whitelist.size,
    };
  }
}

// 导出单例实例
export const ipFilter = new IPFilter();

// 定期清理过期条目（每小时）
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      ipFilter.cleanupExpired();
    },
    60 * 60 * 1000
  );
}

/**
 * 从请求中提取IP地址
 */
export function getClientIP(request: NextRequest): string {
  // 优先使用 X-Forwarded-For（代理/负载均衡器传递的真实IP）
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // X-Forwarded-For 可能包含多个IP，取第一个
    return forwarded.split(',')[0].trim();
  }

  // 尝试 X-Real-IP
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // 其他可能的头
  const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}

/**
 * IP过滤中间件
 */
export function createIPFilterMiddleware(config?: Partial<IPFilterConfig>) {
  if (config?.mode) {
    ipFilter.setMode(config.mode);
  }

  return async function ipFilterMiddleware(
    request: NextRequest
  ): Promise<NextResponse | null> {
    const ip = getClientIP(request);

    const result = ipFilter.shouldBlock(ip);

    if (result.blocked) {
      const message = config?.blockMessage || result.reason || '访问被拒绝';

      if (process.env.NODE_ENV !== 'test') {
        logger.warn('[IPFilter] Blocked request from:', {
          ip,
          reason: result.reason,
          path: new URL(request.url).pathname,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message,
          },
        },
        { status: 403 }
      );
    }

    return null; // 允许继续处理
  };
}

/**
 * 应用IP过滤到API路由
 */
export function withIPFilter<
  TArgs extends unknown[],
  T extends (request: NextRequest, ...args: TArgs) => Promise<NextResponse>,
>(handler: T, config?: Partial<IPFilterConfig>): T {
  const middleware = createIPFilterMiddleware(config);

  return (async (request: NextRequest, ...args: TArgs) => {
    const filterResponse = await middleware(request);
    if (filterResponse) {
      return filterResponse;
    }
    return handler(request, ...args);
  }) as T;
}

/**
 * 与速率限制监控集成 - 自动封禁频繁违规的IP
 */
export function autoBlockOffenders(
  _monitor: {
    isPotentialAttacker: (
      identifier: string,
      timeWindow: number,
      threshold: number
    ) => boolean;
  },
  _timeWindowMinutes: number = 10,
  _threshold: number = 10,
  _banDurationMinutes: number = 60
): void {
  // 这个函数可以被定期调用（例如每5分钟）
  // 检查监控系统中的潜在攻击者并自动添加到黑名单

  // 注意：这需要从监控系统获取所有唯一标识符
  // 这里只是一个框架，实际实现需要根据监控系统的API调整
  if (process.env.NODE_ENV === 'development') {
    logger.info('[IPFilter] Auto-block check running...');
  }
}

/**
 * 使用示例：
 *
 * ```typescript
 * // 1. 基本使用 - 应用到单个API
 * import { withIPFilter } from '@/lib/middleware/ip-filter';
 *
 * export const POST = withIPFilter(async (request) => {
 *   // API逻辑
 * });
 *
 * // 2. 添加IP到黑名单
 * import { ipFilter } from '@/lib/middleware/ip-filter';
 *
 * ipFilter.addToBlacklist('192.168.1.100', '恶意攻击', 60); // 封禁60分钟
 *
 * // 3. 使用白名单模式
 * ipFilter.setMode('whitelist');
 * ipFilter.addToWhitelist('192.168.1.1', '内部IP');
 *
 * // 4. 批量操作
 * ipFilter.batchAddToBlacklist(['1.2.3.4', '5.6.7.8'], 'DDoS攻击');
 *
 * // 5. 获取统计
 * const stats = ipFilter.getStats();
 * ```
 */
