/**
 * Redis缓存优化工具
 * 提供缓存管理和性能监控
 */

import Redis from 'ioredis';
import { logger } from '@/lib/logger';

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

class CacheManager {
  private redis: Redis;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
  };

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (err: Error) => {
      logger.error('Redis连接错误', err);
      this.stats.errors++;
    });
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (value) {
        this.stats.hits++;
        return JSON.parse(value);
      } else {
        this.stats.misses++;
        return null;
      }
    } catch (error) {
      logger.error('获取缓存失败', { error });
      this.stats.errors++;
      return null;
    }
  }

  /**
   * 设置缓存
   */
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      this.stats.sets++;
      return true;
    } catch (error) {
      logger.error('设置缓存失败', { error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      this.stats.deletes++;
      return true;
    } catch (error) {
      logger.error('删除缓存失败', { error });
      this.stats.errors++;
      return false;
    }
  }

  /**
   * 批量删除缓存（按模式）
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.stats.deletes += keys.length;
        return keys.length;
      }
      return 0;
    } catch (error) {
      logger.error('批量删除缓存失败', { error });
      this.stats.errors++;
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & { hitRate: string } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate =
      total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * 打印缓存统计报告
   */
  printReport() {
    const stats = this.getStats();
    logger.info('Redis缓存性能报告', {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      sets: stats.sets,
      deletes: stats.deletes,
      errors: stats.errors,
    });
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
    };
  }

  /**
   * 关闭连接
   */
  async close() {
    await this.redis.quit();
  }
}

// 导出单例
export const cacheManager = new CacheManager();
