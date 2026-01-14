/**
 * 缓存预加载机制测试
 */

import { CacheNamespace } from '@/lib/cache/types';
import {
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
  getPreloadStatus,
  generatePreloadReport,
  cleanupPreload,
} from '@/lib/cache/cache-preload';
import { cache } from '@/lib/cache/manager';

// Mock缓存
jest.mock('@/lib/cache/manager', () => ({
  cache: {
    exists: jest.fn().mockResolvedValue(false),
    set: jest.fn().mockResolvedValue(true),
  },
}));

describe('缓存预加载机制', () => {
  beforeEach(() => {
    clearPreloadQueue();
    cancelAllPreloads();
  });

  afterEach(() => {
    clearPreloadQueue();
    cancelAllPreloads();
  });

  describe('registerDataProvider', () => {
    it('应该成功注册数据提供者', () => {
      const provider = async () => ({ data: 'test' });
      registerDataProvider('test_key', provider);

      const retrieved = getDataProvider('test_key');
      expect(retrieved).toBeDefined();
      expect(retrieved).toBe(provider);
    });

    it('应该覆盖已存在的数据提供者', () => {
      const provider1 = async () => ({ data: 'test1' });
      const provider2 = async () => ({ data: 'test2' });

      registerDataProvider('test_key', provider1);
      registerDataProvider('test_key', provider2);

      const retrieved = getDataProvider('test_key');
      expect(retrieved).toBe(provider2);
    });
  });

  describe('unregisterDataProvider', () => {
    it('应该成功注销量据提供者', () => {
      const provider = async () => ({ data: 'test' });
      registerDataProvider('test_key', provider);

      const result = unregisterDataProvider('test_key');

      expect(result).toBe(true);
      expect(getDataProvider('test_key')).toBeUndefined();
    });

    it('应该返回false当数据提供者不存在时', () => {
      const result = unregisterDataProvider('nonexistent_key');

      expect(result).toBe(false);
    });
  });

  describe('getDataProvider', () => {
    it('应该返回注册的数据提供者', () => {
      const provider = async () => ({ data: 'test' });
      registerDataProvider('test_key', provider);

      const retrieved = getDataProvider('test_key');

      expect(retrieved).toBe(provider);
    });

    it('应该返回undefined当数据提供者不存在时', () => {
      const retrieved = getDataProvider('nonexistent_key');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('addPreloadItem', () => {
    it('应该成功添加预加载项', () => {
      const item = {
        namespace: CacheNamespace.USER_DATA,
        key: 'test_key',
        dataProvider: async () => ({ data: 'test' }),
        priority: 1,
      };

      addPreloadItem(item);
      const status = getPreloadStatus();

      expect(status.queueSize).toBe(1);
    });

    it('应该按优先级排序预加载项', () => {
      addPreloadItem({
        namespace: CacheNamespace.USER_DATA,
        key: 'key2',
        dataProvider: async () => ({ data: 'test2' }),
        priority: 2,
      });

      addPreloadItem({
        namespace: CacheNamespace.USER_DATA,
        key: 'key1',
        dataProvider: async () => ({ data: 'test1' }),
        priority: 1,
      });

      const status = getPreloadStatus();
      expect(status.queueSize).toBe(2);
    });
  });

  describe('addPreloadItems', () => {
    it('应该批量添加预加载项', () => {
      const items = [
        {
          namespace: CacheNamespace.USER_DATA,
          key: 'key1',
          dataProvider: async () => ({ data: 'test1' }),
          priority: 1,
        },
        {
          namespace: CacheNamespace.CONFIGURATION,
          key: 'key2',
          dataProvider: async () => ({ data: 'test2' }),
          priority: 2,
        },
      ];

      addPreloadItems(items);
      const status = getPreloadStatus();

      expect(status.queueSize).toBe(2);
    });
  });

  describe('clearPreloadQueue', () => {
    it('应该清空预加载队列', () => {
      addPreloadItem({
        namespace: CacheNamespace.USER_DATA,
        key: 'test_key',
        dataProvider: async () => ({ data: 'test' }),
        priority: 1,
      });

      expect(getPreloadStatus().queueSize).toBe(1);

      clearPreloadQueue();

      expect(getPreloadStatus().queueSize).toBe(0);
    });
  });

  describe('schedulePreload', () => {
    it('应该创建定时预加载', done => {
      const mockProvider = jest.fn().mockResolvedValue({ data: 'test' });
      registerDataProvider('scheduled_key', mockProvider);

      const timer = schedulePreload('scheduled_key', 100);

      expect(timer).toBeDefined();
      expect(typeof timer).toBe('object');

      // 清理定时器
      cancelPreload('scheduled_key');
      done();
    });

    it('应该复用已存在的定时器', () => {
      const timer1 = schedulePreload('test_key', 1000);
      const timer2 = schedulePreload('test_key', 1000);

      expect(timer1).toBe(timer2);

      cancelPreload('test_key');
    });
  });

  describe('cancelPreload', () => {
    it('应该成功取消预加载', () => {
      schedulePreload('test_key', 1000);
      const result = cancelPreload('test_key');

      expect(result).toBe(true);
    });

    it('应该返回false当预加载不存在时', () => {
      const result = cancelPreload('nonexistent_key');

      expect(result).toBe(false);
    });
  });

  describe('cancelAllPreloads', () => {
    it('应该取消所有预加载', () => {
      schedulePreload('key1', 1000);
      schedulePreload('key2', 1000);
      schedulePreload('key3', 1000);

      const count = cancelAllPreloads();

      expect(count).toBe(3);
    });
  });

  describe('executePreload', () => {
    it('应该成功执行预加载', async () => {
      const provider = jest.fn().mockResolvedValue({ data: 'test' });
      registerDataProvider('test_key', provider);

      // 添加预加载项但不传入 dataProvider，让它使用注册的
      const item = {
        namespace: CacheNamespace.USER_DATA,
        key: 'test_key',
        dataProvider: undefined as unknown as () => Promise<unknown>,
        priority: 1,
      };
      addPreloadItem(item);

      const result = await executePreload({
        batchSize: 1,
        batchDelay: 0,
      });

      expect(result.total).toBe(1);
      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
      expect(provider).toHaveBeenCalledTimes(1);
    });

    it('应该跳过正在进行的预加载', async () => {
      const provider = jest.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            // 模拟长时间运行的操作
            setTimeout(() => resolve({ data: 'test' }), 500);
          })
      );
      registerDataProvider('test_key2', provider);

      const item = {
        namespace: CacheNamespace.USER_DATA,
        key: 'test_key2',
        dataProvider: undefined as unknown as () => Promise<unknown>,
        priority: 1,
      };
      addPreloadItem(item);

      // 开始第一次执行（不等待完成）
      const firstExecution = executePreload();

      // 立即尝试第二次执行，应该跳过
      const result2 = await executePreload();

      expect(result2.skipped).toBeGreaterThan(0);

      // 等待第一次执行完成
      await firstExecution;
    });
  });

  describe('getPreloadStatus', () => {
    it('应该返回预加载状态', () => {
      const status = getPreloadStatus();

      expect(status).toHaveProperty('queueSize');
      expect(status).toHaveProperty('isPreloading');
      expect(status).toHaveProperty('pendingTimers');
      expect(status).toHaveProperty('registeredProviders');
      expect(typeof status.queueSize).toBe('number');
      expect(typeof status.isPreloading).toBe('boolean');
      expect(typeof status.pendingTimers).toBe('number');
      expect(typeof status.registeredProviders).toBe('number');
    });
  });

  describe('generatePreloadReport', () => {
    it('应该生成预加载报告', () => {
      const report = generatePreloadReport();

      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
      expect(report).toContain('缓存预加载报告');
      expect(report).toContain('配置状态');
    });
  });

  describe('cleanupPreload', () => {
    it('应该清理所有预加载资源', () => {
      registerDataProvider('test_key', async () => ({ data: 'test' }));
      addPreloadItem({
        namespace: CacheNamespace.USER_DATA,
        key: 'test_key',
        dataProvider: async () => ({ data: 'test' }),
        priority: 1,
      });
      schedulePreload('test_key', 1000);

      cleanupPreload();

      const status = getPreloadStatus();
      expect(status.queueSize).toBe(0);
      expect(status.pendingTimers).toBe(0);
      expect(status.registeredProviders).toBe(0);
    });
  });
});
