/**
 * 数据库查询性能优化工具
 * 提供查询分析和优化建议
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
  ],
});

interface QueryStats {
  query: string;
  duration: number;
  count: number;
  avgDuration: number;
}

const queryStats = new Map<string, QueryStats>();

// 监听查询事件
prisma.$on('query' as never, (e: any) => {
  const query = e.query;
  const duration = e.duration;

  if (queryStats.has(query)) {
    const stats = queryStats.get(query)!;
    stats.count++;
    stats.duration += duration;
    stats.avgDuration = stats.duration / stats.count;
  } else {
    queryStats.set(query, {
      query,
      duration,
      count: 1,
      avgDuration: duration,
    });
  }
});

/**
 * 获取慢查询列表
 * @param threshold 阈值（毫秒）
 */
export function getSlowQueries(threshold: number = 100): QueryStats[] {
  return Array.from(queryStats.values())
    .filter(stats => stats.avgDuration > threshold)
    .sort((a, b) => b.avgDuration - a.avgDuration);
}

/**
 * 获取频繁查询列表
 * @param threshold 阈值（次数）
 */
export function getFrequentQueries(threshold: number = 10): QueryStats[] {
  return Array.from(queryStats.values())
    .filter(stats => stats.count > threshold)
    .sort((a, b) => b.count - a.count);
}

/**
 * 打印查询统计报告
 */
export function printQueryReport() {
  console.log('\n=== 数据库查询性能报告 ===\n');

  console.log('慢查询（>100ms）：');
  const slowQueries = getSlowQueries(100);
  slowQueries.slice(0, 10).forEach((stats, index) => {
    console.log(
      `${index + 1}. 平均耗时: ${stats.avgDuration.toFixed(2)}ms, 执行次数: ${stats.count}`
    );
    console.log(`   查询: ${stats.query.substring(0, 100)}...`);
  });

  console.log('\n频繁查询（>10次）：');
  const frequentQueries = getFrequentQueries(10);
  frequentQueries.slice(0, 10).forEach((stats, index) => {
    console.log(
      `${index + 1}. 执行次数: ${stats.count}, 平均耗时: ${stats.avgDuration.toFixed(2)}ms`
    );
    console.log(`   查询: ${stats.query.substring(0, 100)}...`);
  });

  console.log('\n=== 报告结束 ===\n');
}

/**
 * 清空查询统计
 */
export function clearQueryStats() {
  queryStats.clear();
}

export { prisma };
