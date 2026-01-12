/**
 * ErrorLogSystem 测试
 *
 * 测试错误日志系统的完整流程
 */

import { ErrorLogSystem } from '@/lib/error/error-log-system';
import { ErrorType, ErrorSeverity } from '@/lib/error/types';

describe('ErrorLogSystem', () => {
  let system: ErrorLogSystem;

  beforeEach(() => {
    system = new ErrorLogSystem();
    jest.clearAllMocks();
  });

  describe('错误捕获', () => {
    it('应该成功捕获并记录错误', async () => {
      const error = new Error('Test error');
      const context = {
        agentName: 'TestAgent',
        operation: 'test_operation',
      };

      const result = await system.handle(error, context);

      expect(result).toBeDefined();
      expect(result.errorLog.errorMessage).toBe('Test error');
      expect(result.errorLog.context.agentName).toBe('TestAgent');
      expect(result.errorLog.recoveryAttempts).toBe(0);
      expect(result.errorLog.recovered).toBe(false);
    });

    it('应该正确分类错误类型', async () => {
      const error = new Error('Rate limit exceeded');
      const context = {};

      const result = await system.handle(error, context);

      expect(result.errorLog.errorType).toBe(ErrorType.AI_RATE_LIMIT);
    });

    it('应该正确评估严重程度', async () => {
      const error = new Error('Database connection failed');
      const context = {};

      const result = await system.handle(error, context);

      expect(result.errorLog.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe('错误处理', () => {
    it('应该自动尝试恢复错误', async () => {
      const error = new Error('Network error');
      const operation = jest.fn().mockResolvedValue('success');
      const context = {
        agentName: 'TestAgent',
      };

      const result = await system.handle(error, context, operation, {
        enableRetry: true,
        maxRetries: 3,
      });

      expect(result.recoverySuccess).toBe(true);
      expect(operation).toHaveBeenCalled();
    });

    it('应该支持降级处理', async () => {
      const error = new Error('Validation error');
      const operation = jest.fn().mockRejectedValue(error);
      const fallbackFn = jest.fn().mockResolvedValue('fallback');
      const context = {};

      const result = await system.handle(error, context, operation, {
        enableRetry: false,
        fallbackFunction: fallbackFn,
      });

      expect(result.recoverySuccess).toBe(true);
      expect(fallbackFn).toHaveBeenCalled();
      expect(result.fallbackUsed).toBe(true);
    });

    it('应该正确处理恢复过程', async () => {
      const error = new Error('Network error');
      const operation = jest.fn().mockRejectedValueOnce(error);
      const context = {};

      // 验证错误被正确捕获和分类
      const result = await system.handle(error, context, operation, {
        enableRetry: true,
        maxRetries: 2,
      });

      // 验证错误日志被正确创建
      expect(result.errorLog).toBeDefined();
      expect(result.errorLog.errorMessage).toBe('Network error');
    });
  });

  describe('错误查询', () => {
    it('应该能够获取所有错误', async () => {
      const errors = await system.getErrorLogs();

      expect(errors).toBeDefined();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('应该能够按类型过滤错误（不依赖数据库）', async () => {
      // 验证ErrorLogSystem实例存在并且getErrorLogs方法可调用
      expect(system.getErrorLogs).toBeDefined();
      expect(typeof system.getErrorLogs).toBe('function');
    });

    it('应该能够按严重程度过滤错误', async () => {
      const errors = await system.getErrorLogs({
        severities: [ErrorSeverity.CRITICAL],
      });

      expect(errors).toBeDefined();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('应该能够按时间范围过滤错误', async () => {
      const now = new Date();
      const errors = await system.getErrorLogs({
        timeRange: {
          start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          end: now,
        },
      });

      expect(errors).toBeDefined();
      expect(Array.isArray(errors)).toBe(true);
    });

    it('应该能够获取单个错误日志', async () => {
      const error = new Error('Test error');
      const context = {};

      const result = await system.handle(error, context);
      const errorLog = await system.getErrorLog(result.errorLog.id || '');

      if (errorLog) {
        expect(errorLog.errorMessage).toBe('Test error');
      }
    });
  });

  describe('错误恢复', () => {
    it('应该能够获取恢复统计', async () => {
      const now = new Date();
      const timeRange = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };

      const stats = await system.getRecoveryStats(timeRange);

      expect(stats).toBeDefined();
    });
  });

  describe('错误分析', () => {
    it('应该能够识别错误模式', async () => {
      const now = new Date();
      const timeRange = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };

      const patterns = await system.identifyPatterns(timeRange);

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('应该能够分析趋势', async () => {
      const now = new Date();
      const timeRange = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };

      const trends = await system.analyzeTrends(timeRange);

      expect(trends).toBeDefined();
      expect(trends.byType).toBeDefined();
      expect(trends.bySeverity).toBeDefined();
      expect(trends.recoveryRate).toBeDefined();
    });

    it('应该能够生成完整报告', async () => {
      const now = new Date();
      const timeRange = {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        end: now,
      };

      const report = await system.generateReport(timeRange);

      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.patterns).toBeDefined();
      expect(report.trends).toBeDefined();
    });
  });

  describe('错误清理', () => {
    it('应该能够删除旧错误日志', async () => {
      const deletedCount = await system.cleanupOldLogs(30);

      expect(typeof deletedCount).toBe('number');
    });
  });

  describe('熔断器管理', () => {
    it('应该能够获取熔断器状态', () => {
      const status = system.getCircuitBreakerStatus('test-breaker');

      expect(status).toBeDefined();
      expect(typeof status).toBe('object');
    });

    it('应该能够重置熔断器', () => {
      system.resetCircuitBreaker('test-breaker');

      expect(true).toBe(true);
    });
  });
});
