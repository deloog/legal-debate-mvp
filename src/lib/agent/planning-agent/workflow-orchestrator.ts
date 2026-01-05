// 工作流编排器

import type { SubTask } from "./types";
import {
  type Workflow,
  type TaskDependency,
  type OrchestrationResult,
  type ExecutionStep,
  ExecutionMode,
  type OrchestrationConfig,
  type PlanningError,
  PlanningErrorType,
} from "./types";

// =============================================================================
// WorkflowOrchestrator类
// =============================================================================

export class WorkflowOrchestrator {
  private config: OrchestrationConfig;
  private workflowCounter: number = 0;

  constructor(
    config: OrchestrationConfig = {
      defaultExecutionMode: ExecutionMode.SEQUENTIAL,
      maxConcurrentTasks: 3,
      enableOptimization: true,
    },
  ) {
    this.config = config;
  }

  // 主编排方法
  public async orchestrate(
    tasks: SubTask[],
    mode?: ExecutionMode,
  ): Promise<OrchestrationResult> {
    try {
      this.workflowCounter++;

      // 确定执行模式
      const executionMode = mode || this.config.defaultExecutionMode;

      // 构建依赖关系
      const dependencies = this.buildDependencies(tasks);

      // 创建工作流
      const workflow = this.createWorkflow(
        `workflow-${this.workflowCounter}`,
        "自动化生成的工作流",
        tasks,
        executionMode,
        dependencies,
      );

      // 生成执行计划
      const executionPlan = this.generateExecutionPlan(
        tasks,
        executionMode,
        dependencies,
      );

      // 估算执行时长
      const estimatedDuration = this.estimateDuration(
        executionPlan,
        executionMode,
      );

      return {
        workflow,
        executionPlan,
        estimatedDuration,
      };
    } catch (error) {
      throw this.createError(
        PlanningErrorType.WORKFLOW_ORCHESTRATION_FAILED,
        error instanceof Error
          ? error.message
          : "Workflow orchestration failed",
        { originalError: error },
      );
    }
  }

  // 构建依赖关系
  private buildDependencies(tasks: SubTask[]): TaskDependency[] {
    return tasks
      .filter((task) => task.dependencies && task.dependencies.length > 0)
      .map((task) => ({
        taskId: task.id,
        dependsOn: task.dependencies || [],
        type: this.determineDependencyType(task),
      }));
  }

  // 确定依赖类型
  private determineDependencyType(task: SubTask): "strict" | "weak" {
    // 如果任务是审查类任务，使用弱依赖
    if (task.id.includes("review")) {
      return "weak";
    }
    return "strict";
  }

  // 创建工作流
  private createWorkflow(
    id: string,
    name: string,
    tasks: SubTask[],
    executionMode: ExecutionMode,
    dependencies: TaskDependency[],
  ): Workflow {
    const estimatedTotalTime = tasks.reduce(
      (sum, task) => sum + (task.estimatedTime || 0),
      0,
    );

    return {
      id,
      name,
      tasks,
      executionMode,
      estimatedTotalTime,
      dependencies,
    };
  }

  // 生成执行计划
  private generateExecutionPlan(
    tasks: SubTask[],
    executionMode: ExecutionMode,
    dependencies: TaskDependency[],
  ): ExecutionStep[] {
    switch (executionMode) {
      case ExecutionMode.SEQUENTIAL:
        return this.generateSequentialPlan(tasks);
      case ExecutionMode.PARALLEL:
        return this.generateParallelPlan(tasks, dependencies);
      case ExecutionMode.MIXED:
        return this.generateMixedPlan(tasks);
      default:
        return this.generateSequentialPlan(tasks);
    }
  }

  // 生成顺序执行计划
  private generateSequentialPlan(tasks: SubTask[]): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    let stepNumber = 1;

    for (const task of tasks) {
      steps.push({
        step: stepNumber++,
        taskId: task.id,
        taskName: task.name,
        mode: "execute",
        dependencies: task.dependencies || [],
        estimatedTime: task.estimatedTime || 0,
      });
    }

    return steps;
  }

  // 生成并行执行计划
  private generateParallelPlan(
    tasks: SubTask[],
    dependencies: TaskDependency[],
  ): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    const taskMap = new Map<string, SubTask>();
    tasks.forEach((task) => taskMap.set(task.id, task));

    // 构建依赖图
    const dependents = new Map<string, string[]>();
    dependencies.forEach((dep) => {
      dep.dependsOn.forEach((depId) => {
        const list = dependents.get(depId) || [];
        list.push(dep.taskId);
        dependents.set(depId, list);
      });
    });

    // 找到无依赖的任务（起点）
    const startTasks = tasks.filter(
      (task) => !task.dependencies || task.dependencies.length === 0,
    );

    let stepNumber = 1;

    // 处理无依赖任务（并行执行）
    if (startTasks.length > 0) {
      for (const task of startTasks) {
        steps.push({
          step: stepNumber,
          taskId: task.id,
          taskName: task.name,
          mode: startTasks.length > 1 ? "parallel" : "execute",
          dependencies: [],
          estimatedTime: task.estimatedTime || 0,
        });
      }
      stepNumber++;
    }

    // 处理有依赖的任务
    const processedTasks = new Set<string>(startTasks.map((t) => t.id));
    let remainingTasks = tasks.filter((t) => !processedTasks.has(t.id));

    while (remainingTasks.length > 0) {
      // 找到当前可以执行的任务（所有依赖都已完成）
      const readyTasks = remainingTasks.filter((task) => {
        if (!task.dependencies) return true;
        return task.dependencies.every((depId) => processedTasks.has(depId));
      });

      if (readyTasks.length === 0) {
        // 循环依赖，按任务ID顺序添加
        const nextTask = remainingTasks[0];
        steps.push({
          step: stepNumber++,
          taskId: nextTask.id,
          taskName: nextTask.name,
          mode: "execute",
          dependencies: nextTask.dependencies || [],
          estimatedTime: nextTask.estimatedTime || 0,
        });
        processedTasks.add(nextTask.id);
        remainingTasks = remainingTasks.filter((t) => t.id !== nextTask.id);
        continue;
      }

      // 添加可执行任务
      for (const task of readyTasks) {
        steps.push({
          step: stepNumber,
          taskId: task.id,
          taskName: task.name,
          mode: readyTasks.length > 1 ? "parallel" : "execute",
          dependencies: task.dependencies || [],
          estimatedTime: task.estimatedTime || 0,
        });
      }
      stepNumber++;

      // 标记为已处理
      readyTasks.forEach((t) => processedTasks.add(t.id));
      remainingTasks = remainingTasks.filter((t) => !processedTasks.has(t.id));
    }

    return steps;
  }

  // 生成混合执行计划
  private generateMixedPlan(tasks: SubTask[]): ExecutionStep[] {
    // 混合模式：允许某些任务并行，某些必须顺序
    const steps: ExecutionStep[] = [];
    const taskMap = new Map<string, SubTask>();
    tasks.forEach((task) => taskMap.set(task.id, task));

    let stepNumber = 1;
    const processedTasks = new Set<string>();

    // 按优先级排序
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityMap: Record<string, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityMap[a.priority] - priorityMap[b.priority];
    });

    // 分析可并行的任务组（传入排序后的任务列表）
    const parallelGroups = this.identifyParallelGroups(sortedTasks);

    // 为每个组生成步骤
    for (const group of parallelGroups) {
      if (group.length === 1) {
        const task = group[0];
        steps.push({
          step: stepNumber++,
          taskId: task.id,
          taskName: task.name,
          mode: "execute",
          dependencies: task.dependencies || [],
          estimatedTime: task.estimatedTime || 0,
        });
      } else {
        // 并行组中的任务
        for (const task of group) {
          steps.push({
            step: stepNumber,
            taskId: task.id,
            taskName: task.name,
            mode: "parallel",
            dependencies: task.dependencies || [],
            estimatedTime: task.estimatedTime || 0,
          });
        }
        stepNumber++;
      }

      group.forEach((t) => processedTasks.add(t.id));
    }

    return steps;
  }

  // 识别可并行执行的任务组
  private identifyParallelGroups(sortedTasks: SubTask[]): SubTask[][] {
    const groups: SubTask[][] = [];
    const taskSet = new Set<string>(sortedTasks.map((t) => t.id));
    const processed = new Set<string>();

    while (processed.size < taskSet.size) {
      // 找到当前可执行的任务（保持排序后的顺序）
      const readyTasks = sortedTasks.filter(
        (task) =>
          !processed.has(task.id) &&
          (!task.dependencies ||
            task.dependencies.every((dep) => processed.has(dep))),
      );

      if (readyTasks.length === 0) {
        // 循环依赖，按排序顺序添加
        const remaining = sortedTasks.filter((t) => !processed.has(t.id));
        groups.push([remaining[0]]);
        processed.add(remaining[0].id);
      } else {
        // 限制每组最大并行任务数
        const maxTasks = this.config.maxConcurrentTasks;
        const batch = readyTasks.slice(0, maxTasks);
        groups.push(batch);
        batch.forEach((t) => processed.add(t.id));
      }
    }

    return groups;
  }

  // 估算执行时长
  private estimateDuration(
    plan: ExecutionStep[],
    executionMode: ExecutionMode,
  ): number {
    if (executionMode === ExecutionMode.SEQUENTIAL) {
      // 顺序执行：总时间
      return plan.reduce((sum, step) => sum + step.estimatedTime, 0);
    }

    if (executionMode === ExecutionMode.PARALLEL) {
      // 完全并行：最长路径时间
      return Math.max(...plan.map((step) => step.estimatedTime));
    }

    // 混合模式：按step分组，每组取最大时间
    const stepMap = new Map<number, ExecutionStep[]>();
    plan.forEach((step) => {
      const list = stepMap.get(step.step) || [];
      list.push(step);
      stepMap.set(step.step, list);
    });

    let totalTime = 0;
    const stepKeys = Array.from(stepMap.keys()).sort((a, b) => a - b);

    for (const stepKey of stepKeys) {
      const steps = stepMap.get(stepKey)!;
      totalTime += Math.max(...steps.map((s) => s.estimatedTime));
    }

    return totalTime;
  }

  // 创建错误
  private createError(
    type: PlanningErrorType,
    message: string,
    details?: unknown,
  ): PlanningError {
    return {
      type,
      message,
      details,
    };
  }

  // 更新配置
  public updateConfig(config: Partial<OrchestrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  public getConfig(): OrchestrationConfig {
    return { ...this.config };
  }

  // 重置计数器
  public resetCounter(): void {
    this.workflowCounter = 0;
  }
}
