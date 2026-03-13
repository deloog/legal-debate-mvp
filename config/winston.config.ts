/**
 * 生产环境日志器配置模块
 * 基于Node.js内置模块实现的日志器，提供统一的日志接口
 * 支持控制台输出、文件输出、日志轮转等功能
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  LoggerConfig,
  LogLevel,
  LogFormat,
  LogOutput,
  LogEntry,
  LogContext,
  formatLogEntry,
  sanitizeContext,
  loadLoggerConfig,
} from './logger.config';

// Re-export types for convenience
export { LogLevel, LogFormat, LogOutput, loadLoggerConfig };
export type { LoggerConfig, LogContext };

/**
 * 日志器类
 */
export class Logger {
  private config: LoggerConfig;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private currentFileSize = 0;
  private currentFileIndex = 0;
  private currentFilePath = '';

  constructor(config: LoggerConfig) {
    this.config = config;
    this.initializeLogger();
  }

  /**
   * 初始化日志器
   */
  private async initializeLogger(): Promise<void> {
    if (this.config.file.enabled) {
      await this.ensureLogDirectory();
      this.currentFilePath = this.getCurrentLogPath();
    }

    if (this.config.performance.async) {
      this.startAsyncFlush();
    }
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.file.directory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * 获取当前日志文件路径
   */
  private getCurrentLogPath(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(
      this.config.file.directory,
      `${date}-${this.currentFileIndex}-${this.config.file.filename}`
    );
  }

  /**
   * 启动异步刷新
   */
  private startAsyncFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.performance.flushInterval);
  }

  /**
   * 停止异步刷新
   */
  private stopAsyncFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * 记录日志
   */
  log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): void {
    // 检查日志级别
    if (!this.shouldLog(level)) {
      return;
    }

    // 创建日志条目
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && {
        context: this.config.sanitize.enabled
          ? sanitizeContext(context, this.config.sanitize.sensitiveKeys)
          : context,
      }),
      ...(error && { error }),
    };

    // 处理日志
    if (this.config.performance.async) {
      this.buffer.push(entry);
      if (this.buffer.length >= this.config.performance.bufferSize) {
        void this.flush();
      }
    } else {
      void this.writeLog(entry);
    }
  }

  /**
   * 检查是否应该记录日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [
      LogLevel.DEBUG,
      LogLevel.INFO,
      LogLevel.WARN,
      LogLevel.ERROR,
      LogLevel.FATAL,
    ];
    const configLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    return logLevelIndex >= configLevelIndex;
  }

  /**
   * 写入日志
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    const formatted = formatLogEntry(entry, this.config.format);

    // 控制台输出
    if (
      this.config.output === LogOutput.CONSOLE ||
      this.config.output === LogOutput.BOTH
    ) {
      this.writeToConsole(formatted, entry.level);
    }

    // 文件输出
    if (
      this.config.output === LogOutput.FILE ||
      this.config.output === LogOutput.BOTH
    ) {
      if (this.config.file.enabled) {
        await this.writeToFile(formatted);
      }
    }
  }

  /**
   * 输出到控制台
   */
  private writeToConsole(formatted: string, level: LogLevel): void {
    if (!this.config.console.enabled) {
      return;
    }

    const method = this.getConsoleMethod(level);
    // 使用 bind 确保 this 绑定正确，避免在测试环境中出错
    method.call(console, formatted);
  }

  /**
   * 获取控制台方法
   */
  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  /**
   * 输出到文件
   */
  private async writeToFile(formatted: string): Promise<void> {
    try {
      // 检查文件大小
      if (this.currentFileSize > 0) {
        try {
          const stats = await fs.stat(this.currentFilePath);
          this.currentFileSize = stats.size;

          // 如果超过最大大小，切换到新文件
          if (this.currentFileSize >= this.config.file.maxSize) {
            this.currentFileIndex++;
            this.currentFilePath = this.getCurrentLogPath();
            this.currentFileSize = 0;
          }
        } catch {
          // 文件不存在，忽略错误
        }
      }

      // 追加写入
      await fs.appendFile(this.currentFilePath, formatted + '\n', 'utf8');
      this.currentFileSize += Buffer.byteLength(formatted + '\n', 'utf8');
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }

  /**
   * 刷新缓冲区
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    for (const entry of entries) {
      await this.writeLog(entry);
    }
  }

  /**
   * Debug级别日志
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Info级别日志
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Warn级别日志
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Error级别日志
   */
  error(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Fatal级别日志
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  /**
   * 清理旧日志文件
   */
  async cleanOldLogs(): Promise<void> {
    if (!this.config.file.enabled) {
      return;
    }

    try {
      const files = await fs.readdir(this.config.file.directory);
      const logFiles = files.filter(f => f.endsWith(this.config.file.filename));

      // 按修改时间排序
      const fileStats = await Promise.all(
        logFiles.map(async f => ({
          name: f,
          path: path.join(this.config.file.directory, f),
          mtime: (await fs.stat(path.join(this.config.file.directory, f)))
            .mtime,
        }))
      );

      fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      // 保留最近的N个文件，删除其余的
      const filesToDelete = fileStats.slice(0, -this.config.file.maxFiles);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  /**
   * 销毁日志器
   */
  async destroy(): Promise<void> {
    this.stopAsyncFlush();
    await this.flush();
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.buffer = [];
  }
}

/**
 * 创建日志器实例
 */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config);
}

/**
 * 导出默认日志器实例
 */
let defaultLoggerInstance: Logger | null = null;

export function getDefaultLogger(): Logger {
  if (!defaultLoggerInstance) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { defaultLoggerConfig } = require('./logger.config');
    defaultLoggerInstance = new Logger(defaultLoggerConfig);
  }
  return defaultLoggerInstance;
}

/**
 * 重置默认日志器实例（用于测试）
 */
export function resetDefaultLogger(): void {
  if (defaultLoggerInstance) {
    void defaultLoggerInstance.destroy();
    defaultLoggerInstance = null;
  }
}

/**
 * 便捷的日志函数
 */
export const logger = {
  debug: (message: string, context?: LogContext): void => {
    getDefaultLogger().debug(message, context);
  },
  info: (message: string, context?: LogContext): void => {
    getDefaultLogger().info(message, context);
  },
  warn: (message: string, context?: LogContext): void => {
    getDefaultLogger().warn(message, context);
  },
  error: (message: string, error?: Error, context?: LogContext): void => {
    getDefaultLogger().error(message, error, context);
  },
  fatal: (message: string, error?: Error, context?: LogContext): void => {
    getDefaultLogger().fatal(message, error, context);
  },
};

export default logger;
