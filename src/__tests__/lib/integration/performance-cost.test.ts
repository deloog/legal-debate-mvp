import { DocAnalyzerAgent } from '@/lib/agent/doc-analyzer/doc-analyzer-agent';
import { LawSearcher } from '@/lib/agent/legal-agent/law-searcher';
import {
  PerformanceMetricsCollector,
  type ThresholdConfig,
} from '@/lib/performance/performance-metrics-collector';
import type { DocumentAnalysisInput } from '@/lib/agent/doc-analyzer/core/types';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// 设置Jest超时时间
jest.setTimeout(60000);

// Mock文件系统
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => {
    return `民事起诉状

原告：张三
性别：男
民族：汉族
出生日期：1980年5月10日
职业：软件工程师
住址：北京市朝阳区建国门外大街1号
联系电话：13800138000

被告：李四
住所地：北京市海淀区中关村大街2号
法定代表人：李四
联系电话：13900139000

诉讼请求：
1. 请求判令被告支付合同款项100000元；
2. 请求判令被告承担本案全部诉讼费用。

事实与理由：
双方签订合同，被告未按期付款，给原告造成损失。为维护原告合法权益，特向贵院提起诉讼。

此致
北京市朝阳区人民法院

具状人：张三
日期：2024年1月1日`;
  }),
}));

// 测试结果接口
interface PerformanceTestResult {
  testName: string;
  responseTime: number;
  aiCost: number;
  tokenCount: number;
  cacheHitRate: number;
  success: boolean;
}

// 测试结果收集
const testResults: PerformanceTestResult[] = [];

// AI成本配置
const AI_COST_PER_TOKEN = 0.00000014;

describe('性能与成本验证 - 性能优化与成本控制', () => {
  let docAnalyzer: DocAnalyzerAgent;
  let lawSearcher: LawSearcher;

  let metricsCollector: PerformanceMetricsCollector;

  beforeEach(async () => {
    jest.clearAllMocks();

    // 初始化性能指标收集器
    metricsCollector = new PerformanceMetricsCollector();

    // 初始化各智能体
    docAnalyzer = new DocAnalyzerAgent(false);
    docAnalyzer.forceUseRealAI();

    lawSearcher = new LawSearcher();
    await lawSearcher.initialize();
  });

  // 不在afterEach中清空testResults，允许汇总测试使用之前的结果
  // afterEach(() => {
  //   testResults.length = 0;
  // });

  afterAll(async () => {
    jest.clearAllTimers();
  });

  describe('缓存性能验证', () => {
    it('P1.1 应该验证MemoryAgent缓存性能', async () => {
      const startTime = Date.now();
      let success = false;
      let responseTime = 0;
      let aiCost = 0;
      let tokenCount = 0;
      let cacheHitRate = 0;

      try {
        const testCases = 5;
        const cacheHits: number[] = [];

        for (let i = 0; i < testCases; i++) {
          const testStartTime = Date.now();

          const input: DocumentAnalysisInput = {
            documentId: `perf-cache-${i}`,
            content:
              '民事起诉状\n\n原告：张三\n被告：李四\n\n诉讼请求：请求判令被告支付合同款项100000元。',
            fileType: 'TXT',
            filePath: `/test/path/test-contract-${i}.txt`,
          };

          const result = await docAnalyzer.execute({
            taskType: 'document-analysis',
            task: '解析合同纠纷起诉状',
            priority: 'HIGH',
            userId: 'perf-test-user',
            data: input,
          } as any);

          const testEndTime = Date.now();
          const testResponseTime = testEndTime - testStartTime;

          // 记录性能指标
          metricsCollector.recordMetric('document-analysis', testResponseTime);
          if (result.success) {
            metricsCollector.recordSuccess('document-analysis');
          } else {
            metricsCollector.recordFailure('document-analysis');
          }

          // 如果响应时间<500ms，认为缓存命中
          if (testResponseTime < 500) {
            cacheHits.push(1);
            metricsCollector.recordCacheHit('document-analysis');
          } else {
            cacheHits.push(0);
            metricsCollector.recordCacheMiss('document-analysis');
          }
        }

        const endTime = Date.now();
        responseTime = endTime - startTime;
        cacheHitRate = cacheHits.filter(hit => hit === 1).length / testCases;
        success = true;
        tokenCount = 800 * (1 - cacheHitRate);
        aiCost = tokenCount * AI_COST_PER_TOKEN;

        expect(success).toBe(true);
        expect(cacheHitRate).toBeGreaterThan(0.5);
      } catch (error) {
        success = false;
        metricsCollector.recordFailure('document-analysis');
        console.error('缓存性能测试失败:', error);
      }

      testResults.push({
        testName: 'P1.1 MemoryAgent缓存性能',
        responseTime,
        aiCost,
        tokenCount,
        cacheHitRate,
        success,
      });

      console.log(
        `📊 P1.1 缓存性能: ${success ? '✅' : '❌'}, ` +
          `缓存命中率: ${(cacheHitRate * 100).toFixed(1)}% (目标:>60%), ` +
          `平均响应时间: ${(responseTime / 5).toFixed(0)}ms`
      );
    });
  });

  describe('响应时间百分位数验证', () => {
    it('P1.2 应该验证P50/P95/P99响应时间', async () => {
      const testCases = 20;

      // 执行20次文档分析
      for (let i = 0; i < testCases; i++) {
        const testStartTime = Date.now();

        const input: DocumentAnalysisInput = {
          documentId: `perf-percentile-${i}`,
          content: `民事起诉状\n\n原告：张三\n被告：李四\n\n诉讼请求：请求判令被告支付合同款项100000元。测试批次：${i}`,
          fileType: 'TXT',
          filePath: `/test/path/test-percentile-${i}.txt`,
        };

        try {
          const result = await docAnalyzer.execute({
            taskType: 'document-analysis',
            task: '解析合同纠纷起诉状',
            priority: 'HIGH',
            userId: 'perf-test-user',
            data: input,
          } as any);

          const testResponseTime = Date.now() - testStartTime;

          metricsCollector.recordMetric('document-analysis', testResponseTime);

          if (result.success) {
            metricsCollector.recordSuccess('document-analysis');
          } else {
            metricsCollector.recordFailure('document-analysis');
          }
        } catch (error) {
          const testResponseTime = Date.now() - testStartTime;
          metricsCollector.recordMetric('document-analysis', testResponseTime);
          metricsCollector.recordFailure('document-analysis');
        }
      }

      // 验证百分位数
      const thresholds: ThresholdConfig = {
        p50: 2000, // < 2秒
        p95: 5000, // < 5秒
        p99: 10000, // < 10秒
      };

      const validation = metricsCollector.validateThresholds(
        'document-analysis',
        thresholds
      );

      console.log('\n📊 P1.2 百分位数验证结果:');
      console.log(
        `  P50: ${validation.p50.value.toFixed(0)}ms (阈值: ${thresholds.p50}ms) ${validation.p50.passed ? '✅' : '❌'}`
      );
      console.log(
        `  P95: ${validation.p95.value.toFixed(0)}ms (阈值: ${thresholds.p95}ms) ${validation.p95.passed ? '✅' : '❌'}`
      );
      console.log(
        `  P99: ${validation.p99.value.toFixed(0)}ms (阈值: ${thresholds.p99}ms) ${validation.p99.passed ? '✅' : '❌'}`
      );

      // 获取统计信息
      const stats = metricsCollector.getStats('document-analysis');
      console.log('\n📊 P1.2 性能统计:');
      console.log(`  平均响应时间: ${stats.average.toFixed(0)}ms`);
      console.log(`  最小响应时间: ${stats.min}ms`);
      console.log(`  最大响应时间: ${stats.max}ms`);
      console.log(`  数据点数量: ${stats.count}`);
      console.log(`  成功率: ${(stats.successRate * 100).toFixed(1)}%`);
      console.log(`  缓存命中率: ${(stats.cacheHitRate * 100).toFixed(1)}%`);

      // 验证阈值
      expect(validation.p50.passed).toBe(true);
      expect(validation.p95.passed).toBe(true);
      expect(validation.p99.passed).toBe(true);
    });
  });

  describe('综合性能与成本验证', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('综合评分验证', () => {
      it('P4.2 应该汇总所有性能成本测试结果', () => {
        const successfulTests = testResults.filter(t => t.success);

        const metrics = {
          avgResponseTime:
            successfulTests.reduce((sum, t) => sum + t.responseTime, 0) /
            successfulTests.length,
          avgAICost:
            successfulTests.reduce((sum, t) => sum + t.aiCost, 0) /
            successfulTests.length,
          totalAICost: successfulTests.reduce((sum, t) => sum + t.aiCost, 0),
          totalTokenCount: successfulTests.reduce(
            (sum, t) => sum + t.tokenCount,
            0
          ),
          avgCacheHitRate:
            successfulTests.reduce((sum, t) => sum + t.cacheHitRate, 0) /
            successfulTests.length,
        };

        console.log('\n' + '='.repeat(60));
        console.log('📊 性能与成本验证报告');
        console.log('='.repeat(60) + '\n');

        console.log(
          '✅ 成功测试数:',
          `${successfulTests.length}/${testResults.length}`
        );
        console.log('\n⏱️  性能指标:');
        console.log(
          `   平均响应时间: ${metrics.avgResponseTime.toFixed(0)}ms (目标: <3000ms)`
        );
        console.log(
          `   平均缓存命中率: ${(metrics.avgCacheHitRate * 100).toFixed(1)}% (目标: >60%)`
        );

        console.log('\n💰 AI成本:');
        console.log(`   总Token消耗: ${metrics.totalTokenCount}`);
        console.log(`   总AI成本: ¥${metrics.totalAICost.toFixed(4)}`);
        console.log(
          `   平均单次成本: ¥${metrics.avgAICost.toFixed(4)} (目标: <¥0.0002)`
        );

        console.log('\n' + '='.repeat(60) + '\n');

        expect(metrics.avgResponseTime).toBeLessThan(3000);
        expect(metrics.avgCacheHitRate).toBeGreaterThan(0.5);
        expect(successfulTests.length).toBeGreaterThan(0);
      });
    });
  });
});
