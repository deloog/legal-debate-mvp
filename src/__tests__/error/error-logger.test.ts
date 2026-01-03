/**
 * ErrorLogger 测试
 *
 * 测试错误日志记录器
 */

import { ErrorLogger } from "@/lib/error/error-logger";
import { ErrorContext, ErrorType, ErrorSeverity } from "@/lib/error/types";

describe("ErrorLogger", () => {
  let logger: ErrorLogger;

  beforeEach(() => {
    logger = new ErrorLogger();
  });

  describe("错误捕获", () => {
    it("应该正确捕获普通错误", async () => {
      const error = new Error("测试错误");
      const context: ErrorContext = {
        agentName: "TestAgent",
        operation: "test_operation",
      };

      const errorLog = await logger.captureError(error, context);

      expect(errorLog).toBeDefined();
      expect(errorLog.errorMessage).toBe("测试错误");
      expect(errorLog.context.agentName).toBe("TestAgent");
      expect(errorLog.recovered).toBe(false);
      expect(errorLog.recoveryAttempts).toBe(0);
    });

    it("应该正确识别超时错误", async () => {
      const error = new Error("Request timeout");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorType).toBe(ErrorType.NETWORK_TIMEOUT);
    });

    it("应该正确识别AI超时错误", async () => {
      const error = new Error("AI service timeout");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorType).toBe(ErrorType.AI_TIMEOUT);
    });

    it("应该正确识别限流错误", async () => {
      const error = new Error("Rate limit exceeded");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorType).toBe(ErrorType.AI_RATE_LIMIT);
    });

    it("应该正确识别数据库连接错误", async () => {
      const error = new Error("Database connection failed");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorType).toBe(ErrorType.DATABASE_CONNECTION_ERROR);
    });

    it("应该正确识别验证错误", async () => {
      const error = new Error("Validation failed");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorType).toBe(ErrorType.VALIDATION_ERROR);
    });

    it("应该正确识别资源未找到错误", async () => {
      const error = new Error("Memory not found");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorType).toBe(ErrorType.MEMORY_NOT_FOUND);
    });
  });

  describe("严重程度评估", () => {
    it("应该将数据库连接错误评估为CRITICAL", async () => {
      const error = new Error("Database connection failed");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it("应该将限流错误评估为HIGH", async () => {
      const error = new Error("Rate limit exceeded");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.severity).toBe(ErrorSeverity.HIGH);
    });

    it("应该将未知错误评估为MEDIUM", async () => {
      const error = new Error("Unknown issue");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it("应该根据错误消息中的关键词评估严重程度", async () => {
      const error = new Error("Critical failure in system");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe("上下文处理", () => {
    it("应该正确脱敏敏感信息", async () => {
      const error = new Error("Test error");
      const context: ErrorContext = {
        inputData: {
          username: "test",
          password: "secret123",
          token: "abc123",
        },
      };

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.context.inputData?.password).toBe("[REDACTED]");
      expect(errorLog.context.inputData?.token).toBe("[REDACTED]");
      expect(errorLog.context.inputData?.username).toBe("test");
    });

    it("应该限制字符串长度", async () => {
      const error = new Error("Test error");
      const longString = "a".repeat(600);
      const context: ErrorContext = {
        inputData: {
          data: longString,
        },
      };

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.context.inputData?.data).toContain("...");
      expect((errorLog.context.inputData?.data as string)?.length).toBeLessThan(
        600,
      );
    });

    it("应该正确脱敏用户ID", async () => {
      const error = new Error("Test error");
      const context: ErrorContext = {
        executionEnvironment: {
          userId: "user123456789",
        },
      };

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.context.executionEnvironment?.userId).toContain("***");
      expect(errorLog.context.executionEnvironment?.userId).not.toBe(
        "user123456789",
      );
    });
  });

  describe("堆栈跟踪", () => {
    it("应该限制堆栈跟踪行数", async () => {
      const error = new Error("Test error");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      if (errorLog.stackTrace) {
        const lines = errorLog.stackTrace.split("\n");
        expect(lines.length).toBeLessThanOrEqual(20);
      }
    });

    it("应该处理没有堆栈跟踪的错误", async () => {
      const error = new Error("Test error");
      error.stack = undefined;
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.stackTrace).toBe("");
    });
  });

  describe("错误码提取", () => {
    it("应该从错误对象中提取错误码", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = new Error("Test error") as any;
      error.code = "ECONNREFUSED";
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorCode).toBe("ECONNREFUSED");
    });

    it("应该使用错误名称作为错误码", async () => {
      const error = new Error("Test error");
      error.name = "CustomError";
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorCode).toBe("CustomError");
    });

    it("应该处理没有错误码的错误", async () => {
      const error = new Error("Test error");
      const context: ErrorContext = {};

      const errorLog = await logger.captureError(error, context);

      expect(errorLog.errorCode).toBe("Error");
    });
  });
});
