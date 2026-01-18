/**
 * DocAnalyzer监控模块单元测试
 */

import {
  DocAnalyzerMonitor,
  QualityMetrics,
  TrendAnalysis,
  AlertConfig,
  Alert,
  getDocAnalyzerMonitor,
  resetDocAnalyzerMonitor,
  recordDocAnalyzerMetric,
  getDocAnalyzerTrend,
  generateDocAnalyzerReport,
} from '@/lib/monitoring/docanalyzer-monitor';

describe('DocAnalyzerMonitor', () => {
  let monitor: DocAnalyzerMonitor;

  beforeEach(() => {
    monitor = new DocAnalyzerMonitor();
    resetDocAnalyzerMonitor();
  });

  afterEach(() => {
    monitor.reset();
  });

  describe('recordMetric', () => {
    test('应该成功记录质量指标', () => {
      const metric: QualityMetrics = {
        timestamp: Date.now(),
        documentId: 'doc1',
        documentType: 'CONTRACT',
        qualityScore: 0.85,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 2,
          claimsExtracted: 5,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      };

      monitor.recordMetric(metric);

      const recentMetrics = monitor.getRecentMetrics(10);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0]).toEqual(metric);
    });

    test('应该限制存储的指标数量', () => {
      const maxMetrics = 1000;
      for (let i = 0; i <= maxMetrics; i++) {
        monitor.recordMetric({
          timestamp: Date.now() + i,
          qualityScore: 0.8,
          processingTime: 50,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: true,
            issues: [],
          },
        });
      }

      const stats = monitor.getStats();
      expect(stats.totalMetrics).toBe(maxMetrics);
    });

    test('应该触发质量评分过低告警', () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      monitor.recordMetric({
        timestamp: Date.now(),
        qualityScore: 0.5,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[alerts.length - 1].level).toBe('warning');
      expect(alerts[alerts.length - 1].message).toContain('质量评分过低');
      consoleSpy.mockRestore();
    });

    test('应该触发处理时间过长告警', () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      monitor.recordMetric({
        timestamp: Date.now(),
        qualityScore: 0.9,
        processingTime: 150,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[alerts.length - 1].level).toBe('warning');
      expect(alerts[alerts.length - 1].message).toContain('处理时间过长');
      consoleSpy.mockRestore();
    });

    test('应该触发验证失败告警', () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      monitor.recordMetric({
        timestamp: Date.now(),
        qualityScore: 0.9,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: false,
          issues: ['Missing party', 'Invalid claim'],
        },
      });

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[alerts.length - 1].level).toBe('error');
      expect(alerts[alerts.length - 1].message).toContain('验证失败');
      consoleSpy.mockRestore();
    });
  });

  describe('getQualityTrend', () => {
    test('应该返回默认周期的趋势分析', () => {
      monitor.recordMetric({
        timestamp: Date.now(),
        qualityScore: 0.8,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const trend = monitor.getQualityTrend();

      expect(trend.period).toBe('day');
      expect(trend.averageQualityScore).toBe(0.8);
      expect(trend.averageProcessingTime).toBe(50);
      expect(trend.qualityTrend).toBe('stable');
      expect(trend.successRate).toBe(1);
    });

    test('应该支持不同周期', () => {
      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;
      const dayAgo = now - 24 * 60 * 60 * 1000;

      monitor.recordMetric({
        timestamp: hourAgo,
        qualityScore: 0.7,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      monitor.recordMetric({
        timestamp: dayAgo,
        qualityScore: 0.9,
        processingTime: 60,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const hourTrend = monitor.getQualityTrend('hour');
      const dayTrend = monitor.getQualityTrend('day');

      expect(hourTrend.period).toBe('hour');
      expect(hourTrend.averageQualityScore).toBe(0.7);
      expect(dayTrend.period).toBe('day');
      expect(dayTrend.averageQualityScore).toBeCloseTo(0.8);
    });

    test('应该计算质量趋势为提升', () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;

      monitor.recordMetric({
        timestamp: twoHoursAgo,
        qualityScore: 0.6,
        processingTime: 60,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      monitor.recordMetric({
        timestamp: oneHourAgo,
        qualityScore: 0.9,
        processingTime: 40,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const trend = monitor.getQualityTrend();

      expect(trend.qualityTrend).toBe('improving');
    });

    test('应该计算质量趋势为下降', () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      const oneHourAgo = now - 60 * 60 * 1000;

      monitor.recordMetric({
        timestamp: twoHoursAgo,
        qualityScore: 0.9,
        processingTime: 40,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      monitor.recordMetric({
        timestamp: oneHourAgo,
        qualityScore: 0.6,
        processingTime: 60,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const trend = monitor.getQualityTrend();

      expect(trend.qualityTrend).toBe('declining');
    });

    test('应该分析问题分布', () => {
      const now = Date.now();

      monitor.recordMetric({
        timestamp: now - 1000,
        qualityScore: 0.8,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: false,
          issues: ['Missing party'],
        },
      });

      monitor.recordMetric({
        timestamp: now - 2000,
        qualityScore: 0.7,
        processingTime: 60,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: false,
          issues: ['Missing party', 'Invalid claim'],
        },
      });

      const trend = monitor.getQualityTrend();

      expect(trend.issueDistribution).toEqual({
        'Missing party': 2,
        'Invalid claim': 1,
      });
    });

    test('应该计算成功率', () => {
      const now = Date.now();

      monitor.recordMetric({
        timestamp: now,
        qualityScore: 0.8,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      monitor.recordMetric({
        timestamp: now,
        qualityScore: 0.7,
        processingTime: 60,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: false,
          issues: ['Issue'],
        },
      });

      const trend = monitor.getQualityTrend();

      expect(trend.successRate).toBe(0.5);
    });
  });

  describe('getRecentMetrics', () => {
    test('应该返回最近N条指标', () => {
      const now = Date.now();

      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.8,
          processingTime: 50,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: true,
            issues: [],
          },
        });
      }

      const recentMetrics = monitor.getRecentMetrics(5);

      expect(recentMetrics).toHaveLength(5);
      expect(recentMetrics[0].timestamp).toBeGreaterThanOrEqual(
        recentMetrics[4].timestamp
      );
    });

    test('应该返回所有指标如果N大于总数', () => {
      const now = Date.now();

      for (let i = 0; i < 3; i++) {
        monitor.recordMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.8,
          processingTime: 50,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: true,
            issues: [],
          },
        });
      }

      const recentMetrics = monitor.getRecentMetrics(10);

      expect(recentMetrics).toHaveLength(3);
    });
  });

  describe('getAlerts', () => {
    test('应该返回所有告警', () => {
      monitor.updateConfig({ minQualityScore: 0.5, maxProcessingTime: 100 });

      monitor.recordMetric({
        timestamp: Date.now(),
        qualityScore: 0.4,
        processingTime: 150,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const alerts = monitor.getAlerts();

      expect(alerts.length).toBeGreaterThan(0);
    });

    test('应该返回告警的副本', () => {
      const alerts1 = monitor.getAlerts();
      const alerts2 = monitor.getAlerts();

      expect(alerts1).not.toBe(alerts2);
      expect(alerts1).toEqual(alerts2);
    });
  });

  describe('clearAlerts', () => {
    test('应该清除所有告警', () => {
      monitor.updateConfig({ minQualityScore: 0.5 });

      monitor.recordMetric({
        timestamp: Date.now(),
        qualityScore: 0.4,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      expect(monitor.getAlerts().length).toBeGreaterThan(0);

      monitor.clearAlerts();

      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('updateConfig', () => {
    test('应该更新告警配置', () => {
      const newConfig: Partial<AlertConfig> = {
        minQualityScore: 0.8,
        maxProcessingTime: 80,
        enableAlerts: false,
      };

      monitor.updateConfig(newConfig);

      const config = monitor.getConfig();
      expect(config.minQualityScore).toBe(0.8);
      expect(config.maxProcessingTime).toBe(80);
      expect(config.enableAlerts).toBe(false);
    });

    test('应该保留未更新的配置', () => {
      const originalConfig = monitor.getConfig();

      monitor.updateConfig({ minQualityScore: 0.8 });

      const newConfig = monitor.getConfig();

      expect(newConfig.maxProcessingTime).toBe(
        originalConfig.maxProcessingTime
      );
      expect(newConfig.enableAlerts).toBe(originalConfig.enableAlerts);
      expect(newConfig.alertChannels).toEqual(originalConfig.alertChannels);
    });
  });

  describe('getConfig', () => {
    test('应该返回配置的副本', () => {
      const config1 = monitor.getConfig();
      const config2 = monitor.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe('generateReport', () => {
    test('应该生成监控报告', () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        monitor.recordMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.8 + i * 0.02,
          processingTime: 50 - i * 2,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: i % 2 === 0,
            issues: i % 2 === 0 ? [] : ['Test issue'],
          },
        });
      }

      const report = monitor.generateReport();

      expect(report).toContain('DocAnalyzer监控报告');
      expect(report).toContain('质量趋势（24小时）');
      expect(report).toContain('平均质量评分:');
      expect(report).toContain('平均处理时间:');
      expect(report).toContain('成功率:');
      expect(report).toContain('趋势:');
      expect(report).toContain('最近处理记录');
    });

    test('应该包含问题分布', () => {
      const now = Date.now();

      for (let i = 0; i < 3; i++) {
        monitor.recordMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.7,
          processingTime: 60,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: false,
            issues: ['Issue A'],
          },
        });
      }

      monitor.recordMetric({
        timestamp: now - 3000,
        qualityScore: 0.8,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: false,
          issues: ['Issue B', 'Issue C'],
        },
      });

      const report = monitor.generateReport();

      expect(report).toContain('问题分布');
      expect(report).toContain('Issue A: 3次');
      expect(report).toContain('Issue B: 1次');
      expect(report).toContain('Issue C: 1次');
    });

    test('应该包含最近告警', () => {
      monitor.updateConfig({ minQualityScore: 0.5, maxProcessingTime: 100 });

      const now = Date.now();

      monitor.recordMetric({
        timestamp: now - 2000,
        qualityScore: 0.4,
        processingTime: 150,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      monitor.recordMetric({
        timestamp: now - 1000,
        qualityScore: 0.3,
        processingTime: 180,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: false,
          issues: ['Critical issue'],
        },
      });

      const report = monitor.generateReport();

      expect(report).toContain('最近告警');
      expect(report).toContain('[WARNING]');
      expect(report).toContain('[ERROR]');
    });
  });

  describe('reset', () => {
    test('应该重置监控数据', () => {
      const now = Date.now();

      monitor.recordMetric({
        timestamp: now,
        qualityScore: 0.8,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      monitor.updateConfig({ minQualityScore: 0.5 });
      monitor.recordMetric({
        timestamp: now,
        qualityScore: 0.4,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      expect(monitor.getStats().totalMetrics).toBeGreaterThan(0);
      expect(monitor.getAlerts().length).toBeGreaterThan(0);

      monitor.reset();

      expect(monitor.getStats().totalMetrics).toBe(0);
      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    test('应该返回监控统计信息', () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        monitor.recordMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.8,
          processingTime: 50 + i * 10,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: i % 2 === 0,
            issues: i % 2 === 0 ? [] : ['Test issue'],
          },
        });
      }

      const stats = monitor.getStats();

      expect(stats.totalMetrics).toBe(5);
      expect(stats.totalAlerts).toBe(2);
      expect(stats.averageQualityScore).toBe(0.8);
      expect(stats.averageProcessingTime).toBe(70);
    });

    test('应该处理空数据情况', () => {
      const stats = monitor.getStats();

      expect(stats.totalMetrics).toBe(0);
      expect(stats.totalAlerts).toBe(0);
      expect(stats.averageQualityScore).toBe(0);
      expect(stats.averageProcessingTime).toBe(0);
    });
  });

  describe('Singleton Pattern', () => {
    afterEach(() => {
      resetDocAnalyzerMonitor();
    });

    test('应该返回相同的实例', () => {
      const instance1 = getDocAnalyzerMonitor();
      const instance2 = getDocAnalyzerMonitor();

      expect(instance1).toBe(instance2);
    });

    test('重置后应该返回新实例', () => {
      const instance1 = getDocAnalyzerMonitor();
      resetDocAnalyzerMonitor();
      const instance2 = getDocAnalyzerMonitor();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Convenience Functions', () => {
    afterEach(() => {
      resetDocAnalyzerMonitor();
    });

    test('recordDocAnalyzerMetric应该记录指标', () => {
      const metric: QualityMetrics = {
        timestamp: Date.now(),
        qualityScore: 0.85,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      };

      recordDocAnalyzerMetric(metric);

      const monitor = getDocAnalyzerMonitor();
      const metrics = monitor.getRecentMetrics(10);

      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toEqual(metric);
    });

    test('getDocAnalyzerTrend应该返回趋势', () => {
      const now = Date.now();

      for (let i = 0; i < 3; i++) {
        recordDocAnalyzerMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.8,
          processingTime: 50,
          reviewerCounts: {
            partiesExtracted: 1,
            claimsExtracted: 1,
            amountsExtracted: 1,
          },
          validationResults: {
            isValid: true,
            issues: [],
          },
        });
      }

      const trend = getDocAnalyzerTrend();

      expect(trend.period).toBe('day');
      expect(trend.averageQualityScore).toBeCloseTo(0.8, 10);
      expect(trend.successRate).toBe(1);
    });

    test('generateDocAnalyzerReport应该生成报告', () => {
      const now = Date.now();

      recordDocAnalyzerMetric({
        timestamp: now,
        qualityScore: 0.85,
        processingTime: 50,
        reviewerCounts: {
          partiesExtracted: 1,
          claimsExtracted: 1,
          amountsExtracted: 1,
        },
        validationResults: {
          isValid: true,
          issues: [],
        },
      });

      const report = generateDocAnalyzerReport();

      expect(report).toContain('DocAnalyzer监控报告');
      expect(report).toContain('质量趋势（24小时）');
    });
  });
});
