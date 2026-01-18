/**
 * 生产环境日志配置模块
 * 提供统一的日志配置接口，支持多种日志级别和输出目标
 * 基于Node.js内置模块实现，无需额外依赖
 */

import { getStringEnv, getNumberEnv, getBooleanEnv } from './load-env';

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 'debug', // 调试信息
  INFO = 'info', // 一般信息
  WARN = 'warn', // 警告信息
  ERROR = 'error', // 错误信息
  FATAL = 'fatal', // 致命错误
}

/**
 * 日志输出目标枚举
 */
export enum LogOutput {
  CONSOLE = 'console', // 控制台输出
  FILE = 'file', // 文件输出
  BOTH = 'both', // 同时输出到控制台和文件
}

/**
 * 日志格式枚举
 */
export enum LogFormat {
  JSON = 'json', // JSON格式
  TEXT = 'text', // 文本格式
  PRETTY = 'pretty', // 彩色格式
}

/**
 * 日志上下文接口
 */
export interface LogContext {
  userId?: string;
  caseId?: string;
  requestId?: string;
  agentName?: string;
  taskType?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  // 基础配置
  level: LogLevel;
  format: LogFormat;
  output: LogOutput;

  // 控制台配置
  console: {
    enabled: boolean;
    colorize: boolean;
    timestamp: boolean;
  };

  // 文件配置
  file: {
    enabled: boolean;
    directory: string;
    filename: string;
    maxSize: number; // 字节
    maxFiles: number;
    compress: boolean;
  };

  // 环境特定配置
  environment: string;
  isProduction: boolean;

  // 安全配置
  sanitize: {
    enabled: boolean;
    sensitiveKeys: string[];
  };

  // 性能配置
  performance: {
    async: boolean;
    bufferSize: number;
    flushInterval: number; // 毫秒
  };
}

/**
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 获取日志级别
 */
export function getLogLevel(): LogLevel {
  const env = process.env.NODE_ENV;
  const level = getStringEnv('LOG_LEVEL');

  if (level) {
    return level as LogLevel;
  }

  // 根据环境设置默认级别
  if (env === 'production') {
    return LogLevel.INFO;
  }
  if (env === 'test') {
    return LogLevel.WARN;
  }
  return LogLevel.DEBUG;
}

/**
 * 获取日志格式
 */
export function getLogFormat(): LogFormat {
  const format = getStringEnv('LOG_FORMAT');
  const isProduction = process.env.NODE_ENV === 'production';

  if (format) {
    return format as LogFormat;
  }

  // 生产环境默认JSON格式
  if (isProduction) {
    return LogFormat.JSON;
  }

  // 开发环境默认PRETTY格式
  return LogFormat.PRETTY;
}

/**
 * 获取日志输出目标
 */
export function getLogOutput(): LogOutput {
  const output = getStringEnv('LOG_OUTPUT');
  const isProduction = process.env.NODE_ENV === 'production';

  if (output) {
    return output as LogOutput;
  }

  // 生产环境同时输出到文件和控制台
  if (isProduction) {
    return LogOutput.BOTH;
  }

  // 开发环境仅输出到控制台
  return LogOutput.CONSOLE;
}

/**
 * 加载敏感键配置
 */
function loadSensitiveKeys(): string[] {
  const defaultKeys = 'password,token,secret,apiKey,key,authorization';
  const envValue = getStringEnv('LOG_SANITIZE_KEYS', defaultKeys);
  return envValue.split(',').map(k => k.trim().toLowerCase());
}

/**
 * 加载日志配置
 */
export function loadLoggerConfig(): LoggerConfig {
  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  const config: LoggerConfig = {
    // 基础配置
    level: getLogLevel(),
    format: getLogFormat(),
    output: getLogOutput(),

    // 控制台配置
    console: {
      enabled: getBooleanEnv('LOG_CONSOLE_ENABLED', !isProduction),
      colorize: getBooleanEnv('LOG_CONSOLE_COLORIZE', !isProduction),
      timestamp: getBooleanEnv('LOG_CONSOLE_TIMESTAMP', true),
    },

    // 文件配置
    file: {
      enabled: getBooleanEnv('LOG_FILE_ENABLED', isProduction),
      directory: getStringEnv('LOG_FILE_DIR', './logs'),
      filename: getStringEnv('LOG_FILE_NAME', 'app.log'),
      maxSize: getNumberEnv('LOG_FILE_MAX_SIZE', 104857600, {
        min: 1048576, // 1MB
        max: 1073741824, // 1GB
      }), // 默认100MB
      maxFiles: getNumberEnv('LOG_FILE_MAX_FILES', 10, { min: 1, max: 30 }),
      compress: getBooleanEnv('LOG_FILE_COMPRESS', true),
    },

    // 环境配置
    environment: env,
    isProduction,

    // 安全配置
    sanitize: {
      enabled: getBooleanEnv('LOG_SANITIZE_ENABLED', true),
      sensitiveKeys: loadSensitiveKeys(),
    },

    // 性能配置
    performance: {
      async: getBooleanEnv('LOG_ASYNC', isProduction),
      bufferSize: getNumberEnv('LOG_BUFFER_SIZE', 100, { min: 1, max: 1000 }),
      flushInterval: getNumberEnv('LOG_FLUSH_INTERVAL', 5000, {
        min: 1000,
        max: 30000,
      }),
    },
  };

  return config;
}

/**
 * 验证日志配置
 */
export function validateLoggerConfig(
  config: LoggerConfig
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证日志级别
  if (!Object.values(LogLevel).includes(config.level)) {
    errors.push(`无效的日志级别: ${config.level}`);
  }

  // 验证日志格式
  if (!Object.values(LogFormat).includes(config.format)) {
    errors.push(`无效的日志格式: ${config.format}`);
  }

  // 验证输出目标
  if (!Object.values(LogOutput).includes(config.output)) {
    errors.push(`无效的输出目标: ${config.output}`);
  }

  // 验证文件配置
  if (config.file.enabled) {
    if (!config.file.directory || config.file.directory.trim() === '') {
      errors.push('文件日志目录不能为空');
    }

    if (!config.file.filename || config.file.filename.trim() === '') {
      errors.push('文件日志文件名不能为空');
    }

    if (config.file.maxSize < 1048576) {
      warnings.push('文件日志最大大小过小（建议≥1MB）');
    }

    if (config.file.maxFiles < 1) {
      warnings.push('保留文件数过少（建议≥1）');
    }
  }

  // 验证性能配置
  if (config.performance.async) {
    if (config.performance.bufferSize < 1) {
      errors.push('异步日志缓冲区大小必须≥1');
    }

    if (config.performance.flushInterval < 1000) {
      warnings.push('异步日志刷新间隔过短（建议≥1000ms）');
    }
  }

  // 生产环境警告
  if (config.isProduction) {
    if (config.level === LogLevel.DEBUG) {
      warnings.push('生产环境不建议使用DEBUG级别');
    }

    if (config.format === LogFormat.PRETTY) {
      warnings.push('生产环境建议使用JSON格式');
    }

    if (!config.file.enabled) {
      warnings.push('生产环境建议启用文件日志');
    }

    if (!config.performance.async) {
      warnings.push('生产环境建议启用异步日志');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 格式化日志条目
 */
export function formatLogEntry(entry: LogEntry, format: LogFormat): string {
  switch (format) {
    case LogFormat.JSON:
      return JSON.stringify(entry);

    case LogFormat.PRETTY:
      return formatPrettyEntry(entry);

    case LogFormat.TEXT:
    default:
      return formatTextEntry(entry);
  }
}

/**
 * 格式化为彩色文本
 */
function formatPrettyEntry(entry: LogEntry): string {
  const colors = {
    [LogLevel.DEBUG]: '\x1b[36m', // Cyan
    [LogLevel.INFO]: '\x1b[32m', // Green
    [LogLevel.WARN]: '\x1b[33m', // Yellow
    [LogLevel.ERROR]: '\x1b[31m', // Red
    [LogLevel.FATAL]: '\x1b[35m', // Magenta
  };
  const reset = '\x1b[0m';

  const color = colors[entry.level] || '';
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const timestamp = entry.timestamp;
  const message = entry.message;

  let result = `${color}[${timestamp}] ${levelStr}${reset} ${message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    result += ` | ${JSON.stringify(entry.context)}`;
  }

  if (entry.error) {
    result += `\n  ${entry.error.stack || entry.error.message}`;
  }

  return result;
}

/**
 * 格式化为普通文本
 */
function formatTextEntry(entry: LogEntry): string {
  const timestamp = entry.timestamp;
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const message = entry.message;

  let result = `[${timestamp}] ${levelStr} ${message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    result += ` | ${JSON.stringify(entry.context)}`;
  }

  if (entry.error) {
    result += `\n  ${entry.error.stack || entry.error.message}`;
  }

  return result;
}

/**
 * 脱敏日志上下文
 */
export function sanitizeContext(
  context: LogContext,
  sensitiveKeys: string[]
): LogContext {
  const sanitized: LogContext = { ...context };

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'string') {
      const value = sanitized[key] as string;
      if (value.length > 500) {
        sanitized[key] = `${value.substring(0, 500)}...` as never;
      }
    }
  }

  return sanitized;
}

/**
 * 生成日志文件名
 */
export function generateLogFilename(
  baseFilename: string,
  level?: LogLevel
): string {
  const date = new Date().toISOString().split('T')[0];
  const levelSuffix = level ? `.${level}` : '';
  return `${date}${levelSuffix}-${baseFilename}`;
}

/**
 * 获取配置摘要
 */
export function getConfigSummary(config: LoggerConfig): string {
  return `
日志配置摘要
================

基础配置
- 日志级别: ${config.level}
- 日志格式: ${config.format}
- 输出目标: ${config.output}
- 环境: ${config.environment}

控制台配置
- 启用: ${config.console.enabled ? '是' : '否'}
- 彩色输出: ${config.console.colorize ? '是' : '否'}
- 时间戳: ${config.console.timestamp ? '是' : '否'}

文件配置
- 启用: ${config.file.enabled ? '是' : '否'}
- 目录: ${config.file.directory}
- 文件名: ${config.file.filename}
- 最大大小: ${(config.file.maxSize / 1024 / 1024).toFixed(2)}MB
- 保留文件数: ${config.file.maxFiles}
- 压缩: ${config.file.compress ? '是' : '否'}

安全配置
- 脱敏: ${config.sanitize.enabled ? '是' : '否'}
- 敏感键: ${config.sanitize.sensitiveKeys.join(', ')}

性能配置
- 异步日志: ${config.performance.async ? '是' : '否'}
- 缓冲区大小: ${config.performance.bufferSize}
- 刷新间隔: ${config.performance.flushInterval}ms
`.trim();
}

/**
 * 导出默认配置
 */
export const defaultLoggerConfig = loadLoggerConfig();

export default defaultLoggerConfig;
