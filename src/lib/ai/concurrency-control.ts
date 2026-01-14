import type {
  ConcurrencyControlConfig,
  QueuedTask,
  TaskPriority,
  ConcurrencyControlStats,
} from '../../types/ai-service-batch';

/**
 * 并发控制器类
 * 控制并发请求数量，防止资源耗尽
 */
export class ConcurrencyControl {
  private config: ConcurrencyControlConfig;
  private queue: QueuedTask<unknown>[];
  private activeTasks: Set<string>;
  private stats: ConcurrencyControlStats;
  private taskIdCounter: number;

  constructor(config?: Partial<ConcurrencyControlConfig>) {
    this.config = this.mergeConfig(config);
    this.queue = [];
    this.activeTasks = new Set();
    this.stats = this.initializeStats();
    this.taskIdCounter = 0;
  }

  /**
   * 执行带并发控制的任务
   */
  public async execute<T>(
    fn: () => Promise<T>,
    priority: TaskPriority = 'normal'
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const taskId = `task_${this.taskIdCounter++}`;
      const now = Date.now();
      const timeoutAt = now + this.config.queueTimeout;

      const task: QueuedTask<T> = {
        taskId,
        execute: fn,
        priority,
        createdAt: now,
        timeoutAt,
        resolve: resolve as (value: unknown) => void,
        reject,
        attempts: 0,
        cancelled: false,
      };

      this.addToQueue(task as QueuedTask<unknown>);
      this.processQueue();
    });
  }

  /**
   * 获取统计信息
   */
  public getStats(): ConcurrencyControlStats {
    return {
      ...this.stats,
      currentConcurrency: this.activeTasks.size,
      currentQueueLength: this.queue.length,
    };
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ConcurrencyControlConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.stats = this.initializeStats();
  }

  /**
   * 取消所有队列中的任务
   */
  public cancelAll(): void {
    this.queue.forEach(task => {
      task.cancelled = true;
      task.reject(new Error('Task cancelled'));
      this.stats.cancelledTasks++;
    });
    this.queue = [];
  }

  /**
   * 清空队列
   */
  public clear(): void {
    this.cancelAll();
  }

  /**
   * 获取队列大小
   */
  public getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 获取活跃任务数
   */
  public getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    config?: Partial<ConcurrencyControlConfig>
  ): ConcurrencyControlConfig {
    const defaultConfig: ConcurrencyControlConfig = {
      maxConcurrency: 10,
      maxQueueSize: 100,
      queueTimeout: 30000,
      enablePriority: true,
      enableFairScheduling: false,
    };
    return { ...defaultConfig, ...config };
  }

  /**
   * 初始化统计
   */
  private initializeStats(): ConcurrencyControlStats {
    return {
      totalTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      cancelledTasks: 0,
      currentConcurrency: 0,
      currentQueueLength: 0,
      averageWaitTime: 0,
      averageExecutionTime: 0,
      averageRetries: 0,
    };
  }

  /**
   * 添加任务到队列
   */
  private addToQueue(task: QueuedTask<unknown>): void {
    if (this.queue.length >= this.config.maxQueueSize) {
      task.reject(new Error('Queue is full'));
      this.stats.failedTasks++;
      return;
    }

    this.queue.push(task);
    this.stats.totalTasks++;
  }

  /**
   * 处理队列
   */
  private processQueue(): void {
    while (
      this.activeTasks.size < this.config.maxConcurrency &&
      this.queue.length > 0
    ) {
      const task = this.getNextTask();
      if (!task) break;

      this.executeTask(task);
    }
  }

  /**
   * 获取下一个任务
   */
  private getNextTask(): QueuedTask<unknown> | null {
    const now = Date.now();

    // 清理超时的任务
    this.queue = this.queue.filter(task => {
      if (task.timeoutAt < now) {
        task.cancelled = true;
        task.reject(new Error('Queue timeout'));
        this.stats.cancelledTasks++;
        return false;
      }
      return true;
    });

    if (this.queue.length === 0) {
      return null;
    }

    if (this.config.enablePriority) {
      return this.getTaskByPriority();
    } else {
      return this.queue.shift() || null;
    }
  }

  /**
   * 根据优先级获取任务
   */
  private getTaskByPriority(): QueuedTask<unknown> | null {
    const priorityOrder: TaskPriority[] = ['high', 'normal', 'low'];

    for (const priority of priorityOrder) {
      const index = this.queue.findIndex(task => task.priority === priority);
      if (index !== -1) {
        return this.queue.splice(index, 1)[0] || null;
      }
    }

    return this.queue.shift() || null;
  }

  /**
   * 执行任务
   */
  private async executeTask(task: QueuedTask<unknown>): Promise<void> {
    if (task.cancelled) {
      return;
    }

    const waitTime = Date.now() - task.createdAt;
    const startTime = Date.now();

    this.activeTasks.add(task.taskId);
    task.attempts++;

    try {
      const result = await task.execute();
      const executionTime = Date.now() - startTime;

      this.updateStats(waitTime, executionTime, true, task.attempts);
      task.resolve(result);
      this.stats.successfulTasks++;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.updateStats(waitTime, executionTime, false, task.attempts);
      task.reject(error instanceof Error ? error : new Error(String(error)));
      this.stats.failedTasks++;
    } finally {
      this.activeTasks.delete(task.taskId);
      this.processQueue();
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(
    waitTime: number,
    executionTime: number,
    success: boolean,
    attempts: number
  ): void {
    const totalTasks = this.stats.successfulTasks + this.stats.failedTasks;
    const newTotalTasks = totalTasks + 1;

    this.stats.averageWaitTime =
      (this.stats.averageWaitTime * totalTasks + waitTime) / newTotalTasks;
    this.stats.averageExecutionTime =
      (this.stats.averageExecutionTime * totalTasks + executionTime) /
      newTotalTasks;
    this.stats.averageRetries =
      (this.stats.averageRetries * totalTasks + (attempts - 1)) / newTotalTasks;
  }
}

/**
 * 并发控制器工厂
 */
export class ConcurrencyControlFactory {
  private static instances: Map<string, ConcurrencyControl> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<ConcurrencyControlConfig>
  ): ConcurrencyControl {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new ConcurrencyControl(config);
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static createCustomInstance(
    name: string,
    config: Partial<ConcurrencyControlConfig>
  ): ConcurrencyControl {
    const instance = new ConcurrencyControl(config);
    this.instances.set(name, instance);
    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      instance.clear();
      this.instances.delete(name);
      return true;
    }
    return false;
  }

  public static getAllInstances(): Map<string, ConcurrencyControl> {
    return new Map(this.instances);
  }

  public static resetAll(): void {
    this.instances.forEach(instance => instance.resetStats());
  }

  public static clearAll(): void {
    this.instances.forEach(instance => instance.clear());
  }

  public static shutdownAll(): void {
    this.instances.forEach(instance => instance.clear());
    this.instances.clear();
  }
}

export default ConcurrencyControlFactory;
