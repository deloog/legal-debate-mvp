// PlanningAgent主类 - 整合规划层

import { TaskDecomposer } from './task-decomposer';
import { StrategyPlanner } from './strategy-planner';
import { WorkflowOrchestrator } from './workflow-orchestrator';
import { ResourceAllocator } from './resource-allocator';
import {
  type PlanningInput,
  type PlanningOutput,
  type PlanningMetadata,
  ExecutionMode,
  TaskType,
  type PlanningError,
  PlanningErrorType,
} from './types';

// =============================================================================
// PlanningAgent类
// =============================================================================

export class PlanningAgent {
  private taskDecomposer: TaskDecomposer;
  private strategyPlanner: StrategyPlanner;
  private workflowOrchestrator: WorkflowOrchestrator;
  private resourceAllocator: ResourceAllocator;

  constructor() {
    this.taskDecomposer = new TaskDecomposer();
    this.strategyPlanner = new StrategyPlanner();
    this.workflowOrchestrator = new WorkflowOrchestrator();
    this.resourceAllocator = new ResourceAllocator();
  }

  // 主规划方法
  public async plan(input: PlanningInput): Promise<PlanningOutput> {
    try {
      // 验证输入
      this.validateInput(input);

      // 步骤1：任务分解
      const decomposition = await this.taskDecomposer.decompose(
        input.taskType,
        input.caseInfo
      );

      // 步骤2：策略规划
      const planning = await this.strategyPlanner.plan(input.caseInfo);

      // 步骤3：工作流编排
      const orchestration = await this.workflowOrchestrator.orchestrate(
        decomposition.subTasks,
        ExecutionMode.SEQUENTIAL
      );

      // 步骤4：资源分配
      const allocation = await this.resourceAllocator.allocate(
        decomposition.subTasks,
        input.constraints?.priorityOverride
      );

      // 步骤5：生成元数据
      const metadata = this.generateMetadata(
        decomposition,
        planning,
        orchestration,
        allocation
      );

      return {
        decomposition,
        planning,
        orchestration,
        allocation,
        metadata,
      };
    } catch (error) {
      if (this.isPlanningError(error)) {
        throw error;
      }
      throw this.createError(
        PlanningErrorType.INVALID_TASK_TYPE,
        error instanceof Error ? error.message : 'Planning failed',
        { originalError: error }
      );
    }
  }

  // 验证输入
  private validateInput(input: PlanningInput): void {
    if (!input.taskType) {
      throw this.createError(
        PlanningErrorType.INVALID_TASK_TYPE,
        'Task type is required'
      );
    }

    if (!input.userGoal) {
      throw this.createError(
        PlanningErrorType.INVALID_TASK_TYPE,
        'User goal is required'
      );
    }

    if (!input.caseInfo) {
      throw this.createError(
        PlanningErrorType.INVALID_TASK_TYPE,
        'Case info is required'
      );
    }
  }

  // 生成元数据
  private generateMetadata(
    decomposition: unknown,
    planning: unknown,
    _orchestration: unknown,
    allocation: unknown
  ): PlanningMetadata {
    // 计算总任务数
    const totalTasks = this.extractTotalTasks(decomposition);

    // 计算总预估时间
    const totalEstimatedTime = this.extractTotalEstimatedTime(decomposition);

    // 确定推荐执行模式
    const recommendedExecutionMode = this.determineRecommendedMode(
      totalTasks,
      allocation
    );

    // 获取关键路径任务
    const criticalPathTasks = this.extractCriticalPathTasks(decomposition);

    // 识别风险因素
    const riskFactors = this.identifyRiskFactors(planning, allocation);

    // 计算置信度
    const confidence = this.calculateConfidence(planning, riskFactors);

    return {
      totalTasks,
      totalEstimatedTime,
      recommendedExecutionMode,
      criticalPathTasks,
      riskFactors,
      confidence,
    };
  }

  // 提取总任务数
  private extractTotalTasks(decomposition: unknown): number {
    if (decomposition && typeof decomposition === 'object') {
      const decomp = decomposition as Record<string, unknown>;
      const subTasks = decomp.subTasks as unknown[] | undefined;
      return subTasks?.length || 0;
    }
    return 0;
  }

  // 提取总预估时间
  private extractTotalEstimatedTime(decomposition: unknown): number {
    if (decomposition && typeof decomposition === 'object') {
      const decomp = decomposition as Record<string, unknown>;
      return (decomp.totalTime as number) || 0;
    }
    return 0;
  }

  // 确定推荐执行模式
  private determineRecommendedMode(
    totalTasks: number,
    allocation: unknown
  ): ExecutionMode {
    // 任务多时建议并行
    if (totalTasks > 5) {
      return ExecutionMode.PARALLEL;
    }

    // 有负载压力时建议并行
    if (allocation && typeof allocation === 'object') {
      const alloc = allocation as Record<string, unknown>;
      const utilization = alloc.utilizationRate as number;
      if (utilization && utilization > 0.8) {
        return ExecutionMode.PARALLEL;
      }
    }

    // 默认使用混合模式
    return ExecutionMode.MIXED;
  }

  // 提取关键路径任务
  private extractCriticalPathTasks(decomposition: unknown): string[] {
    if (decomposition && typeof decomposition === 'object') {
      const decomp = decomposition as Record<string, unknown>;
      return (decomp.criticalPath as string[]) || [];
    }
    return [];
  }

  // 识别风险因素
  private identifyRiskFactors(
    planning: unknown,
    allocation: unknown
  ): string[] {
    const riskFactors: string[] = [];

    // 分析策略风险
    if (planning && typeof planning === 'object') {
      const plan = planning as Record<string, unknown>;
      const strategy = plan.strategy as Record<string, unknown> | undefined;

      if (strategy?.riskLevel === 'high') {
        riskFactors.push('策略风险等级高');
      }

      if ((strategy?.confidence as number) < 0.7) {
        riskFactors.push('策略置信度低');
      }
    }

    // 分析资源风险
    if (allocation && typeof allocation === 'object') {
      const alloc = allocation as Record<string, unknown>;
      const utilization = alloc.utilizationRate as number;

      if (utilization && utilization > 0.9) {
        riskFactors.push('资源利用率过高');
      }
    }

    return riskFactors;
  }

  // 计算置信度
  private calculateConfidence(
    planning: unknown,
    riskFactors: string[]
  ): number {
    let confidence = 0.8;

    // 基于策略置信度调整
    if (planning && typeof planning === 'object') {
      const plan = planning as Record<string, unknown>;
      const strategy = plan.strategy as Record<string, unknown> | undefined;
      const strategyConfidence = (strategy?.confidence as number) || 0.8;
      confidence = Math.min(confidence, strategyConfidence);
    }

    // 基于风险因素调整
    const riskPenalty = riskFactors.length * 0.05;
    confidence = Math.max(0, confidence - riskPenalty);

    return confidence;
  }

  // 生成选择原因
  private __generateSelectionReason(planning: unknown): string {
    const reasons: string[] = [];

    if (planning && typeof planning === 'object') {
      const plan = planning as Record<string, unknown>;
      const strategy = plan.strategy as Record<string, unknown> | undefined;

      if ((strategy?.feasibilityScore as number) > 0.8) {
        reasons.push('可行性得分高');
      }

      if (strategy?.riskLevel === 'low') {
        reasons.push('风险可控');
      }

      if ((strategy?.confidence as number) > 0.85) {
        reasons.push('信心度高');
      }

      if (
        strategy?.swotAnalysis &&
        (strategy.swotAnalysis as Record<string, unknown>).strengths &&
        (strategy.swotAnalysis as Record<string, unknown>).weaknesses
      ) {
        const swot = strategy.swotAnalysis as Record<string, unknown>;
        const strengths = swot.strengths as unknown[];
        const weaknesses = swot.weaknesses as unknown[];
        if (strengths.length > weaknesses.length) {
          reasons.push('优势多于劣势');
        }
      }
    }

    return reasons.length > 0 ? reasons.join('，') : '策略符合当前需求';
  }

  // 快速规划（用于简单场景）
  public async quickPlan(taskType: TaskType): Promise<PlanningOutput> {
    const input: PlanningInput = {
      taskType,
      caseInfo: {},
      userGoal: '快速处理',
    };

    return this.plan(input);
  }

  // 判断是否为规划错误
  private isPlanningError(error: unknown): error is PlanningError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      'message' in error
    );
  }

  // 创建错误
  private createError(
    type: PlanningErrorType,
    message: string,
    details?: unknown
  ): PlanningError {
    return {
      type,
      message,
      details,
    };
  }

  // 更新任务分解器配置
  public updateDecomposerConfig(config: unknown): void {
    this.taskDecomposer.updateConfig(config as never);
  }

  // 更新策略规划器配置
  public updatePlannerConfig(config: unknown): void {
    this.strategyPlanner.updateConfig(config as never);
  }

  // 更新工作流编排器配置
  public updateOrchestratorConfig(config: unknown): void {
    this.workflowOrchestrator.updateConfig(config as never);
  }

  // 更新资源分配器配置
  public updateAllocatorConfig(config: unknown): void {
    this.resourceAllocator.updateConfig(config as never);
  }

  // 重置内部状态
  public reset(): void {
    this.workflowOrchestrator.resetCounter();
    this.resourceAllocator.clearHistory();
  }

  // 获取配置信息
  public getConfigurations(): {
    decomposer: unknown;
    planner: unknown;
    orchestrator: unknown;
    allocator: unknown;
  } {
    return {
      decomposer: this.taskDecomposer.getConfig(),
      planner: this.strategyPlanner.getConfig(),
      orchestrator: this.workflowOrchestrator.getConfig(),
      allocator: this.resourceAllocator.getConfig(),
    };
  }
}
