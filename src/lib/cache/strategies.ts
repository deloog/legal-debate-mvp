import { CacheManager } from './manager';
import { CacheOptions, CacheNamespace, defaultCacheConfig, CacheStrategy } from './types';

// 缓存策略基类
export abstract class BaseCacheStrategy {
  protected cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  abstract get<T>(key: string, options?: CacheOptions): Promise<T | null>;
  abstract set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean>;
  abstract delete(key: string, options?: CacheOptions): Promise<boolean>;
}

// 懒加载策略（Cache-Aside Pattern）
export class LazyLoadingStrategy extends BaseCacheStrategy {
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    return await this.cacheManager.get<T>(key, options);
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    return await this.cacheManager.set<T>(key, value, options);
  }

  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    return await this.cacheManager.delete(key, options);
  }

  // 获取或设置（如果不存在则从数据源加载）
  async getOrSet<T>(
    key: string,
    dataProvider: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T | null> {
    return await this.cacheManager.getOrSet<T>(key, dataProvider, options);
  }
}

// 写穿透策略（Write-Through Pattern）
export class WriteThroughStrategy extends BaseCacheStrategy {
  private dataWriter: (key: string, value: any) => Promise<boolean>;

  constructor(
    cacheManager: CacheManager,
    dataWriter: (key: string, value: any) => Promise<boolean>
  ) {
    super(cacheManager);
    this.dataWriter = dataWriter;
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    // 先从缓存获取
    const cached = await this.cacheManager.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中时，这里不自动加载数据，由调用方决定
    return null;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      // 先写入数据源
      const dataWriteSuccess = await this.dataWriter(key, value);
      if (!dataWriteSuccess) {
        console.warn(`数据源写入失败 [${key}], 缓存写入已跳过`);
        return false;
      }

      // 数据源写入成功后，再写入缓存
      return await this.cacheManager.set<T>(key, value, options);
    } catch (error) {
      console.error(`写穿透策略执行失败 [${key}]:`, error);
      return false;
    }
  }

  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      // 同时删除缓存和数据源
      const cacheDeleteResult = await this.cacheManager.delete(key, options);
      // 这里应该也有数据源删除逻辑，但需要根据具体业务实现
      
      return cacheDeleteResult;
    } catch (error) {
      console.error(`写穿透删除失败 [${key}]:`, error);
      return false;
    }
  }
}

// 写回策略（Write-Behind Pattern）
export class WriteBehindStrategy extends BaseCacheStrategy {
  private dataWriter: (key: string, value: any) => Promise<boolean>;
  private writeQueue: Map<string, { value: any; timestamp: number }> = new Map();
  private batchWriteDelay: number = 5000; // 5秒批量写入
  private batchWriteTimer?: NodeJS.Timeout;

  constructor(
    cacheManager: CacheManager,
    dataWriter: (key: string, value: any) => Promise<boolean>,
    batchWriteDelay: number = 5000
  ) {
    super(cacheManager);
    this.dataWriter = dataWriter;
    this.batchWriteDelay = batchWriteDelay;
    this.startBatchWriter();
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    // 检查是否有待写入的数据
    if (this.writeQueue.has(key)) {
      const queuedData = this.writeQueue.get(key);
      return queuedData?.value as T || null;
    }

    return await this.cacheManager.get<T>(key, options);
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    try {
      // 立即写入缓存
      const cacheSetSuccess = await this.cacheManager.set<T>(key, value, options);
      
      if (cacheSetSuccess) {
        // 添加到写队列
        this.writeQueue.set(key, {
          value,
          timestamp: Date.now(),
        });

        // 重置批量写入定时器
        this.resetBatchWriter();
      }

      return cacheSetSuccess;
    } catch (error) {
      console.error(`写回策略设置失败 [${key}]:`, error);
      return false;
    }
  }

  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    try {
      // 从写队列中移除
      this.writeQueue.delete(key);

      // 从缓存中删除
      return await this.cacheManager.delete(key, options);
    } catch (error) {
      console.error(`写回策略删除失败 [${key}]:`, error);
      return false;
    }
  }

  // 启动批量写入器
  private startBatchWriter(): void {
    if (this.batchWriteTimer) {
      clearInterval(this.batchWriteTimer);
    }

    this.batchWriteTimer = setInterval(() => {
      this.flushWriteQueue();
    }, this.batchWriteDelay);
  }

  // 重置批量写入定时器
  private resetBatchWriter(): void {
    if (this.batchWriteTimer) {
      clearInterval(this.batchWriteTimer);
    }

    this.batchWriteTimer = setTimeout(() => {
      this.flushWriteQueue();
      this.startBatchWriter();
    }, this.batchWriteDelay);
  }

  // 刷新写队列
  private async flushWriteQueue(): Promise<void> {
    if (this.writeQueue.size === 0) {
      return;
    }

    const entries = Array.from(this.writeQueue.entries());
    this.writeQueue.clear();

    const writePromises = entries.map(async ([key, data]) => {
      try {
        return await this.dataWriter(key, data.value);
      } catch (error) {
        console.error(`批量写入失败 [${key}]:`, error);
        return false;
      }
    });

    const results = await Promise.allSettled(writePromises);
    const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length;
    const failureCount = results.length - successCount;

    if (failureCount > 0) {
      console.warn(`批量写入完成: 成功 ${successCount}, 失败 ${failureCount}`);
    }
  }

  // 强制刷新写队列
  async forceFlush(): Promise<void> {
    if (this.batchWriteTimer) {
      clearTimeout(this.batchWriteTimer);
    }
    await this.flushWriteQueue();
    this.startBatchWriter();
  }

  // 获取写队列状态
  getWriteQueueStatus(): { size: number; oldestTimestamp: number | null } {
    if (this.writeQueue.size === 0) {
      return { size: 0, oldestTimestamp: null };
    }

    const timestamps = Array.from(this.writeQueue.values()).map(data => data.timestamp);
    return {
      size: this.writeQueue.size,
      oldestTimestamp: Math.min(...timestamps),
    };
  }
}

// 预刷新策略（Refresh-Ahead Pattern）
export class RefreshAheadStrategy extends BaseCacheStrategy {
  private refreshThreshold: number; // 在TTL剩余多少秒时刷新
  private dataProvider: (key: string) => Promise<any>;
  private refreshJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    cacheManager: CacheManager,
    dataProvider: (key: string) => Promise<any>,
    refreshThreshold: number = 300 // 默认5分钟
  ) {
    super(cacheManager);
    this.dataProvider = dataProvider;
    this.refreshThreshold = refreshThreshold;
  }

  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    const cached = await this.cacheManager.get<T>(key, options);
    
    if (cached !== null) {
      // 检查是否需要预刷新
      const ttl = await this.cacheManager.ttl(key, options);
      if (ttl > 0 && ttl <= this.refreshThreshold) {
        this.scheduleRefresh(key, options);
      }
    }

    return cached;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<boolean> {
    return await this.cacheManager.set<T>(key, value, options);
  }

  async delete(key: string, options?: CacheOptions): Promise<boolean> {
    // 取消预刷新任务
    this.cancelRefresh(key);
    return await this.cacheManager.delete(key, options);
  }

  // 安排预刷新
  private scheduleRefresh(key: string, options?: CacheOptions): void {
    // 如果已经在刷新队列中，跳过
    if (this.refreshJobs.has(key)) {
      return;
    }

    // 安排延迟刷新
    const timer = setTimeout(async () => {
      try {
        const newValue = await this.dataProvider(key);
        if (newValue !== null && newValue !== undefined) {
          await this.cacheManager.set(key, newValue, options);
          console.log(`预刷新缓存成功: ${key}`);
        }
      } catch (error) {
        console.error(`预刷新缓存失败 [${key}]:`, error);
      } finally {
        this.refreshJobs.delete(key);
      }
    }, 1000); // 1秒后执行刷新

    this.refreshJobs.set(key, timer);
  }

  // 取消预刷新
  private cancelRefresh(key: string): void {
    const timer = this.refreshJobs.get(key);
    if (timer) {
      clearTimeout(timer);
      this.refreshJobs.delete(key);
    }
  }

  // 获取预刷新状态
  getRefreshStatus(): { scheduledRefreshes: string[] } {
    return {
      scheduledRefreshes: Array.from(this.refreshJobs.keys()),
    };
  }

  // 取消所有预刷新任务
  cancelAllRefreshes(): void {
    for (const timer of this.refreshJobs.values()) {
      clearTimeout(timer);
    }
    this.refreshJobs.clear();
  }
}

// 缓存策略工厂
export class CacheStrategyFactory {
  private cacheManager: CacheManager;

  constructor(cacheManager: CacheManager) {
    this.cacheManager = cacheManager;
  }

  // 创建懒加载策略
  createLazyLoadingStrategy(): LazyLoadingStrategy {
    return new LazyLoadingStrategy(this.cacheManager);
  }

  // 创建写穿透策略
  createWriteThroughStrategy(
    dataWriter: (key: string, value: any) => Promise<boolean>
  ): WriteThroughStrategy {
    return new WriteThroughStrategy(this.cacheManager, dataWriter);
  }

  // 创建写回策略
  createWriteBehindStrategy(
    dataWriter: (key: string, value: any) => Promise<boolean>,
    batchWriteDelay?: number
  ): WriteBehindStrategy {
    return new WriteBehindStrategy(this.cacheManager, dataWriter, batchWriteDelay);
  }

  // 创建预刷新策略
  createRefreshAheadStrategy(
    dataProvider: (key: string) => Promise<any>,
    refreshThreshold?: number
  ): RefreshAheadStrategy {
    return new RefreshAheadStrategy(this.cacheManager, dataProvider, refreshThreshold);
  }

  // 根据策略类型创建策略
  createStrategy(
    strategy: CacheStrategy,
    dataWriter?: (key: string, value: any) => Promise<boolean>,
    dataProvider?: (key: string) => Promise<any>,
    options?: {
      batchWriteDelay?: number;
      refreshThreshold?: number;
    }
  ): BaseCacheStrategy {
    switch (strategy) {
      case CacheStrategy.LAZY_LOADING:
        return this.createLazyLoadingStrategy();

      case CacheStrategy.WRITE_THROUGH:
        if (!dataWriter) {
          throw new Error('写穿透策略需要提供 dataWriter 函数');
        }
        return this.createWriteThroughStrategy(dataWriter);

      case CacheStrategy.WRITE_BEHIND:
        if (!dataWriter) {
          throw new Error('写回策略需要提供 dataWriter 函数');
        }
        return this.createWriteBehindStrategy(dataWriter, options?.batchWriteDelay);

      case CacheStrategy.REFRESH_AHEAD:
        if (!dataProvider) {
          throw new Error('预刷新策略需要提供 dataProvider 函数');
        }
        return this.createRefreshAheadStrategy(dataProvider, options?.refreshThreshold);

      default:
        throw new Error(`不支持的缓存策略: ${strategy}`);
    }
  }
}

// 创建默认策略工厂实例
import { cacheManager } from './manager';
export const cacheStrategyFactory = new CacheStrategyFactory(cacheManager);

// 预定义的缓存策略配置
export const cacheStrategyConfigs = {
  // 用户会话缓存配置
  userSession: {
    strategy: CacheStrategy.LAZY_LOADING,
    options: {
      ttl: defaultCacheConfig.sessionTtl,
      namespace: CacheNamespace.USER_SESSION,
    },
  },

  // AI响应缓存配置
  aiResponse: {
    strategy: CacheStrategy.REFRESH_AHEAD,
    options: {
      ttl: defaultCacheConfig.defaultTtl,
      namespace: CacheNamespace.AI_RESPONSE,
      refreshThreshold: 300, // 5分钟
    },
  },

  // 配置缓存配置
  configuration: {
    strategy: CacheStrategy.WRITE_THROUGH,
    options: {
      ttl: defaultCacheConfig.configTtl,
      namespace: CacheNamespace.CONFIGURATION,
    },
  },

  // 数据库查询缓存配置
  databaseQuery: {
    strategy: CacheStrategy.LAZY_LOADING,
    options: {
      ttl: defaultCacheConfig.defaultTtl,
      namespace: CacheNamespace.DATABASE_QUERY,
    },
  },
};

export default CacheStrategyFactory;
