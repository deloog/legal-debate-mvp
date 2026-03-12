import { CacheManager } from './manager';
import type { RedisInfo } from './redis';
import { checkRedisConnection, getRedisInfo, redis } from './redis';
import {
  CacheEvent,
  CacheEventListener,
  CacheHealth,
  CacheNamespace,
  CacheStats,
} from './types';

// 缓存监控器类
export class CacheMonitor {
  private cacheManager: CacheManager;
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsInterval?: NodeJS.Timeout;
  private eventListeners: CacheEventListener[] = [];
  private healthHistory: CacheHealth[] = [];
  private maxHistorySize: number = 100;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
    this.setupEventListeners();
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    this.cacheManager.addEventListener(this.handleCacheEvent.bind(this));
  }

  // 处理缓存事件
  private handleCacheEvent(event: CacheEvent): void {
    // 通知所有外部监听器
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('缓存监控事件监听器执行失败:', error);
      }
    });
  }

  // 启动监控
  start(options?: {
    healthCheckInterval?: number; // 健康检查间隔（毫秒）
    metricsInterval?: number; // 指标收集间隔（毫秒）
  }): void {
    if (this.isMonitoring) {
      logger.warn('缓存监控器已经在运行');
      return;
    }

    const {
      healthCheckInterval = 30000, // 30秒
      metricsInterval = 60000, // 1分钟
    } = options || {};

    this.isMonitoring = true;
    logger.info('启动缓存监控器');

    // 启动健康检查
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, healthCheckInterval);

    // 启动指标收集
    this.metricsInterval = setInterval(async () => {
      await this.collectMetrics();
    }, metricsInterval);

    // 立即执行一次健康检查和指标收集
    this.performHealthCheck();
    this.collectMetrics();
  }

  // 停止监控
  stop(): void {
    if (!this.isMonitoring) {
      logger.warn('缓存监控器未在运行');
      return;
    }

    this.isMonitoring = false;
    logger.info('停止缓存监控器');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  // 执行健康检查
  private async performHealthCheck(): Promise<CacheHealth> {
    const startTime = Date.now();

    try {
      const isConnected = await checkRedisConnection();
      const responseTime = Date.now() - startTime;

      let memoryUsage = 0;
      let keyCount = 0;

      if (isConnected) {
        try {
          const redisInfo = await getRedisInfo();
          if (redisInfo && redisInfo.memory) {
            memoryUsage = parseInt(redisInfo.memory.used_memory || '0', 10);
          }
          if (redisInfo && redisInfo.stats) {
            keyCount =
              parseInt(redisInfo.stats.keyspace_hits || '0', 10) +
              parseInt(redisInfo.stats.keyspace_misses || '0', 10);
          }
        } catch (error) {
          logger.error('获取Redis信息失败:', error);
        }
      }

      const health: CacheHealth = {
        connected: isConnected,
        responseTime,
        memoryUsage,
        keyCount,
        lastCheck: new Date(),
      };

      // 添加到历史记录
      this.addToHealthHistory(health);

      // 检查健康状态并发出警告
      this.checkHealthThresholds(health);

      return health;
    } catch (error) {
      const health: CacheHealth = {
        connected: false,
        responseTime: Date.now() - startTime,
        memoryUsage: 0,
        keyCount: 0,
        lastCheck: new Date(),
      };

      this.addToHealthHistory(health);
      logger.error('缓存健康检查失败:', error);

      return health;
    }
  }

  // 添加健康检查历史记录
  private addToHealthHistory(health: CacheHealth): void {
    this.healthHistory.push(health);

    // 保持历史记录大小
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  // 检查健康阈值
  private checkHealthThresholds(health: CacheHealth): void {
    if (!health.connected) {
      logger.error('缓存连接中断！');
      this.triggerAlert('DISCONNECTED', '缓存连接中断', health);
      return;
    }

    if (health.responseTime > 1000) {
      // 响应时间超过1秒
      logger.warn(`缓存响应时间过慢: ${health.responseTime}ms`);
      this.triggerAlert(
        'SLOW_RESPONSE',
        `缓存响应时间过慢: ${health.responseTime}ms`,
        health
      );
    }

    const memoryMB = health.memoryUsage / (1024 * 1024);
    if (memoryMB > 1000) {
      // 内存使用超过1GB
      logger.warn(`缓存内存使用过高: ${memoryMB.toFixed(2)}MB`);
      this.triggerAlert(
        'HIGH_MEMORY',
        `缓存内存使用过高: ${memoryMB.toFixed(2)}MB`,
        health
      );
    }
  }

  // 触发告警
  private triggerAlert(
    type: string,
    message: string,
    health: CacheHealth
  ): void {
    const alert = {
      type,
      message,
      timestamp: new Date(),
      health,
    };

    logger.error('缓存告警:', alert);

    // 这里可以集成外部告警系统（如邮件、短信、Slack等）
    // this.sendAlert(alert);
  }

  // 收集指标
  private async collectMetrics(): Promise<void> {
    try {
      const stats = this.cacheManager.getStats();
      const redisInfo = await getRedisInfo();

      // 记录指标日志
      logger.info('缓存指标:', {
        hitRate: `${stats.hitRate.toFixed(2)}%`,
        totalRequests: stats.totalRequests,
        memoryUsage: redisInfo?.memory?.used_memory || '0',
        connectedKeys: redisInfo?.stats?.keyspace_hits || '0',
      });

      // 这里可以发送指标到监控系统（如Prometheus、InfluxDB等）
      // this.sendMetrics(metrics);
    } catch (error) {
      logger.error('收集缓存指标失败:', error);
    }
  }

  // 获取当前健康状态
  async getHealthStatus(): Promise<CacheHealth> {
    return await this.performHealthCheck();
  }

  // 获取健康历史记录
  getHealthHistory(): CacheHealth[] {
    return [...this.healthHistory];
  }

  // 获取详细监控信息
  async getDetailedStatus(): Promise<{
    health: CacheHealth;
    stats: CacheStats;
    redisInfo: RedisInfo | null;
    isMonitoring: boolean;
  }> {
    const [health, redisInfo] = await Promise.all([
      this.performHealthCheck(),
      getRedisInfo(),
    ]);

    const stats = this.cacheManager.getStats();

    return {
      health,
      stats,
      redisInfo,
      isMonitoring: this.isMonitoring,
    };
  }

  // 添加外部事件监听器
  addEventListener(listener: CacheEventListener): void {
    this.eventListeners.push(listener);
  }

  // 移除外部事件监听器
  removeEventListener(listener: CacheEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  // 获取性能报告
  getPerformanceReport(): {
    avgResponseTime: number;
    maxResponseTime: number;
    uptime: number;
    alertCount: number;
    hitRateTrend: number[];
  } {
    if (this.healthHistory.length === 0) {
      return {
        avgResponseTime: 0,
        maxResponseTime: 0,
        uptime: 0,
        alertCount: 0,
        hitRateTrend: [],
      };
    }

    const responseTimes = this.healthHistory.map(h => h.responseTime);
    const avgResponseTime =
      responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);

    // 计算运行时间（基于第一次健康检查时间）
    const uptime =
      this.healthHistory.length > 1
        ? Date.now() - this.healthHistory[0].lastCheck.getTime()
        : 0;

    // 计算告警次数
    const alertCount = this.healthHistory.filter(
      h => !h.connected || h.responseTime > 1000
    ).length;

    // 获取命中率趋势（最近10次）
    const stats = this.cacheManager.getStats();
    const hitRateTrend = [stats.hitRate]; // 这里可以实现更复杂的趋势计算

    return {
      avgResponseTime,
      maxResponseTime,
      uptime,
      alertCount,
      hitRateTrend,
    };
  }

  // 重置监控数据
  reset(): void {
    this.healthHistory = [];
    this.cacheManager.resetStats();
    logger.info('缓存监控数据已重置');
  }

  // 清理资源
  cleanup(): void {
    this.stop();
    this.eventListeners = [];
    this.healthHistory = [];
    logger.info('缓存监控器已清理');
  }
}

// 缓存监控器单例
let cacheMonitor: CacheMonitor | null = null;

// 获取缓存监控器实例
export const getCacheMonitor = (cacheManager: CacheManager): CacheMonitor => {
  if (!cacheMonitor) {
    cacheMonitor = new CacheMonitor(cacheManager);
  }
  return cacheMonitor;
};

// 创建缓存监控器的便捷函数
import { cacheManager } from './manager';
import { logger } from '@/lib/logger';
export const cacheMonitorInstance = getCacheMonitor(cacheManager);

// 自动启动监控（仅在开发环境）
if (process.env.NODE_ENV === 'development') {
  // 开发环境下自动启动监控
  setTimeout(() => {
    cacheMonitorInstance.start({
      healthCheckInterval: 30000, // 30秒
      metricsInterval: 60000, // 1分钟
    });
  }, 5000); // 应用启动5秒后开始监控
}

// 缓存监控工具函数
export const cacheMonitoringUtils = {
  // 检查特定命名空间的缓存健康状态
  async checkNamespaceHealth(namespace: CacheNamespace): Promise<{
    namespace: string;
    keyCount: number;
    memoryUsage: number;
    avgTtl: number;
  }> {
    try {
      if (!redis) {
        return {
          namespace,
          keyCount: 0,
          memoryUsage: 0,
          avgTtl: 0,
        };
      }

      const pattern = `legal_debate:${namespace}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length === 0) {
        return {
          namespace,
          keyCount: 0,
          memoryUsage: 0,
          avgTtl: 0,
        };
      }

      // 获取所有键的TTL
      const r = redis;
      const ttls = await Promise.all(keys.map(key => r.ttl(key)));
      const validTtls = ttls.filter(ttl => ttl > 0);
      const avgTtl =
        validTtls.length > 0
          ? validTtls.reduce((sum, ttl) => sum + ttl, 0) / validTtls.length
          : 0;

      // 估算内存使用（简化计算）
      const memoryUsage = keys.length * 100; // 假设每个键平均占用100字节

      return {
        namespace,
        keyCount: keys.length,
        memoryUsage,
        avgTtl,
      };
    } catch (error) {
      logger.error(`检查命名空间健康状态失败 [${namespace}]:`, error);
      return {
        namespace,
        keyCount: 0,
        memoryUsage: 0,
        avgTtl: 0,
      };
    }
  },

  // 获取热点键
  async getHotKeys(): Promise<Array<{ key: string; accessCount: number }>> {
    // 这里需要实现基于访问频率的热点键统计
    // 由于Redis本身不直接提供访问计数，需要在应用层实现
    logger.warn('热点键统计功能需要在应用层实现访问计数');
    return [];
  },

  // 清理过期键
  async cleanupExpiredKeys(): Promise<number> {
    try {
      // Redis会自动清理过期键，这里只是记录日志
      logger.info('Redis自动清理过期键中...');
      return 0;
    } catch (error) {
      logger.error('清理过期键失败:', error);
      return 0;
    }
  },

  // 生成缓存报告
  async generateReport(): Promise<string> {
    const status = await cacheMonitorInstance.getDetailedStatus();
    const performanceReport = cacheMonitorInstance.getPerformanceReport();

    const report = `
# 缓存系统监控报告

## 基本信息
- 生成时间: ${new Date().toISOString()}
- 监控状态: ${status.isMonitoring ? '运行中' : '已停止'}

## 连接状态
- 连接状态: ${status.health.connected ? '正常' : '断开'}
- 响应时间: ${status.health.responseTime}ms
- 内存使用: ${(status.health.memoryUsage / (1024 * 1024)).toFixed(2)}MB
- 键数量: ${status.health.keyCount}

## 缓存统计
- 命中次数: ${status.stats.hits}
- 未命中次数: ${status.stats.misses}
- 命中率: ${status.stats.hitRate.toFixed(2)}%
- 总请求数: ${status.stats.totalRequests}
- 设置次数: ${status.stats.sets}
- 删除次数: ${status.stats.deletes}

## 性能指标
- 平均响应时间: ${performanceReport.avgResponseTime.toFixed(2)}ms
- 最大响应时间: ${performanceReport.maxResponseTime}ms
- 运行时间: ${(performanceReport.uptime / 1000 / 60).toFixed(2)}分钟
- 告警次数: ${performanceReport.alertCount}

## Redis信息
${JSON.stringify(status.redisInfo, null, 2)}
    `.trim();

    return report;
  },
};

export default CacheMonitor;
