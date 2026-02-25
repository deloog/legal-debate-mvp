/**
 * 评估报告生成器测试
 * 遵循TDD原则：先测试后代码
 */

import {
  EvaluationReportGenerator,
  EvaluationConfig,
  EvaluationReport,
} from './evaluation-report';
import { BenchmarkResult, BenchmarkQueryType } from './benchmark-runner';
import { DataScale } from './types';

describe('EvaluationReportGenerator', () => {
  let reportGenerator: EvaluationReportGenerator;
  let testResults: BenchmarkResult[];
  let testConfig: EvaluationConfig;

  beforeEach(() => {
    reportGenerator = new EvaluationReportGenerator();

    // 创建测试基准测试结果
    testResults = [
      {
        name: '单节点查询',
        type: BenchmarkQueryType.SINGLE_NODE,
        query: 'MATCH (n) WHERE n.id = $id RETURN n',
        meanTime: 10.5,
        minTime: 8.0,
        maxTime: 15.0,
        medianTime: 10.0,
        stdDev: 2.0,
        p50: 10.0,
        p90: 13.0,
        p95: 14.0,
        p99: 14.5,
        totalRuns: 10,
        successRuns: 10,
        failedRuns: 0,
        avgResultCount: 1,
        timestamp: new Date().toISOString(),
      },
      {
        name: '路径查询',
        type: BenchmarkQueryType.PATH_QUERY,
        query: 'MATCH path = (a)-[*1..3]-(b) RETURN path',
        meanTime: 25.3,
        minTime: 20.0,
        maxTime: 35.0,
        medianTime: 24.0,
        stdDev: 4.5,
        p50: 24.0,
        p90: 30.0,
        p95: 32.0,
        p99: 34.0,
        totalRuns: 10,
        successRuns: 10,
        failedRuns: 0,
        avgResultCount: 50,
        timestamp: new Date().toISOString(),
      },
      {
        name: '聚合查询',
        type: BenchmarkQueryType.AGGREGATION,
        query: 'MATCH (n) RETURN count(n)',
        meanTime: 150.0,
        minTime: 120.0,
        maxTime: 200.0,
        medianTime: 145.0,
        stdDev: 25.0,
        p50: 145.0,
        p90: 180.0,
        p95: 190.0,
        p99: 195.0,
        totalRuns: 10,
        successRuns: 9,
        failedRuns: 1,
        avgResultCount: 1,
        timestamp: new Date().toISOString(),
      },
    ];

    // 创建测试配置
    testConfig = {
      databaseName: 'Neo4j',
      databaseVersion: '5.0.0',
      hardwareInfo: {
        cpu: 'Intel Core i7-12700K',
        memory: '32GB DDR4',
        disk: 'NVMe SSD 1TB',
      },
      datasetScale: {
        articleCount: 1000,
        relationCount: 10000,
        avgRelationsPerArticle: 10,
        averageDegree: 20,
      },
      testDate: new Date(),
    };
  });

  describe('生成评估报告', () => {
    it('应该成功生成评估报告', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);

      expect(report).toBeDefined();
      expect(report.config).toEqual(testConfig);
      expect(report.metrics).toBeDefined();
      expect(report.queryPerformances).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.timestamp).toBeDefined();
    });

    it('应该正确计算性能指标', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);

      expect(report.metrics.avgQueryTime).toBeGreaterThan(0);
      expect(report.metrics.minQueryTime).toBeGreaterThan(0);
      expect(report.metrics.maxQueryTime).toBeGreaterThan(0);
      expect(report.metrics.queryTimeStdDev).toBeGreaterThanOrEqual(0);
      expect(report.metrics.queriesPerSecond).toBeGreaterThan(0);
      expect(report.metrics.totalQueries).toBe(30); // 3个查询 × 10次运行
      expect(report.metrics.successRate).toBeGreaterThan(0);
      expect(report.metrics.stabilityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics.stabilityScore).toBeLessThanOrEqual(100);
      expect(report.metrics.scalabilityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics.scalabilityScore).toBeLessThanOrEqual(100);
      expect(report.metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics.overallScore).toBeLessThanOrEqual(100);
    });

    it('应该正确分析查询性能', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);

      expect(report.queryPerformances).toHaveLength(3);
      expect(report.queryPerformances[0].rank).toBe(1); // 最快的查询
      expect(report.queryPerformances[2].rank).toBe(3); // 最慢的查询
      expect(report.queryPerformances[0].avgTime).toBeLessThan(
        report.queryPerformances[1].avgTime
      );
    });

    it('应该生成合理的优化建议', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);

      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('优化'))).toBe(true);
    });
  });

  describe('生成Markdown报告', () => {
    it('应该生成格式正确的Markdown报告', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const markdown = reportGenerator.generateMarkdownReport(report);

      expect(markdown).toBeDefined();
      expect(markdown).toContain('# 图数据库性能评估报告');
      expect(markdown).toContain('## 评估信息');
      expect(markdown).toContain('## 评估指标');
      expect(markdown).toContain('## 查询性能详情');
      expect(markdown).toContain('## 优化建议');
      expect(markdown).toContain(testConfig.databaseName);
      expect(markdown).toContain(testConfig.databaseVersion);
    });

    it('应该包含所有必要的性能指标', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const markdown = reportGenerator.generateMarkdownReport(report);

      expect(markdown).toContain('平均查询时间');
      expect(markdown).toContain('最小查询时间');
      expect(markdown).toContain('最大查询时间');
      expect(markdown).toContain('查询时间标准差');
      expect(markdown).toContain('每秒查询数');
      expect(markdown).toContain('总查询数');
      expect(markdown).toContain('成功率');
      expect(markdown).toContain('稳定性评分');
      expect(markdown).toContain('扩展性评分');
      expect(markdown).toContain('综合评分');
    });

    it('应该包含查询性能表格', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const markdown = reportGenerator.generateMarkdownReport(report);

      expect(markdown).toContain('| 排名 |');
      expect(markdown).toContain('| 查询名称 |');
      expect(markdown).toContain('| 类型 |');
      expect(markdown).toContain('| 平均时间 |');
      expect(markdown).toContain('| 最小时间 |');
      expect(markdown).toContain('| 最大时间 |');
      expect(markdown).toContain('| 标准差 |');

      // 检查具体查询
      expect(markdown).toContain('单节点查询');
      expect(markdown).toContain('路径查询');
      expect(markdown).toContain('聚合查询');
    });

    it('应该包含性能等级', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const markdown = reportGenerator.generateMarkdownReport(report);

      expect(markdown).toContain('### 性能等级');
      expect(markdown).toMatch(/🥇|🥈|🥉|❌/);
      expect(markdown).toMatch(/A\+|A|B|C|D/);
    });

    it('应该包含优化建议', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const markdown = reportGenerator.generateMarkdownReport(report);

      expect(markdown).toContain('## 优化建议');
      expect(markdown).toMatch(/\d+\.\s+/); // 编号列表
    });
  });

  describe('生成JSON报告', () => {
    it('应该生成格式正确的JSON报告', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const json = reportGenerator.generateJsonReport(report);

      expect(json).toBeDefined();
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('config');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('queryPerformances');
      expect(parsed).toHaveProperty('recommendations');
      expect(parsed).toHaveProperty('timestamp');
    });

    it('JSON应该可以解析为原始报告', () => {
      const report = reportGenerator.generateReport(testResults, testConfig);
      const json = reportGenerator.generateJsonReport(report);
      const parsed = JSON.parse(json) as EvaluationReport;

      expect(parsed.config.databaseName).toBe(testConfig.databaseName);
      expect(parsed.config.databaseVersion).toBe(testConfig.databaseVersion);
      expect(parsed.metrics.overallScore).toBe(report.metrics.overallScore);
    });
  });

  describe('边界情况', () => {
    it('应该处理空的测试结果', () => {
      const report = reportGenerator.generateReport([], testConfig);

      expect(report.metrics.avgQueryTime).toBe(0);
      expect(report.metrics.minQueryTime).toBe(0);
      expect(report.metrics.maxQueryTime).toBe(0);
      expect(report.metrics.queryTimeStdDev).toBe(0);
      expect(report.metrics.queriesPerSecond).toBe(0);
      expect(report.metrics.totalQueries).toBe(0);
      expect(report.metrics.successRate).toBe(0);
      expect(report.metrics.stabilityScore).toBe(0);
      expect(report.metrics.scalabilityScore).toBe(0);
      expect(report.metrics.overallScore).toBe(0);
    });

    it('应该处理失败的查询', () => {
      const failedResults: BenchmarkResult[] = [
        {
          name: '失败查询',
          type: BenchmarkQueryType.SINGLE_NODE,
          query: 'INVALID QUERY',
          meanTime: 0,
          minTime: 0,
          maxTime: 0,
          medianTime: 0,
          stdDev: 0,
          totalRuns: 10,
          successRuns: 0,
          failedRuns: 10,
          avgResultCount: 0,
          timestamp: new Date().toISOString(),
        },
      ];

      const report = reportGenerator.generateReport(failedResults, testConfig);

      expect(report.metrics.successRate).toBe(0);
      expect(report.metrics.overallScore).toBeLessThan(60); // 应该是低分
    });

    it('应该处理高性能查询', () => {
      const highPerfResults: BenchmarkResult[] = [
        {
          name: '高性能查询',
          type: BenchmarkQueryType.SINGLE_NODE,
          query: 'MATCH (n) RETURN n',
          meanTime: 10.0,
          minTime: 8.0,
          maxTime: 12.0,
          medianTime: 10.0,
          stdDev: 1.0,
          totalRuns: 10,
          successRuns: 10,
          failedRuns: 0,
          avgResultCount: 10,
          timestamp: new Date().toISOString(),
        },
      ];

      const report = reportGenerator.generateReport(highPerfResults, testConfig);

      expect(report.metrics.avgQueryTime).toBeLessThan(20);
      expect(report.metrics.successRate).toBe(100);
      expect(report.metrics.stabilityScore).toBeGreaterThan(75);
      expect(report.metrics.overallScore).toBeGreaterThan(75);
    });
  });

  describe('性能等级评估', () => {
    it('应该正确评估优秀性能', () => {
      // 使用多个查询类型以提高扩展性评分
      const excellentResults: BenchmarkResult[] = [
        {
          name: '优秀单节点查询',
          type: BenchmarkQueryType.SINGLE_NODE,
          query: 'MATCH (n) RETURN n',
          meanTime: 1.0,
          minTime: 0.8,
          maxTime: 1.2,
          medianTime: 1.0,
          stdDev: 0.1,
          totalRuns: 10,
          successRuns: 10,
          failedRuns: 0,
          avgResultCount: 10,
          timestamp: new Date().toISOString(),
        },
        {
          name: '优秀路径查询',
          type: BenchmarkQueryType.PATH_QUERY,
          query: 'MATCH path = (a)-[*1..2]-(b) RETURN path',
          meanTime: 2.0,
          minTime: 1.8,
          maxTime: 2.2,
          medianTime: 2.0,
          stdDev: 0.15,
          totalRuns: 10,
          successRuns: 10,
          failedRuns: 0,
          avgResultCount: 50,
          timestamp: new Date().toISOString(),
        },
        {
          name: '优秀聚合查询',
          type: BenchmarkQueryType.AGGREGATION,
          query: 'MATCH (n) RETURN count(n)',
          meanTime: 3.0,
          minTime: 2.8,
          maxTime: 3.2,
          medianTime: 3.0,
          stdDev: 0.15,
          totalRuns: 10,
          successRuns: 10,
          failedRuns: 0,
          avgResultCount: 1,
          timestamp: new Date().toISOString(),
        },
      ];

      const report = reportGenerator.generateReport(excellentResults, testConfig);
      const markdown = reportGenerator.generateMarkdownReport(report);

      // 验证性能指标优秀
      expect(report.metrics.avgQueryTime).toBeLessThan(5);
      expect(report.metrics.successRate).toBe(100);
      expect(report.metrics.stabilityScore).toBeGreaterThan(85);
      expect(markdown).toMatch(/A\+|A/);
    });

    it('应该正确评估中等性能', () => {
      const mediumResults: BenchmarkResult[] = [
        {
          name: '中等查询',
          type: BenchmarkQueryType.SINGLE_NODE,
          query: 'MATCH (n) RETURN n',
          meanTime: 50.0,
          minTime: 40.0,
          maxTime: 60.0,
          medianTime: 50.0,
          stdDev: 5.0,
          totalRuns: 10,
          successRuns: 10,
          failedRuns: 0,
          avgResultCount: 10,
          timestamp: new Date().toISOString(),
        },
      ];

      const report = reportGenerator.generateReport(mediumResults, testConfig);

      expect(report.metrics.overallScore).toBeGreaterThanOrEqual(70);
      expect(report.metrics.overallScore).toBeLessThan(90);
    });

    it('应该正确评估低性能', () => {
      const lowResults: BenchmarkResult[] = [
        {
          name: '低性能查询',
          type: BenchmarkQueryType.SINGLE_NODE,
          query: 'MATCH (n) RETURN n',
          meanTime: 200.0,
          minTime: 150.0,
          maxTime: 300.0,
          medianTime: 200.0,
          stdDev: 50.0,
          totalRuns: 10,
          successRuns: 8,
          failedRuns: 2,
          avgResultCount: 10,
          timestamp: new Date().toISOString(),
        },
      ];

      const report = reportGenerator.generateReport(lowResults, testConfig);

      expect(report.metrics.overallScore).toBeLessThan(70);
    });
  });
});
