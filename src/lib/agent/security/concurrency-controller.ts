// =============================================================================
// 并发控制工具类
// =============================================================================

export interface ConcurrencyOptions {
  maxConcurrent?: number;
  queueTimeout?: number;
}

export class Semaphore {
  private permits: number;
  private waitQueue: Array<{
    resolve: (value: boolean) => void;
    reject: (reason?: any) => void;
    timeout?: ReturnType<typeof setTimeout>;
  }> = [];

  constructor(private maxPermits: number = 5) {
    this.permits = maxPermits;
  }

  async acquire(options: ConcurrencyOptions = {}): Promise<boolean> {
    const { queueTimeout = 30000 } = options;

    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(true);
        return;
      }

      // 添加到等待队列
      const waitItem: any = { resolve, reject };
      this.waitQueue.push(waitItem);

      // 设置超时
      const timeout = setTimeout(() => {
        const index = this.waitQueue.indexOf(waitItem);
        if (index > -1) {
          this.waitQueue.splice(index, 1);
          reject(new Error('等待并发许可超时'));
        }
      }, queueTimeout);

      waitItem.timeout = timeout;
    });
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      // 处理等待队列
      const waitItem = this.waitQueue.shift();
      if (waitItem) {
        if (waitItem.timeout) {
          clearTimeout(waitItem.timeout);
        }
        waitItem.resolve(true);
      }
    } else {
      this.permits++;
    }
  }

  getAvailablePermits(): number {
    return this.permits;
  }

  getQueueLength(): number {
    return this.waitQueue.length;
  }
}

export class ConcurrencyController {
  private static instance: ConcurrencyController;
  private semaphores: Map<string, Semaphore> = new Map();

  static getInstance(): ConcurrencyController {
    if (!ConcurrencyController.instance) {
      ConcurrencyController.instance = new ConcurrencyController();
    }
    return ConcurrencyController.instance;
  }

  getSemaphore(key: string, maxConcurrent: number = 5): Semaphore {
    if (!this.semaphores.has(key)) {
      this.semaphores.set(key, new Semaphore(maxConcurrent));
    }
    return this.semaphores.get(key)!;
  }

  async withConcurrency<T>(
    key: string,
    maxConcurrent: number,
    fn: () => Promise<T>,
    options?: ConcurrencyOptions
  ): Promise<T> {
    const semaphore = this.getSemaphore(key, maxConcurrent);

    await semaphore.acquire(options);

    try {
      return await fn();
    } finally {
      semaphore.release();
    }
  }

  getStats(): Record<string, { available: number; queueLength: number }> {
    const stats: Record<string, { available: number; queueLength: number }> =
      {};

    for (const [key, semaphore] of this.semaphores.entries()) {
      stats[key] = {
        available: semaphore.getAvailablePermits(),
        queueLength: semaphore.getQueueLength(),
      };
    }

    return stats;
  }
}

// 默认的文档处理并发控制器
export const documentConcurrencyController =
  ConcurrencyController.getInstance();
