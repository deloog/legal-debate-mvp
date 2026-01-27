// Agent管理器 - 统一的Agent调用接口

import type {
  Agent,
  AgentContext,
  AgentResult,
  AgentWorkflowConfig,
} from '../../types/agent';

import { AgentError, AgentErrorType, TaskPriority } from '../../types/agent';

import { agentRegistry } from './registry';

import { createAgentError, createAgentResult } from './types';

import { EventEmitter } from 'events';

// =============================================================================
// Agent管理器配置接口
// =============================================================================

export interface AgentManagerConfig {
  // 并发控制
  maxConcurrentExecutions: number;

  // 超时配置
  defaultTimeout: number;

  // 重试配置
  maxRetryAttempts: number;
  retryBaseDelay: number;
  retryMaxDelay: number;

  // 缓存配置
  enableResultCache: boolean;
  cacheTTL: number;

  // 监控配置
  enableMetrics: boolean;
  metricsInterval: number;
}

// =============================================================================
// 执行状态接口
// =============================================================================

export interface ExecutionStatus {
  executionId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: number;
  endTime?: number;
  result?: AgentResult;
  error?: AgentError;
  progress?: number;
}

// =============================================================================
// Agent管理器统计信息
// =============================================================================

export interface AgentManagerStats {
  // 基础统计
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;

  // 性能统计
  averageExecutionTime: number;
  totalExecutionTime: number;

  // 并发统计
  currentConcurrentExecutions: number;
  maxConcurrentExecutions: number;

  // 缓存统计
  cacheHits: number;
  cacheMisses: number;

  // 时间信息
  lastExecutionTime: number;
  uptime: number;
}

// =============================================================================
// 执行队列项
// =============================================================================

interface QueueItem {
  executionId: string;
  agentName: string;
  context: AgentContext;
  priority: TaskPriority;
  resolve: (result: AgentResult) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// 缓存项接口
interface CachedResult {
  result: AgentResult;
  cacheTime: number;
}

// =============================================================================
// Agent管理器类
// =============================================================================

export class AgentManager extends EventEmitter {
  private config: AgentManagerConfig;
  private executionQueue: QueueItem[] = [];
  private runningExecutions = new Map<string, ExecutionStatus>();
  private resultCache = new Map<string, CachedResult>();
  private stats: AgentManagerStats;
  private startTime: number;
  private metricsTimer?: NodeJS.Timeout;
  private executionCounter = 0;

  constructor(config: Partial<AgentManagerConfig> = {}) {
    super();

    this.config = {
      maxConcurrentExecutions: 5,
      defaultTimeout: 30000,
      maxRetryAttempts: 3,
      retryBaseDelay: 1000,
      retryMaxDelay: 10000,
      enableResultCache: true,
      cacheTTL: 300000, // 5分钟
      enableMetrics: true,
      metricsInterval: 60000, // 1分钟
      ...config,
    };

    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cancelledExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      currentConcurrentExecutions: 0,
      maxConcurrentExecutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastExecutionTime: 0,
      uptime: 0,
    };

    this.startTime = Date.now();

    if (this.config.enableMetrics) {
      this.startMetricsCollection();
    }
  }

  // =============================================================================
  // 主要执行接口
  // =============================================================================

  /**
   * 统一执行接口
   */
  public async execute(
    agentName: string,
    task: string,
    data: Record<string, unknown> = {},
    options: {
      priority?: TaskPriority;
      timeout?: number;
      enableCache?: boolean;
      retryAttempts?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<AgentResult> {
    const executionId = this.generateExecutionId();
    const priority = options.priority || TaskPriority.MEDIUM;

    // 创建Agent上下文
    const context: AgentContext = {
      task,
      data,
      priority,
      requestId: executionId,
      options: {
        timeout: options.timeout,
      },
      metadata: options.metadata,
    };

    // 检查缓存
    if (this.config.enableResultCache && options.enableCache !== false) {
      const cachedResult = this.getCachedResult(agentName, context);
      if (cachedResult) {
        this.emit('execution_cached', {
          executionId,
          agentName,
          result: cachedResult,
        });
        return cachedResult;
      }
    }

    // 添加到执行队列
    return new Promise<AgentResult>((resolve, reject) => {
      const queueItem: QueueItem = {
        executionId,
        agentName,
        context,
        priority,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      this.addToQueue(queueItem);
      this.processQueue();
    });
  }

  /**
   * 批量执行
   */
  public async executeBatch(
    tasks: Array<{
      agentName: string;
      task: string;
      data?: Record<string, unknown>;
      options?: {
        priority?: TaskPriority;
        timeout?: number;
        enableCache?: boolean;
      };
    }>
  ): Promise<AgentResult[]> {
    const promises = tasks.map(({ agentName, task, data, options }) =>
      this.execute(agentName, task, data || {}, options)
    );

    const results = await Promise.allSettled(promises);

    // 检查是否有失败的执行
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      const error = failures[0];
      throw error?.reason || new Error('Batch execution failed');
    }

    return results.map(
      result => (result as PromiseFulfilledResult<AgentResult>).value
    );
  }

  /**
   * 工作流执行
   */
  public async executeWorkflow(
    workflow: AgentWorkflowConfig,
    context: AgentContext
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];

    // 根据工作流配置执行Agent
    if (workflow.executionMode === 'sequential') {
      // 顺序执行
      for (const agentType of workflow.agents) {
        const agents = agentRegistry.getAgentsByType(agentType);
        if (agents.length === 0) {
          throw new Error(`No agents found for type: ${agentType}`);
        }

        // 选择最佳Agent
        const bestAgent = agents[0]; // 简化实现，可选择第一个
        const result = await this.execute(
          bestAgent.name,
          context.task,
          context.data
        );
        results.push(result);

        // 如果执行失败且配置为停止，则中断工作流
        if (!result.success && workflow.errorHandling === 'stop') {
          throw new Error(
            `Workflow stopped due to failure in agent: ${bestAgent.name}`
          );
        }
      }
    } else if (workflow.executionMode === 'parallel') {
      // 并行执行
      const promises = workflow.agents.map(async agentType => {
        const agents = agentRegistry.getAgentsByType(agentType);
        if (agents.length === 0) {
          throw new Error(`No agents found for type: ${agentType}`);
        }

        const bestAgent = agents[0];
        return this.execute(bestAgent.name, context.task, context.data);
      });

      const parallelResults = await Promise.allSettled(promises);
      parallelResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // 创建错误结果
          results.push(
            createAgentResult('workflow', undefined, {
              success: false,
              error: createAgentError(
                'WORKFLOW_ERROR',
                result.reason?.message || 'Unknown workflow error',
                AgentErrorType.EXECUTION_ERROR,
                'workflow'
              ),
            })
          );
        }
      });
    }

    return results;
  }

  // =============================================================================
  // 状态管理
  // =============================================================================

  /**
   * 获取执行状态
   */
  public getExecutionStatus(executionId: string): ExecutionStatus | undefined {
    return this.runningExecutions.get(executionId);
  }

  /**
   * 取消执行
   */
  public cancelExecution(executionId: string): boolean {
    const status = this.runningExecutions.get(executionId);
    if (
      !status ||
      status.status === 'completed' ||
      status.status === 'cancelled'
    ) {
      return false;
    }

    status.status = 'cancelled';
    status.endTime = Date.now();

    this.updateStats('cancelled', Date.now() - status.startTime);

    this.emit('execution_cancelled', {
      executionId,
      agentName: status.agentName,
    });
    return true;
  }

  /**
   * 获取所有执行状态
   */
  public getAllExecutionStatuses(): ExecutionStatus[] {
    return Array.from(this.runningExecutions.values());
  }

  // =============================================================================
  // 统计信息
  // =============================================================================

  /**
   * 获取统计信息
   */
  public getStatistics(): AgentManagerStats {
    this.stats.currentConcurrentExecutions = this.runningExecutions.size;
    this.stats.uptime = Date.now() - this.startTime;

    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  public resetStatistics(): void {
    this.stats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      cancelledExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      currentConcurrentExecutions: this.runningExecutions.size,
      maxConcurrentExecutions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      lastExecutionTime: 0,
      uptime: Date.now() - this.startTime,
    };
  }

  // =============================================================================
  // 清理方法
  // =============================================================================

  /**
   * 清理管理器
   */
  public async cleanup(): Promise<void> {
    // 取消所有正在运行的执行
    for (const [executionId, status] of this.runningExecutions.entries()) {
      if (status.status === 'running') {
        this.cancelExecution(executionId);
      }
    }

    // 清理缓存
    this.resultCache.clear();

    // 停止指标收集
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    this.removeAllListeners();
  }

  // =============================================================================
  // 私有方法 - 队列管理
  // =============================================================================

  /**
   * 添加到执行队列
   */
  private addToQueue(item: QueueItem): void {
    // 按优先级插入（高优先级在前）
    let insertIndex = this.executionQueue.length;

    for (let i = 0; i < this.executionQueue.length; i++) {
      if (
        this.comparePriority(item.priority, this.executionQueue[i].priority) > 0
      ) {
        insertIndex = i;
        break;
      }
    }

    this.executionQueue.splice(insertIndex, 0, item);
  }

  /**
   * 处理执行队列
   */
  private async processQueue(): Promise<void> {
    while (
      this.executionQueue.length > 0 &&
      this.runningExecutions.size < this.config.maxConcurrentExecutions
    ) {
      const item = this.executionQueue.shift();
      if (item) {
        this.executeQueueItem(item);
      }
    }
  }

  /**
   * 执行队列项
   */
  private async executeQueueItem(item: QueueItem): Promise<void> {
    const { executionId, agentName, context, resolve, reject } = item;

    // 创建执行状态
    const status: ExecutionStatus = {
      executionId,
      agentName,
      status: 'running',
      startTime: Date.now(),
    };

    this.runningExecutions.set(executionId, status);
    this.stats.currentConcurrentExecutions = Math.max(
      this.stats.currentConcurrentExecutions,
      this.runningExecutions.size
    );

    this.emit('execution_started', { executionId, agentName });

    try {
      // 检查是否已被取消
      if (status.status === 'cancelled') {
        throw new Error(`Execution ${executionId} was cancelled`);
      }

      // 获取Agent实例
      const agent = agentRegistry.getAgent(agentName);
      if (!agent) {
        throw new Error(`Agent '${agentName}' not found`);
      }

      // 执行Agent
      const result = await this.executeWithTimeout(agent, context);

      // 再次检查是否已被取消
      const currentStatus = this.runningExecutions.get(executionId);
      if (currentStatus && currentStatus.status === 'cancelled') {
        throw new Error(`Execution ${executionId} was cancelled`);
      }

      // 缓存结果
      if (this.config.enableResultCache && result.success) {
        this.cacheResult(agentName, context, result);
      }

      // 更新状态
      status.status = 'completed';
      status.endTime = Date.now();
      status.result = result;

      this.updateStats('completed', status.endTime - status.startTime);
      this.emit('execution_completed', { executionId, agentName, result });

      resolve(result);
    } catch (error) {
      // 检查是否为取消导致的错误
      if (status.status === 'cancelled') {
        this.updateStats('cancelled', Date.now() - status.startTime);
        this.emit('execution_cancelled', { executionId, agentName });
        reject(new Error(`Execution ${executionId} was cancelled`));
        return;
      }

      // 更新状态
      status.status = 'failed';
      status.endTime = Date.now();
      status.error = this.createErrorFromException(error);

      this.updateStats('failed', status.endTime - status.startTime);
      this.emit('execution_failed', {
        executionId,
        agentName,
        error: status.error,
      });

      reject(error as Error);
    } finally {
      // 清理执行状态
      this.runningExecutions.delete(executionId);

      // 继续处理队列
      this.processQueue();
    }
  }

  /**
   * 带超时的执行
   */
  private async executeWithTimeout(
    agent: Agent,
    context: AgentContext
  ): Promise<AgentResult> {
    const timeout = context.options?.timeout || this.config.defaultTimeout;

    const executionPromise = agent.execute(context);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutError = createAgentError(
          'TIMEOUT',
          `Execution timeout after ${timeout}ms`,
          AgentErrorType.TIMEOUT_ERROR,
          agent.name
        );
        reject(timeoutError);
      }, timeout);
    });

    return Promise.race([executionPromise, timeoutPromise]);
  }

  // =============================================================================
  // 私有方法 - 缓存管理
  // =============================================================================

  /**
   * 获取缓存结果
   */
  private getCachedResult(
    agentName: string,
    context: AgentContext
  ): AgentResult | undefined {
    const cacheKey = this.generateCacheKey(agentName, context);
    const cached = this.resultCache.get(cacheKey);

    if (cached && Date.now() - cached.cacheTime < this.config.cacheTTL) {
      this.stats.cacheHits++;
      return { ...cached.result, cached: true, cacheKey };
    }

    this.stats.cacheMisses++;
    return undefined;
  }

  /**
   * 缓存结果
   */
  private cacheResult(
    agentName: string,
    context: AgentContext,
    result: AgentResult
  ): void {
    const cacheKey = this.generateCacheKey(agentName, context);
    this.resultCache.set(cacheKey, {
      result,
      cacheTime: Date.now(),
    });
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(agentName: string, context: AgentContext): string {
    return `${agentName}:${JSON.stringify({
      task: context.task,
      data: context.data,
      priority: context.priority,
    })}`;
  }

  // =============================================================================
  // 私有方法 - 工具函数
  // =============================================================================

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${++this.executionCounter}`;
  }

  /**
   * 比较优先级
   */
  private comparePriority(
    priority1: TaskPriority,
    priority2: TaskPriority
  ): number {
    const priorityOrder = {
      [TaskPriority.URGENT]: 4,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.LOW]: 1,
    };

    return priorityOrder[priority1] - priorityOrder[priority2];
  }

  /**
   * 从异常创建错误
   */
  private createErrorFromException(error: unknown): AgentError {
    if (error && typeof error === 'object' && 'code' in error) {
      const errorObj = error as Record<string, unknown>;
      return createAgentError(
        errorObj.code as string,
        (errorObj.message as string) || 'Unknown error',
        this.mapErrorType(errorObj.code as string),
        'agent-manager',
        this.isRetryableError(errorObj.code as string)
      );
    }

    const errorObj = error as Record<string, unknown> | null | undefined;
    return createAgentError(
      'EXECUTION_ERROR',
      (errorObj?.message as string) || 'Unknown execution error',
      AgentErrorType.EXECUTION_ERROR,
      'agent-manager'
    );
  }

  /**
   * 映射错误类型
   */
  private mapErrorType(code: string): AgentErrorType {
    const codeLower = code.toLowerCase();

    if (codeLower.includes('timeout')) return AgentErrorType.TIMEOUT_ERROR;
    if (codeLower.includes('network')) return AgentErrorType.NETWORK_ERROR;
    if (codeLower.includes('rate_limit'))
      return AgentErrorType.RATE_LIMIT_ERROR;
    if (codeLower.includes('permission'))
      return AgentErrorType.PERMISSION_ERROR;
    if (codeLower.includes('validation'))
      return AgentErrorType.VALIDATION_ERROR;

    return AgentErrorType.EXECUTION_ERROR;
  }

  /**
   * 判断是否为可重试错误
   */
  private isRetryableError(code: string): boolean {
    const retryableCodes = [
      'TIMEOUT_ERROR',
      'NETWORK_ERROR',
      'RATE_LIMIT_ERROR',
      'AI_SERVICE_ERROR',
    ];
    return retryableCodes.some(rc =>
      code.toLowerCase().includes(rc.toLowerCase())
    );
  }

  /**
   * 更新统计信息
   */
  private updateStats(
    type: 'completed' | 'failed' | 'cancelled',
    executionTime: number
  ): void {
    this.stats.totalExecutions++;
    this.stats.totalExecutionTime += executionTime;
    this.stats.lastExecutionTime = Date.now();

    if (this.stats.totalExecutions > 0) {
      this.stats.averageExecutionTime =
        this.stats.totalExecutionTime / this.stats.totalExecutions;
    }

    switch (type) {
      case 'completed':
        this.stats.successfulExecutions++;
        break;
      case 'failed':
        this.stats.failedExecutions++;
        break;
      case 'cancelled':
        this.stats.cancelledExecutions++;
        break;
    }
  }

  /**
   * 启动指标收集
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.emit('metrics', {
        timestamp: Date.now(),
        stats: this.getStatistics(),
      });
    }, this.config.metricsInterval);
  }
}

// =============================================================================
// 默认配置
// =============================================================================

export const DEFAULT_AGENT_MANAGER_CONFIG: AgentManagerConfig = {
  maxConcurrentExecutions: 5,
  defaultTimeout: 30000,
  maxRetryAttempts: 3,
  retryBaseDelay: 1000,
  retryMaxDelay: 10000,
  enableResultCache: true,
  cacheTTL: 300000,
  enableMetrics: true,
  metricsInterval: 60000,
};
