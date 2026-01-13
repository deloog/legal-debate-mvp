// 测试文件中使用 any 类型是为了 Jest mock 的类型断言需求
import { CacheManager } from '@/lib/cache/manager';
import { CacheMonitor, cacheMonitoringUtils } from '@/lib/cache/monitor';
import { checkRedisConnection, getRedisInfo, redis } from '@/lib/cache/redis';
import { CacheNamespace } from '@/lib/cache/types';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

describe('CacheMonitor', () => {
  let cacheManager: CacheManager;
  let monitor: CacheMonitor;

  beforeEach(() => {
    cacheManager = new CacheManager();
    monitor = new CacheMonitor(cacheManager);
    jest.clearAllMocks();
  });

  afterEach(() => {
    monitor.stop();
    jest.clearAllMocks();
  });

  describe('启动和停止', () => {
    it('应该成功启动监控', async () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      monitor.start({
        healthCheckInterval: 1000,
        metricsInterval: 2000,
      });

      const status = await monitor.getHealthStatus();
      expect(status).toBeDefined();
    });

    it('应该成功停止监控', () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      monitor.start({
        healthCheckInterval: 1000,
        metricsInterval: 2000,
      });

      monitor.stop();

      const report = monitor.getPerformanceReport();
      expect(report).toBeDefined();
    });

    it('应该处理重复启动', () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      monitor.start({ healthCheckInterval: 1000 });

      // 再次启动应该只是警告，不报错
      monitor.start({ healthCheckInterval: 1000 });

      const report = monitor.getPerformanceReport();
      expect(report).toBeDefined();
    });

    it('应该处理重复停止', () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      monitor.start({ healthCheckInterval: 1000 });
      monitor.stop();

      // 再次停止应该只是警告
      monitor.stop();

      const report = monitor.getPerformanceReport();
      expect(report).toBeDefined();
    });
  });

  describe('健康检查', () => {
    it('应该获取健康状态', async () => {
      jest
        .spyOn(checkRedisConnection as any, 'checkRedisConnection')
        .mockResolvedValue(true as never);
      jest.spyOn(getRedisInfo as any, 'getRedisInfo').mockResolvedValue({
        memory: { used_memory: '1024000' },
        stats: { keyspace_hits: '100', keyspace_misses: '10' },
      } as never);
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      const health = await monitor.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.connected).toBe(true);
      expect(health.responseTime).toBeGreaterThanOrEqual(0);
      expect(health.lastCheck).toBeInstanceOf(Date);
    });

    it('应该处理Redis连接失败', async () => {
      jest
        .spyOn(checkRedisConnection as any, 'checkRedisConnection')
        .mockResolvedValue(false as never);
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      const health = await monitor.getHealthStatus();

      expect(health.connected).toBe(false);
    });
  });

  describe('性能报告', () => {
    it('应该生成性能报告', () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      const report = monitor.getPerformanceReport();

      expect(report).toBeDefined();
      expect(report.avgResponseTime).toBe(0);
      expect(report.maxResponseTime).toBe(0);
      expect(report.uptime).toBe(0);
      expect(report.alertCount).toBe(0);
      expect(Array.isArray(report.hitRateTrend)).toBe(true);
    });

    it('应该计算平均响应时间', async () => {
      jest
        .spyOn(checkRedisConnection as any, 'checkRedisConnection')
        .mockResolvedValue(true as never);
      jest.spyOn(getRedisInfo as any, 'getRedisInfo').mockResolvedValue({
        memory: { used_memory: '1024000' },
        stats: { keyspace_hits: '100', keyspace_misses: '10' },
      } as never);
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      // 执行多次健康检查
      await monitor.getHealthStatus();
      await monitor.getHealthStatus();

      const report = monitor.getPerformanceReport();

      expect(report.avgResponseTime).toBeGreaterThan(0);
    });
  });

  describe('详细状态', () => {
    it('应该获取详细状态', async () => {
      jest
        .spyOn(checkRedisConnection as any, 'checkRedisConnection')
        .mockResolvedValue(true as never);
      jest.spyOn(getRedisInfo as any, 'getRedisInfo').mockResolvedValue({
        memory: { used_memory: '1024000' },
        stats: { keyspace_hits: '100', keyspace_misses: '10' },
      } as never);
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      const status = await monitor.getDetailedStatus();

      expect(status).toBeDefined();
      expect(status.health).toBeDefined();
      expect(status.stats).toBeDefined();
      expect(status.redisInfo).toBeDefined();
      expect(status.isMonitoring).toBeDefined();
    });
  });

  describe('事件监听器', () => {
    it('应该添加和移除事件监听器', async () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      const listener = jest.fn();
      monitor.addEventListener(listener);

      // 触发事件
      await cacheManager.get('test-key');

      expect(listener).toHaveBeenCalled();

      // 移除监听器
      monitor.removeEventListener(listener);
    });
  });

  describe('重置和清理', () => {
    it('应该重置监控数据', () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      monitor.reset();

      const healthHistory = monitor.getHealthHistory();
      const report = monitor.getPerformanceReport();

      expect(healthHistory).toHaveLength(0);
      expect(report.avgResponseTime).toBe(0);
    });

    it('应该清理资源', () => {
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      monitor.cleanup();

      const healthHistory = monitor.getHealthHistory();
      expect(healthHistory).toHaveLength(0);
    });
  });

  describe('监控工具函数', () => {
    it('应该生成监控报告', async () => {
      jest
        .spyOn(checkRedisConnection as any, 'checkRedisConnection')
        .mockResolvedValue(true as never);
      jest.spyOn(getRedisInfo as any, 'getRedisInfo').mockResolvedValue({
        memory: { used_memory: '1024000' },
        stats: { keyspace_hits: '100', keyspace_misses: '10' },
      } as never);
      jest.spyOn(redis as any, 'get').mockResolvedValue('"value"' as never);
      jest.spyOn(redis as any, 'setex').mockResolvedValue('OK' as never);

      const report = await cacheMonitoringUtils.generateReport();

      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
      expect(report).toContain('缓存系统监控报告');
    });

    it('应该检查命名空间健康状态', async () => {
      jest
        .spyOn(redis as any, 'keys')
        .mockResolvedValue(['ns:key1', 'ns:key2'] as never);
      jest.spyOn(redis as any, 'ttl').mockResolvedValue(3600 as never);

      const result = await cacheMonitoringUtils.checkNamespaceHealth(
        CacheNamespace.USER_DATA
      );

      expect(result).toBeDefined();
      expect(result.namespace).toBe(CacheNamespace.USER_DATA);
      expect(result.keyCount).toBe(2);
    });

    it('应该处理空命名空间', async () => {
      jest.spyOn(redis as any, 'keys').mockResolvedValue([] as never);

      const result = await cacheMonitoringUtils.checkNamespaceHealth(
        CacheNamespace.USER_DATA
      );

      expect(result).toBeDefined();
      expect(result.keyCount).toBe(0);
    });

    it('应该获取热点键', async () => {
      const hotKeys = await cacheMonitoringUtils.getHotKeys();

      expect(Array.isArray(hotKeys)).toBe(true);
    });

    it('应该清理过期键', async () => {
      const result = await cacheMonitoringUtils.cleanupExpiredKeys();

      expect(typeof result).toBe('number');
    });
  });
});
