/**
 * API响应时间监控中间件
 */

import { NextRequest, NextResponse } from 'next/server';

interface RequestStats {
  path: string;
  method: string;
  duration: number;
  status: number;
  timestamp: Date;
}

const requestStats: RequestStats[] = [];
const MAX_STATS_SIZE = 1000;

/**
 * API性能监控中间件
 */
export function withPerformanceMonitoring(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest) => {
    const startTime = Date.now();
    const path = new URL(req.url).pathname;
    const method = req.method;

    try {
      const response = await handler(req);
      const duration = Date.now() - startTime;

      // 记录请求统计
      recordRequest({
        path,
        method,
        duration,
        status: response.status,
        timestamp: new Date(),
      });

      // 添加性能头
      response.headers.set('X-Response-Time', `${duration}ms`);

      // 如果响应时间过长，记录警告
      if (duration > 1000) {
        console.warn(`慢请求警告: ${method} ${path} - ${duration}ms`);
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      recordRequest({
        path,
        method,
        duration,
        status: 500,
        timestamp: new Date(),
      });
      throw error;
    }
  };
}

/**
 * 记录请求统计
 */
function recordRequest(stats: RequestStats) {
  requestStats.push(stats);

  // 限制统计数据大小
  if (requestStats.length > MAX_STATS_SIZE) {
    requestStats.shift();
  }
}

/**
 * 获取慢请求列表
 */
export function getSlowRequests(threshold: number = 1000): RequestStats[] {
  return requestStats
    .filter(stats => stats.duration > threshold)
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 20);
}

/**
 * 获取API性能统计
 */
export function getApiStats() {
  const stats = new Map<
    string,
    { count: number; totalDuration: number; avgDuration: number }
  >();

  requestStats.forEach(req => {
    const key = `${req.method} ${req.path}`;
    if (stats.has(key)) {
      const stat = stats.get(key)!;
      stat.count++;
      stat.totalDuration += req.duration;
      stat.avgDuration = stat.totalDuration / stat.count;
    } else {
      stats.set(key, {
        count: 1,
        totalDuration: req.duration,
        avgDuration: req.duration,
      });
    }
  });

  return Array.from(stats.entries())
    .map(([endpoint, stat]) => ({ endpoint, ...stat }))
    .sort((a, b) => b.avgDuration - a.avgDuration);
}

/**
 * 打印API性能报告
 */
export function printApiReport() {
  console.log('\n=== API性能报告 ===\n');

  const slowRequests = getSlowRequests(1000);
  console.log(`慢请求（>1000ms）: ${slowRequests.length}个`);
  slowRequests.slice(0, 10).forEach((req, index) => {
    console.log(
      `${index + 1}. ${req.method} ${req.path} - ${req.duration}ms (${req.status})`
    );
  });

  console.log('\nAPI平均响应时间：');
  const apiStats = getApiStats();
  apiStats.slice(0, 10).forEach((stat, index) => {
    console.log(
      `${index + 1}. ${stat.endpoint} - ${stat.avgDuration.toFixed(2)}ms (${stat.count}次)`
    );
  });

  console.log('\n=== 报告结束 ===\n');
}

/**
 * 清空统计数据
 */
export function clearApiStats() {
  requestStats.length = 0;
}
