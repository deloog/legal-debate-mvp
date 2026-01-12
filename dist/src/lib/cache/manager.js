'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.cache = exports.cacheManager = exports.CacheManager = void 0;
const redis_1 = require('./redis');
const types_1 = require('./types');
// JSON序列化器
const jsonSerializer = {
  serialize(value) {
    try {
      return JSON.stringify(value);
    } catch (error) {
      throw new Error(
        `序列化失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
  deserialize(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new Error(
        `反序列化失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
};
// 缓存管理器类
class CacheManager {
  constructor(config) {
    this.config = types_1.defaultCacheConfig;
    this.serializer = jsonSerializer;
    this.eventListeners = new Set();
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
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }
  // 生成完整的缓存键
  generateKey(key, namespace) {
    const parts = [this.config.keyPrefix];
    if (namespace) {
      parts.push(namespace);
    }
    parts.push(key);
    const fullKey = parts.join(':');
    // 验证键长度
    if (fullKey.length > this.config.maxKeyLength) {
      throw new Error(
        `缓存键长度超过限制: ${fullKey.length} > ${this.config.maxKeyLength}`
      );
    }
    return fullKey;
  }
  // 触发事件
  emitEvent(event) {
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
  updateStats(type) {
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
      this.stats.hitRate =
        (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100;
    }
  }
  // 序列化值
  serializeValue(value, options) {
    if (options?.serialize === false) {
      return String(value);
    }
    return this.serializer.serialize(value);
  }
  // 反序列化值
  deserializeValue(value, options) {
    if (options?.serialize === false) {
      return value;
    }
    return this.serializer.deserialize(value);
  }
  // 获取缓存值
  async get(key, options) {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const startTime = Date.now();
      const value = await redis_1.redis.get(fullKey);
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
      return this.deserializeValue(value, options);
    } catch (error) {
      console.error(`获取缓存失败 [${key}]:`, error);
      this.emitEvent({
        type: 'miss',
        key,
        namespace: options?.namespace,
        timestamp: new Date(),
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return null;
    }
  }
  // 设置缓存值
  async set(key, value, options) {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const serializedValue = this.serializeValue(value, options);
      // 检查值大小
      if (serializedValue.length > this.config.maxValueSize) {
        throw new Error(
          `缓存值大小超过限制: ${serializedValue.length} > ${this.config.maxValueSize}`
        );
      }
      const ttl = options?.ttl ?? this.config.defaultTtl;
      const result = await redis_1.redis.setex(fullKey, ttl, serializedValue);
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
  async delete(key, options) {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const result = await redis_1.redis.del(fullKey);
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
  async exists(key, options) {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const result = await redis_1.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      console.error(`检查缓存存在性失败 [${key}]:`, error);
      return false;
    }
  }
  // 设置TTL
  async expire(key, ttl, options) {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      const result = await redis_1.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      console.error(`设置缓存TTL失败 [${key}]:`, error);
      return false;
    }
  }
  // 获取TTL
  async ttl(key, options) {
    try {
      const fullKey = this.generateKey(key, options?.namespace);
      return await redis_1.redis.ttl(fullKey);
    } catch (error) {
      console.error(`获取缓存TTL失败 [${key}]:`, error);
      return -1;
    }
  }
  // 批量获取
  async mget(keys, options) {
    const fullKeys = keys.map(key => this.generateKey(key, options?.namespace));
    try {
      const values = await redis_1.redis.mget(...fullKeys);
      const result = new Map();
      keys.forEach((key, index) => {
        const value = values[index];
        if (value === null) {
          result.set(key, null);
        } else {
          try {
            result.set(key, this.deserializeValue(value, options));
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
  async mset(items, options) {
    const results = [];
    let successCount = 0;
    let failureCount = 0;
    for (const item of items) {
      try {
        const success = await this.set(item.key, item.value, {
          ...options,
          ttl: item.ttl,
        });
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
  async mdelete(keys, options) {
    const fullKeys = keys.map(key => this.generateKey(key, options?.namespace));
    try {
      const result = await redis_1.redis.del(...fullKeys);
      return result;
    } catch (error) {
      console.error('批量删除缓存失败:', error);
      return 0;
    }
  }
  // 清空命名空间
  async clearNamespace(namespace) {
    try {
      const pattern = `${this.config.keyPrefix}${namespace}:*`;
      const keys = await redis_1.redis.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      const result = await redis_1.redis.del(...keys);
      // 更新统计
      this.stats.deletes += result;
      return result;
    } catch (error) {
      console.error(`清空缓存命名空间失败 [${namespace}]:`, error);
      return 0;
    }
  }
  // 获取统计信息
  getStats() {
    return { ...this.stats };
  }
  // 重置统计信息
  resetStats() {
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
  addEventListener(listener) {
    this.eventListeners.add(listener);
  }
  // 移除事件监听器
  removeEventListener(listener) {
    this.eventListeners.delete(listener);
  }
  // 获取或设置（如果不存在则设置）
  async getOrSet(key, valueProvider, options) {
    // 尝试从缓存获取
    const cached = await this.get(key, options);
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
  setSerializer(serializer) {
    this.serializer = serializer;
  }
  // 获取配置
  getConfig() {
    return { ...this.config };
  }
}
exports.CacheManager = CacheManager;
// 创建默认缓存管理器实例
exports.cacheManager = new CacheManager();
// 便捷函数
exports.cache = {
  get: (key, options) => exports.cacheManager.get(key, options),
  set: (key, value, options) => exports.cacheManager.set(key, value, options),
  delete: (key, options) => exports.cacheManager.delete(key, options),
  exists: (key, options) => exports.cacheManager.exists(key, options),
  expire: (key, ttl, options) => exports.cacheManager.expire(key, ttl, options),
  ttl: (key, options) => exports.cacheManager.ttl(key, options),
  mget: (keys, options) => exports.cacheManager.mget(keys, options),
  mset: (items, options) => exports.cacheManager.mset(items, options),
  mdelete: (keys, options) => exports.cacheManager.mdelete(keys, options),
  clearNamespace: namespace => exports.cacheManager.clearNamespace(namespace),
  getOrSet: (key, valueProvider, options) =>
    exports.cacheManager.getOrSet(key, valueProvider, options),
  getStats: () => exports.cacheManager.getStats(),
  resetStats: () => exports.cacheManager.resetStats(),
  addEventListener: listener => exports.cacheManager.addEventListener(listener),
  removeEventListener: listener =>
    exports.cacheManager.removeEventListener(listener),
};
exports.default = exports.cacheManager;
