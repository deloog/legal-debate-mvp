/**
 * API性能测试脚本
 * 测试API响应时间和并发处理能力
 */

import { performance } from 'perf_hooks';

// 测试配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_ROUTES = [
  '/api/v1/debates',
  '/api/v1/debates/test-id/stream',
  '/api/health',
];

// 测试结果接口
interface TestResult {
  route: string;
  method: string;
  responseTime: number;
  statusCode: number;
  success: boolean;
  error?: string;
}

interface PerformanceReport {
  timestamp: string;
  results: TestResult[];
  summary: {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  };
}

/**
 * 执行单个API测试
 */
async function testEndpoint(
  route: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
  headers?: Record<string, string>
): Promise<TestResult> {
  const startTime = performance.now();
  let responseTime = 0;
  let statusCode = 0;
  let success = false;
  let error: string | undefined;

  try {
    const url = `${API_BASE_URL}${route}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': `perf-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...headers,
      },
    };

    if (body && method === 'POST') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    responseTime = performance.now() - startTime;
    statusCode = response.status;
    success = response.ok;

    if (!success) {
      error = await response.text();
    }
  } catch (err) {
    responseTime = performance.now() - startTime;
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return {
    route,
    method,
    responseTime,
    statusCode,
    success,
    error,
  };
}

/**
 * 并发测试
 */
async function runConcurrentTests(
  route: string,
  concurrency: number = 5
): Promise<TestResult[]> {
  console.log(`🔄 运行并发测试: ${route} (并发数: ${concurrency})`);

  const tests = Array.from({ length: concurrency }, () =>
    testEndpoint(route, 'GET', undefined, {
      'x-correlation-id': `concurrent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    })
  );

  return Promise.all(tests);
}

/**
 * 流式API测试
 */
async function testStreamAPI(route: string): Promise<TestResult> {
  const startTime = performance.now();
  let responseTime = 0;
  let statusCode = 0;
  let success = false;
  let error: string | undefined;

  try {
    const url = `${API_BASE_URL}${route}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        'x-correlation-id': `stream-test-${Date.now()}`,
      },
    });

    responseTime = performance.now() - startTime;
    statusCode = response.status;
    success = response.ok;

    if (success && response.body) {
      // 读取前几个事件来验证流是否工作
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let eventsRead = 0;
      const maxEvents = 3;

      while (eventsRead < maxEvents) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (chunk.includes('data:')) {
          eventsRead++;
        }
      }

      reader.releaseLock();
    } else if (!success) {
      error = await response.text();
    }
  } catch (err) {
    responseTime = performance.now() - startTime;
    error = err instanceof Error ? err.message : 'Unknown error';
  }

  return {
    route,
    method: 'GET',
    responseTime,
    statusCode,
    success,
    error,
  };
}

/**
 * 运行完整性能测试套件
 */
async function runPerformanceTests(): Promise<PerformanceReport> {
  console.log('🚀 开始API性能测试...\n');

  const results: TestResult[] = [];

  // 1. 基础API测试
  console.log('📊 基础API测试:');
  for (const route of TEST_ROUTES) {
    if (route.includes('stream')) continue; // 跳过流式API单独测试

    const result = await testEndpoint(route);
    results.push(result);

    const status = result.success ? '✅' : '❌';
    console.log(
      `  ${status} ${route} - ${result.responseTime.toFixed(2)}ms (${result.statusCode})`
    );
  }

  // 2. 流式API测试
  console.log('\n🌊 流式API测试:');
  const streamResult = await testStreamAPI('/api/v1/debates/test-id/stream');
  results.push(streamResult);

  const streamStatus = streamResult.success ? '✅' : '❌';
  console.log(
    `  ${streamStatus} /api/v1/debates/[id]/stream - ${streamResult.responseTime.toFixed(2)}ms (${streamResult.statusCode})`
  );

  // 3. 并发测试
  console.log('\n⚡ 并发测试:');
  for (const route of TEST_ROUTES) {
    if (route.includes('stream')) continue; // 跳过流式API并发测试

    const concurrentResults = await runConcurrentTests(route, 3);
    results.push(...concurrentResults);

    const avgTime =
      concurrentResults.reduce((sum, r) => sum + r.responseTime, 0) /
      concurrentResults.length;
    const successCount = concurrentResults.filter(r => r.success).length;
    const status = successCount === concurrentResults.length ? '✅' : '⚠️';

    console.log(
      `  ${status} ${route} (x3) - 平均 ${avgTime.toFixed(2)}ms (${successCount}/3 成功)`
    );
  }

  // 生成报告
  const successfulTests = results.filter(r => r.success).length;
  const failedTests = results.length - successfulTests;
  const responseTimes = results.map(r => r.responseTime);
  const averageResponseTime =
    responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  const report: PerformanceReport = {
    timestamp: new Date().toISOString(),
    results,
    summary: {
      totalTests: results.length,
      successfulTests,
      failedTests,
      averageResponseTime,
      maxResponseTime,
      minResponseTime,
    },
  };

  // 输出总结
  console.log('\n📈 性能测试总结:');
  console.log(`  总测试数: ${report.summary.totalTests}`);
  console.log(`  成功测试: ${report.summary.successfulTests}`);
  console.log(`  失败测试: ${report.summary.failedTests}`);
  console.log(
    `  平均响应时间: ${report.summary.averageResponseTime.toFixed(2)}ms`
  );
  console.log(`  最大响应时间: ${report.summary.maxResponseTime.toFixed(2)}ms`);
  console.log(`  最小响应时间: ${report.summary.minResponseTime.toFixed(2)}ms`);

  // 性能建议
  console.log('\n💡 性能建议:');
  if (report.summary.averageResponseTime > 1000) {
    console.log('  ⚠️  平均响应时间超过1秒，建议优化');
  }
  if (report.summary.maxResponseTime > 5000) {
    console.log('  ⚠️  最大响应时间超过5秒，可能存在性能瓶颈');
  }
  if (report.summary.failedTests > 0) {
    console.log('  ⚠️  存在失败的测试，需要检查API稳定性');
  }
  if (
    report.summary.averageResponseTime < 100 &&
    report.summary.failedTests === 0
  ) {
    console.log('  ✅ 性能表现良好');
  }

  return report;
}

/**
 * 主函数
 */
async function main() {
  try {
    const report = await runPerformanceTests();

    // 保存报告到文件
    const fs = require('fs');
    const path = require('path');

    const reportPath = path.join(process.cwd(), 'performance-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n💾 详细报告已保存到: ${reportPath}`);

    // 设置退出码
    process.exit(report.summary.failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export { runPerformanceTests, testEndpoint, runConcurrentTests, testStreamAPI };
