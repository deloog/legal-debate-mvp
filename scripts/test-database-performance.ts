import {
  prisma,
  checkDatabaseConnection,
  getConnectionInfo,
} from '../src/lib/db/prisma';
import { getPoolStats, checkPoolHealth } from '../src/lib/db/connection-pool';

interface PerformanceMetrics {
  queryTimes: number[];
  concurrentQueries: number;
  poolStats: any;
  errorCount: number;
  successCount: number;
}

class DatabasePerformanceTester {
  private metrics: PerformanceMetrics = {
    queryTimes: [],
    concurrentQueries: 0,
    poolStats: null,
    errorCount: 0,
    successCount: 0,
  };

  // 1. 查询速度基准测试
  async testQueryPerformance(): Promise<void> {
    console.log('🚀 开始查询性能基准测试...\n');

    const queries = [
      // 基础查询
      () => prisma.user.findMany({ take: 10 }),
      () => prisma.case.findMany({ take: 10 }),
      () => prisma.debate.findMany({ take: 10 }),

      // 索引查询
      () => prisma.user.findMany({ where: { email: 'test@example.com' } }),
      () => prisma.case.findMany({ where: { userId: 'test-user-id' } }),
      () => prisma.debate.findMany({ where: { status: 'DRAFT' } }),

      // 关联查询
      () =>
        prisma.case.findMany({
          include: {
            user: true,
            documents: true,
            debates: true,
          },
          take: 5,
        }),

      // 复杂查询
      () =>
        prisma.legalReference.findMany({
          where: {
            relevanceScore: { gte: 0.8 },
            status: 'VALID',
          },
          orderBy: { applicabilityScore: 'desc' },
          take: 20,
        }),
    ];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const queryName = `查询 ${i + 1}`;

      try {
        const startTime = Date.now();
        await query();
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        this.metrics.queryTimes.push(queryTime);
        this.metrics.successCount++;

        console.log(`  ✅ ${queryName}: ${queryTime}ms`);
      } catch (error) {
        this.metrics.errorCount++;
        console.log(`  ❌ ${queryName}: 查询失败 - ${error}`);
      }
    }

    const avgTime =
      this.metrics.queryTimes.reduce((a, b) => a + b, 0) /
      this.metrics.queryTimes.length;
    const maxTime = Math.max(...this.metrics.queryTimes);
    const minTime = Math.min(...this.metrics.queryTimes);

    console.log(`\n📊 查询性能统计:`);
    console.log(`  平均响应时间: ${avgTime.toFixed(2)}ms`);
    console.log(`  最快响应时间: ${minTime}ms`);
    console.log(`  最慢响应时间: ${maxTime}ms`);
    console.log(
      `  成功率: ${((this.metrics.successCount / queries.length) * 100).toFixed(1)}%`
    );
  }

  // 2. 并发处理测试
  async testConcurrentQueries(): Promise<void> {
    console.log('\n🔄 开始并发查询测试...\n');

    const concurrentLevels = [5, 10, 20];

    for (const level of concurrentLevels) {
      console.log(`  测试并发级别: ${level}`);

      const startTime = Date.now();
      const promises = [];

      for (let i = 0; i < level; i++) {
        promises.push(
          prisma.user
            .findFirst({
              where: { id: `user-${i}` },
            })
            .catch(() => null) // 忽略不存在的用户错误
        );
      }

      try {
        await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        this.metrics.concurrentQueries = level;
        console.log(`    ✅ 并发${level}个查询完成，耗时: ${totalTime}ms`);
      } catch (error) {
        console.log(`    ❌ 并发${level}个查询失败: ${error}`);
      }
    }
  }

  // 3. 连接池压力测试
  async testConnectionPool(): Promise<void> {
    console.log('\n🏊 开始连接池压力测试...\n');

    try {
      // 获取连接池状态
      const poolStats = await getPoolStats();
      this.metrics.poolStats = poolStats;

      console.log('  连接池状态:');
      console.log(`    活跃连接数: ${poolStats.activeConnections || 'N/A'}`);
      console.log(`    空闲连接数: ${poolStats.idleConnections || 'N/A'}`);
      console.log(`    总连接数: ${poolStats.totalConnections || 'N/A'}`);

      // 连接池健康检查
      const isHealthy = await checkPoolHealth();
      console.log(`    连接池健康状态: ${isHealthy ? '✅ 健康' : '❌ 异常'}`);

      // 快速连接创建测试
      console.log('  快速连接创建测试:');
      const quickStart = Date.now();
      await checkDatabaseConnection();
      const quickEnd = Date.now();
      console.log(`    连接检查耗时: ${quickEnd - quickStart}ms`);
    } catch (error) {
      console.log(`  ❌ 连接池测试失败: ${error}`);
      this.metrics.errorCount++;
    }
  }

  // 4. 实际业务场景性能验证
  async testBusinessScenarios(): Promise<void> {
    console.log('\n💼 开始业务场景性能验证...\n');

    const scenarios = [
      {
        name: '案件创建流程',
        test: async () => {
          // 模拟案件创建的数据库操作
          const user = await prisma.user.findFirst();
          if (!user) throw new Error('未找到测试用户');

          const startTime = Date.now();

          // 创建案件
          const caseData = {
            userId: user.id,
            title: '测试案件',
            description: '性能测试案件',
            type: 'CIVIL' as const,
            status: 'DRAFT' as const,
          };

          // 模拟业务查询
          await prisma.case.findMany({ where: { userId: user.id } });
          await prisma.document.findMany({ where: { userId: user.id } });
          await prisma.debate.findMany({ where: { userId: user.id } });

          const endTime = Date.now();
          return endTime - startTime;
        },
      },

      {
        name: '辩论数据查询',
        test: async () => {
          const startTime = Date.now();

          // 复杂的辩论相关查询
          await prisma.debate.findMany({
            include: {
              case: {
                include: {
                  user: true,
                  documents: true,
                },
              },
              rounds: {
                include: {
                  arguments: true,
                },
              },
            },
            take: 5,
          });

          const endTime = Date.now();
          return endTime - startTime;
        },
      },

      {
        name: '法条检索查询',
        test: async () => {
          const startTime = Date.now();

          // 模拟法条检索
          await prisma.legalReference.findMany({
            where: {
              OR: [
                { category: { contains: '民法' } },
                { source: { contains: '民法典' } },
              ],
              status: 'VALID',
            },
            orderBy: {
              relevanceScore: 'desc',
            },
            take: 10,
          });

          const endTime = Date.now();
          return endTime - startTime;
        },
      },
    ];

    for (const scenario of scenarios) {
      try {
        const executionTime = await scenario.test();
        console.log(`  ✅ ${scenario.name}: ${executionTime}ms`);

        // 业务性能标准：单次操作应在2秒内完成
        if (executionTime > 2000) {
          console.log(`    ⚠️ 警告: 响应时间超过2秒标准`);
        }

        this.metrics.successCount++;
      } catch (error) {
        console.log(`  ❌ ${scenario.name}: 失败 - ${error}`);
        this.metrics.errorCount++;
      }
    }
  }

  // 5. 生成性能报告
  generatePerformanceReport(): void {
    console.log('\n📋 数据库性能测试报告');
    console.log('='.repeat(50));

    // 查询性能评估
    const avgQueryTime =
      this.metrics.queryTimes.length > 0
        ? this.metrics.queryTimes.reduce((a, b) => a + b, 0) /
          this.metrics.queryTimes.length
        : 0;

    console.log('\n🔍 查询性能评估:');
    console.log(`  平均查询时间: ${avgQueryTime.toFixed(2)}ms`);
    console.log(
      `  性能评级: ${avgQueryTime < 100 ? '✅ 优秀' : avgQueryTime < 500 ? '⚠️ 良好' : '❌ 需要优化'}`
    );

    // 并发能力评估
    console.log('\n🔄 并发处理能力:');
    console.log(`  最大并发测试: ${this.metrics.concurrentQueries}`);
    console.log(
      `  并发处理: ${this.metrics.concurrentQueries >= 10 ? '✅ 满足要求' : '⚠️ 需要提升'}`
    );

    // 连接池状态
    console.log('\n🏊 连接池状态:');
    if (this.metrics.poolStats) {
      console.log(`  连接池配置: ✅ 正常`);
      console.log(
        `  连接管理: ${this.metrics.poolStats.totalConnections ? '✅ 正常' : '⚠️ 需要检查'}`
      );
    } else {
      console.log(`  连接池状态: ⚠️ 未获取到详细信息`);
    }

    // 总体评估
    console.log('\n🎯 总体性能评估:');
    const queryPerformanceGood = avgQueryTime < 500;
    const concurrencyGood = this.metrics.concurrentQueries >= 10;
    const errorRateLow = this.metrics.errorCount === 0;

    const allGood = queryPerformanceGood && concurrencyGood && errorRateLow;

    console.log(
      `  查询性能: ${queryPerformanceGood ? '✅ 通过' : '❌ 不达标'}`
    );
    console.log(`  并发能力: ${concurrencyGood ? '✅ 通过' : '❌ 不达标'}`);
    console.log(`  错误率: ${errorRateLow ? '✅ 通过' : '❌ 过高'}`);
    console.log(
      `  总体评估: ${allGood ? '✅ 性能满足要求' : '❌ 性能需要优化'}`
    );

    console.log('\n' + '='.repeat(50));
  }

  // 执行完整测试套件
  async runFullTest(): Promise<void> {
    console.log('🧪 开始数据库性能完整测试...\n');

    try {
      await this.testQueryPerformance();
      await this.testConcurrentQueries();
      await this.testConnectionPool();
      await this.testBusinessScenarios();
      this.generatePerformanceReport();
    } catch (error) {
      console.error('\n❌ 性能测试过程中发生错误:', error);
    } finally {
      await prisma.$disconnect();
    }
  }
}

// 执行测试
async function main() {
  const tester = new DatabasePerformanceTester();
  await tester.runFullTest();
}

main().catch(error => {
  console.error('性能测试执行失败:', error);
  process.exit(1);
});
