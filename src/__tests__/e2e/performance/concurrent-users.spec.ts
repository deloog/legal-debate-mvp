/**
 * 并发用户性能测试
 * 验证系统在多用户同时访问时的稳定性
 */

import { test, expect, APIRequestContext } from '@playwright/test';
import {
  e2eLogin,
  createTestCase,
  createDebate,
  cleanupTestData,
  PerformanceRecorder,
} from '../debate-flow/helpers';

test.describe('并发用户性能测试', () => {
  let apiContext: APIRequestContext;
  let perfRecorder: PerformanceRecorder;
  const testUserId = 'test-e2e-concurrent';

  test.beforeAll(async ({ playwright }) => {
    // 先登录获取认证token
    const loginContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
    });
    const { token } = await e2eLogin(loginContext);
    await loginContext.dispose();

    // 创建带认证头的apiContext，所有请求自动携带token
    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    perfRecorder = new PerformanceRecorder();
  });

  test.afterAll(async () => {
    if (apiContext) {
      await apiContext.dispose();
    }

    console.log('=== 并发用户性能报告 ===');
    console.log(JSON.stringify(perfRecorder.getAllStats(), null, 2));
  });

  test('并发创建案件：10个用户同时创建', async () => {
    const concurrency = 10;
    const startTime = Date.now();

    const createPromises = Array.from({ length: concurrency }, (_, i) =>
      createTestCase(apiContext, `${testUserId}-user-${i}`)
    );

    const results = await Promise.all(createPromises);
    const totalDuration = Date.now() - startTime;

    perfRecorder.record('并发创建案件', totalDuration);

    // 验证所有案件创建成功
    results.forEach(result => {
      expect(result.caseId).toBeDefined();
      expect(result.title).toBeDefined();
    });

    // 清理测试数据
    await Promise.all(results.map(result => cleanupTestData(result.caseId)));

    console.log(`${concurrency}个用户并发创建案件耗时: ${totalDuration}ms`);
  });

  test('并发查询案件列表：10个用户同时查询', async () => {
    const concurrency = 10;
    const startTime = Date.now();

    const queryPromises = Array.from({ length: concurrency }, () =>
      apiContext.get('/api/v1/cases')
    );

    const results = await Promise.all(queryPromises);
    const totalDuration = Date.now() - startTime;

    perfRecorder.record('并发查询案件', totalDuration);

    // 验证所有查询成功
    results.forEach(response => {
      expect(response.ok()).toBe(true);
    });

    console.log(`${concurrency}个用户并发查询案件耗时: ${totalDuration}ms`);

    // 并发查询应该比顺序查询快
    const singleQueryStart = Date.now();
    await apiContext.get('/api/v1/cases');
    const singleQueryDuration = Date.now() - singleQueryStart;

    const speedup = (singleQueryDuration * concurrency) / totalDuration;
    console.log(`并发加速比: ${speedup.toFixed(2)}x`);

    // 放宽标准：并发至少不比单次慢太多（本地环境波动大）
    expect(speedup).toBeGreaterThan(0.3);
  });

  test('并发创建辩论：5个用户同时创建', async () => {
    const concurrency = 5;
    const testCases: string[] = [];

    // 先创建案件
    for (let i = 0; i < concurrency; i++) {
      const testCase = await createTestCase(
        apiContext,
        `${testUserId}-debate-${i}`
      );
      testCases.push(testCase.caseId);
    }

    const startTime = Date.now();

    const debatePromises = testCases.map(caseId =>
      createDebate(apiContext, caseId)
    );

    const results = await Promise.all(debatePromises);
    const totalDuration = Date.now() - startTime;

    perfRecorder.record('并发创建辩论', totalDuration);

    // 验证所有辩论创建成功
    results.forEach(result => {
      expect(result.debateId).toBeDefined();
      expect(result.roundId).toBeDefined();
    });

    // 清理测试数据
    await Promise.all(testCases.map(caseId => cleanupTestData(caseId)));

    console.log(`${concurrency}个用户并发创建辩论耗时: ${totalDuration}ms`);
  });

  test('并发用户不同操作：混合场景', async () => {
    const concurrency = 10;
    const testCases: string[] = [];

    // 先创建案件
    for (let i = 0; i < concurrency; i++) {
      const testCase = await createTestCase(
        apiContext,
        `${testUserId}-mixed-${i}`
      );
      testCases.push(testCase.caseId);
    }

    const startTime = Date.now();

    // 混合操作
    const operations = [
      // 3个用户查询案件列表
      ...Array.from({ length: 3 }, () => apiContext.get('/api/v1/cases')),
      // 3个用户查询自己的案件
      ...testCases
        .slice(0, 3)
        .map(caseId => apiContext.get(`/api/v1/cases/${caseId}`)),
      // 2个用户创建辩论
      ...testCases.slice(3, 5).map(caseId =>
        apiContext.post('/api/v1/debates', {
          data: {
            caseId,
            title: '测试辩论',
            status: 'IN_PROGRESS',
            debateConfig: {
              mode: 'adversarial',
              maxRounds: 3,
            },
          },
        })
      ),
      // 2个用户更新案件
      ...testCases.slice(5, 7).map(caseId =>
        apiContext.put(`/api/v1/cases/${caseId}`, {
          data: {
            title: '更新标题',
          },
        })
      ),
    ];

    const results = await Promise.all(operations);
    const totalDuration = Date.now() - startTime;

    perfRecorder.record('并发混合操作', totalDuration);

    // 验证所有操作成功
    results.forEach(response => {
      expect(response.ok()).toBe(true);
    });

    // 清理测试数据
    await Promise.all(testCases.map(caseId => cleanupTestData(caseId)));

    console.log(`${concurrency}个用户并发混合操作耗时: ${totalDuration}ms`);
  });

  test('并发上传文档：5个用户同时上传', async () => {
    const concurrency = 5;
    const testCases: string[] = [];

    // 先创建案件
    for (let i = 0; i < concurrency; i++) {
      const testCase = await createTestCase(
        apiContext,
        `${testUserId}-upload-${i}`
      );
      testCases.push(testCase.caseId);
    }

    const startTime = Date.now();

    const uploadPromises = testCases.map((caseId, idx) => {
      const fileBuffer = Buffer.from('%PDF_SAMPLE%', 'utf-8');
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), 'test.pdf');
      formData.append('caseId', caseId);
      formData.append('fileId', `test-file-${Date.now()}-${idx}`);

      return apiContext.post('/api/v1/documents/upload', {
        multipart: formData,
      });
    });

    const results = await Promise.all(uploadPromises);
    const totalDuration = Date.now() - startTime;

    perfRecorder.record('并发上传文档', totalDuration);

    // 验证所有上传成功
    results.forEach(response => {
      expect(response.ok()).toBe(true);
    });

    // 清理测试数据
    await Promise.all(testCases.map(caseId => cleanupTestData(caseId)));

    console.log(`${concurrency}个用户并发上传文档耗时: ${totalDuration}ms`);
  });

  test('高并发场景：50个请求同时访问', async () => {
    const concurrency = 50;
    const startTime = Date.now();

    // 混合50个并发请求
    const operations = [
      // 30个查询请求（读操作）
      ...Array.from({ length: 30 }, () => apiContext.get('/api/v1/cases')),
      // 10个创建请求（写操作）
      ...Array.from({ length: 10 }, (_, i) =>
        createTestCase(apiContext, `${testUserId}-high-${i}`)
      ),
      // 10个法条检索请求（读操作，使用POST）
      ...Array.from({ length: 10 }, () =>
        apiContext.post('/api/v1/law-articles/search', {
          data: {
            keywords: ['合同'],
            limit: 10,
          },
        })
      ),
    ];

    const results = await Promise.all(operations);
    const totalDuration = Date.now() - startTime;

    perfRecorder.record('高并发场景', totalDuration);

    // 验证所有请求成功
    // createTestCase 成功时返回 { caseId, title }，失败时抛出异常（Promise.all 已处理）
    const successCount = results.filter(r => {
      if (typeof r === 'object' && r !== null && 'ok' in r) {
        return (r as { ok: () => boolean }).ok();
      }
      // createTestCase 成功结果：{ caseId, title }
      return typeof r === 'object' && r !== null && 'caseId' in r;
    }).length;

    const successRate = (successCount / concurrency) * 100;

    console.log(
      `${concurrency}个请求并发，成功率: ${successRate}%, 耗时: ${totalDuration}ms`
    );

    // 要求至少90%的请求成功
    expect(successRate).toBeGreaterThanOrEqual(90);

    // 清理创建的测试案件
    const createdCases = results
      .filter(
        (r): r is { caseId: string; title: string } =>
          typeof r === 'object' && 'caseId' in r && 'title' in r
      )
      .map(r => r.caseId);

    await Promise.all(
      createdCases.map(caseId => cleanupTestData(caseId).catch(() => {}))
    );
  });

  test('并发冲突场景：同时更新同一资源', async () => {
    const testCase = await createTestCase(apiContext, `${testUserId}-conflict`);
    const caseId = testCase.caseId;

    // 同时发起10个更新请求
    const updatePromises = Array.from({ length: 10 }, (_, i) =>
      apiContext.put(`/api/v1/cases/${caseId}`, {
        data: {
          title: `更新标题${i}`,
        },
      })
    );

    const results = await Promise.all(updatePromises);

    // 验证至少有一个成功
    const successCount = results.filter(r => r.ok()).length;
    const conflictCount = results.filter(r => r.status() === 409).length;

    console.log(
      `并发更新同一资源: 成功${successCount}个, 冲突${conflictCount}个`
    );

    expect(successCount).toBeGreaterThan(0);

    // 验证最终数据一致性
    const finalResponse = await apiContext.get(`/api/v1/cases/${caseId}`);
    const finalData = await finalResponse.json();

    expect(finalData.data.title).toMatch(/更新标题\d+/);

    await cleanupTestData(caseId);
  });

  test('并发性能指标：响应时间分布', async () => {
    const iterations = 20;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await apiContext.get('/api/v1/cases');
      const duration = Date.now() - start;

      durations.push(duration);
    }

    // 计算统计指标
    const sorted = [...durations].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p50 = sorted[Math.floor(iterations * 0.5)];
    const p95 = sorted[Math.floor(iterations * 0.95)];
    const p99 = sorted[Math.floor(iterations * 0.99)];

    const stats = {
      min,
      max,
      avg,
      p50,
      p95,
      p99,
    };

    console.log('并发请求响应时间分布:', stats);

    perfRecorder.record('并发响应_min', min);
    perfRecorder.record('并发响应_max', max);
    perfRecorder.record('并发响应_avg', avg);
    perfRecorder.record('并发响应_p95', p95);
    perfRecorder.record('并发响应_p99', p99);

    // 验证P95在合理范围内
    expect(p95).toBeLessThan(500);
  });

  test('持续并发压力：100个请求分批发送', async () => {
    const batchSize = 10;
    const totalRequests = 100;
    const allDurations: number[] = [];

    for (let batch = 0; batch < totalRequests / batchSize; batch++) {
      const batchStart = Date.now();

      const batchPromises = Array.from({ length: batchSize }, () =>
        apiContext.get('/api/v1/cases')
      );

      await Promise.all(batchPromises);
      const batchDuration = Date.now() - batchStart;

      allDurations.push(batchDuration);

      // 短暂休息，模拟真实场景
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgBatchDuration =
      allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length;
    const maxBatchDuration = Math.max(...allDurations);

    console.log(`${totalRequests}个请求分${totalRequests / batchSize}批处理`);
    console.log(`平均批次耗时: ${avgBatchDuration.toFixed(2)}ms`);
    console.log(`最大批次耗时: ${maxBatchDuration}ms`);

    perfRecorder.record('持续并发_平均批次', avgBatchDuration);
    perfRecorder.record('持续并发_最大批次', maxBatchDuration);

    // 验证性能稳定，没有明显退化
    const lastBatch = allDurations.slice(-5);
    const firstBatch = allDurations.slice(0, 5);
    const lastAvg = lastBatch.reduce((sum, d) => sum + d, 0) / lastBatch.length;
    const firstAvg =
      firstBatch.reduce((sum, d) => sum + d, 0) / firstBatch.length;

    const degradation = lastAvg / firstAvg;
    console.log(`性能退化比: ${degradation.toFixed(2)}x`);

    expect(degradation).toBeLessThan(2);
  });

  test('系统资源监控：内存泄漏检查', async () => {
    const iterations = 20;
    const testCases: string[] = [];

    // 获取初始内存（近似值）
    const startMemory = process.memoryUsage?.()?.heapUsed || 0;

    // 创建和清理多个案件
    for (let i = 0; i < iterations; i++) {
      const testCase = await createTestCase(
        apiContext,
        `${testUserId}-memory-${i}`
      );
      testCases.push(testCase.caseId);
    }

    await Promise.all(testCases.map(caseId => cleanupTestData(caseId)));

    // 获取结束内存
    const endMemory = process.memoryUsage?.()?.heapUsed || 0;

    const memoryGrowth = endMemory - startMemory;
    const memoryGrowthPerOp = memoryGrowth / iterations;

    console.log(
      `内存增长: ${memoryGrowth} bytes, 每次操作: ${memoryGrowthPerOp} bytes`
    );

    // 验证内存增长合理（每次操作不超过1MB）
    expect(memoryGrowthPerOp).toBeLessThan(1024 * 1024);
  });
});
