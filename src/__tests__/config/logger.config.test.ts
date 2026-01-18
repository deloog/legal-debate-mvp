/**
 * Logger配置模块单元测试
 */

import {
  LogLevel,
  LogFormat,
  LogOutput,
  loadLoggerConfig,
  validateLoggerConfig,
  formatLogEntry,
  sanitizeContext,
  generateLogFilename,
  getConfigSummary,
  getLogLevel,
  getLogFormat,
  getLogOutput,
  type LogContext,
  type LogEntry,
} from '../../../config/logger.config';

describe('LoggerConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 清理环境变量
    delete process.env.LOG_LEVEL;
    delete process.env.LOG_FORMAT;
    delete process.env.LOG_OUTPUT;
    delete process.env.LOG_SANITIZE_KEYS;
    delete process.env.LOG_CONSOLE_ENABLED;
    delete process.env.LOG_CONSOLE_COLORIZE;
    delete process.env.LOG_CONSOLE_TIMESTAMP;
    delete process.env.LOG_FILE_ENABLED;
    delete process.env.LOG_FILE_DIR;
    delete process.env.LOG_FILE_NAME;
    delete process.env.LOG_FILE_MAX_SIZE;
    delete process.env.LOG_FILE_MAX_FILES;
    delete process.env.LOG_FILE_COMPRESS;
    delete process.env.LOG_ASYNC;
    delete process.env.LOG_BUFFER_SIZE;
    delete process.env.LOG_FLUSH_INTERVAL;
  });

  afterAll(() => {
    // 恢复原始环境变量
    const env = process.env as Record<string, string | undefined>;
    env.NODE_ENV = originalEnv.NODE_ENV || 'test';
  });

  describe('getLogLevel', () => {
    it('应该返回环境变量指定的日志级别', () => {
      process.env.LOG_LEVEL = 'error';
      const level = getLogLevel();
      expect(level).toBe(LogLevel.ERROR);
    });

    it('生产环境默认返回INFO级别', () => {
      // 使用defineProperty设置环境变量
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'production';
      const level = getLogLevel();
      expect(level).toBe(LogLevel.INFO);
    });

    it('测试环境默认返回WARN级别', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'test';
      const level = getLogLevel();
      expect(level).toBe(LogLevel.WARN);
    });

    it('开发环境默认返回DEBUG级别', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'development';
      const level = getLogLevel();
      expect(level).toBe(LogLevel.DEBUG);
    });
  });

  describe('getLogFormat', () => {
    it('应该返回环境变量指定的日志格式', () => {
      process.env.LOG_FORMAT = 'json';
      const format = getLogFormat();
      expect(format).toBe(LogFormat.JSON);
    });

    it('生产环境默认返回JSON格式', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'production';
      const format = getLogFormat();
      expect(format).toBe(LogFormat.JSON);
    });

    it('开发环境默认返回PRETTY格式', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'development';
      const format = getLogFormat();
      expect(format).toBe(LogFormat.PRETTY);
    });
  });

  describe('getLogOutput', () => {
    it('应该返回环境变量指定的输出目标', () => {
      process.env.LOG_OUTPUT = 'file';
      const output = getLogOutput();
      expect(output).toBe(LogOutput.FILE);
    });

    it('生产环境默认返回BOTH输出', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'production';
      const output = getLogOutput();
      expect(output).toBe(LogOutput.BOTH);
    });

    it('开发环境默认返回CONSOLE输出', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'development';
      const output = getLogOutput();
      expect(output).toBe(LogOutput.CONSOLE);
    });
  });

  describe('loadLoggerConfig', () => {
    it('应该加载默认配置', () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = 'development';
      const config = loadLoggerConfig();

      expect(config).toBeDefined();
      expect(config.level).toBe(LogLevel.DEBUG);
      expect(config.format).toBe(LogFormat.PRETTY);
      expect(config.output).toBe(LogOutput.CONSOLE);
      expect(config.environment).toBe('development');
      expect(config.isProduction).toBe(false);
    });

    it('应该从环境变量加载配置', () => {
      process.env.LOG_LEVEL = 'error';
      process.env.LOG_FORMAT = 'json';
      process.env.LOG_OUTPUT = 'both';
      process.env.LOG_FILE_ENABLED = 'true';
      process.env.LOG_ASYNC = 'true';

      const config = loadLoggerConfig();

      expect(config.level).toBe(LogLevel.ERROR);
      expect(config.format).toBe(LogFormat.JSON);
      expect(config.output).toBe(LogOutput.BOTH);
      expect(config.file.enabled).toBe(true);
      expect(config.performance.async).toBe(true);
    });

    it('应该设置生产环境特定配置', () => {
      // @ts-expect-error - 测试中需要修改环境变量
      process.env.NODE_ENV = 'production';
      const config = loadLoggerConfig();

      expect(config.isProduction).toBe(true);
      expect(config.console.enabled).toBe(false);
      expect(config.file.enabled).toBe(true);
      expect(config.performance.async).toBe(true);
    });

    it('应该设置测试环境特定配置', () => {
      // @ts-expect-error - 测试中需要修改环境变量
      process.env.NODE_ENV = 'test';
      const config = loadLoggerConfig();

      expect(config.isProduction).toBe(false);
      expect(config.level).toBe(LogLevel.WARN);
    });

    it('应该加载敏感键配置', () => {
      const config = loadLoggerConfig();

      expect(config.sanitize.enabled).toBe(true);
      expect(config.sanitize.sensitiveKeys).toContain('password');
      expect(config.sanitize.sensitiveKeys).toContain('token');
      expect(config.sanitize.sensitiveKeys).toContain('secret');
    });

    it('应该限制文件最大大小范围', () => {
      process.env.LOG_FILE_MAX_SIZE = '0';
      const config = loadLoggerConfig();

      expect(config.file.maxSize).toBeGreaterThanOrEqual(1048576);
    });

    it('应该限制保留文件数范围', () => {
      process.env.LOG_FILE_MAX_FILES = '100';
      const config = loadLoggerConfig();

      expect(config.file.maxFiles).toBeLessThanOrEqual(30);
    });

    it('应该限制缓冲区大小范围', () => {
      process.env.LOG_BUFFER_SIZE = '2000';
      const config = loadLoggerConfig();

      expect(config.performance.bufferSize).toBeLessThanOrEqual(1000);
    });

    it('应该限制刷新间隔范围', () => {
      process.env.LOG_FLUSH_INTERVAL = '500';
      const config = loadLoggerConfig();

      expect(config.performance.flushInterval).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('validateLoggerConfig', () => {
    it('应该验证有效的配置', () => {
      const config = loadLoggerConfig();
      const result = validateLoggerConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的日志级别', () => {
      const config = loadLoggerConfig();
      (config as unknown as { level: string }).level = 'invalid';

      const result = validateLoggerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('无效的日志级别: invalid');
    });

    it('应该拒绝无效的日志格式', () => {
      const config = loadLoggerConfig();
      (config as unknown as { format: string }).format = 'invalid';

      const result = validateLoggerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('无效的日志格式: invalid');
    });

    it('应该拒绝无效的输出目标', () => {
      const config = loadLoggerConfig();
      (config as unknown as { output: string }).output = 'invalid';

      const result = validateLoggerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('无效的输出目标: invalid');
    });

    it('应该验证文件日志配置', () => {
      const config = loadLoggerConfig();
      config.file.enabled = true;
      config.file.directory = '';

      const result = validateLoggerConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('文件日志目录不能为空');
    });

    it('应该警告文件日志最大大小过小', () => {
      const config = loadLoggerConfig();
      config.file.enabled = true;
      config.file.maxSize = 100;

      const result = validateLoggerConfig(config);

      expect(result.warnings).toContain('文件日志最大大小过小（建议≥1MB）');
    });

    it('应该警告生产环境使用DEBUG级别', () => {
      const config = loadLoggerConfig();
      config.isProduction = true;
      config.level = LogLevel.DEBUG;

      const result = validateLoggerConfig(config);

      expect(result.warnings).toContain('生产环境不建议使用DEBUG级别');
    });

    it('应该警告生产环境使用PRETTY格式', () => {
      const config = loadLoggerConfig();
      config.isProduction = true;
      config.format = LogFormat.PRETTY;

      const result = validateLoggerConfig(config);

      expect(result.warnings).toContain('生产环境建议使用JSON格式');
    });

    it('应该警告生产环境未启用文件日志', () => {
      const config = loadLoggerConfig();
      config.isProduction = true;
      config.file.enabled = false;

      const result = validateLoggerConfig(config);

      expect(result.warnings).toContain('生产环境建议启用文件日志');
    });

    it('应该警告生产环境未启用异步日志', () => {
      const config = loadLoggerConfig();
      config.isProduction = true;
      config.performance.async = false;

      const result = validateLoggerConfig(config);

      expect(result.warnings).toContain('生产环境建议启用异步日志');
    });
  });

  describe('formatLogEntry', () => {
    const baseEntry: LogEntry = {
      level: LogLevel.INFO,
      message: 'Test message',
      timestamp: '2026-01-17T00:00:00.000Z',
    };

    it('应该格式化为JSON', () => {
      const formatted = formatLogEntry(baseEntry, LogFormat.JSON);
      expect(() => JSON.parse(formatted)).not.toThrow();

      const parsed = JSON.parse(formatted) as LogEntry;
      expect(parsed.level).toBe(LogLevel.INFO);
      expect(parsed.message).toBe('Test message');
    });

    it('应该格式化为PRETTY格式', () => {
      const formatted = formatLogEntry(baseEntry, LogFormat.PRETTY);
      expect(formatted).toContain('[2026-01-17T00:00:00.000Z]');
      expect(formatted).toContain('INFO');
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('\x1b['); // 包含颜色代码
    });

    it('应该格式化为TEXT格式', () => {
      const formatted = formatLogEntry(baseEntry, LogFormat.TEXT);
      expect(formatted).toContain('[2026-01-17T00:00:00.000Z]');
      expect(formatted).toContain('INFO');
      expect(formatted).toContain('Test message');
      expect(formatted).not.toContain('\x1b['); // 不包含颜色代码
    });

    it('应该包含上下文信息', () => {
      const entry: LogEntry = {
        ...baseEntry,
        context: {
          userId: 'user123',
          requestId: 'req456',
        },
      };

      const formatted = formatLogEntry(entry, LogFormat.TEXT);
      expect(formatted).toContain('userId');
      expect(formatted).toContain('user123');
    });

    it('应该包含错误堆栈', () => {
      const error = new Error('Test error');
      const entry: LogEntry = {
        ...baseEntry,
        error,
      };

      const formatted = formatLogEntry(entry, LogFormat.TEXT);
      expect(formatted).toContain('Test error');
      expect(formatted).toContain('Error:');
    });
  });

  describe('sanitizeContext', () => {
    it('应该脱敏敏感键', () => {
      const context: LogContext = {
        userId: 'user123',
        password: 'secret123',
        token: 'abc456',
        apiKey: 'key789',
      };

      const sensitiveKeys = ['password', 'token', 'apikey'];
      const sanitized = sanitizeContext(context, sensitiveKeys);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.userId).toBe('user123');
    });

    it('应该不区分大小写匹配敏感键', () => {
      const context: LogContext = {
        Password: 'secret123',
        TOKEN: 'abc456',
        ApiKey: 'key789',
      };

      const sensitiveKeys = ['password', 'token', 'apikey'];
      const sanitized = sanitizeContext(context, sensitiveKeys);

      expect(sanitized.Password).toBe('[REDACTED]');
      expect(sanitized.TOKEN).toBe('[REDACTED]');
      expect(sanitized.ApiKey).toBe('[REDACTED]');
    });

    it('应该截断过长的字符串', () => {
      const longString = 'a'.repeat(600);
      const context: LogContext = {
        data: longString,
      };

      const sanitized = sanitizeContext(context, []);
      const dataValue = sanitized.data;
      if (typeof dataValue === 'string') {
        expect(dataValue.length).toBeLessThanOrEqual(503); // 500 + '...'
      }
    });

    it('应该保留非敏感键和非字符串值', () => {
      const context: LogContext = {
        count: 100,
        active: true,
        username: 'user123',
      };

      const sanitized = sanitizeContext(context, ['password']);
      expect(sanitized.count).toBe(100);
      expect(sanitized.active).toBe(true);
      expect(sanitized.username).toBe('user123');
    });
  });

  describe('generateLogFilename', () => {
    it('应该生成基本日志文件名', () => {
      const filename = generateLogFilename('app.log');
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-app\.log$/);
    });

    it('应该生成带级别的日志文件名', () => {
      const filename = generateLogFilename('app.log', LogLevel.ERROR);
      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}\.error-app\.log$/);
    });

    it('应该使用当前日期', () => {
      const filename = generateLogFilename('app.log');
      const dateStr = new Date().toISOString().split('T')[0];
      expect(filename).toContain(dateStr);
    });
  });

  describe('getConfigSummary', () => {
    it('应该生成配置摘要', () => {
      const config = loadLoggerConfig();
      const summary = getConfigSummary(config);

      expect(summary).toContain('日志配置摘要');
      expect(summary).toContain('日志级别:');
      expect(summary).toContain('日志格式:');
      expect(summary).toContain('输出目标:');
      expect(summary).toContain('环境:');
    });

    it('应该显示所有配置项', () => {
      const config = loadLoggerConfig();
      const summary = getConfigSummary(config);

      expect(summary).toContain('控制台配置');
      expect(summary).toContain('文件配置');
      expect(summary).toContain('安全配置');
      expect(summary).toContain('性能配置');
    });

    it('应该格式化文件大小', () => {
      const config = loadLoggerConfig();
      const summary = getConfigSummary(config);

      expect(summary).toContain('MB');
    });

    it('应该格式化刷新间隔', () => {
      const config = loadLoggerConfig();
      const summary = getConfigSummary(config);

      expect(summary).toContain('ms');
    });
  });
});
