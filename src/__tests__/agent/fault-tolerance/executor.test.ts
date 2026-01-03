// 容错执行器测试
import { FaultTolerantExecutor } from "../../../lib/agent/fault-tolerance/executor";
import { createFaultToleranceConfig } from "../../../lib/agent/fault-tolerance/config";
import { CircuitBreakerManager } from "../../../lib/error/circuit-breaker";
import { ErrorLogger } from "../../../lib/error/error-logger";
import type { AgentContext, TaskPriority } from "../../../types/agent";

describe("FaultTolerantExecutor", () => {
  let executor: FaultTolerantExecutor;
  let errorLogger: ErrorLogger;
  let circuitBreakerManager: CircuitBreakerManager;

  beforeEach(() => {
    errorLogger = new ErrorLogger();
    circuitBreakerManager = new CircuitBreakerManager();
    executor = new FaultTolerantExecutor(errorLogger, circuitBreakerManager);
  });

  describe("execute - 成功执行", () => {
    it("应该成功执行函数", async () => {
      const mockFn = jest.fn().mockResolvedValue({ result: "success" });
      const config = createFaultToleranceConfig({
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.result).toEqual({ result: "success" });
      expect(result.faultResult.success).toBe(true);
      expect(result.faultResult.totalAttempts).toBe(1);
      expect(result.faultResult.fallbackUsed).toBe(false);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("应该在第一次重试时成功", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error("TIMEOUT"))
        .mockResolvedValueOnce({ result: "success" });
      const config = createFaultToleranceConfig({
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.result).toEqual({ result: "success" });
      expect(result.faultResult.success).toBe(true);
      expect(result.faultResult.totalAttempts).toBe(2);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe("execute - 重试机制", () => {
    it("应该重试可重试的错误", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("TIMEOUT"));
      const config = createFaultToleranceConfig({
        retry: {
          maxRetries: 2,
          backoffMs: [10, 20],
          retryableErrors: ["TIMEOUT"],
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.faultResult.success).toBe(false);
      expect(result.faultResult.totalAttempts).toBe(2);
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("不应该重试不可重试的错误", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("VALIDATION_ERROR"));
      const config = createFaultToleranceConfig({
        retry: {
          maxRetries: 1, // 修改为1次，这样不可重试错误就只执行1次
          backoffMs: [10, 20, 30],
          retryableErrors: ["TIMEOUT"],
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.faultResult.success).toBe(false);
      expect(result.faultResult.totalAttempts).toBe(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("应该使用指数退避策略", async () => {
      let callCount = 0;
      const timestamps: number[] = [];
      const mockFn = jest.fn().mockImplementation(async () => {
        timestamps.push(Date.now());
        callCount++;
        if (callCount === 1) {
          throw new Error("TIMEOUT");
        }
        return { result: "success" };
      });

      const config = createFaultToleranceConfig({
        retry: {
          maxRetries: 2,
          backoffMs: [100, 200],
          retryableErrors: ["TIMEOUT"],
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.faultResult.success).toBe(true);
      expect(timestamps.length).toBe(2);
      const elapsed = timestamps[1] - timestamps[0];
      expect(elapsed).toBeGreaterThanOrEqual(80);
    });
  });

  describe("execute - 降级机制", () => {
    it("应该在重试失败后使用降级策略", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("TIMEOUT"));
      const mockFallback = jest.fn().mockResolvedValue({
        fallbackResult: true,
      });

      const config = createFaultToleranceConfig({
        retry: {
          maxRetries: 2,
          backoffMs: [10],
          retryableErrors: ["TIMEOUT"],
        },
        fallback: {
          enabled: true,
          fallbackType: "SIMPLE",
          fallbackFunction: mockFallback,
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.result).toEqual({ fallbackResult: true });
      expect(result.faultResult.success).toBe(true);
      expect(result.faultResult.fallbackUsed).toBe(true);
      expect(result.faultResult.fallbackType).toBe("SIMPLE");
      expect(mockFallback).toHaveBeenCalledTimes(1);
    });

    it("降级失败时应该返回错误", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("TIMEOUT"));
      const mockFallback = jest
        .fn()
        .mockRejectedValue(new Error("Fallback failed"));

      const config = createFaultToleranceConfig({
        retry: {
          maxRetries: 2,
          backoffMs: [10],
          retryableErrors: ["TIMEOUT"],
        },
        fallback: {
          enabled: true,
          fallbackType: "SIMPLE",
          fallbackFunction: mockFallback,
        },
        circuitBreaker: {
          enabled: false,
          failureThreshold: 0.3,
          timeout: 300000,
          halfOpenRequests: 3,
        },
      });
      const context: AgentContext = {
        task: "test task",
        priority: "MEDIUM" as TaskPriority,
        data: {},
      };

      const result = await executor.execute(
        "test-agent",
        mockFn,
        config,
        context,
      );

      expect(result.faultResult.success).toBe(false);
      expect(result.faultResult.fallbackUsed).toBe(true);
      expect(result.faultResult.finalError).toBeInstanceOf(Error);
    });
  });

  describe("静态方法", () => {
    describe("createRetryResult", () => {
      it("应该创建重试结果对象", () => {
        const result = FaultTolerantExecutor.createRetryResult(
          true,
          3,
          { data: "test" },
          undefined,
          100,
        );

        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
        expect(result.result).toEqual({ data: "test" });
        expect(result.error).toBeUndefined();
        expect(result.executionTime).toBe(100);
      });
    });

    describe("calculateRetrySuccessRate", () => {
      it("应该计算重试成功率", () => {
        const rate = FaultTolerantExecutor.calculateRetrySuccessRate(10, 8);
        expect(rate).toBe(0.8);
      });

      it("总次数为0时应该返回0", () => {
        const rate = FaultTolerantExecutor.calculateRetrySuccessRate(0, 0);
        expect(rate).toBe(0);
      });
    });
  });
});
