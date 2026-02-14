/**
 * 采集器守护进程
 * 提供自动重启、异常恢复和健康监控功能
 */

import { flkCrawler, FLKCrawlOptions, FLKTypeCode } from '../../src/lib/crawler/flk-crawler';
import { getLogger } from '../../src/lib/crawler/crawler-logger';
import * as path from 'path';
import * as fs from 'fs';

interface DaemonConfig {
  maxRestarts: number;
  restartDelay: number;
  healthCheckInterval: number;
  autoRetry: boolean;
  maxConsecutiveFailures: number;
}

interface DaemonState {
  pid: number;
  startTime: string;
  restartCount: number;
  consecutiveFailures: number;
  lastSuccess: string | null;
  lastFailure: string | null;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';
}

class CrawlerDaemon {
  private config: DaemonConfig;
  private state: DaemonState;
  private logger = getLogger('CrawlerDaemon');
  private healthCheckTimer?: NodeJS.Timeout;
  private running = false;
  private outputDir: string;

  constructor(
    private options: FLKCrawlOptions & { outputDir?: string } = {},
    daemonConfig?: Partial<DaemonConfig>
  ) {
    this.config = {
      maxRestarts: 10,
      restartDelay: 60000, // 1 minute
      healthCheckInterval: 30000, // 30 seconds
      autoRetry: true,
      maxConsecutiveFailures: 5,
      ...daemonConfig,
    };

    this.outputDir = options.outputDir || path.resolve('data/crawled/flk');

    this.state = {
      pid: process.pid,
      startTime: new Date().toISOString(),
      restartCount: 0,
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null,
      status: 'idle',
    };

    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      this.logger.info(`接收到 ${signal} 信号，开始优雅关闭...`);
      this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => {
      this.logger.info('接收到 SIGHUP 信号，重新加载配置');
      this.restart();
    });

    process.on('uncaughtException', error => {
      this.logger.error('未捕获的异常', error);
      this.state.consecutiveFailures++;
      this.handleFailure(error);
    });

    process.on('unhandledRejection', reason => {
      this.logger.error('未处理的 Promise 拒绝', reason instanceof Error ? reason : undefined);
      this.state.consecutiveFailures++;
    });
  }

  /**
   * 启动守护进程
   */
  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('守护进程已在运行');
      return;
    }

    this.running = true;
    this.state.status = 'running';
    this.logger.info('守护进程启动', {
      pid: process.pid,
      startTime: this.state.startTime,
      config: this.config,
    });

    // 保存状态
    this.saveState();

    // 启动健康检查
    this.startHealthCheck();

    // 开始执行采集任务
    await this.runWithRetry();
  }

  /**
   * 带重试的运行
   */
  private async runWithRetry(): Promise<void> {
    while (this.running && this.state.restartCount < this.config.maxRestarts) {
      try {
        this.logger.info(`开始采集任务 (第 ${this.state.restartCount + 1} 次尝试)`, {
          consecutiveFailures: this.state.consecutiveFailures,
        });

        const result = await flkCrawler.crawl(this.options);

        if (result.success) {
          this.handleSuccess(result);
          // 成功后退出，避免无限循环
          break;
        } else {
          this.handleFailure(new Error(result.errors.join('; ')));
        }
      } catch (error) {
        this.logger.error('采集任务异常', error instanceof Error ? error : undefined);
        this.handleFailure(error);
      }

      // 检查是否达到连续失败阈值
      if (this.state.consecutiveFailures >= this.config.maxConsecutiveFailures) {
        this.logger.error(
          `连续失败 ${this.state.consecutiveFailures} 次，达到阈值，停止守护进程`
        );
        this.stop();
        break;
      }

      // 检查是否启用自动重试
      if (!this.config.autoRetry) {
        this.logger.info('自动重试已禁用，停止守护进程');
        this.stop();
        break;
      }

      // 延迟后重试
      if (this.running) {
        this.logger.info(`${this.config.restartDelay / 1000} 秒后重试...`);
        await this.sleep(this.config.restartDelay);
        this.state.restartCount++;
        this.saveState();
      }
    }

    if (this.state.restartCount >= this.config.maxRestarts) {
      this.logger.error(`达到最大重试次数 ${this.config.maxRestarts}，停止守护进程`);
      this.stop();
    }
  }

  /**
   * 处理成功
   */
  private handleSuccess(result: any): void {
    this.state.consecutiveFailures = 0;
    this.state.lastSuccess = new Date().toISOString();
    this.state.status = 'completed';
    
    this.logger.info('采集任务成功完成', {
      itemsCrawled: result.itemsCrawled,
      itemsCreated: result.itemsCreated,
      itemsUpdated: result.itemsUpdated,
      duration: `${result.duration / 1000}s`,
      errors: result.errors.length,
    });

    this.saveState();
    this.running = false;
  }

  /**
   * 处理失败
   */
  private handleFailure(error: any): void {
    this.state.consecutiveFailures++;
    this.state.lastFailure = new Date().toISOString();
    this.state.status = 'failed';
    
    this.logger.error('采集任务失败', error instanceof Error ? error : undefined, {
      consecutiveFailures: this.state.consecutiveFailures,
      error: error instanceof Error ? error.message : String(error),
    });

    this.saveState();
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    this.logger.info(`健康检查已启动，间隔 ${this.config.healthCheckInterval / 1000}s`);
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    try {
      const stats = flkCrawler.getStats(this.outputDir);
      const progress = flkCrawler.getProgress();

      this.logger.debug('健康检查', {
        downloadStatus: stats.download.status,
        downloadTotal: stats.download.total,
        parseSuccess: stats.parse.success,
        parseFailed: stats.parse.failed,
        crawlerStatus: progress.status,
        processedItems: progress.processedItems,
        totalItems: progress.totalItems,
      });

      // 检查是否有长时间无响应的情况
      if (progress.status === 'running') {
        const elapsed = Date.now() - new Date(progress.startedAt || Date.now()).getTime();
        if (elapsed > 10 * 60 * 1000) { // 10 minutes
          this.logger.warn(`采集器已运行 ${Math.floor(elapsed / 60000)} 分钟，可能卡住`);
        }
      }
    } catch (error) {
      this.logger.warn('健康检查失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 停止守护进程
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.state.status = 'stopped';

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.logger.info('守护进程已停止', {
      restartCount: this.state.restartCount,
      consecutiveFailures: this.state.consecutiveFailures,
      duration: `${Date.now() - new Date(this.state.startTime).getTime()}ms`,
    });

    this.saveState();
  }

  /**
   * 重启守护进程
   */
  async restart(): Promise<void> {
    this.logger.info('重启守护进程...');
    this.stop();
    await this.sleep(2000);
    await this.start();
  }

  /**
   * 暂停守护进程
   */
  pause(): void {
    this.state.status = 'paused';
    this.logger.info('守护进程已暂停');
    this.saveState();
  }

  /**
   * 恢复守护进程
   */
  async resume(): Promise<void> {
    if (this.state.status === 'paused') {
      this.logger.info('恢复守护进程...');
      this.state.status = 'running';
      this.saveState();
      await this.runWithRetry();
    }
  }

  /**
   * 获取守护进程状态
   */
  getState(): DaemonState {
    return { ...this.state };
  }

  /**
   * 保存状态到文件
   */
  private saveState(): void {
    try {
      const stateFile = path.join(this.outputDir, 'daemon-state.json');
      fs.writeFileSync(
        stateFile,
        JSON.stringify(this.state, null, 2),
        'utf-8'
      );
    } catch (error) {
      this.logger.warn('保存守护进程状态失败', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 加载状态
   */
  private loadState(): DaemonState | null {
    try {
      const stateFile = path.join(this.outputDir, 'daemon-state.json');
      if (fs.existsSync(stateFile)) {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
        this.logger.info('加载守护进程状态', state);
        return state;
      }
    } catch (error) {
      this.logger.warn('加载守护进程状态失败', error instanceof Error ? error : undefined);
    }
    return null;
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * 从命令行启动守护进程
 */
export async function startDaemon(options: FLKCrawlOptions = {}): Promise<void> {
  const daemon = new CrawlerDaemon(options, {
    autoRetry: true,
    maxConsecutiveFailures: 5,
    healthCheckInterval: 30000,
  });

  await daemon.start();
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: FLKCrawlOptions = {};

  // 解析命令行参数
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--types') {
      options.types = args[++i].split(',').map(Number) as FLKTypeCode[];
    } else if (arg === '--max-pages') {
      options.maxPages = parseInt(args[++i], 10);
    } else if (arg === '--page-size') {
      options.pageSize = parseInt(args[++i], 10);
    } else if (arg === '--since-date') {
      options.sinceDate = args[++i];
    } else if (arg === '--output-dir') {
      options.outputDir = args[++i];
    }
  }

  startDaemon(options).catch(error => {
    console.error('启动守护进程失败:', error);
    process.exit(1);
  });
}

export { CrawlerDaemon };
export type { DaemonConfig, DaemonState };
