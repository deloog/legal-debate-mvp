/**
 * Prometheus指标收集模块单元测试
 */

import {
  PrometheusMonitor,
  MetricType,
  PrometheusMetric,
  MetricCollector,
  PrometheusMonitorConfig,
  getPrometheusMonitor,
  resetPrometheusMonitor,
  incrementCounter,
  setGauge,
  recordHistogram,
  recordSummary,
} from '@/lib/monitoring/prometheus-metrics';

describe('PrometheusMonitor', () => {
  let monitor: PrometheusMonitor;

  beforeEach(() => {
    monitor = new PrometheusMonitor({
      enabled: true,
      prefix: 'test_',
      labels: {
        service: 'test-service',
        environment: 'test',
      },
      collectInterval: 1000,
    });
  });

  afterEach(() => {
    monitor.destroy();
    resetPrometheusMonitor();
  });

  describe('constructor', () => {
    test('应该使用默认配置创建监控实例', () => {
      const defaultMonitor = new PrometheusMonitor();
      const config = defaultMonitor.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.prefix).toBe('legal_debate_');
      expect(config.collectInterval).toBe(60000);

      defaultMonitor.destroy();
    });

    test('应该使用自定义配置创建监控实例', () => {
      const config = monitor.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.prefix).toBe('test_');
      expect(config.labels.service).toBe('test-service');
      expect(config.labels.environment).toBe('test');
      expect(config.collectInterval).toBe(1000);
    });

    test('应该创建空的指标存储', () => {
      expect(monitor.getAllMetrics()).toEqual([]);
    });

    test('应该创建空的收集器存储', () => {
      expect(monitor.getStats().totalCollectors).toBe(0);
    });
  });

  describe('incrementCounter', () => {
    test('应该增加计数器指标', () => {
      monitor.incrementCounter('requests', 1);

      const metrics = monitor.getMetricsByName('requests');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(MetricType.COUNTER);
      expect(metrics[0].value).toBe(1);
      expect(metrics[0].name).toBe('test_requests');
    });

    test('应该使用默认值1增加计数器', () => {
      monitor.incrementCounter('requests');

      const metrics = monitor.getMetricsByName('requests');
      expect(metrics[0].value).toBe(1);
    });

    test('应该合并标签', () => {
      monitor.incrementCounter('requests', 5, { method: 'GET' });

      const metrics = monitor.getMetricsByName('requests');
      expect(metrics[0].labels.service).toBe('test-service');
      expect(metrics[0].labels.method).toBe('GET');
    });

    test('应该禁用时忽略指标', () => {
      monitor.updateConfig({ enabled: false });
      monitor.incrementCounter('requests', 1);

      expect(monitor.getMetricsByName('requests')).toHaveLength(0);
    });

    test('应该限制存储的指标数量', () => {
      const maxMetrics = 10000;
      for (let i = 0; i <= maxMetrics; i++) {
        monitor.incrementCounter(`metric_${i}`, 1);
      }

      const totalMetrics = monitor.getAllMetrics().length;
      expect(totalMetrics).toBe(maxMetrics);
    });
  });

  describe('setGauge', () => {
    test('应该设置仪表盘指标', () => {
      monitor.setGauge('temperature', 25.5);

      const metrics = monitor.getMetricsByName('temperature');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(MetricType.GAUGE);
      expect(metrics[0].value).toBe(25.5);
    });

    test('应该支持负值', () => {
      monitor.setGauge('temperature', -10.5);

      const metrics = monitor.getMetricsByName('temperature');
      expect(metrics[0].value).toBe(-10.5);
    });

    test('应该更新现有指标', () => {
      monitor.setGauge('temperature', 20);
      monitor.setGauge('temperature', 25);

      const metrics = monitor.getMetricsByName('temperature');
      expect(metrics).toHaveLength(2);
      expect(metrics[0].value).toBe(20);
      expect(metrics[1].value).toBe(25);
    });
  });

  describe('recordHistogram', () => {
    test('应该记录直方图指标', () => {
      monitor.recordHistogram('request_duration', 0.5);

      const metrics = monitor.getMetricsByName('request_duration');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(MetricType.HISTOGRAM);
      expect(metrics[0].value).toBe(0.5);
    });

    test('应该记录多个值', () => {
      monitor.recordHistogram('request_duration', 0.1);
      monitor.recordHistogram('request_duration', 0.5);
      monitor.recordHistogram('request_duration', 1.0);

      const metrics = monitor.getMetricsByName('request_duration');
      expect(metrics).toHaveLength(3);
    });
  });

  describe('recordSummary', () => {
    test('应该记录摘要指标', () => {
      monitor.recordSummary('response_size', 1024);

      const metrics = monitor.getMetricsByName('response_size');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].type).toBe(MetricType.SUMMARY);
      expect(metrics[0].value).toBe(1024);
    });
  });

  describe('registerCollector', () => {
    test('应该注册指标收集器', () => {
      const collector: MetricCollector = {
        name: 'memory_usage',
        type: MetricType.GAUGE,
        help: 'Memory usage in bytes',
        labels: [],
        collect: () => 1024 * 1024 * 512,
      };

      monitor.registerCollector(collector);
      expect(monitor.getStats().totalCollectors).toBe(1);
    });

    test('应该支持多个收集器', () => {
      const collector1: MetricCollector = {
        name: 'memory_usage',
        type: MetricType.GAUGE,
        help: 'Memory usage',
        labels: [],
        collect: () => 1024 * 1024 * 512,
      };

      const collector2: MetricCollector = {
        name: 'cpu_usage',
        type: MetricType.GAUGE,
        help: 'CPU usage',
        labels: [],
        collect: () => 50,
      };

      monitor.registerCollector(collector1);
      monitor.registerCollector(collector2);

      expect(monitor.getStats().totalCollectors).toBe(2);
    });

    test('收集时应该执行收集器', () => {
      const collectFn = jest.fn().mockReturnValue(100);
      const collector: MetricCollector = {
        name: 'test_metric',
        type: MetricType.GAUGE,
        help: 'Test metric',
        labels: [],
        collect: collectFn,
      };

      monitor.registerCollector(collector);
      monitor.collectMetrics();

      expect(collectFn).toHaveBeenCalled();
      const metrics = monitor.getMetricsByName('test_metric');
      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(100);
    });
  });

  describe('unregisterCollector', () => {
    test('应该取消注册指标收集器', () => {
      const collector: MetricCollector = {
        name: 'test_metric',
        type: MetricType.GAUGE,
        help: 'Test metric',
        labels: [],
        collect: () => 100,
      };

      monitor.registerCollector(collector);
      expect(monitor.getStats().totalCollectors).toBe(1);

      monitor.unregisterCollector('test_metric');
      expect(monitor.getStats().totalCollectors).toBe(0);
    });
  });

  describe('collectMetrics', () => {
    test('应该收集所有注册收集器的指标', () => {
      const collector1: MetricCollector = {
        name: 'metric1',
        type: MetricType.COUNTER,
        help: 'Metric 1',
        labels: [],
        collect: () => 10,
      };

      const collector2: MetricCollector = {
        name: 'metric2',
        type: MetricType.GAUGE,
        help: 'Metric 2',
        labels: [],
        collect: () => 20,
      };

      monitor.registerCollector(collector1);
      monitor.registerCollector(collector2);
      monitor.collectMetrics();

      const stats = monitor.getStats();
      expect(stats.totalMetrics).toBe(2);
    });

    test('应该捕获收集器错误', () => {
      const errorCollector: MetricCollector = {
        name: 'error_metric',
        type: MetricType.GAUGE,
        help: 'Error metric',
        labels: [],
        collect: () => {
          throw new Error('Collection failed');
        },
      };

      const validCollector: MetricCollector = {
        name: 'valid_metric',
        type: MetricType.GAUGE,
        help: 'Valid metric',
        labels: [],
        collect: () => 100,
      };

      monitor.registerCollector(errorCollector);
      monitor.registerCollector(validCollector);

      expect(() => monitor.collectMetrics()).not.toThrow();

      const metrics = monitor.getMetricsByName('valid_metric');
      expect(metrics).toHaveLength(1);
    });
  });

  describe('getPrometheusMetrics', () => {
    test('应该生成Prometheus格式的指标数据', () => {
      monitor.incrementCounter('requests', 10);
      monitor.setGauge('temperature', 25.5);

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('# TYPE counter counter');
      expect(prometheusFormat).toContain('test_requests');
      expect(prometheusFormat).toContain('# TYPE gauge gauge');
      expect(prometheusFormat).toContain('test_temperature');
    });

    test('应该包含标签', () => {
      monitor.incrementCounter('requests', 10, { method: 'GET' });

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('service="test-service"');
      expect(prometheusFormat).toContain('method="GET"');
    });

    test('应该转义特殊字符', () => {
      monitor.incrementCounter('test', 1, {
        message: 'test "quoted" value',
      });

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('message="test \\"quoted\\" value"');
    });
  });

  describe('formatLabels', () => {
    test('应该格式化空标签', () => {
      monitor.incrementCounter('test', 1);
      const __metrics = monitor.getMetricsByName('test');
      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('service="test-service"');
    });

    test('应该格式化多个标签', () => {
      monitor.incrementCounter('test', 1, {
        method: 'GET',
        endpoint: '/api/test',
      });

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('method="GET"');
      expect(prometheusFormat).toContain('endpoint="/api/test"');
    });
  });

  describe('escapeLabelValue', () => {
    test('应该转义反斜杠', () => {
      monitor.incrementCounter('test', 1, { path: 'C:\\Users\\test' });

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('path="C:\\\\Users\\\\test"');
    });

    test('应该转义双引号', () => {
      monitor.incrementCounter('test', 1, { message: 'test"value' });

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('message="test\\"value"');
    });

    test('应该转义换行符', () => {
      monitor.incrementCounter('test', 1, { message: 'line1\nline2' });

      const prometheusFormat = monitor.getPrometheusMetrics();

      expect(prometheusFormat).toContain('message="line1\\nline2"');
    });
  });

  describe('getAllMetrics', () => {
    test('应该返回所有指标的副本', () => {
      monitor.incrementCounter('metric1', 1);
      monitor.setGauge('metric2', 10);

      const metrics = monitor.getAllMetrics();

      expect(metrics).toHaveLength(2);
      expect(metrics).not.toBe(monitor['metrics']); // 应该是副本
    });
  });

  describe('getMetricsByName', () => {
    test('应该返回指定名称的指标', () => {
      monitor.incrementCounter('metric1', 1);
      monitor.incrementCounter('metric2', 2);

      const metrics1 = monitor.getMetricsByName('metric1');
      const metrics2 = monitor.getMetricsByName('metric2');

      expect(metrics1).toHaveLength(1);
      expect(metrics1[0].value).toBe(1);
      expect(metrics2).toHaveLength(1);
      expect(metrics2[0].value).toBe(2);
    });

    test('应该返回空数组如果指标不存在', () => {
      const metrics = monitor.getMetricsByName('nonexistent');
      expect(metrics).toEqual([]);
    });
  });

  describe('getMetricsByType', () => {
    test('应该返回指定类型的指标', () => {
      monitor.incrementCounter('counter1', 1);
      monitor.setGauge('gauge1', 10);
      monitor.setGauge('gauge2', 20);

      const counters = monitor.getMetricsByType(MetricType.COUNTER);
      const gauges = monitor.getMetricsByType(MetricType.GAUGE);

      expect(counters).toHaveLength(1);
      expect(gauges).toHaveLength(2);
    });
  });

  describe('clearMetrics', () => {
    test('应该清除所有指标', () => {
      monitor.incrementCounter('metric1', 1);
      monitor.setGauge('metric2', 10);

      expect(monitor.getAllMetrics()).toHaveLength(2);

      monitor.clearMetrics();

      expect(monitor.getAllMetrics()).toHaveLength(0);
    });
  });

  describe('startCollecting / stopCollecting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('应该启动定时收集', () => {
      const collectSpy = jest.spyOn(monitor, 'collectMetrics');
      monitor.startCollecting();

      jest.advanceTimersByTime(1000);

      expect(collectSpy).toHaveBeenCalled();
    });

    test('应该停止定时收集', () => {
      monitor.startCollecting();
      monitor.stopCollecting();

      const collectSpy = jest.spyOn(monitor, 'collectMetrics');
      jest.advanceTimersByTime(1000);

      expect(collectSpy).not.toHaveBeenCalled();
    });

    test('重复启动应该警告', () => {
      const warnSpy = jest.spyOn(monitor['logger'], 'warn');
      monitor.startCollecting();
      monitor.startCollecting();

      expect(warnSpy).toHaveBeenCalledWith(
        'Collection timer is already running'
      );
      monitor.stopCollecting();
    });

    test('停止未启动的定时器应该警告', () => {
      const warnSpy = jest.spyOn(monitor['logger'], 'warn');
      monitor.stopCollecting();

      expect(warnSpy).toHaveBeenCalledWith('Collection timer is not running');
    });
  });

  describe('updateConfig', () => {
    test('应该更新配置', () => {
      const newConfig: Partial<PrometheusMonitorConfig> = {
        enabled: false,
        collectInterval: 2000,
      };

      monitor.updateConfig(newConfig);
      const config = monitor.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.collectInterval).toBe(2000);
    });

    test('应该保留未更新的配置', () => {
      const originalConfig = monitor.getConfig();

      monitor.updateConfig({ enabled: false });
      const newConfig = monitor.getConfig();

      expect(newConfig.prefix).toBe(originalConfig.prefix);
      expect(newConfig.labels).toEqual(originalConfig.labels);
    });
  });

  describe('getConfig', () => {
    test('应该返回配置的副本', () => {
      const config1 = monitor.getConfig();
      const config2 = monitor.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // 应该是副本
    });
  });

  describe('getStats', () => {
    test('应该返回正确的统计信息', () => {
      monitor.incrementCounter('counter1', 1);
      monitor.setGauge('gauge1', 10);
      monitor.setGauge('gauge2', 20);

      const stats = monitor.getStats();

      expect(stats.totalCollectors).toBe(0);
      expect(stats.totalMetrics).toBe(3);
      expect(stats.metricsByType[MetricType.COUNTER]).toBe(1);
      expect(stats.metricsByType[MetricType.GAUGE]).toBe(2);
    });
  });

  describe('destroy', () => {
    test('应该清理所有资源', () => {
      monitor.startCollecting();
      monitor.incrementCounter('metric', 1);

      const collector: MetricCollector = {
        name: 'test',
        type: MetricType.GAUGE,
        help: 'Test',
        labels: [],
        collect: () => 100,
      };
      monitor.registerCollector(collector);

      monitor.destroy();

      expect(monitor.getAllMetrics()).toHaveLength(0);
      expect(monitor.getStats().totalCollectors).toBe(0);
    });
  });
});

describe('Singleton Pattern', () => {
  afterEach(() => {
    resetPrometheusMonitor();
  });

  test('应该返回相同的实例', () => {
    const instance1 = getPrometheusMonitor();
    const instance2 = getPrometheusMonitor();

    expect(instance1).toBe(instance2);
  });

  test('重置后应该返回新实例', () => {
    const instance1 = getPrometheusMonitor();
    resetPrometheusMonitor();
    const instance2 = getPrometheusMonitor();

    expect(instance1).not.toBe(instance2);
  });
});

describe('Convenience Functions', () => {
  afterEach(() => {
    resetPrometheusMonitor();
  });

  test('incrementCounter 应该调用监控器的incrementCounter', () => {
    incrementCounter('test', 1);

    const monitor = getPrometheusMonitor();
    const metrics = monitor.getMetricsByName('test');

    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(1);
  });

  test('setGauge 应该调用监控器的setGauge', () => {
    setGauge('test', 100);

    const monitor = getPrometheusMonitor();
    const metrics = monitor.getMetricsByName('test');

    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(100);
  });

  test('recordHistogram 应该调用监控器的recordHistogram', () => {
    recordHistogram('test', 0.5);

    const monitor = getPrometheusMonitor();
    const metrics = monitor.getMetricsByName('test');

    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(0.5);
  });

  test('recordSummary 应该调用监控器的recordSummary', () => {
    recordSummary('test', 1024);

    const monitor = getPrometheusMonitor();
    const metrics = monitor.getMetricsByName('test');

    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(1024);
  });
});
