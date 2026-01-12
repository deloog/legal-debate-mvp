import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { cacheManager, cache } from '@/lib/cache/manager';
import { CacheNamespace } from '@/lib/cache/types';
import { redis } from '@/lib/cache/redis';

describe('缓存系统', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('基本缓存操作', () => {
    it('应该设置并获取缓存值', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"test-value"');
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      const setResult = await cacheManager.set('test-key', 'test-value');
      const getResult = await cacheManager.get('test-key');

      expect(setResult).toBe(true);
      expect(getResult).toBe('test-value');
    });

    it('应该删除缓存', async () => {
      jest.spyOn(redis, 'del').mockResolvedValue(1);

      const result = await cacheManager.delete('test-key');
      expect(result).toBe(true);
    });

    it('应该检查缓存是否存在', async () => {
      jest.spyOn(redis, 'exists').mockResolvedValue(1);

      const result = await cacheManager.exists('test-key');
      expect(result).toBe(true);
    });

    it('应该处理缓存未命中', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);

      const result = await cacheManager.get('non-existent-key');
      expect(result).toBe(null);
    });
  });

  describe('TTL操作', () => {
    it('应该设置TTL', async () => {
      jest.spyOn(redis, 'expire').mockResolvedValue(1);

      const result = await cacheManager.expire('test-key', 300);
      expect(result).toBe(true);
    });

    it('应该获取TTL', async () => {
      jest.spyOn(redis, 'ttl').mockResolvedValue(300);

      const result = await cacheManager.ttl('test-key');
      expect(result).toBe(300);
    });
  });

  describe('批量操作', () => {
    it('应该批量获取缓存', async () => {
      jest
        .spyOn(redis, 'mget')
        .mockResolvedValue(['"value1"', '"value2"', null]);

      const result = await cacheManager.mget(['key1', 'key2', 'key3']);

      expect(result.size).toBe(3);
      expect(result.get('key1')).toBe('value1');
      expect(result.get('key3')).toBe(null);
    });

    it('应该批量设置缓存', async () => {
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      const result = await cacheManager.mset([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ]);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
    });

    it('应该批量删除缓存', async () => {
      jest.spyOn(redis, 'del').mockResolvedValue(3);

      const result = await cacheManager.mdelete(['key1', 'key2', 'key3']);
      expect(result).toBe(3);
    });
  });

  describe('命名空间操作', () => {
    it('应该清空命名空间', async () => {
      jest.spyOn(redis, 'keys').mockResolvedValue(['ns:key1', 'ns:key2']);
      jest.spyOn(redis, 'del').mockResolvedValue(2);

      const result = await cacheManager.clearNamespace(
        CacheNamespace.USER_DATA
      );
      expect(result).toBe(2);
    });

    it('应该处理空命名空间', async () => {
      jest.spyOn(redis, 'keys').mockResolvedValue([]);

      const result = await cacheManager.clearNamespace(
        CacheNamespace.USER_DATA
      );
      expect(result).toBe(0);
    });

    it('应该使用命名空间生成键', async () => {
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      await cacheManager.set('test-key', 'value', {
        namespace: CacheNamespace.USER_DATA,
      });

      expect(redis.setex).toHaveBeenCalled();
    });
  });

  describe('统计信息', () => {
    it('应该获取统计信息', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"value"');
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      await cacheManager.set('test-key', 'value');
      await cacheManager.get('test-key');

      const stats = cacheManager.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBeGreaterThan(0);
    });

    it('应该重置统计信息', async () => {
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      await cacheManager.set('test-key', 'value');
      cacheManager.resetStats();

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('应该计算命中率', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"value"');

      await cacheManager.get('test-key');
      await cacheManager.get('test-key');

      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(100);
    });
  });

  describe('错误处理', () => {
    it('应该处理Redis连接错误', async () => {
      jest.spyOn(redis, 'get').mockRejectedValue(new Error('Redis error'));

      const result = await cacheManager.get('test-key');
      expect(result).toBe(null);
    });

    it('应该处理键长度超限', async () => {
      const longKey = 'a'.repeat(3000);
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      await expect(cacheManager.set(longKey, 'value')).rejects.toThrow(
        '缓存键长度超过限制'
      );
    });

    it('应该处理值大小超限', async () => {
      const largeValue = 'a'.repeat(2 * 1024 * 1024);
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      await expect(cacheManager.set('test-key', largeValue)).rejects.toThrow(
        '缓存值大小超过限制'
      );
    });
  });

  describe('getOrSet操作', () => {
    it('应该从缓存获取值', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"cached-value"');

      const valueProvider = jest.fn().mockResolvedValue('new-value' as never);
      const result = await cacheManager.getOrSet(
        'test-key',
        valueProvider as unknown as () => Promise<string>
      );

      expect(result).toBe('cached-value');
      expect(valueProvider).not.toHaveBeenCalled();
    });

    it('应该设置新值到缓存', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      const valueProvider = jest.fn().mockResolvedValue('new-value' as never);
      const result = await cacheManager.getOrSet(
        'test-key',
        valueProvider as unknown as () => Promise<string>
      );

      expect(result).toBe('new-value');
      expect(valueProvider).toHaveBeenCalled();
    });

    it('应该处理getOrSet中的错误', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);

      const valueProvider = jest
        .fn()
        .mockRejectedValue(new Error('Error') as never);
      const result = await cacheManager.getOrSet(
        'test-key',
        valueProvider as unknown as () => Promise<string>
      );

      expect(result).toBe(null);
    });
  });

  describe('事件监听器', () => {
    it('应该添加和触发事件监听器', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"value"');

      const eventListener = jest.fn();
      cacheManager.addEventListener(eventListener);

      await cacheManager.get('test-key');

      expect(eventListener).toHaveBeenCalled();
    });

    it('应该移除事件监听器', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"value"');

      const eventListener = jest.fn();
      cacheManager.addEventListener(eventListener);
      cacheManager.removeEventListener(eventListener);

      await cacheManager.get('test-key');

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('序列化', () => {
    it('应该支持禁用序列化', async () => {
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');
      jest.spyOn(redis, 'get').mockResolvedValue('raw-string');

      const setResult = await cacheManager.set('test-key', 'raw-string', {
        serialize: false,
      });
      const getResult = await cacheManager.get('test-key', {
        serialize: false,
      });

      expect(setResult).toBe(true);
      expect(getResult).toBe('raw-string');
    });

    it('应该处理序列化错误', async () => {
      const circularObj: Record<string, unknown> = {};
      circularObj.self = circularObj;

      await expect(cacheManager.set('test-key', circularObj)).rejects.toThrow(
        '序列化失败'
      );
    });

    it('应该处理反序列化错误', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('invalid-json');

      const result = await cacheManager.get('test-key');
      expect(result).toBe(null);
    });
  });

  describe('配置', () => {
    it('应该获取配置', () => {
      const config = cacheManager.getConfig();
      expect(config).toBeDefined();
      expect(config.keyPrefix).toBeDefined();
      expect(config.defaultTtl).toBeDefined();
    });
  });

  describe('便捷API', () => {
    it('应该使用便捷API', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('"value"');
      jest.spyOn(redis, 'setex').mockResolvedValue('OK');

      await cache.set('test-key', 'value');
      const result = await cache.get('test-key');

      expect(result).toBe('value');
    });

    it('应该获取统计信息', () => {
      const stats = cache.getStats();
      expect(stats).toBeDefined();
    });

    it('应该重置统计信息', () => {
      cache.resetStats();
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
    });
  });
});
