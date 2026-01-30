import {
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector,
  collectSystemMetrics,
  getMetric,
} from '../../../lib/monitoring/metrics-collector';
import { APIMonitor } from '../../../lib/monitoring/api-monitor';

jest.mock('../../../lib/monitoring/api-monitor');

describe('Metrics Collector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    resetMetricsCollector();
    collector = getMetricsCollector();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetMetricsCollector();
  });

  describe('collectSystemMetrics', () => {
    it('应该收集所有系统指标', async () => {
      const mockAPIStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      const mockAIStats = {
        totalCalls: 500,
        successfulCalls: 450,
        failedCalls: 50,
        averageDuration: 2000,
        successRate: 0.9,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockAPIStats);
      (APIMonitor.getAIStats as jest.Mock).mockResolvedValue(mockAIStats);

      const metrics = await collector.collectSystemMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.apiErrorRate).toBe(5); // 0.05 * 100
      expect(metrics.apiResponseTimeP95).toBe(750); // 500 * 1.5
      expect(metrics.databaseConnectionFailed).toBeGreaterThanOrEqual(0);
      expect(metrics.aiServiceErrorRate).toBeCloseTo(10, 1); // (1 - 0.9) * 100
      expect(metrics.diskUsagePercent).toBeGreaterThanOrEqual(30);
      expect(metrics.diskUsagePercent).toBeLessThan(81);
    });

    it('应该正确收集API错误率', async () => {
      const mockStats = {
        totalRequests: 200,
        successRequests: 180,
        failedRequests: 20,
        averageResponseTime: 300,
        errorRate: 0.1,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      const apiErrorRate = await collector.collectAPIErrorRate();

      expect(apiErrorRate).toBe(10); // 0.1 * 100
    });

    it('应该正确收集API响应时间P95', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 1000,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      const p95Time = await collector.collectAPIResponseTimeP95();

      expect(p95Time).toBe(1500); // 1000 * 1.5
    });

    it('应该正确收集数据库连接失败次数', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      const dbFailed = await collector.collectDatabaseConnectionFailed();

      expect(dbFailed).toBe(10); // 1000 * 0.01
    });

    it('应该正确收集AI服务错误率', async () => {
      const mockStats = {
        totalCalls: 100,
        successfulCalls: 90,
        failedCalls: 10,
        averageDuration: 1500,
        successRate: 0.9,
      };

      (APIMonitor.getAIStats as jest.Mock).mockResolvedValue(mockStats);

      const aiErrorRate = await collector.collectAIServiceErrorRate();

      expect(aiErrorRate).toBeCloseTo(10, 1); // (1 - 0.9) * 100
    });

    it('应该正确收集磁盘使用率', async () => {
      const diskUsage = await collector.collectDiskUsagePercent();

      expect(diskUsage).toBeGreaterThanOrEqual(30);
      expect(diskUsage).toBeLessThan(81);
    });
  });

  describe('缓存机制', () => {
    it('应该缓存指标值', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      await collector.collectAPIErrorRate();
      await collector.collectAPIErrorRate();

      // 第二次调用应该使用缓存
      expect(APIMonitor.getAPIStats).toHaveBeenCalledTimes(1);
    });

    it('缓存应该在TTL后过期', async () => {
      jest.useFakeTimers();

      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      await collector.collectAPIErrorRate();

      jest.advanceTimersByTime(61 * 1000); // 超过60秒TTL

      await collector.collectAPIErrorRate();

      // 缓存过期后应该再次调用API
      expect(APIMonitor.getAPIStats).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('应该支持清除缓存', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      await collector.collectAPIErrorRate();
      collector.clearCache();
      await collector.collectAPIErrorRate();

      expect(APIMonitor.getAPIStats).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMetric', () => {
    it('应该正确获取单个指标', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      const value = await collector.getMetric('apiErrorRate');
      expect(value).toBe(5);
    });

    it('应该支持所有支持的指标', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      const mockAIStats = {
        totalCalls: 500,
        successfulCalls: 450,
        failedCalls: 50,
        averageDuration: 2000,
        successRate: 0.9,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);
      (APIMonitor.getAIStats as jest.Mock).mockResolvedValue(mockAIStats);

      const supportedMetrics = collector.getSupportedMetrics();

      for (const metric of supportedMetrics) {
        const value = await collector.getMetric(metric);
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    it('应该拒绝未知指标', async () => {
      await expect(collector.getMetric('unknownMetric')).rejects.toThrow(
        'Unknown metric: unknownMetric'
      );
    });
  });

  describe('getSupportedMetrics', () => {
    it('应该返回所有支持的指标名称', () => {
      const metrics = collector.getSupportedMetrics();

      expect(metrics).toContain('apiErrorRate');
      expect(metrics).toContain('apiResponseTimeP95');
      expect(metrics).toContain('databaseConnectionFailed');
      expect(metrics).toContain('aiServiceErrorRate');
      expect(metrics).toContain('diskUsagePercent');
      expect(metrics).toHaveLength(5);
    });
  });

  describe('错误处理', () => {
    it('应该在API监控失败时返回0', async () => {
      (APIMonitor.getAPIStats as jest.Mock).mockRejectedValue(
        new Error('API error')
      );

      const apiErrorRate = await collector.collectAPIErrorRate();
      expect(apiErrorRate).toBe(0);
    });

    it('应该在AI监控失败时返回0', async () => {
      (APIMonitor.getAIStats as jest.Mock).mockRejectedValue(
        new Error('AI error')
      );

      const aiErrorRate = await collector.collectAIServiceErrorRate();
      expect(aiErrorRate).toBe(0);
    });
  });

  describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = getMetricsCollector();
      const instance2 = getMetricsCollector();

      expect(instance1).toBe(instance2);
    });

    it('应该支持重置实例', () => {
      const instance1 = getMetricsCollector();
      resetMetricsCollector();
      const instance2 = getMetricsCollector();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('便捷函数', () => {
    it('collectSystemMetrics应该使用单例', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      const mockAIStats = {
        totalCalls: 500,
        successfulCalls: 450,
        failedCalls: 50,
        averageDuration: 2000,
        successRate: 0.9,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);
      (APIMonitor.getAIStats as jest.Mock).mockResolvedValue(mockAIStats);

      const metrics = await collectSystemMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.apiErrorRate).toBe(5);
    });

    it('getMetric应该使用单例', async () => {
      const mockStats = {
        totalRequests: 1000,
        successRequests: 950,
        failedRequests: 50,
        averageResponseTime: 500,
        errorRate: 0.05,
      };

      (APIMonitor.getAPIStats as jest.Mock).mockResolvedValue(mockStats);

      const value = await getMetric('apiErrorRate');
      expect(value).toBe(5);
    });
  });
});
