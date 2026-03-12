/**
 * 采集器专用日志系统
 * 提供文件记录、控制台输出和数据库存储的多层日志功能
 */

import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  crawler: string;
  message: string;
  data?: unknown;
  error?: {
    message: string;
    stack?: string;
  };
}

export class CrawlerLogger {
  private crawlerName: string;
  private logDir: string;
  private logFilePath: string;
  private maxLogSize: number = 10 * 1024 * 1024; // 10MB

  constructor(crawlerName: string, logDir: string = 'logs') {
    this.crawlerName = crawlerName;
    this.logDir = path.resolve(logDir);
    this.logFilePath = path.join(
      this.logDir,
      `crawler-${crawlerName.toLowerCase()}.log`
    );
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private rotateLogIfNeeded(): void {
    if (!fs.existsSync(this.logFilePath)) return;

    const stats = fs.statSync(this.logFilePath);
    if (stats.size >= this.maxLogSize) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = this.logFilePath.replace('.log', `-${timestamp}.log`);
      fs.renameSync(this.logFilePath, archivePath);
    }
  }

  private writeToFile(entry: LogEntry): void {
    try {
      this.rotateLogIfNeeded();
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFilePath, line, 'utf-8');
    } catch (error) {
      console.error(`[CrawlerLogger] Failed to write to file:`, error);
    }
  }

  private writeToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString('zh-CN');
    const prefix = `[${timestamp}] [${entry.level}] [${entry.crawler}]`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(prefix, entry.message);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry.message);
        break;
      case LogLevel.DEBUG:
        console.debug(prefix, entry.message);
        if (entry.data) {
          console.debug(JSON.stringify(entry.data, null, 2));
        }
        break;
      case LogLevel.INFO:
      default:
        console.log(prefix, entry.message);
        if (entry.data) {
          console.log(JSON.stringify(entry.data, null, 2));
        }
        break;
    }
  }

  private log(
    level: LogLevel,
    message: string,
    data?: unknown,
    error?: Error
  ): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      crawler: this.crawlerName,
      message,
      data,
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    this.writeToConsole(entry);
    this.writeToFile(entry);
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data, error);
  }

  /**
   * 读取最近的日志
   */
  readRecentLogs(lines: number = 100): string[] {
    try {
      if (!fs.existsSync(this.logFilePath)) {
        return [];
      }

      const content = fs.readFileSync(this.logFilePath, 'utf-8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines);
    } catch (error) {
      console.error('[CrawlerLogger] Failed to read logs:', error);
      return [];
    }
  }

  /**
   * 获取错误日志摘要
   */
  getErrorSummary(): { count: number; errors: string[] } {
    const logs = this.readRecentLogs(1000);
    const errors: string[] = [];

    for (const logLine of logs) {
      try {
        const entry: LogEntry = JSON.parse(logLine);
        if (entry.level === LogLevel.ERROR) {
          errors.push(`${entry.timestamp}: ${entry.message}`);
        }
      } catch {
        // Skip invalid JSON
      }
    }

    return { count: errors.length, errors };
  }

  /**
   * 清空日志
   */
  clearLogs(): void {
    try {
      if (fs.existsSync(this.logFilePath)) {
        fs.unlinkSync(this.logFilePath);
      }
    } catch (error) {
      console.error('[CrawlerLogger] Failed to clear logs:', error);
    }
  }
}

/**
 * 全局日志实例工厂
 */
const loggerInstances = new Map<string, CrawlerLogger>();

export function getLogger(crawlerName: string): CrawlerLogger {
  if (!loggerInstances.has(crawlerName)) {
    loggerInstances.set(crawlerName, new CrawlerLogger(crawlerName));
  }
  return loggerInstances.get(crawlerName)!;
}
