/**
 * 缓存预加载机制
 * 在应用启动时预加载热点数据，提升系统性能
 */

import { cache } from './manager';
import { CacheNamespace, CacheOptions } from './types';
import {
  getAllPreloadKeys,
  getNamespaceConfig,
  cacheSystemConfig,
} from './cache-config';

/**
 * 预加载项接口
 */
interface PreloadItem {
  namespace: CacheNamespace;
  key: string;
  dataProvider: () => Promise<unknown>;
  priority: number; // 优先级，数字越小越先加载
}

/**
 * 预加载结果接口
 */
export interface PreloadResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ key: string; error: Error }>;
  duration: number; // 毫秒
}

/**
 * 预加载队列
 */
const preloadQueue: PreloadItem[] = [];
const preloadTimers: Map<string, NodeJS.Timeout> = new Map();
let isPreloading = false;

/**
 * 数据提供者注册表
 */
const dataProviders: Map<string, () => Promise<unknown>> = new Map();

/**
 * 注册数据提供者
 */
export function registerDataProvider(
  key: string,
  provider: () => Promise<unknown>
): void {
  dataProviders.set(key, provider);
}

/**
 * 注销数据提供者
 */
export function unregisterDataProvider(key: string): boolean {
  return dataProviders.delete(key);
}

/**
 * 获取数据提供者
 */
export function getDataProvider(
  key: string
): (() => Promise<unknown>) | undefined {
  return dataProviders.get(key);
}

/**
 * 添加预加载项到队列
 */
export function addPreloadItem(item: PreloadItem): void {
  preloadQueue.push(item);
  // 按优先级排序
  preloadQueue.sort((a, b) => a.priority - b.priority);
}

/**
 * 批量添加预加载项
 */
export function addPreloadItems(items: PreloadItem[]): void {
  items.forEach(item => addPreloadItem(item));
}

/**
 * 清空预加载队列
 */
export function clearPreloadQueue(): void {
  preloadQueue.length = 0;
}

/**
 * 延迟预加载单个键
 */
export function schedulePreload(
  key: string,
  delay: number
): NodeJS.Timeout | null {
  if (preloadTimers.has(key)) {
    return preloadTimers.get(key)!;
  }

  const timer = setTimeout(async () => {
    try {
      // 这里需要知道key对应的namespace和provider
      // 由调用者自行处理
      preloadTimers.delete(key);
    } catch (error) {
      console.error(`定时预加载失败 [${key}]:`, error);
      preloadTimers.delete(key);
    }
  }, delay);

  preloadTimers.set(key, timer);
  return timer;
}

/**
 * 取消预加载
 */
export function cancelPreload(key: string): boolean {
  const timer = preloadTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    return preloadTimers.delete(key);
  }
  return false;
}

/**
 * 取消所有预加载
 */
export function cancelAllPreloads(): number {
  let cancelled = 0;
  for (const [key, timer] of preloadTimers.entries()) {
    clearTimeout(timer);
    preloadTimers.delete(key);
    cancelled++;
  }
  return cancelled;
}

/**
 * 执行预加载
 */
export async function executePreload(options?: {
  batchSize?: number;
  batchDelay?: number;
  onProgress?: (result: Partial<PreloadResult>) => void;
}): Promise<PreloadResult> {
  const startTime = Date.now();
  const result: PreloadResult = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    duration: 0,
  };

  if (isPreloading) {
    console.warn('预加载正在进行中，跳过此次请求');
    result.skipped = preloadQueue.length;
    result.total = preloadQueue.length;
    result.duration = Date.now() - startTime;
    return result;
  }

  isPreloading = true;
  const batchSize = options?.batchSize || cacheSystemConfig.preload.batchSize;
  const batchDelay =
    options?.batchDelay || cacheSystemConfig.preload.batchDelay;

  try {
    result.total = preloadQueue.length;

    // 批量处理预加载
    for (let i = 0; i < preloadQueue.length; i += batchSize) {
      const batch = preloadQueue.slice(i, i + batchSize);

      const batchPromises = batch.map(async item => {
        try {
          const config = getNamespaceConfig(item.namespace);
          if (!config) {
            throw new Error(`未找到命名空间配置: ${item.namespace}`);
          }

          // 检查缓存是否已存在
          const cached = await cache.exists(item.key, {
            namespace: item.namespace,
          });

          if (cached) {
            console.log(`缓存已存在，跳过预加载: ${item.key}`);
            result.skipped++;
            return;
          }

          // 获取数据
          let data: unknown;
          if (item.dataProvider) {
            data = await item.dataProvider();
          } else if (dataProviders.has(item.key)) {
            data = await dataProviders.get(item.key)!();
          } else {
            throw new Error(`未找到数据提供者: ${item.key}`);
          }

          if (data === null || data === undefined) {
            console.warn(`数据为空，跳过缓存: ${item.key}`);
            result.skipped++;
            return;
          }

          // 设置缓存
          const cacheOptions: CacheOptions = {
            namespace: item.namespace,
            ttl: config.ttl,
          };

          const setSuccess = await cache.set(item.key, data, cacheOptions);

          if (setSuccess) {
            result.success++;
            console.log(`预加载成功: ${item.key}`);
          } else {
            throw new Error('缓存设置失败');
          }
        } catch (error) {
          result.failed++;
          const errorObj =
            error instanceof Error ? error : new Error(String(error));
          result.errors.push({ key: item.key, error: errorObj });
          console.error(`预加载失败 [${item.key}]:`, error);
        }
      });

      await Promise.all(batchPromises);

      // 批次间延迟
      if (i + batchSize < preloadQueue.length && batchDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }

      // 报告进度
      if (options?.onProgress) {
        options.onProgress({
          total: preloadQueue.length,
          success: result.success,
          failed: result.failed,
          skipped: result.skipped,
        });
      }
    }
  } finally {
    result.duration = Date.now() - startTime;
    isPreloading = false;
  }

  console.log(
    `预加载完成: 成功 ${result.success}, 失败 ${result.failed}, 跳过 ${result.skipped}, 耗时 ${result.duration}ms`
  );

  return result;
}

/**
 * 从配置文件初始化预加载
 */
export function initializePreloadFromConfig(): void {
  const preloadKeys = getAllPreloadKeys();

  console.log(`初始化预加载，共 ${preloadKeys.length} 个命名空间`);

  for (const item of preloadKeys) {
    for (const key of item.keys) {
      // 创建占位预加载项，实际数据需要由业务代码注册
      addPreloadItem({
        namespace: item.namespace,
        key,
        dataProvider: async () => {
          const provider = dataProviders.get(key);
          if (provider) {
            return await provider();
          }
          throw new Error(`未注册数据提供者: ${key}`);
        },
        priority: 0,
      });
    }
  }
}

/**
 * 自动启动预加载
 */
export function autoStartPreload(): void {
  if (!cacheSystemConfig.preload.enabled) {
    console.log('预加载已禁用');
    return;
  }

  const delay = cacheSystemConfig.preload.delayAfterStart;
  console.log(`预加载将在 ${delay}ms 后自动启动`);

  setTimeout(async () => {
    try {
      const result = await executePreload({
        onProgress: progress => {
          console.log(`预加载进度: ${progress.success}/${progress.total}`);
        },
      });

      console.log(`自动预加载完成`, result);
    } catch (error) {
      console.error('自动预加载失败:', error);
    }
  }, delay);
}

/**
 * 定时刷新缓存
 */
export function scheduleCacheRefresh(
  namespace: CacheNamespace,
  keys: string[],
  interval: number
): NodeJS.Timeout {
  return setInterval(async () => {
    console.log(`定时刷新缓存: ${namespace}`);

    for (const key of keys) {
      const provider = dataProviders.get(key);
      if (provider) {
        try {
          const data = await provider();
          const config = getNamespaceConfig(namespace);
          if (config) {
            await cache.set(key, data, { namespace, ttl: config.ttl });
            console.log(`刷新缓存成功: ${key}`);
          }
        } catch (error) {
          console.error(`刷新缓存失败 [${key}]:`, error);
        }
      }
    }
  }, interval * 1000);
}

/**
 * 获取预加载状态
 */
export function getPreloadStatus(): {
  queueSize: number;
  isPreloading: boolean;
  pendingTimers: number;
  registeredProviders: number;
} {
  return {
    queueSize: preloadQueue.length,
    isPreloading,
    pendingTimers: preloadTimers.size,
    registeredProviders: dataProviders.size,
  };
}

/**
 * 生成预加载报告
 */
export function generatePreloadReport(): string {
  const status = getPreloadStatus();
  const preloadKeys = getAllPreloadKeys();

  return `
缓存预加载报告
===============

配置状态
- 预加载启用: ${cacheSystemConfig.preload.enabled}
- 队列大小: ${status.queueSize}
- 加载状态: ${status.isPreloading ? '进行中' : '空闲'}
- 待处理定时器: ${status.pendingTimers}
- 注册数据提供者: ${status.registeredProviders}

配置的预加载项
${preloadKeys
  .map(
    item =>
      `- ${item.namespace}: ${item.keys.length}个键 (${item.keys.join(', ')})`
  )
  .join('\n')}
`.trim();
}

/**
 * 清理预加载资源
 */
export function cleanupPreload(): void {
  cancelAllPreloads();
  clearPreloadQueue();
  dataProviders.clear();
  console.log('预加载资源已清理');
}

/**
 * 导出默认实例
 */
export const cachePreload = {
  registerDataProvider,
  unregisterDataProvider,
  getDataProvider,
  addPreloadItem,
  addPreloadItems,
  clearPreloadQueue,
  schedulePreload,
  cancelPreload,
  cancelAllPreloads,
  executePreload,
  initializePreloadFromConfig,
  autoStartPreload,
  scheduleCacheRefresh,
  getPreloadStatus,
  generatePreloadReport,
  cleanupPreload,
};

export default cachePreload;
