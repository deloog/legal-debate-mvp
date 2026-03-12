/**
 * 采集器健康监控脚本
 * 实时监控采集器状态，检测异常并报警
 */

import { flkCrawler } from '../../src/lib/crawler/flk-crawler';
import { getLogger, CrawlerLogger } from '../../src/lib/crawler/crawler-logger';
import * as path from 'path';
import * as fs from 'fs';

interface MonitorConfig {
  checkInterval: number; // 检查间隔（毫秒）
  alertThresholds: {
    noProgressTime: number; // 无进展时间阈值（毫秒）
    highErrorRate: number; // 高错误率阈值（百分比）
    lowMemory: number; // 低内存警告（MB）
  };
  alertMethods: {
    console: boolean;
    log: boolean;
    webhook?: string; // Webhook URL for alerts
  };
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  uptime: number;
  progress: {
    status: string;
    processed: number;
    total: number;
    percentage: number;
    lastUpdate: string;
  };
  errors: {
    recent: string[];
    count: number;
    rate: number;
  };
  memory: {
    used: number;
    heapUsed: number;
    external: number;
  };
  alerts: string[];
}

class HealthMonitor {
  private logger = getLogger('HealthMonitor');
  private crawlerLogger: CrawlerLogger;
  private config: MonitorConfig;
  private timer?: NodeJS.Timeout;
  private outputDir: string;
  private startTime: number;
  private lastProgressTime: number;
  private lastProcessedCount: number;
  private running = false;

  constructor(outputDir: string, config: Partial<MonitorConfig> = {}) {
    this.outputDir = outputDir || path.resolve('data/crawled/flk');
    this.config = {
      checkInterval: 30000, // 30 seconds
      alertThresholds: {
        noProgressTime: 10 * 60 * 1000, // 10 minutes
        highErrorRate: 50, // 50%
        lowMemory: 100, // 100 MB
      },
      alertMethods: {
        console: true,
        log: true,
      },
      ...config,
    };

    this.crawlerLogger = getLogger('FLKCrawler');
    this.startTime = Date.now();
    this.lastProgressTime = Date.now();
    this.lastProcessedCount = 0;
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.running) {
      this.logger.warn('监控已在运行');
      return;
    }

    this.running = true;
    this.logger.info('健康监控启动', {
      checkInterval: `${this.config.checkInterval / 1000}s`,
      thresholds: this.config.alertThresholds,
    });

    this.check(); // 立即执行一次检查

    this.timer = setInterval(() => {
      this.check();
    }, this.config.checkInterval);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.logger.info('健康监控停止');
  }

  /**
   * 执行健康检查
   */
  private check(): void {
    const status = this.getHealthStatus();
    this.logStatus(status);
    this.checkAlerts(status);
    this.saveStatus(status);
  }

  /**
   * 获取健康状态
   */
  getHealthStatus(): HealthStatus {
    const progress = flkCrawler.getProgress();
    const stats = flkCrawler.getStats(this.outputDir);
    const memory = process.memoryUsage();
    const now = Date.now();

    // 计算错误率
    const errorCount = stats.parse.failed;
    const totalParsed = stats.parse.total;
    const errorRate = totalParsed > 0 ? (errorCount / totalParsed) * 100 : 0;

    // 检查进展
    if (progress.processedItems > this.lastProcessedCount) {
      this.lastProgressTime = now;
      this.lastProcessedCount = progress.processedItems;
    }

    const noProgressTime = now - this.lastProgressTime;
    const percentage =
      progress.totalItems > 0
        ? (progress.processedItems / progress.totalItems) * 100
        : 0;

    // 获取最近错误
    const recentErrors = this.crawlerLogger
      .getErrorSummary()
      .errors.slice(0, 10);

    return {
      status: this.determineStatus(noProgressTime, errorRate, memory.heapUsed),
      timestamp: new Date().toISOString(),
      uptime: now - this.startTime,
      progress: {
        status: progress.status,
        processed: progress.processedItems,
        total: progress.totalItems,
        percentage: Math.round(percentage * 100) / 100,
        lastUpdate: progress.startedAt
          ? new Date(progress.startedAt).toISOString()
          : '',
      },
      errors: {
        recent: recentErrors,
        count: errorCount,
        rate: Math.round(errorRate * 100) / 100,
      },
      memory: {
        used: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
      },
      alerts: [],
    };
  }

  /**
   * 确定健康状态
   */
  private determineStatus(
    noProgressTime: number,
    errorRate: number,
    heapUsed: number
  ): 'healthy' | 'warning' | 'critical' {
    if (
      noProgressTime > this.config.alertThresholds.noProgressTime ||
      errorRate > this.config.alertThresholds.highErrorRate ||
      heapUsed < this.config.alertThresholds.lowMemory
    ) {
      return 'critical';
    }

    if (
      noProgressTime > this.config.alertThresholds.noProgressTime / 2 ||
      errorRate > this.config.alertThresholds.highErrorRate / 2
    ) {
      return 'warning';
    }

    return 'healthy';
  }

  /**
   * 记录状态
   */
  private logStatus(status: HealthStatus): void {
    const statusEmoji =
      status.status === 'healthy'
        ? '✅'
        : status.status === 'warning'
          ? '⚠️'
          : '🚨';

    this.logger.info(`${statusEmoji} 健康检查`, {
      status: status.status,
      uptime: `${Math.floor(status.uptime / 1000)}s`,
      progress: `${status.progress.processed}/${status.progress.total} (${status.progress.percentage}%)`,
      errors: `${status.errors.count} (rate: ${status.errors.rate}%)`,
      memory: `${status.memory.heapUsed}MB`,
    });
  }

  /**
   * 检查并生成警报
   */
  private checkAlerts(status: HealthStatus): void {
    const alerts: string[] = [];
    const now = Date.now();
    const noProgressTime = now - this.lastProgressTime;

    // 检查无进展
    if (noProgressTime > this.config.alertThresholds.noProgressTime) {
      alerts.push(
        `⚠️ 采集器 ${Math.floor(noProgressTime / 60000)} 分钟无进展，可能卡住`
      );
    }

    // 检查错误率
    if (status.errors.rate > this.config.alertThresholds.highErrorRate) {
      alerts.push(
        `⚠️ 错误率过高: ${status.errors.rate}% (阈值: ${this.config.alertThresholds.highErrorRate}%)`
      );
    }

    // 检查内存
    if (status.memory.heapUsed < this.config.alertThresholds.lowMemory) {
      alerts.push(
        `⚠️ 内存使用过低: ${status.memory.heapUsed}MB (阈值: ${this.config.alertThresholds.lowMemory}MB)`
      );
    }

    // 检查状态
    if (status.progress.status === 'failed') {
      alerts.push('🚨 采集器状态为失败');
    }

    status.alerts = alerts;

    if (alerts.length > 0) {
      this.sendAlerts(alerts);
    }
  }

  /**
   * 发送警报
   */
  private sendAlerts(alerts: string[]): void {
    const message = `[HealthMonitor] ${new Date().toISOString()}\n${alerts.join('\n')}`;

    if (this.config.alertMethods.console) {
      console.warn(message);
    }

    if (this.config.alertMethods.log) {
      this.logger.warn('健康警报', { alerts });
    }

    if (this.config.alertMethods.webhook) {
      this.sendWebhookAlert(message);
    }
  }

  /**
   * 发送 Webhook 警报
   */
  private async sendWebhookAlert(message: string): Promise<void> {
    try {
      const response = await fetch(this.config.alertMethods.webhook!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: message }),
      });

      if (!response.ok) {
        this.logger.warn('Webhook 警报发送失败', { status: response.status });
      }
    } catch (error) {
      this.logger.warn(
        'Webhook 警报发送异常',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 保存状态到文件
   */
  private saveStatus(status: HealthStatus): void {
    try {
      const statusFile = path.join(this.outputDir, 'health-status.json');
      fs.writeFileSync(statusFile, JSON.stringify(status, null, 2), 'utf-8');
    } catch (error) {
      this.logger.warn(
        '保存健康状态失败',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取历史状态
   */
  getHistory(): HealthStatus[] {
    try {
      const historyFile = path.join(this.outputDir, 'health-history.json');
      if (fs.existsSync(historyFile)) {
        return JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
      }
    } catch {
      // Ignore
    }
    return [];
  }

  /**
   * 生成报告
   */
  generateReport(): string {
    const status = this.getHealthStatus();
    const stats = flkCrawler.getStats(this.outputDir);

    return `
=== 采集器健康报告 ===
时间: ${status.timestamp}
运行时间: ${Math.floor(status.uptime / 1000)} 秒

--- 进度 ---
状态: ${status.progress.status}
已处理: ${status.progress.processed}/${status.progress.total}
进度: ${status.progress.percentage}%
最后更新: ${status.progress.lastUpdate}

--- 错误 ---
错误数: ${status.errors.count}
错误率: ${status.errors.rate}%
最近错误:
${status.errors.recent
  .slice(0, 5)
  .map(e => `  - ${e}`)
  .join('\n')}

--- 下载统计 ---
总数: ${stats.download.total}
状态: ${stats.download.status}
最后更新: ${stats.download.lastUpdated}

--- 解析统计 ---
总数: ${stats.parse.total}
成功: ${stats.parse.success}
失败: ${stats.parse.failed}
失败率: ${stats.parse.failRate}
最后运行: ${stats.parse.lastRun}

--- 内存 ---
RSS: ${status.memory.used} MB
Heap: ${status.memory.heapUsed} MB
External: ${status.memory.external} MB

--- 健康状态 ---
状态: ${status.status}
警报: ${status.alerts.length > 0 ? status.alerts.join('\n') : '无'}
`.trim();
  }
}

/**
 * 启动监控
 */
export function startMonitoring(
  outputDir?: string,
  config?: Partial<MonitorConfig>
): HealthMonitor {
  const monitor = new HealthMonitor(outputDir, config);
  monitor.start();
  return monitor;
}

/**
 * 获取当前健康状态
 */
export function getHealthStatus(outputDir?: string): HealthStatus {
  const monitor = new HealthMonitor(outputDir);
  return monitor.getHealthStatus();
}

/**
 * 生成健康报告
 */
export function generateHealthReport(outputDir?: string): string {
  const monitor = new HealthMonitor(outputDir);
  return monitor.generateReport();
}

// 命令行接口
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'monitor';
  const outputDir = args[1] || path.resolve('data/crawled/flk');

  switch (command) {
    case 'monitor':
      const monitor = new HealthMonitor(outputDir);
      monitor.start();
      console.log('健康监控已启动，按 Ctrl+C 停止');
      break;
    case 'status':
      const status = getHealthStatus(outputDir);
      console.log(JSON.stringify(status, null, 2));
      break;
    case 'report':
      const report = generateHealthReport(outputDir);
      console.log(report);
      break;
    default:
      console.log('用法:');
      console.log(
        '  npm run health-monitor monitor [output-dir]  - 启动持续监控'
      );
      console.log(
        '  npm run health-monitor status [output-dir]   - 获取当前状态'
      );
      console.log(
        '  npm run health-monitor report [output-dir]   - 生成健康报告'
      );
      break;
  }
}

export { HealthMonitor };
export type { MonitorConfig, HealthStatus };
