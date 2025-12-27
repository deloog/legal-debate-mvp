// Agent注册系统

import type {
  Agent,
  AgentType,
  AgentMetadata,
  AgentRegistration,
  AgentContext,
  TaskPriority
} from '../../types/agent';

import {
  AgentStatus,
  AgentEventType,
  AgentEvent
} from '../../types/agent';

import {
  AgentEventListener,
  AgentEventManager,
  createAgentEvent,
  isValidAgent
} from './types';

import {
  AgentDIContainer,
  AgentCreationConfig,
  diContainer
} from './di-container';

// =============================================================================
// Agent发现选项接口
// =============================================================================

export interface AgentDiscoveryOptions {
  // 按能力查询
  byCapability?: string[];
  
  // 按任务类型查询
  byTaskType?: string[];
  
  // 按性能要求查询
  byPerformance?: {
    minSuccessRate?: number;
    maxExecutionTime?: number;
    minConfidence?: number;
  };
  
  // 按状态查询
  byStatus?: AgentStatus[];
  
  // 按依赖关系查询
  withDependencies?: AgentType[];
  withoutDependencies?: AgentType[];
  
  // 排序选项
  sortBy?: 'name' | 'type' | 'successRate' | 'executionTime' | 'lastUsed';
  sortOrder?: 'asc' | 'desc';
  
  // 分页选项
  limit?: number;
  offset?: number;
}

// =============================================================================
// Agent推荐结果接口
// =============================================================================

export interface AgentRecommendation {
  agent: Agent;
  metadata: AgentMetadata;
  score: number;
  reasons: string[];
  confidence: number;
}

// =============================================================================
// Agent注册表类
// =============================================================================

export class AgentRegistry implements AgentEventManager {
  private agents = new Map<string, AgentRegistration>();
  private agentsByType = new Map<AgentType, AgentRegistration[]>();
  private agentsByCapability = new Map<string, AgentRegistration[]>();
  private agentsByTask = new Map<string, AgentRegistration[]>();
  private eventListeners = new Map<AgentEventType, AgentEventListener[]>();
  private diContainer: AgentDIContainer;

  // 单例模式
  private static instance: AgentRegistry;
  public static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  private constructor() {
    // 初始化事件监听器映射
    Object.values(AgentEventType).forEach(eventType => {
      this.eventListeners.set(eventType, []);
    });
    
    // 获取依赖注入容器
    this.diContainer = diContainer;
  }

  // =============================================================================
  // Agent注册管理
  // =============================================================================

  /**
   * 注册Agent
   */
  public registerAgent(agent: Agent, updatedBy?: string): boolean {
    if (!isValidAgent(agent)) {
      throw new Error(`Invalid agent: ${(agent as any).name || 'unknown'}`);
    }

    // 检查Agent是否有getMetadata方法，如果没有则创建基本元数据
    const metadata = (agent as any).getMetadata 
      ? (agent as any).getMetadata()
      : {
          name: agent.name,
          type: agent.type,
          version: agent.version,
          description: agent.description,
          capabilities: [],
          supportedTasks: [],
          status: AgentStatus.IDLE,
          requiredConfig: [],
          optionalConfig: []
        };
    const registration: AgentRegistration = {
      metadata,
      instance: agent,
      registeredAt: Date.now(),
      updatedBy
    };

    // 检查是否已存在同名Agent
    if (this.agents.has(agent.name)) {
      const existing = this.agents.get(agent.name)!;
      if (existing.metadata.status !== AgentStatus.DISABLED) {
        throw new Error(`Agent '${agent.name}' is already registered and active`);
      }
      // 更新已存在的Agent
      this.agents.set(agent.name, registration);
    } else {
      // 新注册Agent
      this.agents.set(agent.name, registration);
    }

    // 按类型索引
    if (!this.agentsByType.has(agent.type)) {
      this.agentsByType.set(agent.type, []);
    }
    const typeAgents = this.agentsByType.get(agent.type)!;
    const existingIndex = typeAgents.findIndex(a => a.metadata.name === agent.name);
    if (existingIndex >= 0) {
      typeAgents[existingIndex] = registration;
    } else {
      typeAgents.push(registration);
    }

    // 发送注册事件
    this.emit(createAgentEvent(
      AgentEventType.REGISTERED,
      agent.name,
      { type: agent.type, metadata }
    ));

    return true;
  }

  /**
   * 注销Agent
   */
  public unregisterAgent(agentName: string): boolean {
    const registration = this.agents.get(agentName);
    if (!registration) {
      return false;
    }

    const agentType = registration.metadata.type;

    // 从主注册表中移除
    this.agents.delete(agentName);

    // 从类型索引中移除
    const typeAgents = this.agentsByType.get(agentType);
    if (typeAgents) {
      const index = typeAgents.findIndex(a => a.metadata.name === agentName);
      if (index >= 0) {
        typeAgents.splice(index, 1);
      }
      if (typeAgents.length === 0) {
        this.agentsByType.delete(agentType);
      }
    }

    // 发送注销事件
    this.emit(createAgentEvent(
      AgentEventType.UNREGISTERED,
      agentName,
      { type: agentType }
    ));

    return true;
  }

  /**
   * 禁用Agent
   */
  public disableAgent(agentName: string): boolean {
    const registration = this.agents.get(agentName);
    if (!registration) {
      return false;
    }

    const oldStatus = registration.metadata.status;
    registration.metadata.status = AgentStatus.DISABLED;

    // 发送状态变更事件
    if (oldStatus !== AgentStatus.DISABLED) {
      this.emit(createAgentEvent(
        AgentEventType.STATUS_CHANGED,
        agentName,
        { oldStatus, newStatus: AgentStatus.DISABLED }
      ));
    }

    return true;
  }

  /**
   * 启用Agent
   */
  public enableAgent(agentName: string): boolean {
    const registration = this.agents.get(agentName);
    if (!registration) {
      return false;
    }

    const oldStatus = registration.metadata.status;
    registration.metadata.status = AgentStatus.IDLE;

    // 发送状态变更事件
    if (oldStatus !== AgentStatus.IDLE) {
      this.emit(createAgentEvent(
        AgentEventType.STATUS_CHANGED,
        agentName,
        { oldStatus, newStatus: AgentStatus.IDLE }
      ));
    }

    return true;
  }

  // =============================================================================
  // Agent查询方法
  // =============================================================================

  /**
   * 根据名称获取Agent
   */
  public getAgent(agentName: string): Agent | undefined {
    const registration = this.agents.get(agentName);
    return registration?.instance;
  }

  /**
   * 根据名称获取Agent注册信息
   */
  public getRegistration(agentName: string): AgentRegistration | undefined {
    return this.agents.get(agentName);
  }

  /**
   * 根据名称获取Agent元数据
   */
  public getMetadata(agentName: string): AgentMetadata | undefined {
    const registration = this.agents.get(agentName);
    return registration?.metadata;
  }

  /**
   * 根据类型获取所有Agent
   */
  public getAgentsByType(agentType: AgentType): Agent[] {
    const registrations = this.agentsByType.get(agentType) || [];
    return registrations
      .filter(reg => reg.metadata.status !== AgentStatus.DISABLED)
      .map(reg => reg.instance);
  }

  /**
   * 根据类型获取所有Agent注册信息
   */
  public getRegistrationsByType(agentType: AgentType): AgentRegistration[] {
    return this.agentsByType.get(agentType) || [];
  }

  /**
   * 获取所有已注册的Agent
   */
  public getAllAgents(): Agent[] {
    const agents: Agent[] = [];
    for (const registration of this.agents.values()) {
      if (registration.metadata.status !== AgentStatus.DISABLED) {
        agents.push(registration.instance);
      }
    }
    return agents;
  }

  /**
   * 获取所有注册信息
   */
  public getAllRegistrations(): AgentRegistration[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取所有Agent元数据
   */
  public getAllMetadata(): AgentMetadata[] {
    const metadataList: AgentMetadata[] = [];
    for (const registration of this.agents.values()) {
      metadataList.push(registration.metadata);
    }
    return metadataList;
  }

  /**
   * 检查Agent是否已注册
   */
  public isRegistered(agentName: string): boolean {
    return this.agents.has(agentName);
  }

  /**
   * 检查指定类型的Agent是否存在
   */
  public hasAgentType(agentType: AgentType): boolean {
    const typeAgents = this.agentsByType.get(agentType);
    return typeAgents ? typeAgents.length > 0 : false;
  }

  /**
   * 获取Agent统计信息
   */
  public getStatistics(): {
    totalAgents: number;
    activeAgents: number;
    disabledAgents: number;
    agentsByType: Record<string, number>;
  } {
    const stats = {
      totalAgents: this.agents.size,
      activeAgents: 0,
      disabledAgents: 0,
      agentsByType: {} as Record<string, number>
    };

    for (const registration of this.agents.values()) {
      if (registration.metadata.status === AgentStatus.DISABLED) {
        stats.disabledAgents++;
      } else {
        stats.activeAgents++;
      }

      const type = registration.metadata.type as string;
      stats.agentsByType[type] = (stats.agentsByType[type] || 0) + 1;
    }

    return stats;
  }

  // =============================================================================
  // 事件管理
  // =============================================================================

  /**
   * 添加事件监听器
   */
  public on(event: AgentEventType, listener: AgentEventListener): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
  }

  /**
   * 移除事件监听器
   */
  public off(event: AgentEventType, listener: AgentEventListener): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * 发送事件
   */
  public emit(event: AgentEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in event listener for ${event.type}:`, error);
      }
    }
  }

  // =============================================================================
  // 批量操作
  // =============================================================================

  /**
   * 批量注册Agent
   */
  public registerAgents(agents: Agent[], updatedBy?: string): number {
    let successCount = 0;
    const errors: string[] = [];

    for (const agent of agents) {
      try {
        if (this.registerAgent(agent, updatedBy)) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Failed to register agent '${agent.name}': ${error}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Batch registration errors:', errors);
    }

    return successCount;
  }

  /**
   * 批量注销Agent
   */
  public unregisterAgents(agentNames: string[]): number {
    let successCount = 0;
    
    for (const agentName of agentNames) {
      if (this.unregisterAgent(agentName)) {
        successCount++;
      }
    }

    return successCount;
  }

  /**
   * 清空注册表
   */
  public clear(): void {
    const agentNames = Array.from(this.agents.keys());
    this.unregisterAgents(agentNames);
  }

  // =============================================================================
  // 健康检查和诊断
  // =============================================================================

  /**
   * 执行所有Agent的健康检查
   */
  async performHealthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [agentName, registration] of this.agents.entries()) {
      if (registration.metadata.status === AgentStatus.DISABLED) {
        results[agentName] = false;
        continue;
      }

      try {
        results[agentName] = await registration.instance.healthCheck?.() ?? true;
      } catch (error) {
        results[agentName] = false;
        console.error(`Health check failed for agent '${agentName}':`, error);
      }
    }

    return results;
  }

  /**
   * 获取注册表诊断信息
   */
  public getDiagnostics(): {
    timestamp: number;
    statistics: ReturnType<AgentRegistry['getStatistics']>;
    agents: AgentMetadata[];
    eventListeners: Record<string, number>;
  } {
    const eventListenerCounts: Record<string, number> = {};
    for (const [eventType, listeners] of this.eventListeners.entries()) {
      eventListenerCounts[eventType] = listeners.length;
    }

    return {
      timestamp: Date.now(),
      statistics: this.getStatistics(),
      agents: this.getAllMetadata(),
      eventListeners: eventListenerCounts
    };
  }

  // =============================================================================
  // 增强的Agent注册表方法
  // =============================================================================

  /**
   * 使用依赖注入注册Agent
   */
  public registerAgentWithDI<T extends Agent>(
    agentClass: new (...args: any[]) => T,
    agentName: string,
    config?: AgentCreationConfig
  ): boolean {
    try {
      // 创建Agent实例
      const agent = this.diContainer.createAgent(agentClass, agentName);
      
      // 注册到注册表
      return this.registerAgent(agent, config?.updatedBy);
    } catch (error) {
      console.error(`Failed to register agent '${agentName}' with DI:`, error);
      throw error;
    }
  }

  /**
   * 批量注册Agent（支持依赖注入）
   */
  public registerAgentsWithDI<T extends Agent>(
    agentClass: new (...args: any[]) => T,
    agentConfigs: Array<{ name: string; config?: AgentCreationConfig }>
  ): number {
    let successCount = 0;
    const errors: string[] = [];

    for (const { name, config } of agentConfigs) {
      try {
        if (this.registerAgentWithDI(agentClass, name, config)) {
          successCount++;
        }
      } catch (error) {
        errors.push(`Failed to register agent '${name}': ${error}`);
      }
    }

    if (errors.length > 0) {
      console.warn('Batch registration with DI errors:', errors);
    }

    return successCount;
  }

  /**
   * 发现Agent（支持复杂查询条件）
   */
  public discoverAgents(options: AgentDiscoveryOptions = {}): Agent[] {
    let agents = this.getAllRegistrations();

    // 按能力过滤
    if (options.byCapability && options.byCapability.length > 0) {
      agents = agents.filter(reg => 
        options.byCapability!.some(capability =>
          reg.metadata.capabilities.includes(capability)
        )
      );
    }

    // 按任务类型过滤
    if (options.byTaskType && options.byTaskType.length > 0) {
      agents = agents.filter(reg => 
        options.byTaskType!.some(taskType =>
          reg.metadata.supportedTasks.includes(taskType)
        )
      );
    }

    // 按状态过滤
    if (options.byStatus && options.byStatus.length > 0) {
      agents = agents.filter(reg => 
        options.byStatus!.includes(reg.metadata.status)
      );
    }

    // 按性能要求过滤
    if (options.byPerformance) {
      agents = agents.filter(reg => {
        const perf = options.byPerformance!;
        
        if (perf.minSuccessRate && reg.metadata.successRate !== undefined) {
          if (reg.metadata.successRate < perf.minSuccessRate) {
            return false;
          }
        }
        
        if (perf.maxExecutionTime && reg.metadata.averageExecutionTime !== undefined) {
          if (reg.metadata.averageExecutionTime > perf.maxExecutionTime) {
            return false;
          }
        }
        
        return true;
      });
    }

    // 按依赖关系过滤
    if (options.withDependencies && options.withDependencies.length > 0) {
      agents = agents.filter(reg => {
        if (!reg.metadata.dependencies) {
          return false;
        }
        return options.withDependencies!.some(dep =>
          reg.metadata.dependencies!.includes(dep)
        );
      });
    }

    if (options.withoutDependencies && options.withoutDependencies.length > 0) {
      agents = agents.filter(reg => {
        if (!reg.metadata.dependencies) {
          return true;
        }
        return !options.withoutDependencies!.some(dep =>
          reg.metadata.dependencies!.includes(dep)
        );
      });
    }

    // 排序
    if (options.sortBy) {
      agents = this.sortAgents(agents, options.sortBy, options.sortOrder || 'asc');
    }

    // 分页
    if (options.offset) {
      agents = agents.slice(options.offset);
    }
    
    if (options.limit) {
      agents = agents.slice(0, options.limit);
    }

    return agents
      .filter(reg => reg.metadata.status !== AgentStatus.DISABLED)
      .map(reg => reg.instance);
  }

  /**
   * 推荐最适合的Agent
   */
  public recommendAgent(
    task: string,
    context?: AgentContext,
    options?: {
      preferredType?: AgentType;
      excludedTypes?: AgentType[];
      maxRecommendations?: number;
    }
  ): AgentRecommendation[] {
    const allAgents = this.getAllRegistrations();
    const candidates = allAgents.filter(reg => 
      reg.metadata.status !== AgentStatus.DISABLED &&
      (!options?.excludedTypes || !options.excludedTypes.includes(reg.metadata.type))
    );

    const recommendations: AgentRecommendation[] = [];

    for (const registration of candidates) {
      const score = this.calculateAgentScore(registration, task, context);
      if (score > 0) {
        recommendations.push({
          agent: registration.instance,
          metadata: registration.metadata,
          score,
          reasons: this.generateRecommendationReasons(registration, task, score),
          confidence: Math.min(score / 100, 1.0)
        });
      }
    }

    // 排序并限制结果数量
    recommendations.sort((a, b) => b.score - a.score);
    
    const maxRecs = options?.maxRecommendations || 5;
    return recommendations.slice(0, maxRecs);
  }

  /**
   * 根据能力查找Agent
   */
  public findAgentsByCapability(capability: string): Agent[] {
    const options: AgentDiscoveryOptions = {
      byCapability: [capability],
      sortBy: 'successRate',
      sortOrder: 'desc'
    };
    return this.discoverAgents(options);
  }

  /**
   * 根据任务类型查找Agent
   */
  public findAgentsByTask(taskType: string): Agent[] {
    const options: AgentDiscoveryOptions = {
      byTaskType: [taskType],
      sortBy: 'successRate',
      sortOrder: 'desc'
    };
    return this.discoverAgents(options);
  }

  /**
   * 查找最佳性能Agent
   */
  public findBestPerformingAgents(
    metric: 'successRate' | 'executionTime' = 'successRate',
    limit: number = 5
  ): Agent[] {
    const options: AgentDiscoveryOptions = {
      sortBy: metric,
      sortOrder: metric === 'successRate' ? 'desc' : 'asc',
      limit
    };
    return this.discoverAgents(options);
  }

  /**
   * 获取增强的统计信息
   */
  public getEnhancedStatistics(): {
    registry: ReturnType<AgentRegistry['getStatistics']>;
    diContainer: ReturnType<AgentDIContainer['getStatistics']>;
    capabilities: Record<string, number>;
    tasks: Record<string, number>;
  } {
    const registryStats = this.getStatistics();
    const diStats = this.diContainer.getStatistics();
    
    // 统计能力和任务
    const capabilities: Record<string, number> = {};
    const tasks: Record<string, number> = {};
    
    for (const registration of this.getAllRegistrations()) {
      for (const capability of registration.metadata.capabilities) {
        capabilities[capability] = (capabilities[capability] || 0) + 1;
      }
      
      for (const task of registration.metadata.supportedTasks) {
        tasks[task] = (tasks[task] || 0) + 1;
      }
    }

    return {
      registry: registryStats,
      diContainer: diStats,
      capabilities,
      tasks
    };
  }

  /**
   * 获取完整的诊断信息
   */
  public getFullDiagnostics(): {
    timestamp: number;
    registry: ReturnType<AgentRegistry['getDiagnostics']>;
    diContainer: ReturnType<AgentDIContainer['getDiagnostics']>;
    recommendations: Array<{
      agentName: string;
      issues: string[];
      suggestions: string[];
    }>;
  } {
    const registryDiag = this.getDiagnostics();
    const diDiag = this.diContainer.getDiagnostics();
    
    // 生成建议
    const recommendations = this.generateRecommendations();

    return {
      timestamp: Date.now(),
      registry: registryDiag,
      diContainer: diDiag,
      recommendations
    };
  }

  // =============================================================================
  // 私有工具方法
  // =============================================================================

  /**
   * 排序Agent
   */
  private sortAgents(
    registrations: AgentRegistration[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): AgentRegistration[] {
    return registrations.sort((a, b) => {
      let valueA: any, valueB: any;

      switch (sortBy) {
        case 'name':
          valueA = a.metadata.name;
          valueB = b.metadata.name;
          break;
        case 'type':
          valueA = a.metadata.type;
          valueB = b.metadata.type;
          break;
        case 'successRate':
          valueA = a.metadata.successRate || 0;
          valueB = b.metadata.successRate || 0;
          break;
        case 'executionTime':
          valueA = a.metadata.averageExecutionTime || Infinity;
          valueB = b.metadata.averageExecutionTime || Infinity;
          break;
        case 'lastUsed':
          valueA = a.metadata.lastUsed || 0;
          valueB = b.metadata.lastUsed || 0;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * 计算Agent评分
   */
  private calculateAgentScore(
    registration: AgentRegistration,
    task: string,
    context?: AgentContext
  ): number {
    let score = 0;
    const metadata = registration.metadata;

    // 基础分数
    score += 20; // 每个Agent都有基础分数

    // 成功率加分
    if (metadata.successRate) {
      score += metadata.successRate * 30;
    }

    // 执行时间加分（越快越好）
    if (metadata.averageExecutionTime) {
      const timeScore = Math.max(0, 30 - (metadata.averageExecutionTime / 100));
      score += timeScore;
    }

    // 能力匹配加分
    const taskLower = task.toLowerCase();
    for (const capability of metadata.capabilities) {
      if (capability.toLowerCase().includes(taskLower) || 
          taskLower.includes(capability.toLowerCase())) {
        score += 15;
      }
    }

    // 任务支持加分
    for (const supportedTask of metadata.supportedTasks) {
      if (supportedTask.toLowerCase().includes(taskLower) || 
          taskLower.includes(supportedTask.toLowerCase())) {
        score += 10;
      }
    }

    // 最近使用加分
    if (metadata.lastUsed) {
      const daysSinceUse = (Date.now() - metadata.lastUsed) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.max(0, 10 - daysSinceUse);
      score += recencyScore;
    }

    // 依赖扣分
    if (metadata.dependencies && metadata.dependencies.length > 0) {
      score -= metadata.dependencies.length * 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成推荐理由
   */
  private generateRecommendationReasons(
    registration: AgentRegistration,
    task: string,
    score: number
  ): string[] {
    const reasons: string[] = [];
    const metadata = registration.metadata;

    if (metadata.successRate && metadata.successRate > 0.8) {
      reasons.push(`高成功率 (${(metadata.successRate * 100).toFixed(1)}%)`);
    }

    if (metadata.averageExecutionTime && metadata.averageExecutionTime < 1000) {
      reasons.push(`快速响应 (${metadata.averageExecutionTime}ms)`);
    }

    const taskLower = task.toLowerCase();
    for (const capability of metadata.capabilities) {
      if (capability.toLowerCase().includes(taskLower) || 
          taskLower.includes(capability.toLowerCase())) {
        reasons.push(`能力匹配: ${capability}`);
        break;
      }
    }

    if (score > 80) {
      reasons.push('综合评分优秀');
    }

    return reasons;
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(): Array<{
    agentName: string;
    issues: string[];
    suggestions: string[];
  }> {
    const recommendations = [];
    
    for (const registration of this.getAllRegistrations()) {
      const issues: string[] = [];
      const suggestions: string[] = [];
      
      // 检查成功率
      if (registration.metadata.successRate !== undefined) {
        if (registration.metadata.successRate < 0.5) {
          issues.push('成功率偏低');
          suggestions.push('优化Agent实现以提高成功率');
        }
      }
      
      // 检查执行时间
      if (registration.metadata.averageExecutionTime !== undefined) {
        if (registration.metadata.averageExecutionTime > 5000) {
          issues.push('执行时间过长');
          suggestions.push('优化算法或增加缓存机制');
        }
      }
      
      // 检查能力定义
      if (registration.metadata.capabilities.length === 0) {
        issues.push('缺少能力定义');
        suggestions.push('添加Agent能力描述');
      }
      
      // 检查任务支持
      if (registration.metadata.supportedTasks.length === 0) {
        issues.push('缺少任务支持定义');
        suggestions.push('添加支持的任务类型');
      }
      
      if (issues.length > 0 || suggestions.length > 0) {
        recommendations.push({
          agentName: registration.metadata.name,
          issues,
          suggestions
        });
      }
    }
    
    return recommendations;
  }
}

// =============================================================================
// 导出单例实例
// =============================================================================

export const agentRegistry = AgentRegistry.getInstance();
