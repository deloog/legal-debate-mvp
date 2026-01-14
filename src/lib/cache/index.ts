// Redis缓存系统 - 统一导出接口

// 核心模块
export { cache, CacheManager, cacheManager } from './manager';
export {
  CacheMonitor,
  cacheMonitoringUtils,
  cacheMonitorInstance,
  getCacheMonitor,
} from './monitor';
export {
  checkRedisConnection,
  connectRedis,
  disconnectRedis,
  getRedisInfo,
  redis,
} from './redis';

// 类型定义
export type {
  CacheBatchResult,
  CacheCompressor,
  CacheConfig,
  CacheEvent,
  CacheEventListener,
  CacheHealth,
  CacheItem,
  CacheKeyGenerator,
  CacheNamespaceManager,
  CacheOperationResult,
  CacheOptions,
  CacheSerializer,
  CacheStats,
  CacheTagManager,
} from './types';

export { CacheNamespace, CacheStrategy, defaultCacheConfig } from './types';

// 缓存策略
export {
  BaseCacheStrategy,
  cacheStrategyConfigs,
  CacheStrategyFactory,
  cacheStrategyFactory,
  LazyLoadingStrategy,
  RefreshAheadStrategy,
  WriteBehindStrategy,
  WriteThroughStrategy,
} from './strategies';

// 缓存配置
export {
  cacheSystemConfig,
  getAllPreloadKeys,
  getConfigSummary,
  getNamespaceConfig,
  getRefreshThreshold,
  setNamespaceTTL,
  shouldAutoRefresh,
  validateConfig,
} from './cache-config';

// 缓存预加载
export {
  addPreloadItem,
  addPreloadItems,
  autoStartPreload,
  cachePreload,
  cancelAllPreloads,
  cancelPreload,
  cleanupPreload,
  clearPreloadQueue,
  executePreload,
  generatePreloadReport,
  getDataProvider,
  getPreloadStatus,
  initializePreloadFromConfig,
  registerDataProvider,
  scheduleCacheRefresh,
  schedulePreload,
  unregisterDataProvider,
} from './cache-preload';

// 便捷导出 - 常用功能
export { cache as cacheInstance } from './manager';
export { cacheMonitorInstance as cacheMonitor } from './monitor';

// 导入用于内部使用
import { cache as cacheInstance, cacheManager } from './manager';
import { cacheMonitorInstance } from './monitor';
import {
  checkRedisConnection,
  connectRedis,
  disconnectRedis,
  redis,
} from './redis';
import { cacheStrategyFactory } from './strategies';
import type { CacheHealth, CacheOptions, CacheStats } from './types';
import { CacheNamespace, CacheStrategy, defaultCacheConfig } from './types';
import { cacheSystemConfig } from './cache-config';
import { cachePreload } from './cache-preload';

// 类型别名
export type CacheNamespaceType = CacheNamespace;
export type CacheStrategyType = CacheStrategy;
export type CacheOptionsType = CacheOptions;

// 工具函数
export const cacheUtils = {
  // 快速缓存操作
  async getOrSet<T>(
    key: string,
    valueProvider: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T | null> {
    return cacheInstance.getOrSet<T>(key, valueProvider, options);
  },

  // 批量操作
  async batchGet<T>(
    keys: string[],
    options?: CacheOptions
  ): Promise<Map<string, T | null>> {
    return cacheInstance.mget<T>(keys, options);
  },

  async batchSet<T>(
    items: Array<{ key: string; value: T; ttl?: number }>,
    options?: CacheOptions
  ) {
    return cacheInstance.mset<T>(items, options);
  },

  async batchDelete(keys: string[], options?: CacheOptions): Promise<number> {
    return cacheInstance.mdelete(keys, options);
  },

  // 命名空间操作
  async clearNamespace(namespace: CacheNamespace): Promise<number> {
    return cacheInstance.clearNamespace(namespace);
  },

  // 健康检查
  async healthCheck(): Promise<CacheHealth> {
    return cacheMonitorInstance.getHealthStatus();
  },

  // 生成报告
  async generateReport(): Promise<string> {
    const { cacheMonitoringUtils } = await import('./monitor');
    return cacheMonitoringUtils.generateReport();
  },

  // 获取统计信息
  getStats(): CacheStats {
    return cacheManager.getStats();
  },

  // 重置统计
  resetStats(): void {
    cacheManager.resetStats();
  },
};

// 缓存装饰器
export function Cached(options?: {
  ttl?: number;
  namespace?: CacheNamespace;
  keyGenerator?: (...args: unknown[]) => string;
}) {
  return function (
    target: object,
    propertyName: string,
    descriptor: PropertyDescriptor
  ) {
    const method = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      // 生成缓存键
      const key = options?.keyGenerator
        ? options.keyGenerator(...args)
        : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;

      const cacheOptions: CacheOptions = {
        ttl: options?.ttl || defaultCacheConfig.defaultTtl,
        namespace: options?.namespace,
      };

      // 尝试从缓存获取
      const cached = await cacheUtils.getOrSet(
        key,
        () => method.apply(this, args),
        cacheOptions
      );

      return cached;
    };

    return descriptor;
  };
}

// 缓存工厂函数
export function createCache(namespace: CacheNamespace) {
  return {
    async get<T>(key: string, ttl?: number): Promise<T | null> {
      return cacheInstance.get<T>(key, { namespace, ttl });
    },

    async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
      return cacheInstance.set<T>(key, value, { namespace, ttl });
    },

    async delete(key: string): Promise<boolean> {
      return cacheInstance.delete(key, { namespace });
    },

    async exists(key: string): Promise<boolean> {
      return cacheInstance.exists(key, { namespace });
    },

    async clear(): Promise<number> {
      return cacheInstance.clearNamespace(namespace);
    },

    async getOrSet<T>(
      key: string,
      valueProvider: () => Promise<T>,
      ttl?: number
    ): Promise<T | null> {
      return cacheInstance.getOrSet<T>(key, valueProvider, { namespace, ttl });
    },
  };
}

// 常用缓存实例
export const userCache = createCache(CacheNamespace.USER_SESSION); // 30分钟
export const dataCache = createCache(CacheNamespace.USER_DATA); // 1小时
export const aiCache = createCache(CacheNamespace.AI_RESPONSE); // 1小时
export const configCache = createCache(CacheNamespace.CONFIGURATION); // 24小时
export const queryCache = createCache(CacheNamespace.DATABASE_QUERY); // 1小时
export const apiCache = createCache(CacheNamespace.API_RESPONSE); // 5分钟
export const tempCache = createCache(CacheNamespace.TEMPORARY); // 1分钟

// 缓存初始化函数
export async function initializeCache(): Promise<void> {
  try {
    // 连接Redis
    await connectRedis();

    // 健康检查
    const isConnected = await checkRedisConnection();

    if (!isConnected) {
      throw new Error('Redis连接失败');
    }

    console.log('✅ 缓存系统初始化成功');
  } catch (error) {
    console.error('❌ 缓存系统初始化失败:', error);
    throw error;
  }
}

// 缓存清理函数
export async function cleanupCache(): Promise<void> {
  try {
    // 停止监控
    cacheMonitorInstance.stop();

    // 断开连接
    await disconnectRedis();

    console.log('✅ 缓存系统清理完成');
  } catch (error) {
    console.error('❌ 缓存系统清理失败:', error);
    throw error;
  }
}

// 开发环境下的自动初始化
if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
  // 服务端开发环境下自动初始化
  initializeCache().catch(error => {
    console.error('开发环境缓存自动初始化失败:', error);
  });
}

// 默认导出
const cacheExports = {
  // 核心
  redis,
  cacheManager,
  cache: cacheInstance,
  cacheMonitor: cacheMonitorInstance,
  cacheStrategyFactory,

  // 配置
  cacheSystemConfig,

  // 预加载
  cachePreload,

  // 工具
  cacheUtils,

  // 实例
  userCache,
  dataCache,
  aiCache,
  configCache,
  queryCache,
  apiCache,
  tempCache,

  // 函数
  initializeCache,
  cleanupCache,
  createCache,
  Cached,

  // 配置
  defaultCacheConfig,
};

export default cacheExports;
