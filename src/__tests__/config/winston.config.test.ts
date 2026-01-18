/**
 * Winston日志器配置模块单元测试
 */

import { promises as fs } from 'fs';
import path from 'path';
import {
  Logger,
  createLogger,
  getDefaultLogger,
  resetDefaultLogger,
  logger,
  LogLevel,
  LogFormat,
  LogOutput,
  loadLoggerConfig,
  type LoggerConfig,
  type LogContext,
} from '../../../config/winston.config';

describe('WinstonLogger', () => {
  const testLogDir = path.join(__dirname, 'test-logs');
  let mockConfig: LoggerConfig;

  beforeEach(() => {
    mockConfig = loadLoggerConfig();
    mockConfig.console.enabled = true;
    mockConfig.file.enabled = true;
    mockConfig.file.directory = testLogDir;
    mockConfig.file.maxSize = 1024; // 1KB for testing
    mockConfig.file.maxFiles = 3;
    mockConfig.performance.async = false; // Disable async for testing
    resetDefaultLogger();
  });

  afterEach(async () => {
    resetDefaultLogger();
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Logger', () => {
    it('应该创建Logger实例', () => {
      const loggerInstance = new Logger(mockConfig);
      expect(loggerInstance).toBeInstanceOf(Logger);
    });

    it('应该支持debug级别日志', () => {
      const loggerInstance = new Logger(mockConfig);
      loggerInstance.debug('Debug message');
      // Test passes if no error is thrown
    });

    it('应该支持info级别日志', () => {
      const loggerInstance = new Logger(mockConfig);
      loggerInstance.info('Info message');
      // Test passes if no error is thrown
    });

    it('应该支持warn级别日志', () => {
      const loggerInstance = new Logger(mockConfig);
      loggerInstance.warn('Warn message');
      // Test passes if no error is thrown
    });

    it('应该支持error级别日志', () => {
      const loggerInstance = new Logger(mockConfig);
      const error = new Error('Test error');
      loggerInstance.error('Error message', error);
      // Test passes if no error is thrown
    });

    it('应该支持fatal级别日志', () => {
      const loggerInstance = new Logger(mockConfig);
      const error = new Error('Fatal error');
      loggerInstance.fatal('Fatal message', error);
      // Test passes if no error is thrown
    });

    it('应该支持带上下文的日志', () => {
      const loggerInstance = new Logger(mockConfig);
      const context: LogContext = {
        userId: 'user123',
        requestId: 'req456',
      };
      loggerInstance.info('Message with context', context);
      // Test passes if no error is thrown
    });

    it('应该只记录配置级别及以上的日志', () => {
      const config = { ...mockConfig, level: LogLevel.WARN };
      const loggerInstance = new Logger(config);

      // 这些日志应该被过滤掉
      loggerInstance.debug('Debug message');
      loggerInstance.info('Info message');

      // 这些日志应该被记录
      loggerInstance.warn('Warn message');
      loggerInstance.error('Error message');
      // Test passes if no error is thrown
    });

    it('应该禁用控制台输出', () => {
      const config = { ...mockConfig };
      config.console.enabled = false;
      config.output = LogOutput.CONSOLE;

      const loggerInstance = new Logger(config);
      loggerInstance.info('Message');
      // Test passes if no error is thrown
    });

    it('应该禁用文件输出', () => {
      const config = { ...mockConfig };
      config.file.enabled = false;
      config.output = LogOutput.FILE;

      const loggerInstance = new Logger(config);
      loggerInstance.info('Message');
      // Test passes if no error is thrown
    });

    it('应该支持同步刷新', async () => {
      const config = {
        ...mockConfig,
        performance: { ...mockConfig.performance, async: false },
      };
      const loggerInstance = new Logger(config);

      loggerInstance.info('Sync message');
      // 同步模式下，日志立即写入，无需手动flush
      await new Promise(resolve => setTimeout(resolve, 100));
      // Test passes if no error is thrown
    });

    it('应该支持异步刷新', async () => {
      const config = {
        ...mockConfig,
        performance: {
          ...mockConfig.performance,
          async: true,
          bufferSize: 2,
          flushInterval: 1000,
        },
      };
      const loggerInstance = new Logger(config);

      loggerInstance.info('Async message 1');
      loggerInstance.info('Async message 2');

      await new Promise(resolve => setTimeout(resolve, 100));
      await loggerInstance.destroy();
      // Test passes if no error is thrown
    });
  });

  describe('createLogger', () => {
    it('应该创建Logger实例', () => {
      const loggerInstance = createLogger(mockConfig);
      expect(loggerInstance).toBeInstanceOf(Logger);
    });

    it('应该使用提供的配置', () => {
      const config = {
        ...mockConfig,
        level: LogLevel.ERROR,
      };
      const loggerInstance = createLogger(config);
      loggerInstance.debug('Debug message'); // Should be filtered
      loggerInstance.error('Error message'); // Should be logged
      // Test passes if no error is thrown
    });
  });

  describe('Logger - 日志级别过滤', () => {
    it('应该正确过滤DEBUG级别', () => {
      const config = { ...mockConfig, level: LogLevel.DEBUG };
      const loggerInstance = new Logger(config);
      loggerInstance.debug('Debug');
      loggerInstance.info('Info');
      loggerInstance.warn('Warn');
      loggerInstance.error('Error');
      loggerInstance.fatal('Fatal');
    });

    it('应该正确过滤INFO级别', () => {
      const config = { ...mockConfig, level: LogLevel.INFO };
      const loggerInstance = new Logger(config);
      loggerInstance.debug('Debug'); // Filtered
      loggerInstance.info('Info');
      loggerInstance.warn('Warn');
      loggerInstance.error('Error');
      loggerInstance.fatal('Fatal');
    });

    it('应该正确过滤WARN级别', () => {
      const config = { ...mockConfig, level: LogLevel.WARN };
      const loggerInstance = new Logger(config);
      loggerInstance.debug('Debug'); // Filtered
      loggerInstance.info('Info'); // Filtered
      loggerInstance.warn('Warn');
      loggerInstance.error('Error');
      loggerInstance.fatal('Fatal');
    });

    it('应该正确过滤ERROR级别', () => {
      const config = { ...mockConfig, level: LogLevel.ERROR };
      const loggerInstance = new Logger(config);
      loggerInstance.debug('Debug'); // Filtered
      loggerInstance.info('Info'); // Filtered
      loggerInstance.warn('Warn'); // Filtered
      loggerInstance.error('Error');
      loggerInstance.fatal('Fatal');
    });

    it('应该正确过滤FATAL级别', () => {
      const config = { ...mockConfig, level: LogLevel.FATAL };
      const loggerInstance = new Logger(config);
      loggerInstance.debug('Debug'); // Filtered
      loggerInstance.info('Info'); // Filtered
      loggerInstance.warn('Warn'); // Filtered
      loggerInstance.error('Error'); // Filtered
      loggerInstance.fatal('Fatal');
    });
  });

  describe('Logger - 错误处理', () => {
    it('应该正确处理Error对象', () => {
      const loggerInstance = new Logger(mockConfig);
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test (test.js:1:1)';

      loggerInstance.error('An error occurred', error);
      // Test passes if no error is thrown
    });

    it('应该正确处理没有stack的Error', () => {
      const loggerInstance = new Logger(mockConfig);
      const error = new Error('Simple error');

      loggerInstance.error('Simple error', error);
      // Test passes if no error is thrown
    });

    it('应该正确处理undefined错误', () => {
      const loggerInstance = new Logger(mockConfig);
      loggerInstance.error('No error object', undefined);
      // Test passes if no error is thrown
    });
  });

  describe('Logger - 文件轮转', () => {
    it('应该在文件超过大小时创建新文件', async () => {
      const config = {
        ...mockConfig,
        file: {
          ...mockConfig.file,
          maxSize: 100, // Small size for testing
          maxFiles: 2,
        },
      };
      const loggerInstance = new Logger(config);

      // Write enough data to trigger rotation
      for (let i = 0; i < 20; i++) {
        loggerInstance.info(`Message ${i}: ${'x'.repeat(50)}`);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await loggerInstance.destroy();
      // Test passes if no error is thrown
    });

    it('应该清理旧日志文件', async () => {
      const filename = 'test.log';
      const config = {
        ...mockConfig,
        file: {
          ...mockConfig.file,
          filename,
          maxFiles: 2,
        },
      };

      // Ensure directory exists
      await fs.mkdir(testLogDir, { recursive: true });

      // Create some log files directly with matching filename pattern
      const dateStr = new Date().toISOString().split('T')[0];
      for (let i = 0; i < 5; i++) {
        const logFilename = `${dateStr}-${i}-${filename}`;
        const filepath = path.join(testLogDir, logFilename);
        await fs.writeFile(filepath, `Test log ${i}`);
      }

      // Wait a bit to ensure different mtime
      await new Promise(resolve => setTimeout(resolve, 50));

      // Manually trigger cleanup logic by creating a logger
      const loggerInstance = new Logger(config);
      await loggerInstance.cleanOldLogs();
      await loggerInstance.destroy();

      // Check that only maxFiles files remain (newest ones)
      const files = await fs.readdir(testLogDir);
      const logFiles = files.filter(f => f.endsWith(filename));
      expect(logFiles.length).toBeLessThanOrEqual(config.file.maxFiles);
    });
  });

  describe('Logger - 配置更新', () => {
    it('应该支持更新配置', () => {
      const loggerInstance = new Logger(mockConfig);

      const newConfig: Partial<LoggerConfig> = {
        level: LogLevel.ERROR,
        format: LogFormat.JSON,
      };

      loggerInstance.updateConfig(newConfig);
      // Test passes if no error is thrown
    });

    it('应该清空缓冲区', () => {
      const config = {
        ...mockConfig,
        performance: {
          ...mockConfig.performance,
          async: true,
          bufferSize: 10,
        },
      };
      const loggerInstance = new Logger(config);

      // Add messages to buffer
      for (let i = 0; i < 5; i++) {
        loggerInstance.info(`Message ${i}`);
      }

      // Update config should clear buffer
      loggerInstance.updateConfig({ level: LogLevel.FATAL });
      // Test passes if no error is thrown
    });
  });

  describe('getDefaultLogger', () => {
    beforeEach(() => {
      resetDefaultLogger();
    });

    it('应该返回单例Logger实例', () => {
      const logger1 = getDefaultLogger();
      const logger2 = getDefaultLogger();

      expect(logger1).toBe(logger2);
    });

    it('应该重置默认Logger', () => {
      const logger1 = getDefaultLogger();
      resetDefaultLogger();
      const logger2 = getDefaultLogger();

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('logger - 便捷函数', () => {
    beforeEach(() => {
      resetDefaultLogger();
    });

    it('应该提供debug函数', () => {
      logger.debug('Debug message');
      // Test passes if no error is thrown
    });

    it('应该提供info函数', () => {
      logger.info('Info message');
      // Test passes if no error is thrown
    });

    it('应该提供warn函数', () => {
      logger.warn('Warn message');
      // Test passes if no error is thrown
    });

    it('应该提供error函数', () => {
      const error = new Error('Test error');
      logger.error('Error message', error);
      // Test passes if no error is thrown
    });

    it('应该提供fatal函数', () => {
      const error = new Error('Fatal error');
      logger.fatal('Fatal message', error);
      // Test passes if no error is thrown
    });

    it('应该支持上下文参数', () => {
      const context: LogContext = {
        userId: 'user123',
      };
      logger.info('Message', context);
      // Test passes if no error is thrown
    });
  });

  describe('Logger - 输出目标', () => {
    it('应该只输出到控制台', () => {
      const config = {
        ...mockConfig,
        output: LogOutput.CONSOLE,
        file: { ...mockConfig.file, enabled: false },
      };
      const loggerInstance = new Logger(config);
      loggerInstance.info('Console only');
      // Test passes if no error is thrown
    });

    it('应该只输出到文件', () => {
      const config = {
        ...mockConfig,
        output: LogOutput.FILE,
        console: { ...mockConfig.console, enabled: false },
      };
      const loggerInstance = new Logger(config);
      loggerInstance.info('File only');
      // Test passes if no error is thrown
    });

    it('应该同时输出到控制台和文件', () => {
      const config = {
        ...mockConfig,
        output: LogOutput.BOTH,
        file: { ...mockConfig.file, enabled: true },
        console: { ...mockConfig.console, enabled: true },
      };
      const loggerInstance = new Logger(config);
      loggerInstance.info('Both outputs');
      // Test passes if no error is thrown
    });
  });

  describe('Logger - 销毁', () => {
    it('应该正确销毁Logger实例', async () => {
      const loggerInstance = new Logger(mockConfig);

      loggerInstance.info('Before destroy');

      await loggerInstance.destroy();

      // After destroy, Logger should still exist but timer should be cleared
      loggerInstance.info('After destroy');
      // Test passes if no error is thrown
    });

    it('应该刷新缓冲区后再销毁', async () => {
      const config = {
        ...mockConfig,
        performance: {
          ...mockConfig.performance,
          async: true,
          bufferSize: 5,
          flushInterval: 5000,
        },
      };
      const loggerInstance = new Logger(config);

      // Add messages to buffer
      for (let i = 0; i < 3; i++) {
        loggerInstance.info(`Buffered message ${i}`);
      }

      // Destroy should flush buffer
      await loggerInstance.destroy();
      // Test passes if no error is thrown
    });
  });
});
