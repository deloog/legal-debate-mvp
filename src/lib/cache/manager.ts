import { redis } from './redis';
import {
  CacheItem,
  CacheOptions,
  CacheStats,
  CacheHealth,
  CacheOperationResult,
  CacheBatchResult,
  CacheEvent,
  CacheEventListener,
  CacheSerializer,
  CacheNamespace,
  defaultCacheConfig,
} from './types';

// JSON序列化器
const jsonSerializer: CacheSerializer = {
  serialize<T>(value: T): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new Error(`序列化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  
  deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      throw new Error(`反序列化失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};

// 缓存管理器类
export class CacheManager {
  private config = defaultCacheConfig;
  private serializer: CacheSerializer = jsonSerializer;
  private eventListeners: Set<CacheEventListener> = new Set();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    memoryUsage: 0,
    keyCount: 0,
  };

  constructor(config?: Partial<typeof defaultCacheConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // 生成完整的缓存键
  private generateKey(key: string, namespace?: string): string {
    const parts: string[] = [this.config.keyPrefix];
    
    if (namespace) {
      parts.push(namespace);
    }
    
    parts.push(key);
    
    const fullKey = parts.join(':');
    
    // 验证键长度
    if (fullKey.length > this.config.maxKeyLength) {
      throw new Error(`缓存键长度超过限制: ${fullKey.length} > ${this.config.maxKeyLength}`);
    }
    
    return fullKey;
  }

  // 触发事件
  private emitEvent(event: CacheEvent): void {
    if (!this.config.enableMetrics) return;
    
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('缓存事件监听器执行失败:', error);
      }
    });
  }

  // 更新统计信息
  private updateStats(type: 'hit' | 'miss' | 'set' | 'delete'): void {
    if (!this.config.enableMetrics) return;
    
    this.stats.totalRequests++;
    
    switch (type) {
      case 'hit':
        this.stats.hits++;
        break;
      case 'miss':
        this.stats.misses++;
        break;
      case 'set':
        this.stats.sets++;
        break;
      case 'delete':
        this.stats.deletes++;
        break;
    }
    
    // 计算命中率
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100;
    }
  }

  // 序列化值
  private serializeValue<T>(value: T, options?: CacheOptions): string {
    if (options?.serialize === false) {
      return String(value);
    }
    return this.serializer.serialize(value);
  }

  // 反序列化值
  private deserializeValue<T>(value: string, options?: CacheOptions): T {
    if (options?.serialize === false) {
      return value as unknown as T;
    }
    return this.serializer.deserialize<T>(value);
  }

  // 获取缓存值
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const startTime = Date.now();
      
      const value = await redis.get(fullKey);
      
      if (value === null) {
        this.updateStats('miss');
        this.emitEvent({
          type: 'miss',
          key,
          namespace: options?.namespace,
          timestamp: new Date(),
          metadata: { responseTime: Date.now() - startTime },
        });
        return null;
      }
      
      this.updateStats('hit');
      this.emitEvent({
        type: 'hit',
        key,
        namespace: options?.namespace,
        timestamp: new Date(),
        metadata: { responseTime: Date.now() - startTime },
      });
      
      return this.deserializeValue<T>(value, options);
    } catch (error) {
      console.error(`获取缓存失败 [${key}]:`, error);
      this.emitEvent({
        type: 'miss',
        key,
        namespace: options?.namespace,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });
      return null;
    }
  }

  // 设置缓存值
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const serializedValue = this.serializeValue(value, options);
      
      // 检查值大小
      if (serializedValue.length > this.config.maxValueSize) {
        throw new Error(`缓存值大小超过限制: ${serializedValue.length} > ${this.config.maxValueSize}`);
      }
      
      const ttl = options?.ttl ?? this.config.defaultTtl;
      const result = await redis.setex(fullKey, ttl, serializedValue);
      
      const success = result === 'OK';
      
      if (success) {
        this.updateStats('set');
        this.emitEvent({
          type: 'set',
          key,
          namespace: options?.namespace,
          timestamp: new Date(),
          metadata: { ttl },
        });
      }
      
      return success;
    } catch (error) {
      console.error(`设置缓存失败 [${key}]:`, error);
      return false;
    }
  }

  // 删除缓存值
  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const result = await redis.del(fullKey);
      
      const success = result > 0;
      
      if (success) {
        this.updateStats('delete');
        this.emitEvent({
          type: 'delete',
          key,
          namespace: options?.namespace,
          timestamp: new Date(),
        });
      }
      
      return success;
    } catch (error) {
      console.error(`删除缓存失败 [${key}]:`, error);
      return false;
    }
  }

  // 检查缓存是否存在
  async exists(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const result = await redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error(`检查缓存存在性失败 [${key}]:`, error);
      return false;
    }
  }

  // 设置TTL
  async expire(key: string, ttl: number, options?: CacheOptions): Promise<boolean> {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const result = await redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error(`设置缓存TTL失败 [${key}]:`, error);
      return false;
    }
  }

  // 获取TTL
  async ttl(key: string, options?: CacheOptions): Promise<number> {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      return await redis.ttl(fullKey);
    } catch (error) {
      console.error(`获取缓存TTL失败 [${key}]:`, error);
      return -1;
    }
  }

  // 批量获取
  async mget<T>(keys: string[], options?: CacheOptions): Promise<Map<string, T | null>> {
    const fullKeys = keys.map(key => this.generateKey(key, options?.namespace));
    
    try {
      const values = await redis.mget(...fullKeys);
      const result = new Map<string, T | null>();
      
      keys.forEach((key, index) => {
        const value = values[index];
        if (value === null) {
          result.set(key, null);
        } else {
          try {
            result.set(key, this.deserializeValue<T>(value, options));
          } catch (error) {
            console.error(`反序列化缓存值失败 [${key}]:`, error);
            result.set(key, null);
          }
        }
      });
      
      return result;
    } catch (error) {
      console.error('批量获取缓存失败:', error);
      return new Map(keys.map(key => [key, null]));
    }
  }

  // 批量设置
  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>, options?: CacheOptions): Promise<CacheBatchResult<T>> {
    const results: Array<{
      key: string;
      success: boolean;
      value?: T;
      error?: Error;
    }> = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const item of items) {
      try {
        const success = await this.set(item.key, item.value, { ...options, ttl: item.ttl });
        
        results.push({
          key: item.key,
          success,
          value: success ? item.value : undefined,
        });
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
        }
      } catch (error) {
        results.push({
          key: item.key,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        failureCount++;
      }
    }
    
    return {
      results,
      successCount,
      failureCount,
      totalCount: items.length,
    };
  }

  // 批量删除
  async mdelete(keys: string[], options?: CacheOptions): Promise<number> {
    const fullKeys = keys.map(key => this.generateKey(key, options?.namespace));
    
    try {
      const result = await redis.del(...fullKeys);
      return result;
    } catch (error) {
      console.error('批量删除缓存失败:', error);
      return 0;
    }
  }

  // 清空命名空间
  async clearNamespace(namespace: CacheNamespace | string): Promise<number> {
    try {
      const pattern = `${this.config.keyPrefix}${namespace}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await redis.del(...keys);
      
      // 更新统计
      this.stats.deletes += result;
      
      return result;
    } catch (error) {
      console.error(`清空缓存命名空间失败 [${namespace}]:`, error);
      return 0;
    }
  }

  // 获取统计信息
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // 重置统计信息
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryUsage: 0,
      keyCount: 0,
    };
  }

  // 添加事件监听器
  addEventListener(listener: CacheEventListener): void {
    this.eventListeners.add(listener);
  }

  // 移除事件监听器
  removeEventListener(listener: CacheEventListener): void {
    this.eventListeners.delete(listener);
  }

  // 获取或设置（如果不存在则设置）
  async getOrSet<T>(
    key: string,
    valueProvider: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T | null> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }
    
    // 缓存未命中，获取新值
    try {
      const value = await valueProvider();
      
      // 设置到缓存
      await this.set(key, value, options);
      
      return value;
    } catch (error) {
      console.error(`获取新值失败 [${key}]:`, error);
      return null;
    }
  }

  // 设置序列化器
  setSerializer(serializer: CacheSerializer): void {
    this.serializer = serializer;
  }

  // 获取配置
  getConfig(): typeof defaultCacheConfig {
    return { ...this.config };
  }
}

// 创建默认缓存管理器实例
export const cacheManager = new CacheManager();

// 便捷函数
export const cache = {
  get: <T>(key: string, options?: CacheOptions) => cacheManager.get<T>(key, options),
  set: <T>(key: string, value: T, options?: CacheOptions) => cacheManager.set<T>(key, value, options),
  delete: (key: string, options?: CacheOptions) => cacheManager.delete(key, options),
  exists: (key: string, options?: CacheOptions) => cacheManager.exists(key, options),
  expire: (key: string, ttl: number, options?: CacheOptions) => cacheManager.expire(key, ttl, options),
  ttl: (key: string, options?: CacheOptions) => cacheManager.ttl(key, options),
  mget: <T>(keys: string[], options?: CacheOptions) => cacheManager.mget<T>(keys, options),
  mset: <T>(items: Array<{ key: string; value: T; ttl?: number }>, options?: CacheOptions) => 
    cacheManager.mset<T>(items, options),
  mdelete: (keys: string[], options?: CacheOptions) => cacheManager.mdelete(keys, options),
  clearNamespace: (namespace: CacheNamespace | string) => cacheManager.clearNamespace(namespace),
  getOrSet: <T>(
    key: string,
    valueProvider: () => Promise<T>,
    options?: CacheOptions
  ) => cacheManager.getOrSet<T>(key, valueProvider, options),
  getStats: () => cacheManager.getStats(),
  resetStats: () => cacheManager.resetStats(),
  addEventListener: (listener: CacheEventListener) => cacheManager.addEventListener(listener),
  removeEventListener: (listener: CacheEventListener) => cacheManager.removeEventListener(listener),
};

export default cacheManager;
