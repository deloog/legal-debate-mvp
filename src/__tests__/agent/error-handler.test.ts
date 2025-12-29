// 错误处理器测试

import {
  ErrorHandler,
  FallbackStrategyBuilder,
} from "@/lib/agent/coordinator/error-handler";
import type {
  FallbackStrategy,
  WorkflowStep,
  StepExecution,
  ErrorHandlingStrategy,
} from "@/lib/agent/coordinator/types";
import { ErrorHandlingStrategy as EHStrategy } from "@/lib/agent/coordinator/types";

describe("ErrorHandler", () => {
  let errorHandler: ErrorHandler;
  let mockStep: WorkflowStep;
  let mockStepExecution: StepExecution;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    mockStep = {
      stepId: "test-step",
      agentType: "ANALYZER" as any,
      name: "测试步骤",
      required: true,
    };
    mockStepExecution = {
      stepId: "test-step",
      status: "failed" as any,
      startTime: Date.now(),
      endTime: Date.now(),
      retryCount: 0,
    };
  });

  describe("重试策略处理", () => {
    test("应该支持重试", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "retry-strategy",
        type: "retry",
        maxAttempts: 3,
        retryDelay: 1000,
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Temporary error"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(true);
      expect(result.strategy).toBe(EHStrategy.RETRY);
      expect(result.shouldRetry).toBe(true);
      expect(result.message).toContain("重试");
    });

    test("应该在达到最大重试次数时中止", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "retry-strategy",
        type: "retry",
        maxAttempts: 2,
        retryDelay: 1000,
      };

      mockStepExecution.retryCount = 2;

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Persistent error"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(false);
      expect(result.strategy).toBe(EHStrategy.ABORT);
      expect(result.shouldRetry).toBe(false);
      expect(result.message).toContain("最大重试次数");
    });
  });

  describe("替代方案处理", () => {
    test("应该支持替代步骤", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "alternate-strategy",
        type: "alternate",
        alternateStepId: "alternate-step",
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Failed"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(true);
      expect(result.strategy).toBe(EHStrategy.FALLBACK);
      expect(result.fallbackStepId).toBe("alternate-step");
      expect(result.message).toContain("替代步骤");
    });

    test("应该支持替代Agent", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "alternate-agent-strategy",
        type: "alternate",
        alternateAgentType: "STRATEGIST" as any,
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Agent failed"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(true);
      expect(result.strategy).toBe(EHStrategy.FALLBACK);
      expect(result.message).toContain("替代Agent");
    });

    test("应该在缺少替代方案时中止", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "incomplete-strategy",
        type: "alternate",
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Failed"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(false);
      expect(result.strategy).toBe(EHStrategy.ABORT);
    });
  });

  describe("跳过策略处理", () => {
    test("应该允许跳过非必须步骤", async () => {
      mockStep.required = false;
      const strategy: FallbackStrategy = {
        strategyId: "skip-strategy",
        type: "skip",
        allowSkip: true,
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Failed"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(true);
      expect(result.strategy).toBe(EHStrategy.CONTINUE);
      expect(result.message).toContain("跳过");
    });

    test("应该在不允许跳过时中止", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "no-skip-strategy",
        type: "skip",
        allowSkip: false,
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Failed"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(false);
      expect(result.strategy).toBe(EHStrategy.ABORT);
      expect(result.message).toContain("不允许跳过");
    });
  });

  describe("中止策略处理", () => {
    test("应该中止执行", async () => {
      const strategy: FallbackStrategy = {
        strategyId: "abort-strategy",
        type: "abort",
        description: "Critical error",
      };

      const result = await errorHandler.handleError(
        mockStep,
        new Error("Critical failure"),
        mockStepExecution,
        strategy,
      );

      expect(result.handled).toBe(false);
      expect(result.strategy).toBe(EHStrategy.ABORT);
      expect(result.message).toBe("Critical error");
    });

    test("应该在缺少回退策略时中止", async () => {
      const result = await errorHandler.handleError(
        mockStep,
        new Error("No strategy"),
        mockStepExecution,
      );

      expect(result.handled).toBe(false);
      expect(result.strategy).toBe(EHStrategy.ABORT);
      expect(result.message).toContain("没有配置回退策略");
    });
  });

  describe("错误类型判断", () => {
    test("应该识别可重试的错误", () => {
      expect(errorHandler.isRetryableError(new Error("timeout"))).toBe(true);
      expect(errorHandler.isRetryableError(new Error("network error"))).toBe(
        true,
      );
      expect(
        errorHandler.isRetryableError(new Error("500 Internal Error")),
      ).toBe(true);
      expect(
        errorHandler.isRetryableError(new Error("Rate limit exceeded")),
      ).toBe(true);
    });

    test("应该识别不可重试的错误", () => {
      expect(
        errorHandler.isRetryableError(new Error("permission denied")),
      ).toBe(false);
      expect(errorHandler.isRetryableError(new Error("invalid data"))).toBe(
        false,
      );
    });

    test("应该识别应该中止的错误", () => {
      expect(
        errorHandler.shouldAbortWorkflow(new Error("permission denied")),
      ).toBe(true);
      expect(
        errorHandler.shouldAbortWorkflow(new Error("authentication failed")),
      ).toBe(true);
      expect(
        errorHandler.shouldAbortWorkflow(new Error("400 Bad Request")),
      ).toBe(true);
    });

    test("应该在404错误时继续", () => {
      expect(errorHandler.shouldAbortWorkflow(new Error("404 Not Found"))).toBe(
        false,
      );
    });
  });
});

describe("FallbackStrategyBuilder", () => {
  let builder: FallbackStrategyBuilder;

  beforeEach(() => {
    builder = new FallbackStrategyBuilder();
  });

  describe("重试策略构建", () => {
    test("应该构建重试策略", () => {
      const strategy = builder.setStrategyId("retry-1").retry(3, 1000).build();

      expect(strategy.strategyId).toBe("retry-1");
      expect(strategy.type).toBe("retry");
      expect(strategy.maxAttempts).toBe(3);
      expect(strategy.retryDelay).toBe(1000);
    });
  });

  describe("替代策略构建", () => {
    test("应该构建替代步骤策略", () => {
      const strategy = builder
        .setStrategyId("alternate-1")
        .alternate("alternate-step")
        .build();

      expect(strategy.strategyId).toBe("alternate-1");
      expect(strategy.type).toBe("alternate");
      expect(strategy.alternateStepId).toBe("alternate-step");
    });

    test("应该构建替代Agent策略", () => {
      const strategy = builder
        .setStrategyId("alternate-2")
        .alternate(undefined, "STRATEGIST" as any)
        .build();

      expect(strategy.strategyId).toBe("alternate-2");
      expect(strategy.type).toBe("alternate");
      expect(strategy.alternateAgentType).toBe("STRATEGIST");
    });
  });

  describe("跳过策略构建", () => {
    test("应该构建跳过策略", () => {
      const strategy = builder.setStrategyId("skip-1").skip().build();

      expect(strategy.strategyId).toBe("skip-1");
      expect(strategy.type).toBe("skip");
      expect(strategy.allowSkip).toBe(true);
    });
  });

  describe("中止策略构建", () => {
    test("应该构建中止策略", () => {
      const strategy = builder
        .setStrategyId("abort-1")
        .abort()
        .setDescription("Critical error")
        .build();

      expect(strategy.strategyId).toBe("abort-1");
      expect(strategy.type).toBe("abort");
      expect(strategy.description).toBe("Critical error");
      expect(strategy.allowSkip).toBe(false);
    });
  });

  describe("错误处理", () => {
    test("应该在缺少strategyId时抛出错误", () => {
      expect(() => builder.retry(1, 100).build()).toThrow("strategyId");
    });
  });

  describe("重置构建器", () => {
    test("应该重置构建器状态", () => {
      builder.setStrategyId("test-1").retry(3, 1000);
      expect(() => builder.build()).not.toThrow();

      builder.reset();
      expect(() => builder.retry(1, 100).build()).toThrow("strategyId");
    });
  });
});
