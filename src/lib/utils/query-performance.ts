/**
 * 数据库查询性能优化工具
 * 提供查询分析和优化建议
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

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
const MAX_QUERY_STATS_ENTRIES = 1000;

// 监听查询事件
prisma.$on('query' as never, (e: Prisma.QueryEvent) => {
  const query = e.query;
  const duration = e.duration;

  if (queryStats.has(query)) {
    const stats = queryStats.get(query)!;
    stats.count++;
    stats.duration += duration;
    stats.avgDuration = stats.duration / stats.count;
  } else {
    if (queryStats.size >= MAX_QUERY_STATS_ENTRIES) {
      // 超出上限时删除平均耗时最低的 20%，为新条目腾出空间
      const entries = Array.from(queryStats.entries()).sort(
        (a, b) => a[1].avgDuration - b[1].avgDuration
      );
      const toDelete = Math.ceil(MAX_QUERY_STATS_ENTRIES * 0.2);
      for (let i = 0; i < toDelete; i++) {
        queryStats.delete(entries[i][0]);
      }
    }
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
  const slowQueries = getSlowQueries(100);
  const frequentQueries = getFrequentQueries(10);

  logger.info('数据库查询性能报告', {
    slowQueries: slowQueries.slice(0, 10).map((stats, index) => ({
      rank: index + 1,
      avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
      count: stats.count,
      query: stats.query.substring(0, 100),
    })),
    frequentQueries: frequentQueries.slice(0, 10).map((stats, index) => ({
      rank: index + 1,
      count: stats.count,
      avgDuration: `${stats.avgDuration.toFixed(2)}ms`,
      query: stats.query.substring(0, 100),
    })),
  });
}

/**
 * 清空查询统计
 */
export function clearQueryStats() {
  queryStats.clear();
}

export { prisma };
