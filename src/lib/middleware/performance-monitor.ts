import { NextResponse } from 'next/server';

/**
 * 性能指标接口
 */
interface PerformanceMetrics {
  url: string;
  method: string;
  statusCode: number;
  responseTime: number; // 毫秒
  cacheStatus?: string;
  timestamp: Date;
}

/**
 * 性能配置接口
 */
interface PerformanceConfig {
  enabled: boolean;
  slowThreshold: number; // 慢速请求阈值（毫秒）
  logSlowQueries: boolean;
  logAllRequests: boolean;
}

/**
 * 默认性能配置
 */
const defaultConfig: PerformanceConfig = {
  enabled:
    process.env.NODE_ENV !== 'test' ||
    process.env.ENABLE_PERFORMANCE_MONITORING === 'true',
  slowThreshold: 2000, // 2秒
  logSlowQueries: true,
  logAllRequests: false, // 生产环境只记录慢速请求
};

/**
 * 性能日志记录器
 */
class PerformanceLogger {
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsCount = 1000;

  /**
   * 记录性能指标
   */
  record(metric: PerformanceMetrics): void {
    this.metrics.push(metric);

    // 限制内存中的指标数量
    if (this.metrics.length > this.maxMetricsCount) {
      this.metrics.shift();
    }

    // 输出到控制台
    this.logMetric(metric);
  }

  /**
   * 记录慢速请求
   */
  logSlowMetric(metric: PerformanceMetrics): void {
    console.warn(`⚠️  慢速请求: ${metric.method} ${metric.url}`);
    console.warn(`   响应时间: ${metric.responseTime}ms`);
    console.warn(`   状态码: ${metric.statusCode}`);
    if (metric.cacheStatus) {
      console.warn(`   缓存状态: ${metric.cacheStatus}`);
    }
  }

  /**
   * 记录正常指标
   */
  logNormalMetric(metric: PerformanceMetrics): void {
    console.log(`✅ ${metric.method} ${metric.url} - ${metric.responseTime}ms`);
  }

  /**
   * 记录指标
   */
  private logMetric(metric: PerformanceMetrics): void {
    if (metric.responseTime > defaultConfig.slowThreshold) {
      this.logSlowMetric(metric);
    } else if (defaultConfig.logAllRequests) {
      this.logNormalMetric(metric);
    }
  }

  /**
   * 获取所有指标
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * 获取统计数据
   */
  getStats(): {
    total: number;
    average: number;
    max: number;
    min: number;
    slowCount: number;
    slowRate: number;
  } {
    if (this.metrics.length === 0) {
      return {
        total: 0,
        average: 0,
        max: 0,
        min: 0,
        slowCount: 0,
        slowRate: 0,
      };
    }

    const responseTimes = this.metrics.map(m => m.responseTime);
    const total = this.metrics.length;
    const average = responseTimes.reduce((a, b) => a + b, 0) / total;
    const max = Math.max(...responseTimes);
    const min = Math.min(...responseTimes);
    const slowCount = responseTimes.filter(
      t => t > defaultConfig.slowThreshold
    ).length;
    const slowRate = (slowCount / total) * 100;

    return {
      total,
      average,
      max,
      min,
      slowCount,
      slowRate,
    };
  }

  /**
   * 清空指标
   */
  clear(): void {
    this.metrics = [];
  }
}

// 全局性能日志记录器
const performanceLogger = new PerformanceLogger();

/**
 * 性能监控中间件工厂
 */
export function createPerformanceMonitorMiddleware(
  config?: Partial<PerformanceConfig>
) {
  const finalConfig = { ...defaultConfig, ...config };

  return async function performanceMonitorMiddleware(
    request: Request,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: { params?: Record<string, string> }
  ): Promise<NextResponse | undefined> {
    if (!finalConfig.enabled) {
      return undefined; // 继续处理请求
    }

    const url = request.url;
    const method = request.method;

    // 记录请求开始
    console.log(`🚀 开始处理: ${method} ${url}`);

    // 返回undefined继续处理请求
    return undefined;
  };
}

/**
 * 响应时间测量器
 * 在API处理完成后记录性能指标
 */
export async function measurePerformance(
  request: Request,
  response: NextResponse,
  startTime: number,
  config?: Partial<PerformanceConfig>
): Promise<void> {
  const finalConfig = { ...defaultConfig, ...config };

  if (!finalConfig.enabled) {
    return;
  }

  const endTime = Date.now();
  const responseTime = endTime - startTime;
  const statusCode = response.status;
  const url = request.url;
  const method = request.method;

  // 获取缓存状态
  const cacheStatus = response.headers.get('X-Cache');

  // 记录性能指标
  const metric: PerformanceMetrics = {
    url,
    method,
    statusCode,
    responseTime,
    cacheStatus: cacheStatus || undefined,
    timestamp: new Date(),
  };

  performanceLogger.record(metric);

  // 添加性能头到响应
  response.headers.set('X-Response-Time', `${responseTime}ms`);

  if (cacheStatus) {
    response.headers.set('X-Cache-Status', cacheStatus);
  }
}

/**
 * 获取性能统计信息
 */
export function getPerformanceStats(): ReturnType<
  PerformanceLogger['getStats']
> {
  return performanceLogger.getStats();
}

/**
 * 获取所有性能指标
 */
export function getAllPerformanceMetrics(): PerformanceMetrics[] {
  return performanceLogger.getMetrics();
}

/**
 * 清空性能指标
 */
export function clearPerformanceMetrics(): void {
  performanceLogger.clear();
}

/**
 * 生成性能报告
 */
export function generatePerformanceReport(): {
  summary: ReturnType<PerformanceLogger['getStats']>;
  slowRequests: PerformanceMetrics[];
  timestamp: Date;
} {
  const stats = performanceLogger.getStats();
  const slowRequests = performanceLogger
    .getMetrics()
    .filter(m => m.responseTime > defaultConfig.slowThreshold);

  return {
    summary: stats,
    slowRequests,
    timestamp: new Date(),
  };
}

/**
 * 检查性能健康状态
 */
export function checkPerformanceHealth(): {
  healthy: boolean;
  issues: string[];
} {
  const finalConfig = defaultConfig;
  const stats = performanceLogger.getStats();
  const issues: string[] = [];

  // 检查平均响应时间
  if (stats.average > defaultConfig.slowThreshold) {
    issues.push(
      `平均响应时间 ${stats.average.toFixed(0)}ms 超过阈值 ${finalConfig.slowThreshold}ms`
    );
  }

  // 检查慢速请求比例
  if (stats.slowRate > 10) {
    issues.push(`慢速请求比例 ${stats.slowRate.toFixed(1)}% 超过10%`);
  }

  // 检查最大响应时间
  if (stats.max > finalConfig.slowThreshold * 5) {
    issues.push(`最大响应时间 ${stats.max}ms 超过阈值的5倍`);
  }

  return {
    healthy: issues.length === 0,
    issues,
  };
}

export type { PerformanceMetrics, PerformanceConfig };
export { defaultConfig };
