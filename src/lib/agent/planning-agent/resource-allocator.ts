// 资源分配器

import { AgentType, TaskPriority } from "../../../types/agent";
import type { SubTask } from "./types";
import {
  type AgentResource,
  type AllocationConfig,
  type PlanningError,
  PlanningErrorType,
  type ResourceAllocation,
  type ResourceAvailability,
} from "./types";

// =============================================================================
// ResourceAllocator类
// =============================================================================

export class ResourceAllocator {
  private config: AllocationConfig;
  private allocationHistory: Map<AgentType, AgentResource[]>;

  constructor(
    config: AllocationConfig = {
      enableLoadBalancing: true,
      maxLoadPerAgent: 100,
      enablePrioritization: true,
    },
  ) {
    this.config = config;
    this.allocationHistory = new Map();
  }

  // 主分配方法
  public async allocate(
    tasks: SubTask[],
    priority?: TaskPriority,
  ): Promise<ResourceAllocation> {
    try {
      const allocationPriority = priority || TaskPriority.MEDIUM;
      const agentsMap = new Map<AgentType, AgentResource>();

      // 获取所有需要用到的Agent类型
      const requiredAgentTypes = this.getRequiredAgentTypes(tasks);

      // 为每种Agent类型创建资源
      for (const agentType of requiredAgentTypes) {
        const agentResource = this.createAgentResource(
          agentType,
          tasks,
          allocationPriority,
        );
        agentsMap.set(agentType, agentResource);
      }

      // 执行负载均衡
      if (this.config.enableLoadBalancing) {
        this.balanceLoad(agentsMap);
      }

      // 计算利用率
      const utilizationRate = this.calculateUtilization(agentsMap);

      // 计算最大并发数
      const maxConcurrent = this.calculateMaxConcurrent(tasks);

      const result: ResourceAllocation = {
        agents: agentsMap,
        priority: allocationPriority,
        maxConcurrent,
        utilizationRate,
      };

      // 记录分配历史
      this.recordAllocation(result);

      return result;
    } catch (error) {
      throw this.createError(
        PlanningErrorType.RESOURCE_ALLOCATION_FAILED,
        error instanceof Error ? error.message : "Resource allocation failed",
        { originalError: error },
      );
    }
  }

  // 获取需要的Agent类型
  private getRequiredAgentTypes(tasks: SubTask[]): AgentType[] {
    const agentTypes = new Set<AgentType>();
    tasks.forEach((task) => agentTypes.add(task.agent));
    return Array.from(agentTypes);
  }

  // 创建Agent资源
  private createAgentResource(
    agentType: AgentType,
    tasks: SubTask[],
    priority: TaskPriority,
  ): AgentResource {
    // 计算该Agent需要执行的任务数量
    const agentTasks = tasks.filter((task) => task.agent === agentType);
    const estimatedLoad = agentTasks.reduce(
      (sum, task) => sum + (task.estimatedTime || 0),
      0,
    );

    // 计算时间范围
    const timeRange = this.calculateTimeRange(agentTasks);

    return {
      agentType,
      allocated: true,
      estimatedLoad,
      priority,
      startTime: timeRange.start,
      endTime: timeRange.end,
    };
  }

  // 计算时间范围
  private calculateTimeRange(tasks: SubTask[]): { start: number; end: number } {
    if (tasks.length === 0) {
      return { start: 0, end: 0 };
    }

    let minStart = Infinity;
    let maxEnd = 0;

    // 简单估算：假设无依赖的任务同时开始
    const startTasks = tasks.filter(
      (t) => !t.dependencies || t.dependencies.length === 0,
    );
    if (startTasks.length > 0) {
      minStart = 0;
    } else {
      minStart = tasks[0].estimatedTime || 0;
    }

    // 计算总时间作为结束时间
    const totalTime = tasks.reduce(
      (sum, task) => sum + (task.estimatedTime || 0),
      0,
    );
    maxEnd = totalTime;

    return { start: minStart, end: maxEnd };
  }

  // 负载均衡
  private balanceLoad(agentsMap: Map<AgentType, AgentResource>): void {
    // 获取当前所有Agent的负载
    const loads = new Map<AgentType, number>();
    agentsMap.forEach((resource, agentType) => {
      loads.set(agentType, resource.estimatedLoad);
    });

    // 找出负载过重的Agent
    const overloadedAgents: AgentType[] = [];
    loads.forEach((load, agentType) => {
      if (load > this.config.maxLoadPerAgent) {
        overloadedAgents.push(agentType);
      }
    });

    // 对于过载的Agent，尝试将部分任务转移到其他同类Agent
    // 注意：由于类型系统限制，同类型Agent可能无法替换，所以这里只是标记
    // 实际实现可能需要Agent池或多个相同类型的Agent实例
    for (const agentType of overloadedAgents) {
      const resource = agentsMap.get(agentType);
      if (resource) {
        // 标记为高负载状态
        resource.allocated = true;
      }
    }
  }

  // 计算利用率
  private calculateUtilization(
    agentsMap: Map<AgentType, AgentResource>,
  ): number {
    let totalLoad = 0;
    const totalCapacity = agentsMap.size * this.config.maxLoadPerAgent;

    agentsMap.forEach((resource) => {
      totalLoad += resource.estimatedLoad;
    });

    return totalCapacity > 0 ? Math.min(totalLoad / totalCapacity, 1) : 0;
  }

  // 计算最大并发数
  private calculateMaxConcurrent(tasks: SubTask[]): number {
    // 统计每个时间点有多少任务在执行
    const timePoints = new Map<number, number>();

    for (const task of tasks) {
      const startTime = this.getTaskStartTime(task, tasks);
      const endTime = startTime + (task.estimatedTime || 0);

      // 简化处理：假设任务在整数时间点开始
      for (let t = startTime; t < endTime; t++) {
        const current = timePoints.get(t) || 0;
        timePoints.set(t, current + 1);
      }
    }

    // 返回最大并发数
    return Math.max(...Array.from(timePoints.values()), 1);
  }

  // 获取任务开始时间
  private getTaskStartTime(task: SubTask, allTasks: SubTask[]): number {
    // 如果没有依赖，从0开始
    if (!task.dependencies || task.dependencies.length === 0) {
      return 0;
    }

    // 计算所有依赖任务的最晚结束时间
    let maxEndTime = 0;
    for (const depId of task.dependencies) {
      const depTask = allTasks.find((t) => t.id === depId);
      if (depTask) {
        const depEndTime =
          this.getTaskStartTime(depTask, allTasks) +
          (depTask.estimatedTime || 0);
        maxEndTime = Math.max(maxEndTime, depEndTime);
      }
    }

    return maxEndTime;
  }

  // 查询资源可用性
  public async queryAvailability(
    agentType: AgentType,
  ): Promise<ResourceAvailability> {
    // 检查历史分配记录
    const history = this.allocationHistory.get(agentType) || [];
    const currentLoad =
      history.length > 0 ? history[history.length - 1].estimatedLoad : 0;

    const available = currentLoad < this.config.maxLoadPerAgent;
    const capacity = this.config.maxLoadPerAgent;

    // 估算等待时间
    let estimatedWaitTime = 0;
    if (!available) {
      estimatedWaitTime = currentLoad - capacity;
    }

    return {
      agentType,
      available,
      currentLoad,
      capacity,
      estimatedWaitTime,
    };
  }

  // 批量查询资源可用性
  public async queryAllAvailability(
    agentTypes: AgentType[],
  ): Promise<ResourceAvailability[]> {
    const results: ResourceAvailability[] = [];

    for (const agentType of agentTypes) {
      const availability = await this.queryAvailability(agentType);
      results.push(availability);
    }

    return results;
  }

  // 记录分配历史
  private recordAllocation(allocation: ResourceAllocation): void {
    allocation.agents.forEach((resource, agentType) => {
      const history = this.allocationHistory.get(agentType) || [];
      history.push({ ...resource });
      this.allocationHistory.set(agentType, history);

      // 限制历史记录数量
      if (history.length > 100) {
        this.allocationHistory.set(agentType, history.slice(-100));
      }
    });
  }

  // 清空分配历史
  public clearHistory(): void {
    this.allocationHistory.clear();
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
  public updateConfig(config: Partial<AllocationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // 获取当前配置
  public getConfig(): AllocationConfig {
    return { ...this.config };
  }
}
