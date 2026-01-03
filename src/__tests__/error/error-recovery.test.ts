/**
 * ErrorRecovery 测试
 *
 * 测试错误恢复器
 */

import { ErrorRecovery } from "@/lib/error/error-recovery";
import {
  ErrorLog,
  ErrorType,
  ErrorSeverity,
  RecoveryMethod,
} from "@/lib/error/types";

describe("ErrorRecovery", () => {
  let recovery: ErrorRecovery;

  beforeEach(() => {
    recovery = new ErrorRecovery();
  });

  describe("错误恢复流程", () => {
    it("应该成功恢复网络错误", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.NETWORK_ERROR,
        errorMessage: "Network error",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const result = await recovery.attemptRecovery(errorLog, mockOperation, {
        enableRetry: true,
        maxRetries: 3,
        enableBackoff: false,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe(RecoveryMethod.RETRY);
      expect(errorLog.recovered).toBe(true);
      expect(mockOperation).toHaveBeenCalled();
    });

    it("应该在成功时立即停止重试", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.NETWORK_ERROR,
        errorMessage: "Network error",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const result = await recovery.attemptRecovery(errorLog, mockOperation, {
        enableRetry: true,
        maxRetries: 3,
        enableBackoff: false,
      });

      expect(result.success).toBe(true);
      expect(errorLog.recoveryAttempts).toBe(1);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("应该使用降级函数", async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error("Failed"));
      const fallbackFn = jest.fn().mockResolvedValue("fallback");
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.VALIDATION_ERROR,
        errorMessage: "Validation error",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const result = await recovery.attemptRecovery(errorLog, mockOperation, {
        enableRetry: false,
        fallbackFunction: fallbackFn,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe(RecoveryMethod.FALLBACK);
      expect(fallbackFn).toHaveBeenCalled();
    });

    it("应该尝试重试并最终失败", async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error("Failed"));
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.NETWORK_ERROR,
        errorMessage: "Network error",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      const result = await recovery.attemptRecovery(errorLog, mockOperation, {
        enableRetry: true,
        maxRetries: 2,
        enableBackoff: false,
        fallbackFunction: undefined,
      });

      expect(result.success).toBe(false);
      expect(errorLog.recovered).toBe(false);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("应该在已恢复时直接返回", async () => {
      const mockOperation = jest.fn();
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.NETWORK_ERROR,
        errorMessage: "Network error",
        context: {},
        severity: ErrorSeverity.MEDIUM,
        recoveryAttempts: 1,
        recovered: true,
        recoveryMethod: RecoveryMethod.RETRY,
        learned: false,
        createdAt: new Date(),
      };

      const result = await recovery.attemptRecovery(errorLog, mockOperation, {
        enableRetry: true,
        maxRetries: 3,
      });

      expect(result.success).toBe(true);
      expect(result.method).toBe(RecoveryMethod.RETRY);
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });

  describe("忽略错误", () => {
    it("应该正确标记错误为忽略", () => {
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.MEMORY_EXPIRED,
        errorMessage: "Memory expired",
        context: {},
        severity: ErrorSeverity.LOW,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      recovery.ignore(errorLog);

      expect(errorLog.recovered).toBe(true);
      expect(errorLog.recoveryMethod).toBe(RecoveryMethod.IGNORE);
      expect(errorLog.recoveryAttempts).toBe(1);
    });
  });

  describe("人工介入", () => {
    it("应该正确标记需要人工介入", () => {
      const errorLog: ErrorLog = {
        id: "1",
        errorType: ErrorType.AGENT_NOT_FOUND,
        errorMessage: "Agent not found",
        context: {},
        severity: ErrorSeverity.CRITICAL,
        recoveryAttempts: 0,
        recovered: false,
        learned: false,
        createdAt: new Date(),
      };

      recovery.markForManualIntervention(errorLog);

      expect(errorLog.recovered).toBe(false);
      expect(errorLog.recoveryMethod).toBe(RecoveryMethod.MANUAL_INTERVENTION);
    });
  });

  describe("恢复统计", () => {
    it("应该正确计算恢复统计信息", () => {
      const errorLogs: ErrorLog[] = [
        {
          id: "1",
          errorType: ErrorType.NETWORK_ERROR,
          errorMessage: "Error 1",
          context: {},
          severity: ErrorSeverity.MEDIUM,
          recoveryAttempts: 2,
          recovered: true,
          recoveryMethod: RecoveryMethod.RETRY,
          recoveryTime: 1000,
          learned: false,
          createdAt: new Date(),
        },
        {
          id: "2",
          errorType: ErrorType.VALIDATION_ERROR,
          errorMessage: "Error 2",
          context: {},
          severity: ErrorSeverity.MEDIUM,
          recoveryAttempts: 1,
          recovered: true,
          recoveryMethod: RecoveryMethod.FALLBACK,
          recoveryTime: 500,
          learned: false,
          createdAt: new Date(),
        },
        {
          id: "3",
          errorType: ErrorType.UNKNOWN_ERROR,
          errorMessage: "Error 3",
          context: {},
          severity: ErrorSeverity.HIGH,
          recoveryAttempts: 0,
          recovered: false,
          learned: false,
          createdAt: new Date(),
        },
      ];

      const stats = recovery.getRecoveryStats(errorLogs);

      expect(stats.total).toBe(3);
      expect(stats.recovered).toBe(2);
      expect(stats.unrecovered).toBe(1);
      expect(stats.recoveryRate).toBeCloseTo(0.67, 2);
      expect(stats.avgRecoveryTime).toBe(750);
    });

    it("应该按恢复方法分类统计", () => {
      const errorLogs: ErrorLog[] = [
        {
          id: "1",
          errorType: ErrorType.NETWORK_ERROR,
          errorMessage: "Error 1",
          context: {},
          severity: ErrorSeverity.MEDIUM,
          recoveryAttempts: 1,
          recovered: true,
          recoveryMethod: RecoveryMethod.RETRY,
          learned: false,
          createdAt: new Date(),
        },
        {
          id: "2",
          errorType: ErrorType.VALIDATION_ERROR,
          errorMessage: "Error 2",
          context: {},
          severity: ErrorSeverity.MEDIUM,
          recoveryAttempts: 1,
          recovered: true,
          recoveryMethod: RecoveryMethod.FALLBACK,
          learned: false,
          createdAt: new Date(),
        },
      ];

      const stats = recovery.getRecoveryStats(errorLogs);

      expect(stats.byMethod[RecoveryMethod.RETRY]).toBe(1);
      expect(stats.byMethod[RecoveryMethod.FALLBACK]).toBe(1);
    });
  });
});
