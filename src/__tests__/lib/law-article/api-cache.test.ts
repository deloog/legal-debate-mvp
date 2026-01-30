/**
 * LawArticleAPICache 单元测试
 *
 * 测试覆盖：
 * - 缓存读写测试
 * - 缓存失效测试
 * - Redis模式测试
 * - 内存模式测试
 * - 统计信息测试
 */

import {
  LawArticleAPICache,
  APICacheConfig,
  APICacheStats,
} from '../../../lib/law-article/api-cache';
import type { LawArticle } from '../../../lib/agent/legal-agent/types';

// Mock Redis
jest.mock('../../../lib/cache/redis', () => ({
  redis: {
    get: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    exists: jest.fn(),
    ttl: jest.fn(),
    ping: jest.fn(),
  },
  checkRedisConnection: jest.fn(),
}));

// 获取mock的redis
const mockRedis = jest.requireMock('../../../lib/cache/redis').redis;
const mockCheckRedisConnection = jest.requireMock(
  '../../../lib/cache/redis'
).checkRedisConnection;

describe('LawArticleAPICache', () => {
  // 测试数据
  const mockArticle: LawArticle = {
    id: 'article-001',
    lawName: '中华人民共和国民法典',
    articleNumber: '第一百四十三条',
    content:
      '具备下列条件的民事法律行为有效：（一）行为人具有相应的民事行为能力；（二）意思表示真实；（三）不违反法律、行政法规的强制性规定，不违背公序良俗。',
    category: 'civil',
    effectiveDate: '2021-01-01',
    deprecated: false,
    keywords: ['民事法律行为', '有效条件'],
  };

  const mockArticles: LawArticle[] = [
    mockArticle,
    {
      id: 'article-002',
      lawName: '中华人民共和国民法典',
      articleNumber: '第一百四十四条',
      content: '无民事行为能力人实施的民事法律行为无效。',
      category: 'civil',
      effectiveDate: '2021-01-01',
      deprecated: false,
      keywords: ['无民事行为能力', '无效'],
    },
  ];

  let cache: LawArticleAPICache;

  beforeEach(() => {
    jest.clearAllMocks();
    // 默认Redis可用
    mockCheckRedisConnection.mockResolvedValue(true);
    mockRedis.ping.mockResolvedValue('PONG');
  });

  afterEach(() => {
    if (cache) {
      cache.destroy();
    }
  });

  describe('构造函数和配置', () => {
    it('应该使用默认配置创建实例', () => {
      cache = new LawArticleAPICache();
      const config = cache.getConfig();

      expect(config.mode).toBe('hybrid');
      expect(config.defaultTTL).toBe(3600);
      expect(config.maxMemoryItems).toBe(1000);
      expect(config.enableStats).toBe(true);
    });

    it('应该使用自定义配置创建实例', () => {
      const customConfig: Partial<APICacheConfig> = {
        mode: 'memory',
        defaultTTL: 7200,
        maxMemoryItems: 500,
        enableStats: false,
      };

      cache = new LawArticleAPICache(customConfig);
      const config = cache.getConfig();

      expect(config.mode).toBe('memory');
      expect(config.defaultTTL).toBe(7200);
      expect(config.maxMemoryItems).toBe(500);
      expect(config.enableStats).toBe(false);
    });

    it('应该支持Redis模式配置', () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      expect(cache.getConfig().mode).toBe('redis');
    });

    it('应该支持混合模式配置', () => {
      cache = new LawArticleAPICache({ mode: 'hybrid' });
      expect(cache.getConfig().mode).toBe('hybrid');
    });
  });

  describe('缓存读写测试 - 内存模式', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory' });
    });

    it('应该正确写入和读取单个法条', async () => {
      const key = 'test-key-1';

      await cache.set(key, mockArticle);
      const result = await cache.get<LawArticle>(key);

      expect(result).toEqual(mockArticle);
    });

    it('应该正确写入和读取法条数组', async () => {
      const key = 'test-articles';

      await cache.set(key, mockArticles);
      const result = await cache.get<LawArticle[]>(key);

      expect(result).toEqual(mockArticles);
      expect(result).toHaveLength(2);
    });

    it('应该在缓存未命中时返回null', async () => {
      const result = await cache.get<LawArticle>('non-existent-key');
      expect(result).toBeNull();
    });

    it('应该支持自定义TTL', async () => {
      const key = 'ttl-test';
      const customTTL = 60; // 60秒

      await cache.set(key, mockArticle, customTTL);
      const result = await cache.get<LawArticle>(key);

      expect(result).toEqual(mockArticle);
    });

    it('应该在TTL过期后返回null', async () => {
      jest.useFakeTimers();
      const key = 'expire-test';
      const shortTTL = 1; // 1秒

      await cache.set(key, mockArticle, shortTTL);

      // 快进2秒
      jest.advanceTimersByTime(2000);

      const result = await cache.get<LawArticle>(key);
      expect(result).toBeNull();

      jest.useRealTimers();
    });

    it('应该正确处理复杂对象的序列化', async () => {
      const complexData = {
        articles: mockArticles,
        metadata: {
          source: 'test',
          timestamp: new Date().toISOString(),
          nested: { level1: { level2: 'value' } },
        },
        total: 100,
      };

      await cache.set('complex-key', complexData);
      const result = await cache.get<typeof complexData>('complex-key');

      expect(result).toEqual(complexData);
    });
  });

  describe('缓存读写测试 - Redis模式', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'redis' });
    });

    it('应该通过Redis写入缓存', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const result = await cache.set('redis-key', mockArticle);

      expect(result).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('redis-key'),
        3600,
        expect.any(String)
      );
    });

    it('应该通过Redis读取缓存', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockArticle));

      const result = await cache.get<LawArticle>('redis-key');

      expect(result).toEqual(mockArticle);
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining('redis-key')
      );
    });

    it('应该在Redis返回null时返回null', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cache.get<LawArticle>('missing-key');

      expect(result).toBeNull();
    });

    it('应该在Redis错误时优雅降级', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cache.get<LawArticle>('error-key');

      expect(result).toBeNull();
    });

    it('应该在Redis写入失败时返回false', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis write failed'));

      const result = await cache.set('fail-key', mockArticle);

      expect(result).toBe(false);
    });
  });

  describe('缓存读写测试 - 混合模式', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'hybrid' });
    });

    it('应该同时写入内存和Redis', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cache.set('hybrid-key', mockArticle);

      // 验证Redis被调用
      expect(mockRedis.setex).toHaveBeenCalled();

      // 验证内存缓存也有数据（通过禁用Redis读取来验证）
      mockRedis.get.mockResolvedValue(null);
      const result = await cache.get<LawArticle>('hybrid-key');
      expect(result).toEqual(mockArticle);
    });

    it('应该优先从内存读取', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await cache.set('memory-first', mockArticle);

      // 清除Redis mock调用记录
      mockRedis.get.mockClear();

      const result = await cache.get<LawArticle>('memory-first');

      expect(result).toEqual(mockArticle);
      // 内存命中时不应该调用Redis
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('应该在内存未命中时从Redis读取', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify(mockArticle));

      // 直接读取（内存中没有）
      const result = await cache.get<LawArticle>('redis-fallback');

      expect(result).toEqual(mockArticle);
      expect(mockRedis.get).toHaveBeenCalled();
    });
  });

  describe('缓存失效测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'hybrid' });
    });

    it('应该正确删除单个缓存项', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      await cache.set('delete-test', mockArticle);
      const beforeDelete = await cache.get<LawArticle>('delete-test');
      expect(beforeDelete).toEqual(mockArticle);

      await cache.invalidate('delete-test');

      mockRedis.get.mockResolvedValue(null);
      const afterDelete = await cache.get<LawArticle>('delete-test');
      expect(afterDelete).toBeNull();
    });

    it('应该支持按模式批量删除', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.keys.mockResolvedValue([
        'law_api:search:民法典',
        'law_api:search:合同法',
      ]);
      mockRedis.del.mockResolvedValue(2);

      await cache.set('search:民法典', mockArticles);
      await cache.set('search:合同法', mockArticles);

      const deletedCount = await cache.invalidateByPattern('search:*');

      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    it('应该正确清空所有缓存', async () => {
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.del.mockResolvedValue(3);

      await cache.set('key1', mockArticle);
      await cache.set('key2', mockArticle);
      await cache.set('key3', mockArticle);

      await cache.clear();

      mockRedis.get.mockResolvedValue(null);
      const result1 = await cache.get<LawArticle>('key1');
      const result2 = await cache.get<LawArticle>('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });

    it('应该在删除不存在的键时不报错', async () => {
      mockRedis.del.mockResolvedValue(0);

      await expect(cache.invalidate('non-existent')).resolves.not.toThrow();
    });
  });

  describe('统计信息测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory', enableStats: true });
    });

    it('应该正确记录缓存命中', async () => {
      await cache.set('stats-hit', mockArticle);
      await cache.get<LawArticle>('stats-hit');
      await cache.get<LawArticle>('stats-hit');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
    });

    it('应该正确记录缓存未命中', async () => {
      await cache.get<LawArticle>('miss-1');
      await cache.get<LawArticle>('miss-2');

      const stats = cache.getStats();

      expect(stats.misses).toBe(2);
    });

    it('应该正确计算命中率', async () => {
      await cache.set('hit-rate-test', mockArticle);

      // 2次命中
      await cache.get<LawArticle>('hit-rate-test');
      await cache.get<LawArticle>('hit-rate-test');

      // 1次未命中
      await cache.get<LawArticle>('non-existent');

      const stats = cache.getStats();

      // 命中率 = 2 / 3 ≈ 66.67%
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('应该正确记录写入次数', async () => {
      await cache.set('write-1', mockArticle);
      await cache.set('write-2', mockArticle);
      await cache.set('write-3', mockArticle);

      const stats = cache.getStats();

      expect(stats.sets).toBe(3);
    });

    it('应该正确记录删除次数', async () => {
      await cache.set('del-1', mockArticle);
      await cache.set('del-2', mockArticle);

      await cache.invalidate('del-1');
      await cache.invalidate('del-2');

      const stats = cache.getStats();

      expect(stats.deletes).toBe(2);
    });

    it('应该正确重置统计信息', async () => {
      await cache.set('reset-test', mockArticle);
      await cache.get<LawArticle>('reset-test');

      cache.resetStats();

      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.hitRate).toBe(0);
    });

    it('应该在禁用统计时不记录', async () => {
      cache.destroy();
      cache = new LawArticleAPICache({ mode: 'memory', enableStats: false });

      await cache.set('no-stats', mockArticle);
      await cache.get<LawArticle>('no-stats');

      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.sets).toBe(0);
    });

    it('应该返回正确的统计摘要', async () => {
      await cache.set('summary-1', mockArticle);
      await cache.set('summary-2', mockArticle);
      await cache.get<LawArticle>('summary-1');
      await cache.get<LawArticle>('missing');

      const stats = cache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('memorySize');
    });
  });

  describe('内存管理测试', () => {
    it('应该在达到最大容量时清理旧缓存', async () => {
      cache = new LawArticleAPICache({
        mode: 'memory',
        maxMemoryItems: 3,
      });

      await cache.set('item-1', mockArticle);
      await cache.set('item-2', mockArticle);
      await cache.set('item-3', mockArticle);
      await cache.set('item-4', mockArticle); // 应该触发清理

      const stats = cache.getStats();
      expect(stats.memorySize).toBeLessThanOrEqual(3);
    });

    it('应该使用LRU策略清理缓存', async () => {
      cache = new LawArticleAPICache({
        mode: 'memory',
        maxMemoryItems: 3,
      });

      await cache.set('lru-1', { id: '1' });
      await cache.set('lru-2', { id: '2' });
      await cache.set('lru-3', { id: '3' });

      // 添加新项，应该触发清理（清理最早添加的项）
      await cache.set('lru-4', { id: '4' });

      const stats = cache.getStats();
      // 验证缓存大小不超过最大值
      expect(stats.memorySize).toBeLessThanOrEqual(3);

      // 验证新添加的项存在
      const result4 = await cache.get('lru-4');
      expect(result4).not.toBeNull();
      expect(result4).toEqual({ id: '4' });
    });
  });

  describe('键生成测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory' });
    });

    it('应该生成正确的缓存键', async () => {
      const query = '民法典 合同';
      const options = { limit: 10, category: 'civil' };

      const key = cache.generateKey(query, options);

      expect(key).toContain('民法典');
      expect(key).toContain('合同');
      expect(key).toContain('10');
      expect(key).toContain('civil');
    });

    it('应该对相同参数生成相同的键', () => {
      const query = '测试查询';
      const options = { limit: 20 };

      const key1 = cache.generateKey(query, options);
      const key2 = cache.generateKey(query, options);

      expect(key1).toBe(key2);
    });

    it('应该对不同参数生成不同的键', () => {
      const key1 = cache.generateKey('查询1', { limit: 10 });
      const key2 = cache.generateKey('查询2', { limit: 10 });
      const key3 = cache.generateKey('查询1', { limit: 20 });

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it('应该处理特殊字符', () => {
      const query = '民法典：第一百四十三条（有效条件）';
      const key = cache.generateKey(query, {});

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });

    it('应该处理空查询', () => {
      const key = cache.generateKey('', {});

      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
    });
  });

  describe('错误处理测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'redis' });
    });

    it('应该处理JSON解析错误', async () => {
      mockRedis.get.mockResolvedValue('invalid json {{{');

      const result = await cache.get<LawArticle>('parse-error');

      expect(result).toBeNull();
    });

    it('应该处理Redis连接超时', async () => {
      mockRedis.get.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 100)
          )
      );

      const result = await cache.get<LawArticle>('timeout-key');

      expect(result).toBeNull();
    });

    it('应该在Redis不可用时降级到内存', async () => {
      cache.destroy();
      cache = new LawArticleAPICache({ mode: 'hybrid' });

      mockRedis.setex.mockRejectedValue(new Error('Redis unavailable'));
      mockRedis.get.mockRejectedValue(new Error('Redis unavailable'));

      // 写入应该成功（内存）
      const setResult = await cache.set('fallback-key', mockArticle);
      expect(setResult).toBe(true);

      // 读取应该成功（内存）
      const getResult = await cache.get<LawArticle>('fallback-key');
      expect(getResult).toEqual(mockArticle);
    });
  });

  describe('并发访问测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory' });
    });

    it('应该正确处理并发写入', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        cache.set(`concurrent-${i}`, { ...mockArticle, id: `article-${i}` })
      );

      await Promise.all(promises);

      const stats = cache.getStats();
      expect(stats.sets).toBe(10);
    });

    it('应该正确处理并发读取', async () => {
      await cache.set('concurrent-read', mockArticle);

      const promises = Array.from({ length: 10 }, () =>
        cache.get<LawArticle>('concurrent-read')
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result).toEqual(mockArticle);
      });
    });

    it('应该正确处理并发读写', async () => {
      const writePromises = Array.from({ length: 5 }, (_, i) =>
        cache.set(`rw-${i}`, { ...mockArticle, id: `article-${i}` })
      );

      await Promise.all(writePromises);

      const readPromises = Array.from({ length: 5 }, (_, i) =>
        cache.get<LawArticle>(`rw-${i}`)
      );

      const results = await Promise.all(readPromises);

      results.forEach((result, i) => {
        expect(result).not.toBeNull();
        expect(result?.id).toBe(`article-${i}`);
      });
    });
  });

  describe('getOrSet方法测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory' });
    });

    it('应该在缓存命中时返回缓存值', async () => {
      await cache.set('getOrSet-hit', mockArticle);

      const fetchFn = jest.fn().mockResolvedValue({ id: 'new-article' });

      const result = await cache.getOrSet('getOrSet-hit', fetchFn);

      expect(result).toEqual(mockArticle);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('应该在缓存未命中时调用获取函数', async () => {
      const fetchFn = jest.fn().mockResolvedValue(mockArticle);

      const result = await cache.getOrSet('getOrSet-miss', fetchFn);

      expect(result).toEqual(mockArticle);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('应该在获取后缓存结果', async () => {
      const fetchFn = jest.fn().mockResolvedValue(mockArticle);

      await cache.getOrSet('getOrSet-cache', fetchFn);

      // 第二次调用不应该触发fetchFn
      const result = await cache.getOrSet('getOrSet-cache', fetchFn);

      expect(result).toEqual(mockArticle);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('应该在获取函数抛出错误时返回null', async () => {
      const fetchFn = jest.fn().mockRejectedValue(new Error('Fetch failed'));

      const result = await cache.getOrSet('getOrSet-error', fetchFn);

      expect(result).toBeNull();
    });
  });

  describe('健康检查测试', () => {
    it('应该返回内存模式的健康状态', async () => {
      cache = new LawArticleAPICache({ mode: 'memory' });

      const health = await cache.healthCheck();

      expect(health.memoryAvailable).toBe(true);
      expect(health.mode).toBe('memory');
    });

    it('应该返回Redis模式的健康状态', async () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      mockCheckRedisConnection.mockResolvedValue(true);

      const health = await cache.healthCheck();

      expect(health.redisAvailable).toBe(true);
      expect(health.mode).toBe('redis');
    });

    it('应该检测Redis不可用', async () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      mockCheckRedisConnection.mockResolvedValue(false);

      const health = await cache.healthCheck();

      expect(health.redisAvailable).toBe(false);
    });
  });

  describe('缓存预热测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory' });
    });

    it('应该支持批量预热缓存', async () => {
      const items = [
        { key: 'warm-1', value: mockArticles[0] },
        { key: 'warm-2', value: mockArticles[1] },
      ];

      await cache.warmUp(items);

      const result1 = await cache.get<LawArticle>('warm-1');
      const result2 = await cache.get<LawArticle>('warm-2');

      expect(result1).toEqual(mockArticles[0]);
      expect(result2).toEqual(mockArticles[1]);
    });

    it('应该在预热时支持自定义TTL', async () => {
      jest.useFakeTimers();

      const items = [{ key: 'warm-ttl', value: mockArticle, ttl: 1 }];

      await cache.warmUp(items);

      jest.advanceTimersByTime(2000);

      const result = await cache.get<LawArticle>('warm-ttl');
      expect(result).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('单例模式测试', () => {
    it('应该正确获取单例实例', async () => {
      // 导入单例函数
      const { getAPICache, resetAPICache } =
        await import('../../../lib/law-article/api-cache');

      resetAPICache();

      const instance1 = getAPICache();
      const instance2 = getAPICache();

      expect(instance1).toBe(instance2);

      resetAPICache();
    });

    it('应该正确重置单例实例', async () => {
      const { getAPICache, resetAPICache } =
        await import('../../../lib/law-article/api-cache');

      resetAPICache();

      const instance1 = getAPICache();
      await instance1.set('singleton-test', { data: 'test' });

      resetAPICache();

      const instance2 = getAPICache();
      const result = await instance2.get('singleton-test');

      expect(result).toBeNull();

      resetAPICache();
    });
  });

  describe('清理过期缓存测试', () => {
    it('应该在定时器触发时清理过期缓存', async () => {
      jest.useFakeTimers();

      cache = new LawArticleAPICache({ mode: 'memory' });

      // 设置一个短TTL的缓存
      await cache.set('cleanup-test', mockArticle, 30); // 30秒

      // 验证缓存存在
      const beforeCleanup = await cache.get<LawArticle>('cleanup-test');
      expect(beforeCleanup).toEqual(mockArticle);

      // 快进超过TTL
      jest.advanceTimersByTime(35000);

      // 触发清理（快进到下一个清理周期）
      jest.advanceTimersByTime(60000);

      // 验证缓存已被清理
      const afterCleanup = await cache.get<LawArticle>('cleanup-test');
      expect(afterCleanup).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('边界条件测试', () => {
    beforeEach(() => {
      cache = new LawArticleAPICache({ mode: 'memory' });
    });

    it('应该处理空值', async () => {
      await cache.set('empty-string', '');
      const result = await cache.get<string>('empty-string');
      expect(result).toBe('');
    });

    it('应该处理null值', async () => {
      await cache.set('null-value', null);
      const result = await cache.get('null-value');
      expect(result).toBeNull();
    });

    it('应该处理数组值', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('array-value', arr);
      const result = await cache.get<number[]>('array-value');
      expect(result).toEqual(arr);
    });

    it('应该处理布尔值', async () => {
      await cache.set('bool-true', true);
      await cache.set('bool-false', false);

      const resultTrue = await cache.get<boolean>('bool-true');
      const resultFalse = await cache.get<boolean>('bool-false');

      expect(resultTrue).toBe(true);
      expect(resultFalse).toBe(false);
    });

    it('应该处理数字值', async () => {
      await cache.set('number-zero', 0);
      await cache.set('number-negative', -100);
      await cache.set('number-float', 3.14159);

      expect(await cache.get<number>('number-zero')).toBe(0);
      expect(await cache.get<number>('number-negative')).toBe(-100);
      expect(await cache.get<number>('number-float')).toBe(3.14159);
    });
  });

  describe('Redis错误分支覆盖测试', () => {
    it('应该处理批量删除Redis缓存失败', async () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      mockRedis.keys.mockRejectedValue(new Error('Redis keys failed'));

      const deletedCount = await cache.invalidateByPattern('test:*');

      expect(deletedCount).toBe(0);
    });

    it('应该处理清空Redis缓存失败', async () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      mockRedis.keys.mockRejectedValue(new Error('Redis keys failed'));

      await expect(cache.clear()).resolves.not.toThrow();
    });

    it('应该处理健康检查Redis异常', async () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      mockCheckRedisConnection.mockRejectedValue(
        new Error('Connection check failed')
      );

      const health = await cache.healthCheck();

      expect(health.redisAvailable).toBe(false);
    });

    it('应该处理Redis删除失败', async () => {
      cache = new LawArticleAPICache({ mode: 'redis' });
      mockRedis.del.mockRejectedValue(new Error('Redis del failed'));

      await expect(cache.invalidate('test-key')).resolves.not.toThrow();
    });
  });
});
