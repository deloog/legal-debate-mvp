/**
 * PerformanceMetricsCollector 单元测试
 * 测试性能指标收集器的各种功能
 */

import {
  PerformanceMetricsCollector,
  MetricRecord,
  PercentileResult,
  PerformanceStats,
} from '@/lib/performance/performance-metrics-collector';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('PerformanceMetricsCollector', () => {
  let collector: PerformanceMetricsCollector;

  beforeEach(() => {
    collector = new PerformanceMetricsCollector();
  });

  describe('记录响应时间', () => {
    it('应该成功记录单次响应时间', () => {
      collector.recordMetric('document-analysis', 1500);

      const metrics = collector.getMetrics('document-analysis');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(1500);
      expect(metrics[0].timestamp).toBeGreaterThan(0);
    });

    it('应该记录多次响应时间', () => {
      collector.recordMetric('document-analysis', 1000);
      collector.recordMetric('document-analysis', 1500);
      collector.recordMetric('document-analysis', 2000);

      const metrics = collector.getMetrics('document-analysis');
      expect(metrics).toHaveLength(3);
      expect(metrics.map(m => m.value)).toEqual([1000, 1500, 2000]);
    });

    it('应该记录不同操作的响应时间', () => {
      collector.recordMetric('document-analysis', 1000);
      collector.recordMetric('law-retrieval', 500);
      collector.recordMetric('debate-generation', 3000);

      const docMetrics = collector.getMetrics('document-analysis');
      const lawMetrics = collector.getMetrics('law-retrieval');
      const debateMetrics = collector.getMetrics('debate-generation');

      expect(docMetrics).toHaveLength(1);
      expect(lawMetrics).toHaveLength(1);
      expect(debateMetrics).toHaveLength(1);
    });

    it('应该拒绝负的响应时间', () => {
      expect(() => {
        collector.recordMetric('test', -100);
      }).toThrow('响应时间不能为负数');
    });

    it('应该拒绝过大的响应时间（>1小时）', () => {
      expect(() => {
        collector.recordMetric('test', 3600001); // 1小时 + 1毫秒
      }).toThrow('响应时间不能超过1小时');
    });
  });

  describe('计算平均值', () => {
    it('应该计算正确的平均值', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);
      collector.recordMetric('test', 3000);

      const stats = collector.getStats('test');
      expect(stats.average).toBe(2000);
    });

    it('应该处理空数据的平均值', () => {
      const stats = collector.getStats('test');
      expect(stats.average).toBe(0);
    });

    it('应该计算多个操作的平均值', () => {
      collector.recordMetric('document-analysis', 1000);
      collector.recordMetric('document-analysis', 2000);
      collector.recordMetric('law-retrieval', 500);
      collector.recordMetric('law-retrieval', 1500);

      const docStats = collector.getStats('document-analysis');
      const lawStats = collector.getStats('law-retrieval');

      expect(docStats.average).toBe(1500);
      expect(lawStats.average).toBe(1000);
    });
  });

  describe('计算百分位数', () => {
    it('应该计算正确的P50（中位数）', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);
      collector.recordMetric('test', 3000);

      const percentile = collector.getPercentile('test', 50);
      expect(percentile.value).toBe(2000);
    });

    it('应该计算正确的P95', () => {
      // 20个数据点，P95应该是第19个点
      for (let i = 1; i <= 20; i++) {
        collector.recordMetric('test', i * 100);
      }

      const p95 = collector.getPercentile('test', 95);
      expect(p95.value).toBe(1900); // 第19个值
    });

    it('应该计算正确的P99', () => {
      // 100个数据点，P99应该是第99个点
      for (let i = 1; i <= 100; i++) {
        collector.recordMetric('test', i * 10);
      }

      const p99 = collector.getPercentile('test', 99);
      expect(p99.value).toBe(990); // 第99个值
    });

    it('应该处理奇数个数据点', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);
      collector.recordMetric('test', 3000);
      collector.recordMetric('test', 4000);
      collector.recordMetric('test', 5000);

      const p50 = collector.getPercentile('test', 50);
      expect(p50.value).toBe(3000); // 中间值
    });

    it('应该处理空数据的百分位数', () => {
      const percentile = collector.getPercentile('test', 50);
      expect(percentile.value).toBe(0);
      expect(percentile.count).toBe(0);
    });

    it('应该计算多个百分位数', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);
      collector.recordMetric('test', 3000);

      const p50 = collector.getPercentile('test', 50);
      const p95 = collector.getPercentile('test', 95);
      const p99 = collector.getPercentile('test', 99);

      expect(p50.value).toBe(2000);
      expect(p95.value).toBe(3000);
      expect(p99.value).toBe(3000);
    });

    it('应该拒绝无效的百分位数', () => {
      collector.recordMetric('test', 1000);

      expect(() => {
        collector.getPercentile('test', 101);
      }).toThrow('百分位数必须在0-100之间');
    });
  });

  describe('计算最大值和最小值', () => {
    it('应该计算正确的最大值', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);
      collector.recordMetric('test', 3000);

      const stats = collector.getStats('test');
      expect(stats.max).toBe(3000);
    });

    it('应该计算正确的最小值', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);
      collector.recordMetric('test', 3000);

      const stats = collector.getStats('test');
      expect(stats.min).toBe(1000);
    });

    it('应该处理空数据的极值', () => {
      const stats = collector.getStats('test');
      expect(stats.max).toBe(0);
      expect(stats.min).toBe(0);
    });
  });

  describe('计算成功率', () => {
    it('应该计算100%的成功率', () => {
      collector.recordSuccess('test');
      collector.recordSuccess('test');
      collector.recordSuccess('test');

      const stats = collector.getStats('test');
      expect(stats.successRate).toBe(1.0);
    });

    it('应该计算50%的成功率', () => {
      collector.recordSuccess('test');
      collector.recordFailure('test');
      collector.recordSuccess('test');
      collector.recordFailure('test');

      const stats = collector.getStats('test');
      expect(stats.successRate).toBe(0.5);
    });

    it('应该计算0%的成功率', () => {
      collector.recordFailure('test');
      collector.recordFailure('test');

      const stats = collector.getStats('test');
      expect(stats.successRate).toBe(0.0);
    });

    it('应该处理空数据的成功率', () => {
      const stats = collector.getStats('test');
      expect(stats.successRate).toBe(0.0);
    });
  });

  describe('计算错误率', () => {
    it('应该计算0%的错误率', () => {
      collector.recordSuccess('test');
      collector.recordSuccess('test');
      collector.recordSuccess('test');

      const stats = collector.getStats('test');
      expect(stats.errorRate).toBe(0.0);
    });

    it('应该计算50%的错误率', () => {
      collector.recordSuccess('test');
      collector.recordFailure('test');
      collector.recordSuccess('test');
      collector.recordFailure('test');

      const stats = collector.getStats('test');
      expect(stats.errorRate).toBe(0.5);
    });

    it('应该计算100%的错误率', () => {
      collector.recordFailure('test');
      collector.recordFailure('test');

      const stats = collector.getStats('test');
      expect(stats.errorRate).toBe(1.0);
    });
  });

  describe('计算缓存命中率', () => {
    it('应该计算100%的缓存命中率', () => {
      collector.recordCacheHit('test');
      collector.recordCacheHit('test');
      collector.recordCacheHit('test');

      const stats = collector.getStats('test');
      expect(stats.cacheHitRate).toBe(1.0);
    });

    it('应该计算50%的缓存命中率', () => {
      collector.recordCacheHit('test');
      collector.recordCacheMiss('test');
      collector.recordCacheHit('test');
      collector.recordCacheMiss('test');

      const stats = collector.getStats('test');
      expect(stats.cacheHitRate).toBe(0.5);
    });

    it('应该计算0%的缓存命中率', () => {
      collector.recordCacheMiss('test');
      collector.recordCacheMiss('test');

      const stats = collector.getStats('test');
      expect(stats.cacheHitRate).toBe(0.0);
    });

    it('应该处理空数据的缓存命中率', () => {
      const stats = collector.getStats('test');
      expect(stats.cacheHitRate).toBe(0.0);
    });
  });

  describe('获取统计报告', () => {
    it('应该生成完整的统计报告', () => {
      collector.recordMetric('document-analysis', 1000);
      collector.recordMetric('document-analysis', 2000);
      collector.recordMetric('document-analysis', 3000);
      collector.recordSuccess('document-analysis');
      collector.recordCacheHit('document-analysis');

      collector.recordMetric('law-retrieval', 500);
      collector.recordMetric('law-retrieval', 1500);
      collector.recordSuccess('law-retrieval');
      collector.recordCacheMiss('law-retrieval');

      const report = collector.getReport();

      expect(report).toHaveProperty('document-analysis');
      expect(report).toHaveProperty('law-retrieval');

      const docStats = report['document-analysis'];
      expect(docStats.average).toBe(2000);
      expect(docStats.count).toBe(3);
      expect(docStats.successRate).toBe(1.0);
      expect(docStats.cacheHitRate).toBe(1.0);

      const lawStats = report['law-retrieval'];
      expect(lawStats.average).toBe(1000);
      expect(lawStats.count).toBe(2);
      expect(lawStats.successRate).toBe(1.0);
      expect(lawStats.cacheHitRate).toBe(0.0);
    });

    it('应该生成空报告（无数据）', () => {
      const report = collector.getReport();
      expect(Object.keys(report)).toHaveLength(0);
    });
  });

  describe('清空指标', () => {
    it('应该清空指定操作的指标', () => {
      collector.recordMetric('test', 1000);
      collector.recordMetric('test', 2000);

      collector.clearMetrics('test');

      const metrics = collector.getMetrics('test');
      expect(metrics).toHaveLength(0);
    });

    it('应该清空所有指标', () => {
      collector.recordMetric('document-analysis', 1000);
      collector.recordMetric('law-retrieval', 500);

      collector.clearAll();

      const docMetrics = collector.getMetrics('document-analysis');
      const lawMetrics = collector.getMetrics('law-retrieval');

      expect(docMetrics).toHaveLength(0);
      expect(lawMetrics).toHaveLength(0);
    });
  });

  describe('边界情况处理', () => {
    it('应该处理极小的响应时间（0ms）', () => {
      collector.recordMetric('test', 0);
      const stats = collector.getStats('test');
      expect(stats.min).toBe(0);
      expect(stats.average).toBe(0);
    });

    it('应该处理极大的响应时间（1小时）', () => {
      const maxTime = 3600000; // 1小时
      collector.recordMetric('test', maxTime);
      const stats = collector.getStats('test');
      expect(stats.max).toBe(maxTime);
    });

    it('应该处理大量数据点', () => {
      // 记录1000个数据点
      for (let i = 0; i < 1000; i++) {
        collector.recordMetric('test', i);
      }

      const metrics = collector.getMetrics('test');
      expect(metrics).toHaveLength(1000);
      expect(metrics[999].value).toBe(999);
    });

    it('应该处理不同操作名的混合', () => {
      collector.recordMetric('op1', 100);
      collector.recordMetric('op2', 200);
      collector.recordMetric('op1', 300);

      const op1Metrics = collector.getMetrics('op1');
      const op2Metrics = collector.getMetrics('op2');

      expect(op1Metrics).toHaveLength(2);
      expect(op2Metrics).toHaveLength(1);
    });
  });

  describe('性能验证', () => {
    it('应该验证P50响应时间 < 2秒', () => {
      collector.recordMetric('document-analysis', 1000);
      collector.recordMetric('document-analysis', 1500);
      collector.recordMetric('document-analysis', 2000);

      const validation = collector.validateThresholds('document-analysis', {
        p50: 2000,
        p95: 5000,
        p99: 10000,
      });

      expect(validation.p50.passed).toBe(true);
    });

    it('应该验证P95响应时间 < 5秒', () => {
      // 记录20个数据点
      for (let i = 0; i < 20; i++) {
        collector.recordMetric('test', 3000 + i * 100);
      }

      const validation = collector.validateThresholds('test', {
        p50: 2000,
        p95: 5000,
        p99: 10000,
      });

      expect(validation.p95.passed).toBe(true);
    });

    it('应该验证P99响应时间 < 10秒', () => {
      // 记录100个数据点，最大值为9900（小于10000）
      for (let i = 0; i < 100; i++) {
        collector.recordMetric('test', i * 100);
      }

      const validation = collector.validateThresholds('test', {
        p50: 2000,
        p95: 5000,
        p99: 10000,
      });

      expect(validation.p99.passed).toBe(true);
    });

    it('应该报告失败的P50验证', () => {
      collector.recordMetric('test', 3000);
      collector.recordMetric('test', 4000);

      const validation = collector.validateThresholds('test', {
        p50: 2000,
        p95: 5000,
        p99: 10000,
      });

      expect(validation.p50.passed).toBe(false);
      expect(validation.p50.actual).toBeGreaterThanOrEqual(3000);
    });
  });
});
