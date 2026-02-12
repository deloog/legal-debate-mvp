/**
 * 速率限制监控工具
 * 用于记录和分析速率限制事件
 */

export interface RateLimitEvent {
  timestamp: Date;
  identifier: string;
  endpoint: string;
  limitType: 'strict' | 'moderate' | 'lenient' | 'custom';
  currentCount: number;
  maxRequests: number;
  blocked: boolean;
  userAgent?: string;
  ip?: string;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  blockRate: number;
  topOffenders: Array<{
    identifier: string;
    blockedCount: number;
    lastBlocked: Date;
  }>;
  endpointStats: Record<
    string,
    {
      requests: number;
      blocked: number;
    }
  >;
}

/**
 * 速率限制事件存储（内存存储，生产环境应使用Redis或数据库）
 */
class RateLimitMonitor {
  private events: RateLimitEvent[] = [];
  private maxEvents = 10000; // 最多保存10000条事件
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 每小时清理一次过期事件
    if (typeof setInterval !== 'undefined') {
      this.cleanupInterval = setInterval(
        () => {
          this.cleanup();
        },
        60 * 60 * 1000
      );
    }
  }

  /**
   * 记录速率限制事件
   */
  recordEvent(event: Omit<RateLimitEvent, 'timestamp'>): void {
    const fullEvent: RateLimitEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // 如果超过最大事件数，删除最旧的事件
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // 如果是被阻止的请求，记录到日志
    if (event.blocked && process.env.NODE_ENV !== 'test') {
      console.warn('[RateLimit] Request blocked:', {
        identifier: event.identifier.substring(0, 20) + '...',
        endpoint: event.endpoint,
        limitType: event.limitType,
        count: `${event.currentCount}/${event.maxRequests}`,
        ip: event.ip,
      });
    }
  }

  /**
   * 获取统计信息
   */
  getStats(timeWindowMinutes: number = 60): RateLimitStats {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const recentEvents = this.events.filter(e => e.timestamp >= cutoffTime);

    const totalRequests = recentEvents.length;
    const blockedRequests = recentEvents.filter(e => e.blocked).length;
    const blockRate =
      totalRequests > 0 ? (blockedRequests / totalRequests) * 100 : 0;

    // 统计被阻止最多的标识符
    const offenderMap = new Map<string, { count: number; lastBlocked: Date }>();
    recentEvents.forEach(event => {
      if (event.blocked) {
        const existing = offenderMap.get(event.identifier);
        if (existing) {
          existing.count++;
          if (event.timestamp > existing.lastBlocked) {
            existing.lastBlocked = event.timestamp;
          }
        } else {
          offenderMap.set(event.identifier, {
            count: 1,
            lastBlocked: event.timestamp,
          });
        }
      }
    });

    const topOffenders = Array.from(offenderMap.entries())
      .map(([identifier, data]) => ({
        identifier,
        blockedCount: data.count,
        lastBlocked: data.lastBlocked,
      }))
      .sort((a, b) => b.blockedCount - a.blockedCount)
      .slice(0, 10); // 只返回前10个

    // 统计各端点的请求和阻止情况
    const endpointStats: Record<string, { requests: number; blocked: number }> =
      {};
    recentEvents.forEach(event => {
      if (!endpointStats[event.endpoint]) {
        endpointStats[event.endpoint] = { requests: 0, blocked: 0 };
      }
      endpointStats[event.endpoint].requests++;
      if (event.blocked) {
        endpointStats[event.endpoint].blocked++;
      }
    });

    return {
      totalRequests,
      blockedRequests,
      blockRate: Math.round(blockRate * 100) / 100,
      topOffenders,
      endpointStats,
    };
  }

  /**
   * 检查某个标识符是否被频繁阻止（可能是攻击者）
   */
  isPotentialAttacker(
    identifier: string,
    timeWindowMinutes: number = 10,
    threshold: number = 10
  ): boolean {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const blockedCount = this.events.filter(
      e => e.identifier === identifier && e.blocked && e.timestamp >= cutoffTime
    ).length;

    return blockedCount >= threshold;
  }

  /**
   * 获取某个端点的详细统计
   */
  getEndpointStats(endpoint: string, timeWindowMinutes: number = 60) {
    const cutoffTime = new Date(Date.now() - timeWindowMinutes * 60 * 1000);
    const endpointEvents = this.events.filter(
      e => e.endpoint === endpoint && e.timestamp >= cutoffTime
    );

    const totalRequests = endpointEvents.length;
    const blockedRequests = endpointEvents.filter(e => e.blocked).length;
    const uniqueIdentifiers = new Set(endpointEvents.map(e => e.identifier))
      .size;

    return {
      endpoint,
      totalRequests,
      blockedRequests,
      blockRate:
        totalRequests > 0
          ? Math.round((blockedRequests / totalRequests) * 10000) / 100
          : 0,
      uniqueIdentifiers,
      timeWindowMinutes,
    };
  }

  /**
   * 清理过期事件（超过24小时）
   */
  private cleanup(): void {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.events = this.events.filter(e => e.timestamp >= cutoffTime);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[RateLimitMonitor] Cleaned up old events. Current count: ${this.events.length}`
      );
    }
  }

  /**
   * 获取所有事件（用于调试）
   */
  getAllEvents(): RateLimitEvent[] {
    return [...this.events];
  }

  /**
   * 清空所有事件（用于测试）
   */
  clearAll(): void {
    this.events = [];
  }

  /**
   * 销毁监控器（清理定时器）
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// 导出单例实例
export const rateLimitMonitor = new RateLimitMonitor();

/**
 * 导出监控API路由助手函数
 */
export function createMonitoringEndpoint() {
  return {
    /**
     * GET /api/admin/rate-limit/stats
     * 获取速率限制统计信息
     */
    getStats: (timeWindowMinutes: number = 60) => {
      return rateLimitMonitor.getStats(timeWindowMinutes);
    },

    /**
     * GET /api/admin/rate-limit/endpoint/:endpoint
     * 获取特定端点的统计
     */
    getEndpointStats: (endpoint: string, timeWindowMinutes: number = 60) => {
      return rateLimitMonitor.getEndpointStats(endpoint, timeWindowMinutes);
    },

    /**
     * GET /api/admin/rate-limit/check/:identifier
     * 检查某个标识符是否是潜在攻击者
     */
    checkPotentialAttacker: (
      identifier: string,
      timeWindowMinutes: number = 10,
      threshold: number = 10
    ) => {
      return rateLimitMonitor.isPotentialAttacker(
        identifier,
        timeWindowMinutes,
        threshold
      );
    },
  };
}
