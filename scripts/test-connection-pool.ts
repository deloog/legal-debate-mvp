import {
  connectionManager,
  ConnectionManager,
  ConnectionPoolError,
} from '../src/lib/db/connection-manager';
import {
  getPoolStats,
  checkPoolHealth,
  warmupConnectionPool,
} from '../src/lib/db/connection-pool';
import { _prisma } from '../src/lib/db/prisma';

interface StressTestResult {
  testName: string;
  success: boolean;
  duration: number;
  operations: number;
  errors: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number;
  errorDetails?: string[];
}

interface PoolTestConfig {
  maxConcurrency: number;
  totalOperations: number;
  operationDelay: number;
  testDuration: number;
}

class ConnectionPoolStressTester {
  private results: StressTestResult[] = [];

  // 1. 基础并发连接测试
  async testConcurrentConnections(
    config: PoolTestConfig
  ): Promise<StressTestResult> {
    console.log(
      `🔄 开始并发连接测试 (并发数: ${config.maxConcurrency}, 操作数: ${config.totalOperations})`
    );

    const startTime = Date.now();
    const promises: Promise<void>[] = [];
    const responseTimes: number[] = [];
    const errors: string[] = [];

    for (let i = 0; i < config.totalOperations; i++) {
      const operationStart = Date.now();

      const promise = connectionManager
        .executeWithRetry(
          async connection => {
            return connection.$queryRaw`SELECT ${i} as operation_id, NOW() as timestamp`;
          },
          2 // 最多重试2次
        )
        .then(() => {
          const responseTime = Date.now() - operationStart;
          responseTimes.push(responseTime);
        })
        .catch(error => {
          errors.push(error instanceof Error ? error.message : String(error));
        });

      promises.push(promise);

      // 控制并发数
      if (promises.length >= config.maxConcurrency) {
        await Promise.race(promises);
        promises.splice(
          promises.findIndex(p => p === promise),
          1
        );
      }

      // 操作间隔
      if (config.operationDelay > 0) {
        await new Promise(resolve =>
          setTimeout(resolve, config.operationDelay)
        );
      }
    }

    await Promise.all(promises);
    const duration = Date.now() - startTime;

    const result: StressTestResult = {
      testName: '并发连接测试',
      success: errors.length === 0,
      duration,
      operations: config.totalOperations,
      errors: errors.length,
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
      maxResponseTime:
        responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      minResponseTime:
        responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      throughput: (config.totalOperations / duration) * 1000, // 操作/秒
      errorDetails: errors.slice(0, 10), // 只记录前10个错误
    };

    this.results.push(result);
    this.logResult(result);
    return result;
  }

  // 2. 连接池压力测试
  async testPoolStress(config: PoolTestConfig): Promise<StressTestResult> {
    console.log(`💪 开始连接池压力测试 (持续 ${config.testDuration}秒)`);

    const startTime = Date.now();
    const endTime = startTime + config.testDuration * 1000;
    const responseTimes: number[] = [];
    const errors: string[] = [];
    let operations = 0;

    while (Date.now() < endTime) {
      const operationStart = Date.now();

      try {
        await connectionManager.executeWithRetry(async connection => {
          // 模拟复杂查询，使用替代方案避免pg_sleep类型问题
          await new Promise(resolve => setTimeout(resolve, 10)); // 10ms延迟
          return connection.$queryRaw`
              SELECT 
                ${operations} as operation_id,
                NOW() as timestamp
            `;
        }, 2);

        const responseTime = Date.now() - operationStart;
        responseTimes.push(responseTime);
        operations++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    const duration = Date.now() - startTime;

    const result: StressTestResult = {
      testName: '连接池压力测试',
      success: errors.length === 0,
      duration,
      operations,
      errors: errors.length,
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
      maxResponseTime:
        responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      minResponseTime:
        responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      throughput: (operations / duration) * 1000,
      errorDetails: errors.slice(0, 10),
    };

    this.results.push(result);
    this.logResult(result);
    return result;
  }

  // 3. 连接泄漏检测测试
  async testConnectionLeaks(config: PoolTestConfig): Promise<StressTestResult> {
    console.log(`🔍 开始连接泄漏检测测试`);

    const startTime = Date.now();
    const initialStats = connectionManager.getStats();
    const errors: string[] = [];
    let operations = 0;

    // 故意不释放一些连接来测试泄漏检测
    const connections: any[] = [];

    for (let i = 0; i < config.maxConcurrency; i++) {
      try {
        const connection = await connectionManager.getConnection();
        connections.push(connection);
        operations++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    // 等待一段时间观察连接状态
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 释放一半连接
    const halfLength = Math.floor(connections.length / 2);
    for (let i = 0; i < halfLength; i++) {
      await connectionManager.releaseConnection(connections.pop());
    }

    // 再等待一段时间
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 释放剩余连接
    while (connections.length > 0) {
      await connectionManager.releaseConnection(connections.pop());
    }

    const finalStats = connectionManager.getStats();
    const duration = Date.now() - startTime;

    const result: StressTestResult = {
      testName: '连接泄漏检测测试',
      success: finalStats.activeConnections === 0,
      duration,
      operations,
      errors: errors.length,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: 0,
      throughput: operations / (duration / 1000),
      errorDetails: errors.slice(0, 10),
    };

    this.results.push(result);
    this.logResult(result);

    console.log(`  初始活跃连接: ${initialStats.activeConnections}`);
    console.log(`  最终活跃连接: ${finalStats.activeConnections}`);
    console.log(
      `  连接泄漏: ${finalStats.activeConnections > 0 ? '❌ 检测到泄漏' : '✅ 无泄漏'}`
    );

    return result;
  }

  // 4. 超时和重试机制测试
  async testTimeoutAndRetry(): Promise<StressTestResult> {
    console.log(`⏱️ 开始超时和重试机制测试`);

    const startTime = Date.now();
    const responseTimes: number[] = [];
    const errors: string[] = [];
    let operations = 0;

    // 测试短超时配置
    const shortTimeoutManager = new ConnectionManager({
      acquireTimeoutMillis: 1000,
      createTimeoutMillis: 500,
      createRetryIntervalMillis: 100,
      maxConnections: 2, // 设置更小的连接池便于测试
    });

    // 填满连接池
    const connections: any[] = [];
    for (let i = 0; i < 2; i++) {
      try {
        const connection = await shortTimeoutManager.getConnection();
        connections.push(connection);
        operations++;
        console.log(`  获取连接 ${i + 1}/2 成功`);
      } catch (error) {
        errors.push(
          `连接获取失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // 尝试获取更多连接（应该超时）
    console.log(`  连接池已满，尝试获取额外连接（应该超时）...`);
    for (let i = 0; i < 2; i++) {
      const operationStart = Date.now();
      try {
        await shortTimeoutManager.getConnection();
        operations++;
        console.log(`  意外成功获取连接 ${i + 1}`);
      } catch (error) {
        const responseTime = Date.now() - operationStart;
        responseTimes.push(responseTime);
        const errorMsg = `超时测试 ${i + 1}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.log(`  ${errorMsg} (${responseTime}ms)`);
      }
    }

    // 释放所有连接
    console.log(`  释放所有连接...`);
    for (const connection of connections) {
      await shortTimeoutManager.releaseConnection(connection);
    }

    await shortTimeoutManager.shutdown();
    const duration = Date.now() - startTime;

    const result: StressTestResult = {
      testName: '超时和重试机制测试',
      success: errors.some(e => e.includes('ACQUIRE_TIMEOUT')),
      duration,
      operations,
      errors: errors.length,
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
      maxResponseTime:
        responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      minResponseTime:
        responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      throughput: operations / (duration / 1000),
      errorDetails: errors.slice(0, 10),
    };

    this.results.push(result);
    this.logResult(result);
    return result;
  }

  // 5. 连接池健康检查测试
  async testHealthCheck(): Promise<StressTestResult> {
    console.log(`🏥 开始连接池健康检查测试`);

    const startTime = Date.now();
    const responseTimes: number[] = [];
    const errors: string[] = [];
    let operations = 0;

    // 多次健康检查
    for (let i = 0; i < 20; i++) {
      const operationStart = Date.now();

      try {
        const isHealthy = await checkPoolHealth();
        const responseTime = Date.now() - operationStart;
        responseTimes.push(responseTime);
        operations++;

        if (!isHealthy) {
          errors.push(`健康检查失败 #${i}`);
        }
      } catch (error) {
        errors.push(
          `健康检查异常 #${i}: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      // 间隔检查
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;

    const result: StressTestResult = {
      testName: '连接池健康检查测试',
      success: errors.length === 0,
      duration,
      operations,
      errors: errors.length,
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0,
      maxResponseTime:
        responseTimes.length > 0 ? Math.max(...responseTimes) : 0,
      minResponseTime:
        responseTimes.length > 0 ? Math.min(...responseTimes) : 0,
      throughput: operations / (duration / 1000),
      errorDetails: errors.slice(0, 10),
    };

    this.results.push(result);
    this.logResult(result);
    return result;
  }

  // 记录测试结果
  private logResult(result: StressTestResult): void {
    console.log(`\n📊 ${result.testName} 结果:`);
    console.log(`  ✅ 成功: ${result.success ? '是' : '否'}`);
    console.log(`  ⏱️ 耗时: ${result.duration}ms`);
    console.log(`  🔢 操作数: ${result.operations}`);
    console.log(`  ❌ 错误数: ${result.errors}`);
    console.log(`  📈 吞吐量: ${result.throughput.toFixed(2)} ops/sec`);
    console.log(
      `  ⚡ 平均响应时间: ${result.averageResponseTime.toFixed(2)}ms`
    );
    console.log(`  🚀 最大响应时间: ${result.maxResponseTime}ms`);
    console.log(`  🐢 最小响应时间: ${result.minResponseTime}ms`);

    if (result.errorDetails && result.errorDetails.length > 0) {
      console.log(`  🔍 错误详情:`);
      result.errorDetails.forEach(error => {
        console.log(`    - ${error}`);
      });
    }
  }

  // 生成综合报告
  generateReport(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📋 连接池压力测试综合报告');
    console.log('='.repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const totalOperations = this.results.reduce(
      (sum, r) => sum + r.operations,
      0
    );
    const totalErrors = this.results.reduce((sum, r) => sum + r.errors, 0);
    const avgThroughput =
      this.results.reduce((sum, r) => sum + r.throughput, 0) / totalTests;
    const avgResponseTime =
      this.results.reduce((sum, r) => sum + r.averageResponseTime, 0) /
      totalTests;

    console.log('\n🎯 总体统计:');
    console.log(
      `  测试通过率: ${((passedTests / totalTests) * 100).toFixed(1)}% (${passedTests}/${totalTests})`
    );
    console.log(`  总操作数: ${totalOperations}`);
    console.log(`  总错误数: ${totalErrors}`);
    console.log(`  平均吞吐量: ${avgThroughput.toFixed(2)} ops/sec`);
    console.log(`  平均响应时间: ${avgResponseTime.toFixed(2)}ms`);

    console.log('\n📊 详细结果:');
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`  ${index + 1}. ${status} ${result.testName}`);
      console.log(
        `     吞吐量: ${result.throughput.toFixed(2)} ops/sec, 响应时间: ${result.averageResponseTime.toFixed(2)}ms`
      );
    });

    console.log('\n🏆 性能评估:');
    if (avgThroughput > 100) {
      console.log('  吞吐量: ✅ 优秀 (>100 ops/sec)');
    } else if (avgThroughput > 50) {
      console.log('  吞吐量: ⚠️ 良好 (50-100 ops/sec)');
    } else {
      console.log('  吞吐量: ❌ 需要优化 (<50 ops/sec)');
    }

    if (avgResponseTime < 100) {
      console.log('  响应时间: ✅ 优秀 (<100ms)');
    } else if (avgResponseTime < 500) {
      console.log('  响应时间: ⚠️ 良好 (100-500ms)');
    } else {
      console.log('  响应时间: ❌ 需要优化 (>500ms)');
    }

    if (totalErrors === 0) {
      console.log('  错误率: ✅ 优秀 (0%)');
    } else if (totalErrors < totalOperations * 0.05) {
      console.log('  错误率: ⚠️ 良好 (<5%)');
    } else {
      console.log('  错误率: ❌ 需要优化 (>=5%)');
    }

    console.log('\n' + '='.repeat(60));
  }

  // 运行完整测试套件
  async runFullTestSuite(): Promise<void> {
    console.log('🚀 开始连接池压力测试套件...\n');

    try {
      // 预热连接池
      console.log('🔥 预热连接池...');
      await warmupConnectionPool();

      // 1. 基础并发连接测试
      await this.testConcurrentConnections({
        maxConcurrency: 20,
        totalOperations: 100,
        operationDelay: 10,
        testDuration: 0,
      });

      // 2. 连接池压力测试
      await this.testPoolStress({
        maxConcurrency: 15,
        totalOperations: 0,
        operationDelay: 0,
        testDuration: 10, // 10秒压力测试
      });

      // 3. 连接泄漏检测测试
      await this.testConnectionLeaks({
        maxConcurrency: 10,
        totalOperations: 10,
        operationDelay: 0,
        testDuration: 0,
      });

      // 4. 超时和重试机制测试
      await this.testTimeoutAndRetry();

      // 5. 连接池健康检查测试
      await this.testHealthCheck();

      // 生成综合报告
      this.generateReport();
    } catch (error) {
      console.error('❌ 测试套件执行失败:', error);
    } finally {
      // 清理资源
      try {
        await connectionManager.shutdown();
      } catch (error) {
        console.error('清理资源时出错:', error);
      }
    }
  }
}

// 执行测试
async function main() {
  const tester = new ConnectionPoolStressTester();
  await tester.runFullTestSuite();
}

// 错误处理
main().catch(error => {
  console.error('连接池压力测试执行失败:', error);
  process.exit(1);
});
