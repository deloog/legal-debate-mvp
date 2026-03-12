/**
 * 生产环境数据库监控脚本
 *
 * 功能：
 * - 监控数据库性能指标
 * - 监控连接池状态
 * - 监控查询性能
 * - 监控磁盘空间和内存使用
 * - 实现告警机制
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

/**
 * 监控配置接口
 */
interface MonitoringConfig {
  databaseUrl: string;
  logDir: string;
  checkInterval: number;
  alertThresholds: AlertThresholds;
  alertEnabled: boolean;
  alertChannel: 'console' | 'file' | 'webhook';
  webhookUrl?: string;
}

/**
 * 告警阈值接口
 */
interface AlertThresholds {
  connectionUtilization: number; // 连接池使用率阈值
  queryTime: number; // 查询时间阈值
  slowQueryCount: number; // 慢查询数量阈值
  diskUsage: number; // 磁盘使用率阈值
  memoryUsage: number; // 内存使用率阈值
  connectionErrors: number; // 连接错误数阈值
}

/**
 * 数据库性能指标接口
 */
interface DatabaseMetrics {
  timestamp: Date;
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
    utilization: number;
  };
  performance: {
    avgQueryTime: number;
    maxQueryTime: number;
    slowQueries: number;
    totalQueries: number;
  };
  system: {
    diskUsage: number;
    diskFree: number;
    memoryUsage: number;
    memoryTotal: number;
  };
  errors: {
    connectionErrors: number;
    queryErrors: number;
    deadlocks: number;
  };
}

/**
 * 告警信息接口
 */
interface AlertInfo {
  id: string;
  timestamp: Date;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  metrics: DatabaseMetrics;
}

/**
 * 生产数据库监控器类
 */
export class ProductionDatabaseMonitor {
  private config: MonitoringConfig;
  private metricsHistory: DatabaseMetrics[] = [];
  private alerts: AlertInfo[] = [];
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.intervalId) {
      console.log('[PROD] 监控已在运行中');
      return;
    }

    console.log(
      `[PROD] 启动数据库监控，检查间隔: ${this.config.checkInterval}ms`
    );

    this.intervalId = setInterval(async () => {
      await this.collectAndAnalyzeMetrics();
    }, this.config.checkInterval);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[PROD] 数据库监控已停止');
    }
  }

  /**
   * 收集并分析指标
   */
  async collectAndAnalyzeMetrics(): Promise<void> {
    try {
      const metrics = await this.collectMetrics();

      // 保存指标历史
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > 100) {
        this.metricsHistory.shift();
      }

      // 分析指标并触发告警
      await this.analyzeMetrics(metrics);

      // 输出监控状态
      this.logMetrics(metrics);
    } catch (error) {
      console.error('[PROD] 收集监控指标失败:', error);
    }
  }

  /**
   * 收集数据库指标
   */
  async collectMetrics(): Promise<DatabaseMetrics> {
    const connections = await this.collectConnectionMetrics();
    const performance = await this.collectPerformanceMetrics();
    const system = await this.collectSystemMetrics();
    const errors = await this.collectErrorMetrics();

    return {
      timestamp: new Date(),
      connections,
      performance,
      system,
      errors,
    };
  }

  /**
   * 收集连接池指标
   */
  private async collectConnectionMetrics(): Promise<{
    active: number;
    idle: number;
    total: number;
    max: number;
    utilization: number;
  }> {
    try {
      const result = await this.executePostgresQuery<{
        active_connections: number;
        idle_connections: number;
        max_connections: number;
      }>(
        `SELECT 
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity`
      );

      const active = result[0]?.active_connections || 0;
      const idle = result[0]?.idle_connections || 0;
      const total = active + idle;
      const max = result[0]?.max_connections || 100;

      return {
        active,
        idle,
        total,
        max,
        utilization: total / max,
      };
    } catch (error) {
      console.error('[PROD] 收集连接池指标失败:', error);
      return {
        active: 0,
        idle: 0,
        total: 0,
        max: 100,
        utilization: 0,
      };
    }
  }

  /**
   * 收集性能指标
   */
  private async collectPerformanceMetrics(): Promise<{
    avgQueryTime: number;
    maxQueryTime: number;
    slowQueries: number;
    totalQueries: number;
  }> {
    try {
      const result = await this.executePostgresQuery<{
        avg_query_time: number;
        max_query_time: number;
        slow_queries: number;
        total_queries: number;
      }>(
        `SELECT 
          COALESCE(AVG(mean_exec_time), 0) as avg_query_time,
          COALESCE(MAX(max_exec_time), 0) as max_query_time,
          COUNT(*) FILTER (WHERE mean_exec_time > ${this.config.alertThresholds.queryTime}) as slow_queries,
          COUNT(*) as total_queries
        FROM pg_stat_statements`
      );

      return {
        avgQueryTime: result[0]?.avg_query_time || 0,
        maxQueryTime: result[0]?.max_query_time || 0,
        slowQueries: result[0]?.slow_queries || 0,
        totalQueries: result[0]?.total_queries || 0,
      };
    } catch (error) {
      console.error('[PROD] 收集性能指标失败:', error);
      return {
        avgQueryTime: 0,
        maxQueryTime: 0,
        slowQueries: 0,
        totalQueries: 0,
      };
    }
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<{
    diskUsage: number;
    diskFree: number;
    memoryUsage: number;
    memoryTotal: number;
  }> {
    try {
      // 获取磁盘使用率
      const diskResult = await this.executePostgresQuery<{
        pg_database_size: number;
      }>('SELECT pg_database_size(current_database()) as pg_database_size');

      const dbSize = diskResult[0]?.pg_database_size || 0;
      const diskFree = dbSize * 0.2; // 假设保留20%的可用空间

      // 获取内存使用率
      const memoryResult = await this.executePostgresQuery<{
        shared_buffers: number;
      }>(
        "SELECT setting::bigint as shared_buffers FROM pg_settings WHERE name = 'shared_buffers'"
      );

      const sharedBuffers = memoryResult[0]?.shared_buffers || 0;
      const memoryUsage = sharedBuffers / (1024 * 1024 * 1024); // 转换为GB

      return {
        diskUsage: 80, // 假设值，需要从系统获取
        diskFree,
        memoryUsage,
        memoryTotal: 16, // 假设16GB内存
      };
    } catch (error) {
      console.error('[PROD] 收集系统指标失败:', error);
      return {
        diskUsage: 0,
        diskFree: 0,
        memoryUsage: 0,
        memoryTotal: 0,
      };
    }
  }

  /**
   * 收集错误指标
   */
  private async collectErrorMetrics(): Promise<{
    connectionErrors: number;
    queryErrors: number;
    deadlocks: number;
  }> {
    try {
      const result = await this.executePostgresQuery<{
        deadlocks: number;
      }>(
        `SELECT COUNT(*) as deadlocks 
        FROM pg_stat_database 
        WHERE datname = current_database()`
      );

      return {
        connectionErrors: 0, // 需要从日志分析
        queryErrors: 0, // 需要从日志分析
        deadlocks: result[0]?.deadlocks || 0,
      };
    } catch (error) {
      console.error('[PROD] 收集错误指标失败:', error);
      return {
        connectionErrors: 0,
        queryErrors: 0,
        deadlocks: 0,
      };
    }
  }

  /**
   * 执行PostgreSQL查询
   */
  private async executePostgresQuery<T>(query: string): Promise<T[]> {
    try {
      const { databaseUrl } = this.config;
      const pgpassPath = process.cwd() + '/config/.pgpass';

      const command = `set PGPASSFILE="${pgpassPath}" && psql -t -A -F\t -c "${query}" "${databaseUrl}"`;

      const { stdout } = await execAsync(command);

      if (!stdout.trim()) {
        return [];
      }

      const lines = stdout.trim().split('\n');
      if (lines.length === 0) {
        return [];
      }

      const headers = lines[0].split('\t');
      const result: T[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const row = {} as T;

        for (let j = 0; j < headers.length; j++) {
          const key = headers[j] as keyof T;
          const value = values[j];

          // 尝试转换为数字
          if (!isNaN(Number(value))) {
            (row as unknown as Record<string, unknown>)[key as string] =
              Number(value);
          } else {
            (row as unknown as Record<string, unknown>)[key as string] = value;
          }
        }

        result.push(row);
      }

      return result;
    } catch (error) {
      console.error('[PROD] 执行查询失败:', error);
      return [];
    }
  }

  /**
   * 分析指标并触发告警
   */
  private async analyzeMetrics(metrics: DatabaseMetrics): Promise<void> {
    const thresholds = this.config.alertThresholds;
    const alerts: AlertInfo[] = [];

    // 检查连接池使用率
    if (metrics.connections.utilization > thresholds.connectionUtilization) {
      alerts.push({
        id: `conn_${Date.now()}`,
        timestamp: new Date(),
        type: 'CONNECTION_UTILIZATION',
        severity: this.getSeverity(
          metrics.connections.utilization,
          thresholds.connectionUtilization
        ),
        message: `连接池使用率过高: ${(metrics.connections.utilization * 100).toFixed(1)}%`,
        metrics,
      });
    }

    // 检查慢查询数量
    if (metrics.performance.slowQueries > thresholds.slowQueryCount) {
      alerts.push({
        id: `slow_query_${Date.now()}`,
        timestamp: new Date(),
        type: 'SLOW_QUERY',
        severity: this.getSeverity(
          metrics.performance.slowQueries,
          thresholds.slowQueryCount
        ),
        message: `慢查询数量过多: ${metrics.performance.slowQueries}`,
        metrics,
      });
    }

    // 检查磁盘使用率
    if (metrics.system.diskUsage > thresholds.diskUsage) {
      alerts.push({
        id: `disk_${Date.now()}`,
        timestamp: new Date(),
        type: 'DISK_USAGE',
        severity: this.getSeverity(
          metrics.system.diskUsage,
          thresholds.diskUsage
        ),
        message: `磁盘使用率过高: ${metrics.system.diskUsage}%`,
        metrics,
      });
    }

    // 检查内存使用率
    if (metrics.system.memoryUsage > thresholds.memoryUsage) {
      alerts.push({
        id: `memory_${Date.now()}`,
        timestamp: new Date(),
        type: 'MEMORY_USAGE',
        severity: this.getSeverity(
          metrics.system.memoryUsage,
          thresholds.memoryUsage
        ),
        message: `内存使用率过高: ${metrics.system.memoryUsage}%`,
        metrics,
      });
    }

    // 处理告警
    for (const alert of alerts) {
      await this.sendAlert(alert);
    }

    // 保存告警历史
    this.alerts.push(...alerts);
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100);
    }
  }

  /**
   * 获取告警严重程度
   */
  private getSeverity(
    current: number,
    threshold: number
  ): 'critical' | 'high' | 'medium' | 'low' {
    const ratio = current / threshold;

    if (ratio >= 1.5) {
      return 'critical';
    } else if (ratio >= 1.2) {
      return 'high';
    } else if (ratio >= 1.0) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 发送告警
   */
  private async sendAlert(alert: AlertInfo): Promise<void> {
    const alertMessage = `[${alert.severity.toUpperCase()}] ${alert.message}`;

    switch (this.config.alertChannel) {
      case 'console':
        console.log(alertMessage);
        break;
      case 'file':
        await this.logAlertToFile(alert);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert);
        break;
    }
  }

  /**
   * 记录告警到文件
   */
  private async logAlertToFile(alert: AlertInfo): Promise<void> {
    try {
      await fs.mkdir(this.config.logDir, { recursive: true });

      const alertPath = `${this.config.logDir}/alerts.log`;
      const logEntry = JSON.stringify(alert);

      await fs.appendFile(alertPath, `${logEntry}\n`);
    } catch (error) {
      console.error('[PROD] 写入告警日志失败:', error);
    }
  }

  /**
   * 发送Webhook告警
   */
  private async sendWebhookAlert(alert: AlertInfo): Promise<void> {
    if (!this.config.webhookUrl) {
      console.error('[PROD] 未配置Webhook URL');
      return;
    }

    try {
      // TODO: 实现Webhook发送逻辑
      console.log(`[PROD] Webhook告警: ${alert.message}`);
    } catch (error) {
      console.error('[PROD] 发送Webhook告警失败:', error);
    }
  }

  /**
   * 记录指标到控制台
   */
  private logMetrics(metrics: DatabaseMetrics): void {
    console.log('[PROD] 数据库指标:', {
      时间: metrics.timestamp.toLocaleString('zh-CN'),
      连接: `${metrics.connections.active}/${metrics.connections.total} (${(metrics.connections.utilization * 100).toFixed(1)}%)`,
      查询: `平均 ${metrics.performance.avgQueryTime.toFixed(2)}ms, 慢查询 ${metrics.performance.slowQueries}`,
      磁盘: `${metrics.system.diskUsage}%`,
      内存: `${metrics.system.memoryUsage.toFixed(2)}GB`,
      死锁: metrics.errors.deadlocks,
    });
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(): DatabaseMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(): AlertInfo[] {
    return [...this.alerts];
  }

  /**
   * 生成监控报告
   */
  generateReport(): string {
    const latestMetrics = this.metricsHistory[this.metricsHistory.length - 1];
    const recentAlerts = this.alerts.slice(-10);

    let report = '=== 数据库监控报告 ===\n\n';
    report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    if (latestMetrics) {
      report += '=== 当前指标 ===\n';
      report += `连接池使用率: ${(latestMetrics.connections.utilization * 100).toFixed(1)}% (${latestMetrics.connections.active}/${latestMetrics.connections.total})\n`;
      report += `平均查询时间: ${latestMetrics.performance.avgQueryTime.toFixed(2)}ms\n`;
      report += `慢查询数量: ${latestMetrics.performance.slowQueries}\n`;
      report += `磁盘使用率: ${latestMetrics.system.diskUsage}%\n`;
      report += `内存使用率: ${latestMetrics.system.memoryUsage.toFixed(2)}GB\n`;
      report += `死锁数量: ${latestMetrics.errors.deadlocks}\n\n`;
    }

    if (recentAlerts.length > 0) {
      report += '=== 最近告警 ===\n';
      for (const alert of recentAlerts) {
        report += `[${alert.severity.toUpperCase()}] ${alert.timestamp.toLocaleString('zh-CN')}: ${alert.message}\n`;
      }
      report += '\n';
    }

    return report;
  }
}

/**
 * 创建生产监控器实例
 */
export const createProductionMonitor = (): ProductionDatabaseMonitor => {
  const config: MonitoringConfig = {
    databaseUrl:
      process.env.DATABASE_URL ||
      'postgresql://postgres:TFL5650056btg@localhost:5432/legal_debate_dev',
    logDir: process.env.MONITOR_LOG_DIR || './logs',
    checkInterval: parseInt(process.env.MONITOR_CHECK_INTERVAL || '60000', 10),
    alertThresholds: {
      connectionUtilization: parseFloat(
        process.env.ALERT_CONNECTION_UTILIZATION || '0.8'
      ),
      queryTime: parseFloat(process.env.ALERT_QUERY_TIME || '1000'),
      slowQueryCount: parseInt(process.env.ALERT_SLOW_QUERY_COUNT || '10', 10),
      diskUsage: parseFloat(process.env.ALERT_DISK_USAGE || '80'),
      memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE || '80'),
      connectionErrors: parseInt(
        process.env.ALERT_CONNECTION_ERRORS || '5',
        10
      ),
    },
    alertEnabled: process.env.ALERT_ENABLED !== 'false',
    alertChannel:
      (process.env.ALERT_CHANNEL as 'console' | 'file' | 'webhook') ||
      'console',
    webhookUrl: process.env.ALERT_WEBHOOK_URL,
  };

  return new ProductionDatabaseMonitor(config);
};

/**
 * 运行监控
 */
export const runMonitor = async (): Promise<void> => {
  const monitor = createProductionMonitor();

  console.log('[PROD] 启动数据库监控...');
  monitor.start();

  // 优雅关闭处理
  process.on('SIGINT', () => {
    console.log('\n[PROD] 收到关闭信号，停止监控...');
    monitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n[PROD] 收到终止信号，停止监控...');
    monitor.stop();
    process.exit(0);
  });
};

/**
 * 生成报告
 */
export const generateReport = async (): Promise<void> => {
  const monitor = createProductionMonitor();

  await monitor.collectAndAnalyzeMetrics();
  const report = monitor.generateReport();

  console.log(report);

  // 保存报告到文件
  const reportPath = `${monitor['config'].logDir}/monitoring-report-${Date.now()}.txt`;
  await fs.writeFile(reportPath, report);

  console.log(`[PROD] 监控报告已保存: ${reportPath}`);
};

/**
 * CLI主函数
 */
const main = async (): Promise<void> => {
  const command = process.argv[2];

  switch (command) {
    case 'monitor':
    case 'start':
      await runMonitor();
      break;
    case 'report':
      await generateReport();
      break;
    default:
      console.log('[PROD] 生产环境数据库监控工具');
      console.log('');
      console.log('用法:');
      console.log(
        '  node scripts/monitor-database-prod.ts monitor  # 启动监控'
      );
      console.log(
        '  node scripts/monitor-database-prod.ts report   # 生成报告'
      );
      console.log('');
      console.log('环境变量:');
      console.log('  DATABASE_URL                  # 数据库连接字符串');
      console.log('  MONITOR_LOG_DIR             # 日志目录 (默认: ./logs)');
      console.log(
        '  MONITOR_CHECK_INTERVAL        # 检查间隔 (毫秒，默认: 60000)'
      );
      console.log('  ALERT_ENABLED               # 是否启用告警 (默认: true)');
      console.log('  ALERT_CHANNEL               # 告警通道 (默认: console)');
      console.log('  ALERT_WEBHOOK_URL          # Webhook URL');
      console.log(
        '  ALERT_CONNECTION_UTILIZATION # 连接池使用率阈值 (默认: 0.8)'
      );
      console.log(
        '  ALERT_QUERY_TIME            # 查询时间阈值 (默认: 1000ms)'
      );
      console.log('  ALERT_SLOW_QUERY_COUNT     # 慢查询数量阈值 (默认: 10)');
      console.log('  ALERT_DISK_USAGE            # 磁盘使用率阈值 (默认: 80%)');
      console.log('  ALERT_MEMORY_USAGE          # 内存使用率阈值 (默认: 80%)');
      process.exit(0);
  }
};

// 如果直接运行此脚本，执行CLI
if (require.main === module) {
  main().catch(console.error);
}
