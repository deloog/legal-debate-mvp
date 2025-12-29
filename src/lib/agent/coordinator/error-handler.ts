// 错误处理器 - 支持重试、回退、熔断等容错机制

import type {
  FallbackStrategy,
  ErrorHandlingResult,
  ErrorHandlingStrategy,
  WorkflowStep,
} from "./types";

import type { AgentType } from "../../../types/agent";

import { ErrorHandlingStrategy as EHStrategy } from "./types";

import type { StepExecution } from "./types";

// =============================================================================
// 错误处理器
// =============================================================================

export class ErrorHandler {
  /**
   * 处理错误
   */
  public async handleError(
    step: WorkflowStep,
    error: Error,
    stepExecution: StepExecution,
    fallbackStrategy?: FallbackStrategy,
  ): Promise<ErrorHandlingResult> {
    // 如果步骤不是必须的，可以选择跳过
    if (!step.required) {
      if (fallbackStrategy?.allowSkip) {
        return {
          handled: true,
          strategy: EHStrategy.CONTINUE,
          shouldRetry: false,
          message: "非必须步骤，跳过执行",
        };
      }
    }

    // 如果没有回退策略，使用默认处理
    if (!fallbackStrategy) {
      return {
        handled: false,
        strategy: EHStrategy.ABORT,
        shouldRetry: false,
        message: "没有配置回退策略，中止执行",
      };
    }

    // 根据策略类型处理
    switch (fallbackStrategy.type) {
      case "retry":
        return this.handleRetry(stepExecution, error, fallbackStrategy);

      case "alternate":
        return this.handleAlternate(step, error, fallbackStrategy);

      case "skip":
        return this.handleSkip(step, error, fallbackStrategy);

      case "abort":
        return this.handleAbort(step, error, fallbackStrategy);

      default:
        return {
          handled: false,
          strategy: EHStrategy.ABORT,
          shouldRetry: false,
          message: `未知的回退策略类型: ${fallbackStrategy.type}`,
        };
    }
  }

  /**
   * 处理重试
   */
  private handleRetry(
    stepExecution: StepExecution,
    error: Error,
    strategy: FallbackStrategy,
  ): ErrorHandlingResult {
    const maxAttempts = strategy.maxAttempts || 3;
    const currentAttempt = stepExecution.retryCount;

    if (currentAttempt < maxAttempts) {
      return {
        handled: true,
        strategy: EHStrategy.RETRY,
        shouldRetry: true,
        message:
          `执行失败，将在${strategy.retryDelay || 1000}ms后重试` +
          ` (${currentAttempt + 1}/${maxAttempts})`,
      };
    }

    return {
      handled: false,
      strategy: EHStrategy.ABORT,
      shouldRetry: false,
      message: `已达到最大重试次数(${maxAttempts})，中止执行`,
    };
  }

  /**
   * 处理替代方案
   */
  private handleAlternate(
    step: WorkflowStep,
    error: Error,
    strategy: FallbackStrategy,
  ): ErrorHandlingResult {
    // 检查是否需要替代步骤或替代Agent
    if (strategy.alternateStepId) {
      return {
        handled: true,
        strategy: EHStrategy.FALLBACK,
        shouldRetry: false,
        fallbackStepId: strategy.alternateStepId,
        message: `执行失败，使用替代步骤: ${strategy.alternateStepId}`,
      };
    }

    if (strategy.alternateAgentType) {
      // 这里需要更新步骤的Agent类型
      // 实际使用时需要修改WorkflowContext中的步骤定义
      return {
        handled: true,
        strategy: EHStrategy.FALLBACK,
        shouldRetry: false,
        message: `执行失败，使用替代Agent: ${strategy.alternateAgentType}`,
      };
    }

    return {
      handled: false,
      strategy: EHStrategy.ABORT,
      shouldRetry: false,
      message: "alternate回退策略需要指定alternateStepId或alternateAgentType",
    };
  }

  /**
   * 处理跳过
   */
  private handleSkip(
    step: WorkflowStep,
    error: Error,
    strategy: FallbackStrategy,
  ): ErrorHandlingResult {
    if (strategy.allowSkip) {
      return {
        handled: true,
        strategy: EHStrategy.CONTINUE,
        shouldRetry: false,
        message: "跳过当前步骤，继续执行",
      };
    }

    return {
      handled: false,
      strategy: EHStrategy.ABORT,
      shouldRetry: false,
      message: "不允许跳过步骤，中止执行",
    };
  }

  /**
   * 处理中止
   */
  private handleAbort(
    step: WorkflowStep,
    error: Error,
    strategy: FallbackStrategy,
  ): ErrorHandlingResult {
    return {
      handled: false,
      strategy: EHStrategy.ABORT,
      shouldRetry: false,
      message: strategy.description || "执行失败，中止工作流",
    };
  }

  /**
   * 判断错误是否可重试
   */
  public isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /ECONNRESET/i,
      /ETIMEDOUT/i,
      /EAI_AGAIN/i,
      /rate.?limit/i,
      /5\d{2}/, // 5xx错误
    ];

    const errorMessage = error.message || "";
    return retryablePatterns.some((pattern) => pattern.test(errorMessage));
  }

  /**
   * 判断错误是否应该中止工作流
   */
  public shouldAbortWorkflow(error: Error): boolean {
    const abortPatterns = [
      /permission/i,
      /authentication/i,
      /authorization/i,
      /invalid.?config/i,
      /missing.?required/i,
      /4\d{2}/, // 4xx错误（除404外）
    ];

    const errorMessage = error.message || "";

    // 404错误通常不应该中止工作流
    if (/404/.test(errorMessage)) {
      return false;
    }

    return abortPatterns.some((pattern) => pattern.test(errorMessage));
  }
}

// =============================================================================
// 回退策略构建器
// =============================================================================

export class FallbackStrategyBuilder {
  private strategy: Partial<FallbackStrategy> = {
    type: "abort",
    allowSkip: false,
  };

  /**
   * 设置策略ID
   */
  public setStrategyId(id: string): this {
    this.strategy.strategyId = id;
    return this;
  }

  /**
   * 设置为重试策略
   */
  public retry(maxAttempts: number, retryDelay: number): this {
    this.strategy.type = "retry";
    this.strategy.maxAttempts = maxAttempts;
    this.strategy.retryDelay = retryDelay;
    return this;
  }

  /**
   * 设置为替代策略
   */
  public alternate(
    alternateStepId?: string,
    alternateAgentType?: AgentType,
  ): this {
    this.strategy.type = "alternate";
    this.strategy.alternateStepId = alternateStepId;
    this.strategy.alternateAgentType = alternateAgentType;
    return this;
  }

  /**
   * 设置为跳过策略
   */
  public skip(): this {
    this.strategy.type = "skip";
    this.strategy.allowSkip = true;
    return this;
  }

  /**
   * 设置为中止策略
   */
  public abort(): this {
    this.strategy.type = "abort";
    this.strategy.allowSkip = false;
    return this;
  }

  /**
   * 设置描述
   */
  public setDescription(description: string): this {
    this.strategy.description = description;
    return this;
  }

  /**
   * 构建策略
   */
  public build(): FallbackStrategy {
    if (!this.strategy.strategyId) {
      throw new Error("回退策略必须设置strategyId");
    }

    return this.strategy as FallbackStrategy;
  }

  /**
   * 重置构建器
   */
  public reset(): void {
    this.strategy = {
      type: "abort",
      allowSkip: false,
    };
  }
}
