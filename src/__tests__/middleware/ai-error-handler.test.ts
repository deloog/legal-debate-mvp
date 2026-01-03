/**
 * AI服务错误处理中间件测试套件
 * 测试超时控制、重试机制和友好错误提示
 */

import {
  AIServiceErrorHandler,
  AIServiceTimeoutError,
  AIServiceFailureError,
  AIServiceBusyError,
  type RetryOptions,
} from "@/lib/middleware/ai-error-handler";

// =============================================================================
// 测试套件1：超时处理测试（5个用例）
// =============================================================================

describe("AIServiceErrorHandler - 超时处理", () => {
  it("应该在超时时间内正常返回结果", async () => {
    const promise = Promise.resolve("成功");
    const result = await AIServiceErrorHandler.withTimeout(
      promise,
      "测试操作",
      5000,
    );

    expect(result).toBe("成功");
  });

  it("应该在5秒超时触发超时错误", async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("结果"), 6000);
    });

    await expect(
      AIServiceErrorHandler.withTimeout(promise, "文档解析", 5000),
    ).rejects.toThrow(AIServiceTimeoutError);
  });

  it("超时错误应该包含正确的上下文信息", async () => {
    const promise = new Promise<string>(() => {
      setTimeout(() => {}, 6000);
    });

    try {
      await AIServiceErrorHandler.withTimeout(promise, "法条检索", 5000);
      fail("Expected timeout error");
    } catch (error) {
      expect(error).toBeInstanceOf(AIServiceTimeoutError);
      expect((error as AIServiceTimeoutError).context).toBe("法条检索");
      expect((error as AIServiceTimeoutError).code).toBe("AI_TIMEOUT");
      expect((error as AIServiceTimeoutError).statusCode).toBe(408);
    }
  });

  it("超时错误应该保留原始错误的堆栈信息", async () => {
    const promise = new Promise<string>((resolve) => {
      setTimeout(() => resolve("测试"), 6000);
    });

    try {
      await AIServiceErrorHandler.withTimeout(promise, "测试上下文", 5000);
      fail("Expected timeout error");
    } catch (error) {
      expect(error).toBeInstanceOf(AIServiceTimeoutError);
      expect((error as Error).message).toContain("测试上下文");
      expect((error as Error).stack).toBeDefined();
    }
  });

  it("多个并发调用的超时应该相互独立", async () => {
    const promise1 = new Promise<string>((resolve) => {
      setTimeout(() => resolve("结果1"), 6000);
    });
    const promise2 = Promise.resolve("结果2");

    const results = await Promise.allSettled([
      AIServiceErrorHandler.withTimeout(promise1, "操作1", 5000),
      AIServiceErrorHandler.withTimeout(promise2, "操作2", 5000),
    ]);

    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("fulfilled");
    expect((results[1] as PromiseFulfilledResult<string>).value).toBe("结果2");
  });
});

// =============================================================================
// 测试套件2：错误提示测试（4个用例）
// =============================================================================

describe("AIServiceErrorHandler - 友好错误提示", () => {
  it("超时错误应该显示友好的中文提示", () => {
    const error = new AIServiceTimeoutError("文档解析");
    const message = AIServiceErrorHandler.getFriendlyMessage(error, "zh-CN");

    expect(message).toBe("分析时间较长，请耐心等待");
  });

  it("失败错误应该显示友好的中文提示", () => {
    const originalError = new Error("网络连接失败");
    const error = new AIServiceFailureError("辩论生成", originalError);
    const message = AIServiceErrorHandler.getFriendlyMessage(error, "zh-CN");

    expect(message).toBe("当前服务繁忙，请稍后重试");
  });

  it("繁忙错误应该显示友好的中文提示", () => {
    const error = new AIServiceBusyError("AI服务");
    const message = AIServiceErrorHandler.getFriendlyMessage(error, "zh-CN");

    expect(message).toBe("当前服务繁忙，请稍后重试");
  });

  it("未知错误应该显示通用中文提示", () => {
    const error = new Error("未知错误");
    const message = AIServiceErrorHandler.getFriendlyMessage(error, "zh-CN");

    expect(message).toBe("系统处理出现问题，请稍后重试");
  });
});

// =============================================================================
// 测试套件3：重试机制测试（6个用例）
// =============================================================================

describe("AIServiceErrorHandler - 重试机制", () => {
  it("操作成功时不应该重试", async () => {
    const operation = jest.fn().mockResolvedValueOnce("成功");
    const options: RetryOptions = {
      maxRetries: 3,
      context: "文档解析",
    };

    const result = await AIServiceErrorHandler.withRetry(operation, options);

    expect(result).toBe("成功");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("失败后第2次重试应该成功", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce("成功");
    const options: RetryOptions = {
      maxRetries: 3,
      context: "文档解析",
    };

    const result = await AIServiceErrorHandler.withRetry(operation, options);

    expect(result).toBe("成功");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("失败后第3次重试应该成功", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockRejectedValueOnce(new Error("econnreset"))
      .mockResolvedValueOnce("成功");
    const options: RetryOptions = {
      maxRetries: 3,
      context: "文档解析",
    };

    const result = await AIServiceErrorHandler.withRetry(operation, options);

    expect(result).toBe("成功");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("重试3次后仍失败应该抛出错误", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockRejectedValueOnce(new Error("etimedout"))
      .mockRejectedValueOnce(new Error("连接失败"));
    const options: RetryOptions = {
      maxRetries: 2,
      context: "文档解析",
    };

    await expect(
      AIServiceErrorHandler.withRetry(operation, options),
    ).rejects.toThrow("连接失败");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("应该验证重试间隔的指数退避", async () => {
    const delays: number[] = [];
    const originalSetTimeout = global.setTimeout;

    // Mock setTimeout来捕获延迟时间
    jest
      .spyOn(global, "setTimeout")
      .mockImplementation((callback: () => void, delay: number) => {
        delays.push(delay);
        return originalSetTimeout(callback, delay);
      });

    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce("成功");
    const options: RetryOptions = {
      maxRetries: 2,
      context: "测试",
      enableExponentialBackoff: true,
    };

    await AIServiceErrorHandler.withRetry(operation, options);

    expect(delays).toEqual([1000, 2000]); // 1s, 2s

    // 恢复原始setTimeout
    jest.restoreAllMocks();
  });

  it("不可重试的错误不应该触发重试", async () => {
    const operation = jest.fn().mockRejectedValueOnce(new Error("参数错误"));
    const options: RetryOptions = {
      maxRetries: 3,
      context: "文档解析",
      shouldRetry: () => false,
    };

    await expect(
      AIServiceErrorHandler.withRetry(operation, options),
    ).rejects.toThrow("参数错误");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// 测试套件4：集成测试（3个用例）
// =============================================================================

describe("AIServiceErrorHandler - 集成测试", () => {
  it("应该能够与现有AI服务集成使用", async () => {
    const mockAIService = {
      async chatCompletion(prompt: string) {
        return { content: `测试响应: ${prompt}` };
      },
    };

    const result = await AIServiceErrorHandler.withTimeout(
      mockAIService.chatCompletion("测试"),
      "集成测试",
      5000,
    );

    expect(result).toBeDefined();
    expect((result as { content: string }).content).toBe("测试响应: 测试");
  });

  it("应该能够处理带重试的复杂AI调用", async () => {
    let attemptCount = 0;
    const complexOperation = async () => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error("network timeout");
      }
      return { result: `第${attemptCount}次成功` };
    };

    const options: RetryOptions = {
      maxRetries: 2,
      context: "复杂操作",
    };

    const result = await AIServiceErrorHandler.withRetry(
      complexOperation,
      options,
    );

    expect((result as { result: string }).result).toBe("第2次成功");
  });

  it("应该保留错误上下文信息用于日志记录", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("network timeout"));
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    const options: RetryOptions = {
      maxRetries: 1,
      context: "法条检索",
    };

    try {
      await AIServiceErrorHandler.withRetry(operation, options);
    } catch {
      // 预期会抛出错误
    }

    expect(consoleWarnSpy).toHaveBeenCalled();
    const warnCall = (
      consoleWarnSpy as jest.MockedFunction<typeof console.warn>
    ).mock.calls[0][0];
    expect(warnCall).toContain("法条检索");

    consoleWarnSpy.mockRestore();
  });
});
