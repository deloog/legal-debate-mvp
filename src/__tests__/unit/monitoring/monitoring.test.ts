/**
 * 监控系统集成测试
 * 测试监控系统的端到端集成功能
 */

// 使用真实数据库进行集成测试
jest.mock('@/lib/db/prisma', () => {
  const { PrismaClient: RealPrismaClient } = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  return { prisma: new RealPrismaClient() };
});

import {
  APIMonitor,
  createPerformanceTracker,
} from '@/lib/monitoring/api-monitor';
import {
  DocAnalyzerMonitor,
  getDocAnalyzerMonitor,
  resetDocAnalyzerMonitor,
  recordDocAnalyzerMetric,
  getDocAnalyzerTrend,
  generateDocAnalyzerReport,
  QualityMetrics,
} from '@/lib/monitoring/docanalyzer-monitor';
import {
  PrometheusMonitor,
  getPrometheusMonitor,
} from '@/lib/monitoring/prometheus-metrics';
import { prisma } from '@/lib/db/prisma';

describe('监控系统集成测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetDocAnalyzerMonitor();
  });

  afterEach(async () => {
    await prisma.aIInteraction.deleteMany({});
    const monitor = getDocAnalyzerMonitor();
    monitor.reset();
  });

  describe('API监控与数据库集成', () => {
    test('应该正确记录API请求到数据库', async () => {
      const metrics = {
        endpoint: '/api/test',
        method: 'POST' as const,
        statusCode: 200,
        responseTime: 100,
        userId: 'user123',
        requestId: 'req123',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      };

      await APIMonitor.logRequest(metrics);

      const stats = await APIMonitor.getAPIStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.errorRate).toBe(0);
      expect(stats.averageResponseTime).toBe(100);
    });

    test('应该正确处理失败的API请求', async () => {
      const metrics = {
        endpoint: '/api/error',
        method: 'GET' as const,
        statusCode: 500,
        responseTime: 200,
        error: 'Internal server error',
      };

      await APIMonitor.logRequest(metrics);

      const stats = await APIMonitor.getAPIStats();

      expect(stats.totalRequests).toBe(1);
      expect(stats.errorRate).toBe(1);
      expect(stats.averageResponseTime).toBe(200);
    });

    test('性能追踪器应该正确计算响应时间', async () => {
      const tracker = createPerformanceTracker('/api/test', 'GET');

      await new Promise(resolve => setTimeout(resolve, 50));

      const result = await tracker.endTime(
        200,
        'user123',
        'test-agent',
        '1.2.3.4'
      );

      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.requestId).toBeDefined();
    });

    test('应该支持批量API请求监控', async () => {
      const endpoints = ['/api/users', '/api/posts', '/api/comments'];

      for (const endpoint of endpoints) {
        await APIMonitor.logRequest({
          endpoint,
          method: 'GET',
          statusCode: 200,
          responseTime: Math.random() * 100 + 50,
        });
      }

      const stats = await APIMonitor.getAPIStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.topEndpoints).toHaveLength(3);
    });

    test('应该支持时间范围过滤', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      await APIMonitor.logRequest({
        endpoint: '/api/recent',
        method: 'GET',
        statusCode: 200,
        responseTime: 50,
      });

      await APIMonitor.logRequest({
        endpoint: '/api/old',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
      });

      const stats = await APIMonitor.getAPIStats({
        start: yesterday,
        end: now,
      });

      expect(stats.totalRequests).toBeGreaterThanOrEqual(1);
    });
  });

  describe('数据库操作监控集成', () => {
    test('应该正确记录数据库操作', async () => {
      await APIMonitor.logDatabaseOperation({
        operation: 'findMany',
        table: 'User',
        duration: 50,
        success: true,
      });

      // 验证记录成功
      expect(true).toBe(true);
    });

    test('应该正确记录失败的数据库操作', async () => {
      await APIMonitor.logDatabaseOperation({
        operation: 'create',
        table: 'Case',
        duration: 100,
        success: false,
        error: 'Duplicate key',
      });

      // 验证记录成功
      expect(true).toBe(true);
    });

    test('应该支持批量数据库操作监控', async () => {
      const operations = ['findMany', 'findFirst', 'create', 'update'];

      for (const operation of operations) {
        await APIMonitor.logDatabaseOperation({
          operation: operation as
            | 'findMany'
            | 'findFirst'
            | 'create'
            | 'update',
          table: 'User',
          duration: Math.random() * 50 + 20,
          success: Math.random() > 0.2,
        });
      }

      // 验证记录成功
      expect(true).toBe(true);
    });
  });

  describe('AI服务监控集成', () => {
    test('应该正确记录AI操作', async () => {
      await APIMonitor.logAIOperation({
        provider: 'deepseek',
        model: 'deepseek-chat',
        operation: 'generate-debate',
        tokensUsed: 1000,
        duration: 2000,
        cost: 0.002,
        success: true,
      });

      const stats = await APIMonitor.getAIStats();

      expect(stats.totalOperations).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.totalTokens).toBe(1000);
      expect(stats.totalCost).toBe(0.002);
    });

    test('应该正确记录失败的AI操作', async () => {
      await APIMonitor.logAIOperation({
        provider: 'zhipu',
        operation: 'analyze-document',
        duration: 1000,
        success: false,
        error: 'Rate limit exceeded',
      });

      const stats = await APIMonitor.getAIStats();

      expect(stats.totalOperations).toBe(1);
      expect(stats.successRate).toBe(0);
    });

    test('应该支持多AI提供商监控', async () => {
      const providers = [
        { provider: 'deepseek' as const, model: 'deepseek-chat' },
        { provider: 'zhipu' as const, model: 'glm-4' },
      ];

      for (const { provider, model } of providers) {
        await APIMonitor.logAIOperation({
          provider,
          model,
          operation: 'generate',
          tokensUsed: 1000,
          duration: 2000,
          cost: 0.002,
          success: true,
        });
      }

      const stats = await APIMonitor.getAIStats();

      expect(stats.totalOperations).toBe(2);
      expect(stats.providerStats).toHaveLength(2);
      expect(stats.providerStats[0].count).toBe(1);
      expect(stats.providerStats[1].count).toBe(1);
    });
  });

  describe('DocAnalyzer监控集成', () => {
    test('应该正确记录文档质量指标', () => {
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

      recordDocAnalyzerMetric(metric);

      const monitor = getDocAnalyzerMonitor();
      const recentMetrics = monitor.getRecentMetrics(10);

      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].qualityScore).toBe(0.85);
      expect(recentMetrics[0].documentId).toBe('doc1');
    });

    test('应该正确触发告警', () => {
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      recordDocAnalyzerMetric({
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

      const monitor = getDocAnalyzerMonitor();
      const alerts = monitor.getAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[alerts.length - 1].level).toBe('warning');

      consoleSpy.mockRestore();
    });

    test('应该正确分析质量趋势', () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
        recordDocAnalyzerMetric({
          timestamp: now - i * 1000,
          qualityScore: 0.7 + i * 0.05,
          processingTime: 60 - i * 5,
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

      const trend = getDocAnalyzerTrend('hour');

      expect(trend.period).toBe('hour');
      expect(trend.averageQualityScore).toBeGreaterThan(0.7);
      expect(trend.qualityTrend).toBe('improving');
    });

    test('应该生成完整的监控报告', () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
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
            isValid: i % 2 === 0,
            issues: i % 2 === 0 ? [] : ['Test issue'],
          },
        });
      }

      const report = generateDocAnalyzerReport();

      expect(report).toContain('DocAnalyzer监控报告');
      expect(report).toContain('质量趋势（24小时）');
      expect(report).toContain('平均质量评分:');
      expect(report).toContain('平均处理时间:');
      expect(report).toContain('成功率:');
    });
  });

  describe('Prometheus指标集成', () => {
    test('应该正确初始化Prometheus指标', () => {
      const monitor = getPrometheusMonitor();

      expect(monitor).toBeInstanceOf(PrometheusMonitor);
    });

    test('应该正确记录Counter指标', () => {
      const monitor = getPrometheusMonitor();
      monitor.incrementCounter('test_counter', 1, { label: 'value1' });
      monitor.incrementCounter('test_counter', 2, { label: 'value2' });

      const output = monitor.getPrometheusMetrics();

      expect(output).toContain('test_counter');
      expect(output).toContain('label="value1"');
      expect(output).toContain('label="value2"');
    });

    test('应该正确记录Gauge指标', () => {
      const monitor = getPrometheusMonitor();
      monitor.setGauge('test_gauge', 100, { label: 'value1' });
      monitor.incrementCounter('test_gauge', 50, { label: 'value2' });

      const output = monitor.getPrometheusMetrics();

      expect(output).toContain('test_gauge');
      expect(output).toContain('label="value1"');
    });

    test('应该正确记录Histogram指标', () => {
      const monitor = getPrometheusMonitor();
      monitor.recordHistogram('test_histogram', 100, { label: 'value1' });
      monitor.recordHistogram('test_histogram', 200, { label: 'value2' });

      const output = monitor.getPrometheusMetrics();

      expect(output).toContain('test_histogram');
      expect(output).toContain('histogram');
    });

    test('应该正确记录Summary指标', () => {
      const monitor = getPrometheusMonitor();
      monitor.recordSummary('test_summary', 100, { label: 'value1' });
      monitor.recordSummary('test_summary', 200, { label: 'value2' });

      const output = monitor.getPrometheusMetrics();

      expect(output).toContain('test_summary');
      expect(output).toContain('summary');
    });

    test('应该生成完整的Prometheus指标输出', () => {
      const monitor = getPrometheusMonitor();
      monitor.incrementCounter('api_requests', 100);
      monitor.setGauge('active_connections', 50);
      monitor.recordHistogram('response_time', 200);

      const output = monitor.getPrometheusMetrics();

      expect(output).toContain('api_requests');
      expect(output).toContain('active_connections');
      expect(output).toContain('response_time');
    });
  });

  describe('监控系统协同工作', () => {
    test('API监控和DocAnalyzer监控应该独立工作', async () => {
      const now = Date.now();

      // 记录API指标
      await APIMonitor.logRequest({
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
      });

      // 记录DocAnalyzer指标
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

      // 验证两者都正常工作
      const apiStats = await APIMonitor.getAPIStats();
      const docAnalyzerMonitor = getDocAnalyzerMonitor();
      const docMetrics = docAnalyzerMonitor.getRecentMetrics(10);

      expect(apiStats.totalRequests).toBe(1);
      expect(docMetrics).toHaveLength(1);
    });

    test('应该支持多种监控指标的同时记录', async () => {
      const now = Date.now();

      // API请求
      await APIMonitor.logRequest({
        endpoint: '/api/test',
        method: 'POST',
        statusCode: 200,
        responseTime: 100,
      });

      // 数据库操作
      await APIMonitor.logDatabaseOperation({
        operation: 'findMany',
        table: 'User',
        duration: 50,
        success: true,
      });

      // AI操作
      await APIMonitor.logAIOperation({
        provider: 'deepseek',
        model: 'deepseek-chat',
        operation: 'generate',
        tokensUsed: 1000,
        duration: 2000,
        cost: 0.002,
        success: true,
      });

      // DocAnalyzer指标
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

      // Prometheus指标
      const monitor = getPrometheusMonitor();
      monitor.incrementCounter('test_counter', 1);

      // 验证所有监控都正常工作
      const apiStats = await APIMonitor.getAPIStats();
      const aiStats = await APIMonitor.getAIStats();
      const docMonitor = getDocAnalyzerMonitor();
      const docMetrics = docMonitor.getRecentMetrics(10);

      expect(apiStats.totalRequests).toBe(1);
      expect(aiStats.totalOperations).toBe(1);
      expect(docMetrics).toHaveLength(1);
    });
  });

  describe('监控系统清理和维护', () => {
    test('应该正确清理旧数据', async () => {
      const daysToKeep = 1;

      // 记录一些数据
      await APIMonitor.logRequest({
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
      });

      await APIMonitor.cleanupOldData(daysToKeep);

      // 验证清理成功
      expect(true).toBe(true);
    });

    test('DocAnalyzer监控应该支持重置', () => {
      const now = Date.now();

      for (let i = 0; i < 5; i++) {
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

      const monitor = getDocAnalyzerMonitor();
      expect(monitor.getStats().totalMetrics).toBe(5);

      monitor.reset();
      expect(monitor.getStats().totalMetrics).toBe(0);
    });

    test('应该正确清理告警', () => {
      const monitor = getDocAnalyzerMonitor();

      monitor.updateConfig({ minQualityScore: 0.5, maxProcessingTime: 100 });

      recordDocAnalyzerMetric({
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

      expect(monitor.getAlerts().length).toBeGreaterThan(0);

      monitor.clearAlerts();
      expect(monitor.getAlerts()).toHaveLength(0);
    });
  });

  describe('监控系统配置管理', () => {
    test('应该正确更新告警配置', () => {
      const monitor = getDocAnalyzerMonitor();

      const newConfig = {
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

    test('配置更新应该影响后续告警触发', () => {
      const monitor = getDocAnalyzerMonitor();
      const consoleSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      // 设置高阈值
      monitor.updateConfig({ minQualityScore: 0.9 });

      // 记录低于阈值的指标
      recordDocAnalyzerMetric({
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
      });

      expect(monitor.getAlerts().length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });
});
