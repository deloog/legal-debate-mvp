/**
 * 法条API缓存层
 *
 * 支持Redis和内存双模式缓存，提供：
 * - 缓存读写
 * - 缓存失效
 * - 统计信息
 * - LRU淘汰策略
 */

import { redis, checkRedisConnection } from '../cache/redis';

// =============================================================================
// 类型定义
// =============================================================================

/** 缓存模式 */
export type CacheMode = 'memory' | 'redis' | 'hybrid';

/** 缓存配置 */
export interface APICacheConfig {
  /** 缓存模式 */
  mode: CacheMode;
  /** 默认TTL（秒） */
  defaultTTL: number;
  /** 内存缓存最大条目数 */
  maxMemoryItems: number;
  /** 是否启用统计 */
  enableStats: boolean;
  /** 缓存键前缀 */
  keyPrefix: string;
}

/** 缓存统计信息 */
export interface APICacheStats {
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 写入次数 */
  sets: number;
  /** 删除次数 */
  deletes: number;
  /** 命中率（百分比） */
  hitRate: number;
  /** 总请求数 */
  totalRequests: number;
  /** 内存缓存大小 */
  memorySize: number;
}

/** 健康检查结果 */
export interface CacheHealthStatus {
  /** 内存缓存是否可用 */
  memoryAvailable: boolean;
  /** Redis是否可用 */
  redisAvailable: boolean;
  /** 当前模式 */
  mode: CacheMode;
  /** 检查时间 */
  checkedAt: Date;
}

/** 缓存项 */
interface CacheEntry<T> {
  value: T;
  expiry: number;
  lastAccess: number;
}

/** 键生成选项 */
export interface KeyGeneratorOptions {
  limit?: number;
  category?: string;
  lawType?: string;
  caseType?: string;
  [key: string]: string | number | undefined;
}

/** 预热项 */
export interface WarmUpItem<T> {
  key: string;
  value: T;
  ttl?: number;
}

// =============================================================================
// 默认配置
// =============================================================================

const DEFAULT_CONFIG: APICacheConfig = {
  mode: 'hybrid',
  defaultTTL: 3600,
  maxMemoryItems: 1000,
  enableStats: true,
  keyPrefix: 'law_api:',
};

// =============================================================================
// LawArticleAPICache 类
// =============================================================================

export class LawArticleAPICache {
  private config: APICacheConfig;
  private memoryCache: Map<string, CacheEntry<unknown>>;
  private stats: APICacheStats;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<APICacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new Map();
    this.stats = this.createEmptyStats();

    // 启动定期清理
    this.startCleanup();
  }

  // ---------------------------------------------------------------------------
  // 公共方法
  // ---------------------------------------------------------------------------

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    // 混合模式或内存模式：先检查内存
    if (this.config.mode !== 'redis') {
      const memoryResult = this.getFromMemory<T>(fullKey);
      if (memoryResult !== null) {
        this.recordHit();
        return memoryResult;
      }
    }

    // Redis模式或混合模式（内存未命中）：检查Redis
    if (this.config.mode !== 'memory') {
      const redisResult = await this.getFromRedis<T>(fullKey);
      if (redisResult !== null) {
        // 混合模式：回填内存缓存
        if (this.config.mode === 'hybrid') {
          this.setToMemory(fullKey, redisResult, this.config.defaultTTL);
        }
        this.recordHit();
        return redisResult;
      }
    }

    this.recordMiss();
    return null;
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const actualTTL = ttl ?? this.config.defaultTTL;

    let success = true;

    // 内存模式或混合模式：写入内存
    if (this.config.mode !== 'redis') {
      this.setToMemory(fullKey, value, actualTTL);
    }

    // Redis模式或混合模式：写入Redis
    if (this.config.mode !== 'memory') {
      const redisSuccess = await this.setToRedis(fullKey, value, actualTTL);
      if (this.config.mode === 'redis') {
        success = redisSuccess;
      }
    }

    if (success) {
      this.recordSet();
    }

    return success;
  }

  /**
   * 删除缓存项
   */
  async invalidate(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);

    // 删除内存缓存
    if (this.config.mode !== 'redis') {
      this.memoryCache.delete(fullKey);
    }

    // 删除Redis缓存
    if (this.config.mode !== 'memory') {
      await this.deleteFromRedis(fullKey);
    }

    this.recordDelete();
  }

  /**
   * 按模式批量删除
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    const fullPattern = this.getFullKey(pattern);
    let deletedCount = 0;

    // 删除内存缓存
    if (this.config.mode !== 'redis') {
      const regex = this.patternToRegex(fullPattern);
      const keys = Array.from(this.memoryCache.keys());
      for (const key of keys) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          deletedCount++;
        }
      }
    }

    // 删除Redis缓存
    if (this.config.mode !== 'memory') {
      try {
        const keys = await redis.keys(fullPattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount = Math.max(deletedCount, keys.length);
        }
      } catch (error) {
        console.error('[APICache] 批量删除Redis缓存失败:', error);
      }
    }

    return deletedCount;
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 清空内存缓存
    this.memoryCache.clear();

    // 清空Redis缓存
    if (this.config.mode !== 'memory') {
      try {
        const pattern = `${this.config.keyPrefix}*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch (error) {
        console.error('[APICache] 清空Redis缓存失败:', error);
      }
    }
  }

  /**
   * 获取或设置缓存
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    // 尝试获取缓存
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，执行获取函数
    try {
      const value = await fetchFn();
      await this.set(key, value, ttl);
      return value;
    } catch (error) {
      console.error('[APICache] 获取数据失败:', error);
      return null;
    }
  }

  /**
   * 生成缓存键
   */
  generateKey(query: string, options: KeyGeneratorOptions): string {
    const parts: string[] = [query.trim()];

    // 按字母顺序添加选项
    const sortedKeys = Object.keys(options).sort();
    for (const key of sortedKeys) {
      const value = options[key];
      if (value !== undefined && value !== null && value !== '') {
        parts.push(`${key}:${value}`);
      }
    }

    return parts.join('|');
  }

  /**
   * 获取统计信息
   */
  getStats(): APICacheStats {
    return {
      ...this.stats,
      memorySize: this.memoryCache.size,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  /**
   * 获取配置
   */
  getConfig(): APICacheConfig {
    return { ...this.config };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<CacheHealthStatus> {
    const memoryAvailable = true;
    let redisAvailable = false;

    if (this.config.mode !== 'memory') {
      try {
        redisAvailable = await checkRedisConnection();
      } catch {
        redisAvailable = false;
      }
    }

    return {
      memoryAvailable,
      redisAvailable,
      mode: this.config.mode,
      checkedAt: new Date(),
    };
  }

  /**
   * 批量预热缓存
   */
  async warmUp<T>(items: WarmUpItem<T>[]): Promise<void> {
    const promises = items.map(item =>
      this.set(item.key, item.value, item.ttl)
    );
    await Promise.all(promises);
  }

  /**
   * 销毁缓存实例
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
  }

  // ---------------------------------------------------------------------------
  // 私有方法 - 内存缓存
  // ---------------------------------------------------------------------------

  private getFromMemory<T>(key: string): T | null {
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }

    // 更新最后访问时间（LRU）
    entry.lastAccess = Date.now();
    return entry.value;
  }

  private setToMemory<T>(key: string, value: T, ttl: number): void {
    // 检查是否需要清理
    if (this.memoryCache.size >= this.config.maxMemoryItems) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      value,
      expiry: Date.now() + ttl * 1000,
      lastAccess: Date.now(),
    };

    this.memoryCache.set(key, entry);
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    const entries = Array.from(this.memoryCache.entries());
    for (const [key, entry] of entries) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  // ---------------------------------------------------------------------------
  // 私有方法 - Redis缓存
  // ---------------------------------------------------------------------------

  private async getFromRedis<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('[APICache] Redis读取失败:', error);
      return null;
    }
  }

  private async setToRedis<T>(
    key: string,
    value: T,
    ttl: number
  ): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttl, serialized);
      return true;
    } catch (error) {
      console.error('[APICache] Redis写入失败:', error);
      return false;
    }
  }

  private async deleteFromRedis(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      console.error('[APICache] Redis删除失败:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // 私有方法 - 工具函数
  // ---------------------------------------------------------------------------

  private getFullKey(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }

  private createEmptyStats(): APICacheStats {
    return {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalRequests: 0,
      memorySize: 0,
    };
  }

  private recordHit(): void {
    if (!this.config.enableStats) return;
    this.stats.hits++;
    this.stats.totalRequests++;
    this.updateHitRate();
  }

  private recordMiss(): void {
    if (!this.config.enableStats) return;
    this.stats.misses++;
    this.stats.totalRequests++;
    this.updateHitRate();
  }

  private recordSet(): void {
    if (!this.config.enableStats) return;
    this.stats.sets++;
  }

  private recordDelete(): void {
    if (!this.config.enableStats) return;
    this.stats.deletes++;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    if (total > 0) {
      this.stats.hitRate = (this.stats.hits / total) * 100;
    }
  }

  private startCleanup(): void {
    // 每分钟清理过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000);
  }

  private cleanupExpired(): void {
    const now = Date.now();
    const entries = Array.from(this.memoryCache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// =============================================================================
// 导出单例
// =============================================================================

let defaultInstance: LawArticleAPICache | null = null;

export function getAPICache(): LawArticleAPICache {
  if (!defaultInstance) {
    defaultInstance = new LawArticleAPICache();
  }
  return defaultInstance;
}

export function resetAPICache(): void {
  if (defaultInstance) {
    defaultInstance.destroy();
    defaultInstance = null;
  }
}
