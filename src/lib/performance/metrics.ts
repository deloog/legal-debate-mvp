/**
 * 性能监控模块
 * 功能：收集和记录Web Vitals性能指标
 */

/**
 * Web Vitals指标类型
 */
export interface PerformanceMetrics {
  // 最大内容绘制（LCP）
  lcp?: number;
  // 首次输入延迟（FID）
  fid?: number;
  // 首次内容绘制（FCP）
  fcp?: number;
  // 首次字节时间（TTFB）
  ttfb?: number;
  // 累积布局偏移（CLS）
  cls?: number;
  // 首次绘制（FP）
  fp?: number;
  // 测量时间戳
  timestamp: number;
}

/**
 * 性能条目类型定义
 */
interface LCPEntry extends PerformanceEntry {
  startTime: number;
}

interface FIDEntry extends PerformanceEntry {
  processingStart: number;
  startTime: number;
}

interface CLSEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

/**
 * 性能指标收集器类
 */
class PerformanceCollector {
  private metrics: PerformanceMetrics[] = [];

  /**
   * 收集LCP（最大内容绘制）
   */
  collectLCP(value: number): void {
    this.recordMetric('lcp', value);
  }

  /**
   * 收集FID（首输入延迟）
   */
  collectFID(value: number): void {
    this.recordMetric('fid', value);
  }

  /**
   * 收集FCP（首次内容绘制）
   */
  collectFCP(value: number): void {
    this.recordMetric('fcp', value);
  }

  /**
   * 收集TTFB（首字节时间）
   */
  collectTTFB(value: number): void {
    this.recordMetric('ttfb', value);
  }

  /**
   * 收集CLS（累积布局偏移）
   */
  collectCLS(value: number): void {
    this.recordMetric('cls', value);
  }

  /**
   * 收集FP（首次绘制）
   */
  collectFP(value: number): void {
    this.recordMetric('fp', value);
  }

  /**
   * 记录指标
   */
  private recordMetric(key: keyof PerformanceMetrics, value: number): void {
    const metric: PerformanceMetrics = {
      [key]: value,
      timestamp: Date.now(),
    };
    this.metrics.push(metric);

    // 发送到分析服务（生产环境）
    if (
      typeof window !== 'undefined' &&
      process.env.NODE_ENV === 'production'
    ) {
      this.sendToAnalytics(metric);
    }
  }

  /**
   * 发送到分析服务
   */
  private sendToAnalytics(metric: PerformanceMetrics): void {
    try {
      // 方式1: Google Analytics 4 (如果已配置)
      if (
        typeof (window as unknown as Record<string, unknown>).__gtag ===
        'function'
      ) {
        const gtag = (window as unknown as Record<string, unknown>).__gtag as (
          ...args: unknown[]
        ) => void;
        gtag('event', 'web_vitals', {
          event_category: 'Performance',
          event_label: 'LCP',
          value: metric.lcp,
          non_interaction: true,
        });

        if (metric.fid !== undefined) {
          gtag('event', 'web_vitals', {
            event_category: 'Performance',
            event_label: 'FID',
            value: metric.fid,
            non_interaction: true,
          });
        }

        if (metric.cls !== undefined) {
          gtag('event', 'web_vitals', {
            event_category: 'Performance',
            event_label: 'CLS',
            value: metric.cls,
            non_interaction: true,
          });
        }
      }

      // 方式2: 发送到自定义API（如果配置）
      const analyticsApiUrl = process.env.NEXT_PUBLIC_ANALYTICS_API_URL;
      if (analyticsApiUrl) {
        fetch(analyticsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'web_vitals',
            metrics: metric,
            page: window.location.pathname,
            userAgent: navigator.userAgent,
            timestamp: metric.timestamp,
          }),
          keepalive: true, // 使用keepalive确保请求在页面卸载后仍能完成
        }).catch(error => {
          console.warn('[Performance] Failed to send metrics to API:', error);
        });
      }

      // 方式3: 发送到事件跟踪器（如果存在）
      if (
        typeof (window as unknown as Record<string, unknown>).trackEvent ===
        'function'
      ) {
        const trackEvent = (window as unknown as Record<string, unknown>)
          .trackEvent as (...args: unknown[]) => void;
        trackEvent('performance_metric', metric);
      }

      console.log('[Performance] Metric recorded:', metric);
    } catch (error) {
      console.error('[Performance] Failed to send metric:', error);
    }
  }

  /**
   * 获取所有指标
   */
  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * 获取最新指标
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0
      ? this.metrics[this.metrics.length - 1]
      : null;
  }

  /**
   * 计算平均指标
   */
  getAverageMetrics(): Partial<PerformanceMetrics> {
    const sums: Partial<PerformanceMetrics> = {};
    const counts: Record<string, number> = {};

    this.metrics.forEach(metric => {
      Object.keys(metric).forEach(key => {
        if (key !== 'timestamp') {
          const value = metric[key as keyof PerformanceMetrics];
          if (typeof value === 'number') {
            sums[key as keyof PerformanceMetrics] =
              ((sums[key as keyof PerformanceMetrics] as number) || 0) + value;
            counts[key] = (counts[key] || 0) + 1;
          }
        }
      });
    });

    const averages: Partial<PerformanceMetrics> = {};
    Object.keys(sums).forEach(key => {
      const sum = sums[key as keyof PerformanceMetrics] as number;
      const count = counts[key];
      averages[key as keyof PerformanceMetrics] = sum / count;
    });

    return averages;
  }

  /**
   * 清除指标
   */
  clearMetrics(): void {
    this.metrics = [];
  }
}

// 导出单例
export const performanceCollector = new PerformanceCollector();

/**
 * 使用Performance Observer收集Web Vitals
 */
export function initPerformanceObservers(): void {
  if (typeof window === 'undefined' || !window.performance) {
    return;
  }

  // 收集LCP
  if ('PerformanceObserver' in window) {
    try {
      const lcpObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as LCPEntry;
        if (lastEntry?.startTime) {
          performanceCollector.collectLCP(lastEntry.startTime);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      console.warn('LCP Observer setup failed:', e);
    }

    // 收集FID
    try {
      const fidObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        entries.forEach((entry: FIDEntry) => {
          if (entry.processingStart) {
            performanceCollector.collectFID(
              entry.processingStart - entry.startTime
            );
          }
        });
      });
      fidObserver.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      console.warn('FID Observer setup failed:', e);
    }

    // 收集CLS
    try {
      const clsObserver = new PerformanceObserver(list => {
        const entries = list.getEntries();
        let clsValue = 0;
        entries.forEach((entry: CLSEntry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        performanceCollector.collectCLS(clsValue);
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      console.warn('CLS Observer setup failed:', e);
    }
  }

  // 收集传统性能指标
  window.addEventListener('load', () => {
    setTimeout(() => {
      const perfData = window.performance.timing;
      if (perfData) {
        const ttfb = perfData.responseStart - perfData.requestStart;
        const fp = perfData.responseStart - perfData.navigationStart;

        if (ttfb > 0) performanceCollector.collectTTFB(ttfb);
        if (fp > 0) performanceCollector.collectFP(fp);
      }
    }, 0);
  });
}

/**
 * 手动记录交互时间
 */
export function recordInteractionTime(
  interactionName: string,
  startTime: number
): number {
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`Interaction [${interactionName}]: ${duration}ms`);

  return duration;
}

/**
 * 检查性能指标是否达标
 */
export function checkPerformanceThresholds(metrics: PerformanceMetrics): {
  passed: boolean;
  details: Record<
    string,
    { value: number; threshold: number; passed: boolean }
  >;
} {
  const thresholds = {
    lcp: { value: 2500, label: 'LCP' }, // < 2.5s
    fid: { value: 100, label: 'FID' }, // < 100ms
    fcp: { value: 1800, label: 'FCP' }, // < 1.8s
    cls: { value: 0.1, label: 'CLS' }, // < 0.1
  };

  const details: Record<
    string,
    { value: number; threshold: number; passed: boolean }
  > = {};
  let allPassed = true;

  Object.keys(thresholds).forEach(key => {
    const thresholdInfo = thresholds[key as keyof typeof thresholds];
    const metricValue = metrics[key as keyof PerformanceMetrics];

    if (typeof metricValue === 'number') {
      const passed = metricValue <= thresholdInfo.value;
      details[key] = {
        value: metricValue,
        threshold: thresholdInfo.value,
        passed,
      };

      if (!passed) {
        allPassed = false;
      }
    }
  });

  return {
    passed: allPassed,
    details,
  };
}
