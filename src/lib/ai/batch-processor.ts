import type {
  BatchRequestItem,
  BatchRequestResult,
  BatchProcessorConfig,
  BatchProcessorStats,
  BatchProcessFunction,
} from '../../types/ai-service-batch';
import type { AIRequestConfig, AIResponse } from '../../types/ai-service';
import { logger } from '@/lib/logger';

/**
 * 批量处理器类
 * 用于批量处理AI请求，提高效率和降低成本
 */
export class BatchProcessor {
  private config: BatchProcessorConfig;
  private queue: BatchRequestItem[];
  private activeBatches: number;
  private stats: BatchProcessorStats;
  private processFn: BatchProcessFunction;
  private batchTimeoutId: NodeJS.Timeout | null;
  private requestIdCounter: number;

  constructor(
    processFn: BatchProcessFunction,
    config?: Partial<BatchProcessorConfig>
  ) {
    this.processFn = processFn;
    this.config = this.mergeConfig(config);
    this.queue = [];
    this.activeBatches = 0;
    this.requestIdCounter = 0;
    this.stats = this.initializeStats();
    this.batchTimeoutId = null;
  }

  public add(request: AIRequestConfig): Promise<AIResponse> {
    return new Promise((resolve, reject) => {
      const requestId = `batch_${this.requestIdCounter++}`;
      const item: BatchRequestItem = {
        requestId,
        request,
        resolve,
        reject,
        timestamp: Date.now(),
        processed: false,
      };
      this.queue.push(item);
      this.stats.totalRequests++;
      if (this.queue.length >= this.config.maxBatchSize) {
        void this.processBatch();
      } else {
        this.scheduleBatch();
      }
    });
  }

  public async flush(): Promise<void> {
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    await this.processBatch();
  }

  public getStats(): BatchProcessorStats {
    return {
      ...this.stats,
      currentQueueLength: this.queue.length,
      activeBatches: this.activeBatches,
    };
  }

  public updateConfig(config: Partial<BatchProcessorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public resetStats(): void {
    this.stats = this.initializeStats();
  }

  public async shutdown(): Promise<void> {
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    await this.flush();
  }

  private mergeConfig(
    config?: Partial<BatchProcessorConfig>
  ): BatchProcessorConfig {
    const defaultConfig: BatchProcessorConfig = {
      maxBatchSize: 10,
      batchTimeout: 100,
      maxConcurrentBatches: 3,
      enablePriority: false,
      enableDeduplication: false,
    };
    return { ...defaultConfig, ...config };
  }

  private initializeStats(): BatchProcessorStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalBatches: 0,
      successfulBatches: 0,
      failedBatches: 0,
      averageBatchSize: 0,
      averageBatchDuration: 0,
      currentQueueLength: 0,
      activeBatches: 0,
    };
  }

  private scheduleBatch(): void {
    if (
      this.batchTimeoutId ||
      this.activeBatches >= this.config.maxConcurrentBatches
    ) {
      return;
    }
    this.batchTimeoutId = setTimeout(() => {
      this.batchTimeoutId = null;
      void this.processBatch();
    }, this.config.batchTimeout);
  }

  private async processBatch(): Promise<void> {
    if (
      this.queue.length === 0 ||
      this.activeBatches >= this.config.maxConcurrentBatches
    ) {
      return;
    }
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = null;
    }
    const batchSize = Math.min(this.queue.length, this.config.maxBatchSize);
    const batch = this.queue.splice(0, batchSize);
    this.activeBatches++;
    const startTime = Date.now();
    try {
      const results = await this.processFn(batch);
      this.distributeResults(batch, results);
      this.updateBatchStats(batchSize, results, startTime);
    } catch (error) {
      this.handleBatchError(batch, error as Error);
    } finally {
      this.activeBatches--;
      if (this.queue.length > 0) {
        this.scheduleBatch();
      }
    }
  }

  private distributeResults(
    batch: BatchRequestItem[],
    results: BatchRequestResult[]
  ): void {
    const resultMap = new Map<string, BatchRequestResult>();
    results.forEach(result => resultMap.set(result.requestId, result));
    batch.forEach(item => {
      const result = resultMap.get(item.requestId);
      if (result) {
        if (result.success && result.response) {
          item.resolve(result.response);
          this.stats.successfulRequests++;
        } else if (result.error) {
          item.reject(result.error);
          this.stats.failedRequests++;
        }
      } else {
        item.reject(new Error('No result found for request'));
        this.stats.failedRequests++;
      }
    });
  }

  private handleBatchError(batch: BatchRequestItem[], error: Error): void {
    batch.forEach(item => {
      item.reject(error);
      this.stats.failedRequests++;
    });
    this.stats.failedBatches++;
  }

  private updateBatchStats(
    batchSize: number,
    results: BatchRequestResult[],
    startTime: number
  ): void {
    const duration = Date.now() - startTime;
    this.stats.totalBatches++;
    const successfulCount = results.filter(r => r.success).length;
    if (successfulCount === batchSize) {
      this.stats.successfulBatches++;
    } else {
      this.stats.failedBatches++;
    }
    this.stats.averageBatchSize =
      (this.stats.averageBatchSize * (this.stats.totalBatches - 1) +
        batchSize) /
      this.stats.totalBatches;
    this.stats.averageBatchDuration =
      (this.stats.averageBatchDuration * (this.stats.totalBatches - 1) +
        duration) /
      this.stats.totalBatches;
  }
}

export class BatchProcessorFactory {
  private static instances: Map<string, BatchProcessor> = new Map();

  public static getInstance(
    name: string = 'default',
    processFn?: BatchProcessFunction,
    config?: Partial<BatchProcessorConfig>
  ): BatchProcessor {
    let instance = this.instances.get(name);
    if (!instance && processFn) {
      instance = new BatchProcessor(processFn, config);
      this.instances.set(name, instance);
    }
    return instance!;
  }

  public static createCustomInstance(
    name: string,
    processFn: BatchProcessFunction,
    config?: Partial<BatchProcessorConfig>
  ): BatchProcessor {
    const instance = new BatchProcessor(processFn, config);
    this.instances.set(name, instance);
    return instance;
  }

  public static removeInstance(name: string): boolean {
    const instance = this.instances.get(name);
    if (instance) {
      this.instances.delete(name);
      return true;
    }
    return false;
  }

  public static async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.instances.values()).map(
      instance => {
        return instance.shutdown().catch(error => {
          logger.error('Error shutting down batch processor:', error);
        });
      }
    );
    await Promise.allSettled(shutdownPromises);
    this.instances.clear();
  }
}

export default BatchProcessorFactory;
