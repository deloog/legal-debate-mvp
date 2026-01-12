'use strict';
// =============================================================================
// 并发控制工具类
// =============================================================================
Object.defineProperty(exports, '__esModule', { value: true });
exports.documentConcurrencyController =
  exports.ConcurrencyController =
  exports.Semaphore =
    void 0;
class Semaphore {
  constructor(maxPermits = 5) {
    this.maxPermits = maxPermits;
    this.waitQueue = [];
    this.permits = maxPermits;
  }
  async acquire(options = {}) {
    const { queueTimeout = 30000 } = options;
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(true);
        return;
      }
      // 添加到等待队列
      const waitItem = { resolve, reject };
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
  release() {
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
  getAvailablePermits() {
    return this.permits;
  }
  getQueueLength() {
    return this.waitQueue.length;
  }
}
exports.Semaphore = Semaphore;
class ConcurrencyController {
  constructor() {
    this.semaphores = new Map();
  }
  static getInstance() {
    if (!ConcurrencyController.instance) {
      ConcurrencyController.instance = new ConcurrencyController();
    }
    return ConcurrencyController.instance;
  }
  getSemaphore(key, maxConcurrent = 5) {
    if (!this.semaphores.has(key)) {
      this.semaphores.set(key, new Semaphore(maxConcurrent));
    }
    return this.semaphores.get(key);
  }
  async withConcurrency(key, maxConcurrent, fn, options) {
    const semaphore = this.getSemaphore(key, maxConcurrent);
    await semaphore.acquire(options);
    try {
      return await fn();
    } finally {
      semaphore.release();
    }
  }
  getStats() {
    const stats = {};
    for (const [key, semaphore] of this.semaphores.entries()) {
      stats[key] = {
        available: semaphore.getAvailablePermits(),
        queueLength: semaphore.getQueueLength(),
      };
    }
    return stats;
  }
}
exports.ConcurrencyController = ConcurrencyController;
// 默认的文档处理并发控制器
exports.documentConcurrencyController = ConcurrencyController.getInstance();
