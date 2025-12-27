// 工作流执行器 - 支持串行和并行执行

import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowExecutionResult,
  WorkflowStep,
  StepExecution,
  WorkflowStatus,
  StepStatus
} from './types';

import { WorkflowStatus as WFStatus } from './types';
import { StepStatus as SStatus } from './types';

import { agentRegistry } from '../registry';
import type { Agent, AgentContext, AgentResult } from '../../../types/agent';
import type { TaskPriority } from '../../../types/agent';

// =============================================================================
// 工作流执行器类
// =============================================================================

export class WorkflowExecutor {
  private context: WorkflowContext;
  private cancelled: boolean = false;

  /**
   * 创建工作流执行器
   */
  constructor(definition: WorkflowDefinition, inputData: Record<string, any>) {
    this.context = {
      workflow: definition,
      inputData,
      status: WFStatus.PENDING,
      stepResults: new Map(),
      sharedData: new Map(),
      stats: {
        startTime: Date.now(),
        totalSteps: definition.steps.length,
        completedSteps: 0,
        failedSteps: 0,
        skippedSteps: 0
      },
      errors: []
    };
  }

  /**
   * 执行工作流
   */
  public async execute(): Promise<WorkflowExecutionResult> {
    this.context.status = WFStatus.RUNNING;

    try {
      const definition = this.context.workflow;

      // 根据执行模式执行
      if (definition.executionMode === 'sequential') {
        await this.executeSequential();
      } else if (definition.executionMode === 'parallel') {
        await this.executeParallel();
      } else if (definition.executionMode === 'mixed') {
        await this.executeMixed();
      } else {
        throw new Error(`不支持的执行模式: ${definition.executionMode}`);
      }

      // 确定最终状态
      if (this.cancelled) {
        this.context.status = WFStatus.CANCELLED;
      } else if (this.context.stats.failedSteps > 0) {
        this.context.status = WFStatus.FAILED;
      } else {
        this.context.status = WFStatus.COMPLETED;
      }
    } catch (error) {
      this.context.status = WFStatus.FAILED;
      this.context.errors.push({
        stepId: 'workflow',
        error: error as Error,
        timestamp: Date.now()
      });
    } finally {
      this.context.stats.endTime = Date.now();
    }

    return this.buildResult();
  }

  /**
   * 取消工作流执行
   */
  public cancel(): void {
    this.cancelled = true;
  }

  /**
   * 获取工作流状态
   */
  public getStatus(): WorkflowStatus {
    return this.context.status;
  }

  /**
   * 获取执行上下文
   */
  public getContext(): WorkflowContext {
    return { ...this.context };
  }

  /**
   * 串行执行
   */
  private async executeSequential(): Promise<void> {
    const steps = this.getExecutionOrder();

    for (const step of steps) {
      this.checkCancelled();

      try {
        await this.executeStep(step);
      } catch (error) {
        this.handleStepError(step, error as Error);

        // 如果是必须步骤，停止执行
        if (step.required) {
          throw error;
        }
      }
    }
  }

  /**
   * 并行执行
   */
  private async executeParallel(): Promise<void> {
    const steps = this.context.workflow.steps;

    // 按依赖关系分组
    const groups = this.groupStepsByDependencies(steps);

    // 按顺序执行各组
    for (const group of groups) {
      this.checkCancelled();

      // 并行执行当前组的所有步骤
      const promises = group.map(step => this.executeStep(step));

      try {
        await Promise.all(promises);
      } catch (error) {
        // 检查是否有必须步骤失败
        const requiredFailed = group.some(step => 
          step.required && this.context.stepResults.get(step.stepId)?.status === SStatus.FAILED
        );

        if (requiredFailed) {
          throw error;
        }
      }
    }
  }

  /**
   * 混合模式执行（支持动态并行和串行）
   */
  private async executeMixed(): Promise<void> {
    const steps = this.getExecutionOrder();

    // 按优先级分组
    const groups = this.groupStepsByPriority(steps);

    // 按优先级顺序执行各组
    for (const group of groups) {
      this.checkCancelled();

      // 检查组内是否有依赖关系
      const hasDependencies = this.groupHasDependencies(group);

      if (hasDependencies) {
        // 有依赖关系，按依赖顺序串行执行
        for (const step of group) {
          this.checkCancelled();

          try {
            await this.executeStep(step);
          } catch (error) {
            this.handleStepError(step, error as Error);

            if (step.required) {
              throw error;
            }
          }
        }
      } else {
        // 无依赖关系，并行执行
        const promises = group.map(step => this.executeStep(step));

        try {
          await Promise.all(promises);
        } catch (error) {
          const requiredFailed = group.some(step =>
            step.required && this.context.stepResults.get(step.stepId)?.status === SStatus.FAILED
          );

          if (requiredFailed) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: WorkflowStep): Promise<void> {
    // 检查步骤依赖是否完成
    await this.waitForDependencies(step);

    // 检查是否已被跳过
    const existingResult = this.context.stepResults.get(step.stepId);
    if (existingResult && existingResult.status === SStatus.SKIPPED) {
      return;
    }

    // 创建步骤执行记录
    const stepExecution: StepExecution = {
      stepId: step.stepId,
      status: SStatus.RUNNING,
      startTime: Date.now(),
      retryCount: 0
    };

    this.context.stepResults.set(step.stepId, stepExecution);

    try {
      // 准备Agent上下文
      const agentContext = this.prepareAgentContext(step);

      // 获取Agent实例
      const agent = this.getAgentForStep(step);
      if (!agent) {
        throw new Error(`未找到类型为${step.agentType}的Agent`);
      }

      // 执行Agent
      const result = await agent.execute(agentContext);

      // 更新步骤执行记录
      stepExecution.status = SStatus.COMPLETED;
      stepExecution.result = result;
      stepExecution.endTime = Date.now();

      // 存储输出数据
      if (step.outputKey) {
        this.context.sharedData.set(step.outputKey, result.data);
      }

      // 存储完整结果数据
      stepExecution.data = result.data;

      // 更新统计
      this.context.stats.completedSteps++;
    } catch (error) {
      stepExecution.status = SStatus.FAILED;
      stepExecution.error = error as Error;
      stepExecution.endTime = Date.now();
      this.context.stats.failedSteps++;
      throw error;
    }
  }

  /**
   * 等待步骤依赖完成
   */
  private async waitForDependencies(step: WorkflowStep): Promise<void> {
    const dependencies = step.dependsOn || [];

    for (const depId of dependencies) {
      const depResult = this.context.stepResults.get(depId);

      if (!depResult) {
        throw new Error(`依赖步骤${depId}未执行`);
      }

      if (depResult.status === SStatus.FAILED) {
        throw new Error(`依赖步骤${depId}执行失败`);
      }

      if (depResult.status === SStatus.SKIPPED) {
        throw new Error(`依赖步骤${depId}被跳过`);
      }

      // 如果依赖还在运行，等待完成
      while (depResult.status === SStatus.RUNNING || depResult.status === SStatus.PENDING) {
        await this.sleep(100);
      }
    }
  }

  /**
   * 准备Agent上下文
   */
  private prepareAgentContext(step: WorkflowStep): AgentContext {
    // 合并输入数据映射
    const inputData: Record<string, any> = {};

    // 从工作流输入数据复制
    Object.assign(inputData, this.context.inputData);

    // 从输入数据映射复制
    if (step.inputData) {
      for (const [key, sourceKey] of Object.entries(step.inputData)) {
        // 优先从共享数据获取
        if (this.context.sharedData.has(sourceKey)) {
          inputData[key] = this.context.sharedData.get(sourceKey);
        } else if (sourceKey in inputData) {
          inputData[key] = inputData[sourceKey];
        }
      }
    }

    return {
      task: step.description || step.name,
      taskType: step.agentType as string,
      priority: this.mapPriority(step.priority),
      data: inputData,
      requestId: `workflow_${this.context.workflow.workflowId}_${step.stepId}`,
      metadata: {
        workflowId: this.context.workflow.workflowId,
        stepId: step.stepId
      }
    };
  }

  /**
   * 获取步骤对应的Agent
   */
  private getAgentForStep(step: WorkflowStep): Agent | undefined {
    const agents = agentRegistry.getAgentsByType(step.agentType);
    return agents[0]; // 返回第一个匹配的Agent
  }

  /**
   * 处理步骤错误
   */
  private handleStepError(step: WorkflowStep, error: Error): void {
    this.context.errors.push({
      stepId: step.stepId,
      error,
      timestamp: Date.now()
    });

    const stepExecution = this.context.stepResults.get(step.stepId);
    if (stepExecution) {
      stepExecution.status = SStatus.FAILED;
      stepExecution.error = error;
      stepExecution.endTime = Date.now();
    }
  }

  /**
   * 获取执行顺序（拓扑排序）
   */
  private getExecutionOrder(): WorkflowStep[] {
    const steps = [...this.context.workflow.steps];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: WorkflowStep[] = [];

    const visit = (step: WorkflowStep): void => {
      if (visiting.has(step.stepId)) {
        throw new Error(`检测到循环依赖: ${step.stepId}`);
      }

      if (visited.has(step.stepId)) {
        return;
      }

      visiting.add(step.stepId);

      // 先执行依赖
      for (const depId of step.dependsOn || []) {
        const depStep = steps.find(s => s.stepId === depId);
        if (depStep) {
          visit(depStep);
        }
      }

      visiting.delete(step.stepId);
      visited.add(step.stepId);
      result.push(step);
    };

    for (const step of steps) {
      if (!visited.has(step.stepId)) {
        visit(step);
      }
    }

    return result;
  }

  /**
   * 按依赖关系分组步骤
   */
  private groupStepsByDependencies(steps: WorkflowStep[]): WorkflowStep[][] {
    const groups: WorkflowStep[][] = [];
    const visited = new Set<string>();
    const currentGroup = new Set<string>();

    const canAddToGroup = (step: WorkflowStep): boolean => {
      const deps = step.dependsOn || [];
      return deps.every(depId => visited.has(depId));
    };

    while (visited.size < steps.length) {
      const group: WorkflowStep[] = [];

      for (const step of steps) {
        if (!visited.has(step.stepId) && canAddToGroup(step)) {
          group.push(step);
        }
      }

      if (group.length === 0) {
        throw new Error('无法解析步骤依赖关系');
      }

      groups.push(group);

      for (const step of group) {
        visited.add(step.stepId);
      }
    }

    return groups;
  }

  /**
   * 按优先级分组步骤
   */
  private groupStepsByPriority(steps: WorkflowStep[]): WorkflowStep[][] {
    const groupsMap = new Map<number, WorkflowStep[]>();

    for (const step of steps) {
      const priority = step.priority || 0;
      if (!groupsMap.has(priority)) {
        groupsMap.set(priority, []);
      }
      groupsMap.get(priority)!.push(step);
    }

    // 按优先级排序并返回
    const sortedPriorities = Array.from(groupsMap.keys()).sort((a, b) => a - b);
    return sortedPriorities.map(priority => groupsMap.get(priority)!);
  }

  /**
   * 检查组内是否有依赖关系
   */
  private groupHasDependencies(steps: WorkflowStep[]): boolean {
    const stepIds = new Set(steps.map(s => s.stepId));

    for (const step of steps) {
      for (const depId of step.dependsOn || []) {
        if (stepIds.has(depId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查是否已取消
   */
  private checkCancelled(): void {
    if (this.cancelled) {
      throw new Error('工作流执行已取消');
    }
  }

  /**
   * 映射优先级
   */
  private mapPriority(priority?: number): TaskPriority {
    if (!priority) return 'medium' as TaskPriority;

    if (priority >= 3) return 'urgent' as TaskPriority;
    if (priority === 2) return 'high' as TaskPriority;
    if (priority === 1) return 'medium' as TaskPriority;
    return 'low' as TaskPriority;
  }

  /**
   * 睡眠指定毫秒
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 构建执行结果
   */
  private buildResult(): WorkflowExecutionResult {
    const endTime = this.context.stats.endTime || Date.now();
    const executionTime = endTime - this.context.stats.startTime;

    // 计算平均步骤执行时间
    let totalStepTime = 0;
    let completedStepCount = 0;

    for (const stepExec of this.context.stepResults.values()) {
      if (stepExec.startTime && stepExec.endTime) {
        totalStepTime += stepExec.endTime - stepExec.startTime;
        completedStepCount++;
      }
    }

    const averageStepTime = completedStepCount > 0 ? totalStepTime / completedStepCount : 0;

    // 构建输出数据
    const outputData: Record<string, any> = {};
    for (const [key, value] of this.context.sharedData.entries()) {
      outputData[key] = value;
    }

    return {
      workflowId: this.context.workflow.workflowId,
      status: this.context.status,
      stepResults: Array.from(this.context.stepResults.values()),
      outputData,
      stats: {
        totalSteps: this.context.stats.totalSteps,
        completedSteps: this.context.stats.completedSteps,
        failedSteps: this.context.stats.failedSteps,
        skippedSteps: this.context.stats.skippedSteps,
        totalExecutionTime: executionTime,
        averageStepTime
      },
      errors: this.context.errors.map(e => ({
        stepId: e.stepId,
        error: e.error
      })),
      startTime: this.context.stats.startTime,
      endTime,
      executionTime
    };
  }
}
