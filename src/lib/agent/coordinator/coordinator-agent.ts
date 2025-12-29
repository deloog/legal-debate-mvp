// Coordinator Agent - 工作流编排Agent

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentMetadata,
} from "../../../types/agent";

import { AgentType } from "../../../types/agent";

import type { WorkflowDefinition, WorkflowExecutionResult } from "./types";

import { WorkflowExecutor } from "./workflow-executor";
import { ErrorHandler } from "./error-handler";
import { circuitBreakerManager } from "./circuit-breaker";
import type { CircuitBreakerConfig } from "./types";

// =============================================================================
// Coordinator Agent
// =============================================================================

export class CoordinatorAgent implements Agent {
  readonly name: string = "coordinator";
  readonly type: AgentType = AgentType.COORDINATOR;
  readonly version: string = "1.0.0";
  readonly description: string =
    "Agent工作流编排器，支持串行和并行执行、动态路由、容错和回退";

  private errorHandler: ErrorHandler;

  constructor() {
    this.errorHandler = new ErrorHandler();
  }

  /**
   * 初始化Agent
   */
  public async initialize(): Promise<void> {
    // CoordinatorAgent初始化逻辑
    console.log("Coordinator Agent initialized");
  }

  /**
   * 清理Agent
   */
  public async cleanup(): Promise<void> {
    // 清理熔断器状态
    circuitBreakerManager.clear();
    console.log("Coordinator Agent cleaned up");
  }

  /**
   * 执行Agent
   */
  public async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      // 从输入数据中获取工作流定义
      const workflowDefinition = this.extractWorkflowDefinition(context.data);

      // 验证工作流定义
      this.validateWorkflow(workflowDefinition);

      // 获取输入数据
      const inputData = context.data.inputData || {};

      // 创建工作流执行器
      const executor = new WorkflowExecutor(workflowDefinition, inputData);

      // 检查是否启用熔断器
      if (workflowDefinition.enableCircuitBreaker) {
        const circuitBreakerKey = `workflow_${workflowDefinition.workflowId}`;
        const circuitBreaker =
          circuitBreakerManager.getOrCreate(circuitBreakerKey);

        if (!circuitBreaker.canExecute()) {
          throw new Error("工作流熔断器已打开，拒绝执行");
        }
      }

      // 执行工作流
      const workflowResult = await this.executeWorkflowWithRetry(
        executor,
        workflowDefinition,
      );

      // 检查是否启用熔断器并记录结果
      if (workflowDefinition.enableCircuitBreaker) {
        const circuitBreakerKey = `workflow_${workflowDefinition.workflowId}`;
        const circuitBreaker = circuitBreakerManager.get(circuitBreakerKey);

        if (workflowResult.status === "completed") {
          circuitBreaker?.recordSuccess();
        } else {
          circuitBreaker?.recordFailure();
        }
      }

      // 返回Agent结果
      return {
        success: workflowResult.status === "completed",
        agentName: this.name,
        executionTime: Date.now() - startTime,
        data: {
          workflowId: workflowResult.workflowId,
          status: workflowResult.status,
          stepResults: workflowResult.stepResults,
          outputData: workflowResult.outputData,
          stats: workflowResult.stats,
          errors: workflowResult.errors,
        },
        context: {
          inputSummary: this.summarizeInput(context),
          processingSteps: [
            `验证工作流定义`,
            `初始化执行器`,
            `执行工作流（${workflowDefinition.executionMode}模式）`,
            `收集执行结果`,
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        agentName: this.name,
        executionTime: Date.now() - startTime,
        error: {
          code: "WORKFLOW_EXECUTION_ERROR",
          message: (error as Error).message,
          type: "execution_error" as any,
          agentName: this.name,
          timestamp: Date.now(),
          retryable: this.errorHandler.isRetryableError(error as Error),
        },
      };
    }
  }

  /**
   * 提取工作流定义
   */
  private extractWorkflowDefinition(
    data: Record<string, any>,
  ): WorkflowDefinition {
    if (!data.workflowDefinition) {
      throw new Error("输入数据中缺少workflowDefinition");
    }

    const workflow = data.workflowDefinition;

    // 简单验证必填字段
    if (!workflow.workflowId) {
      throw new Error("workflowDefinition缺少workflowId");
    }

    if (!workflow.name) {
      throw new Error("workflowDefinition缺少name");
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error("workflowDefinition缺少steps或steps为空");
    }

    return workflow;
  }

  /**
   * 验证工作流定义
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    // 验证工作流ID
    if (!workflow.workflowId || workflow.workflowId.trim() === "") {
      throw new Error("workflowId不能为空");
    }

    // 验证名称
    if (!workflow.name || workflow.name.trim() === "") {
      throw new Error("name不能为空");
    }

    // 验证步骤
    if (!workflow.steps || workflow.steps.length === 0) {
      throw new Error("steps不能为空");
    }

    // 验证步骤ID唯一性
    const stepIds = new Set<string>();
    for (const step of workflow.steps) {
      if (!step.stepId) {
        throw new Error("步骤缺少stepId");
      }

      if (stepIds.has(step.stepId)) {
        throw new Error(`步骤ID重复: ${step.stepId}`);
      }

      stepIds.add(step.stepId);

      if (!step.agentType) {
        throw new Error(`步骤${step.stepId}缺少agentType`);
      }

      if (!step.name) {
        throw new Error(`步骤${step.stepId}缺少name`);
      }
    }

    // 验证执行模式
    const validModes = ["sequential", "parallel", "mixed"];
    if (!validModes.includes(workflow.executionMode)) {
      throw new Error(`不支持的执行模式: ${workflow.executionMode}`);
    }
  }

  /**
   * 带重试的工作流执行
   */
  private async executeWorkflowWithRetry(
    executor: WorkflowExecutor,
    workflow: WorkflowDefinition,
  ): Promise<WorkflowExecutionResult> {
    const fallbackStrategy = workflow.fallbackStrategy;

    if (!fallbackStrategy || fallbackStrategy.type !== "retry") {
      return executor.execute();
    }

    const maxAttempts = fallbackStrategy.maxAttempts || 3;
    const retryDelay = fallbackStrategy.retryDelay || 1000;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await executor.execute();
      } catch (error) {
        lastError = error as Error;

        // 如果是最后一次尝试，不再重试
        if (attempt === maxAttempts - 1) {
          break;
        }

        // 判断错误是否可重试
        if (!this.errorHandler.isRetryableError(lastError)) {
          break;
        }

        // 等待重试延迟
        await this.sleep(retryDelay);
      }
    }

    // 所有重试都失败，抛出最后一个错误
    throw lastError || new Error("工作流执行失败");
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<boolean> {
    try {
      // 检查熔断器管理器状态
      const stats = circuitBreakerManager.getStatistics();
      return stats.totalBreakers >= 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取元数据
   */
  public getMetadata(): AgentMetadata {
    return {
      name: this.name,
      type: this.type,
      version: this.version,
      description: this.description,
      capabilities: [
        "workflow_orchestration",
        "sequential_execution",
        "parallel_execution",
        "dynamic_routing",
        "error_handling",
        "circuit_breaker",
        "retry_mechanism",
      ],
      supportedTasks: [
        "execute_workflow",
        "validate_workflow",
        "monitor_workflow",
      ],
      status: "idle" as any,
      averageExecutionTime: 1000,
      successRate: 0.95,
    };
  }

  /**
   * 总结输入数据
   */
  private summarizeInput(context: AgentContext): string {
    const keys = Object.keys(context.data);
    return `输入字段: ${keys.join(", ")}`;
  }

  /**
   * 睡眠指定毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 配置熔断器
   */
  public configureCircuitBreaker(
    key: string,
    config: CircuitBreakerConfig,
  ): void {
    const breaker = circuitBreakerManager.getOrCreate(key, config);
    breaker.updateConfig(config);
  }

  /**
   * 获取熔断器状态
   */
  public getCircuitBreakerState(key: string): any {
    const breaker = circuitBreakerManager.get(key);
    return breaker?.getStateInfo();
  }

  /**
   * 获取所有熔断器状态
   */
  public getAllCircuitBreakerStates(): Record<string, any> {
    return circuitBreakerManager.getAllStates();
  }
}

// =============================================================================
// 创建Coordinator Agent实例
// =============================================================================

export function createCoordinatorAgent(): CoordinatorAgent {
  return new CoordinatorAgent();
}

// 导出默认实例
export const coordinatorAgent = new CoordinatorAgent();
