import { prisma } from './prisma';
import { 
  ConnectionPoolConfig, 
  PoolStats, 
  ConnectionStatus,
  connectionPoolConfig 
} from './connection-pool';

// 连接管理器接口
export interface IConnectionManager {
  getConnection(): Promise<any>;
  releaseConnection(connection: any): Promise<void>;
  executeWithRetry<T>(
    operation: (connection: any) => Promise<T>,
    maxRetries?: number
  ): Promise<T>;
}

// 连接池错误类
export class ConnectionPoolError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ConnectionPoolError';
  }
}

// 连接管理器实现
export class ConnectionManager implements IConnectionManager {
  private config: ConnectionPoolConfig;
  private connectionQueue: Array<{
    resolve: (connection: any) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private activeConnections = 0;
  private totalConnections = 0;
  private connectionErrors = 0;
  private totalWaitTime = 0;
  private lastError?: string;

  constructor(config?: Partial<ConnectionPoolConfig>) {
    this.config = { ...connectionPoolConfig, ...config };
  }

  // 获取数据库连接
  async getConnection(): Promise<any> {
    const startTime = Date.now();

    // 检查是否可以获取新连接
    if (this.activeConnections >= this.config.maxConnections) {
      return this.waitForConnection(startTime);
    }

    // 尝试获取连接
    try {
      const connection = await this.createConnection();
      this.activeConnections++;
      return connection;
    } catch (error) {
      this.connectionErrors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      
      if (this.isRetryableError(error)) {
        return this.retryConnection();
      }
      
      throw new ConnectionPoolError(
        `无法获取数据库连接: ${this.lastError}`,
        'CONNECTION_FAILED',
        false
      );
    }
  }

  // 等待可用连接
  private async waitForConnection(startTime: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.connectionQueue.findIndex(
          item => item.resolve === resolve
        );
        if (index !== -1) {
          this.connectionQueue.splice(index, 1);
        }
        reject(new ConnectionPoolError(
          '连接获取超时',
          'ACQUIRE_TIMEOUT',
          true
        ));
      }, this.config.acquireTimeoutMillis);

      this.connectionQueue.push({
        resolve: (connection) => {
          clearTimeout(timeout);
          const waitTime = Date.now() - startTime;
          this.totalWaitTime += waitTime;
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timestamp: startTime
      });
    });
  }

  // 创建新连接
  private async createConnection(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ConnectionPoolError(
          '连接创建超时',
          'CREATE_TIMEOUT',
          true
        ));
      }, this.config.createTimeoutMillis);

      // 验证连接可用性
      prisma.$queryRaw`SELECT 1 as connection_test`
        .then(() => {
          clearTimeout(timeout);
          this.totalConnections++;
          resolve(prisma);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  // 重试连接
  private async retryConnection(): Promise<any> {
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      try {
        await new Promise(resolve => 
          setTimeout(resolve, this.config.createRetryIntervalMillis * (attempts + 1))
        );
        
        const connection = await this.createConnection();
        this.activeConnections++;
        return connection;
      } catch (error) {
        attempts++;
        this.connectionErrors++;
        this.lastError = error instanceof Error ? error.message : String(error);
        
        if (attempts >= maxRetries) {
          throw new ConnectionPoolError(
            `连接重试失败，已尝试${maxRetries}次: ${this.lastError}`,
            'RETRY_EXHAUSTED',
            false
          );
        }
      }
    }

    throw new ConnectionPoolError(
      '重试连接失败',
      'RETRY_FAILED',
      false
    );
  }

  // 释放连接
  async releaseConnection(connection: any): Promise<void> {
    try {
      this.activeConnections = Math.max(0, this.activeConnections - 1);
      
      // 处理等待队列
      if (this.connectionQueue.length > 0) {
        const next = this.connectionQueue.shift();
        if (next) {
          this.activeConnections++;
          next.resolve(connection);
        }
      }
    } catch (error) {
      this.connectionErrors++;
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error('释放连接时出错:', error);
    }
  }

  // 带重试的执行操作
  async executeWithRetry<T>(
    operation: (connection: any) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= maxRetries) {
      const connection = await this.getConnection();
      
      try {
        const result = await operation(connection);
        await this.releaseConnection(connection);
        return result;
      } catch (error) {
        await this.releaseConnection(connection);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (this.isRetryableError(lastError) && attempts < maxRetries) {
          attempts++;
          const delay = this.config.createRetryIntervalMillis * Math.pow(2, attempts);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw lastError;
      }
    }

    throw lastError || new Error('操作执行失败');
  }

  // 判断错误是否可重试
  private isRetryableError(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error);
    const retryablePatterns = [
      'timeout',
      'connection',
      'network',
      'temporary',
      'deadlock',
      'lock wait timeout'
    ];
    
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  // 获取连接管理器统计信息
  getStats(): PoolStats {
    const maxConnections = this.config.maxConnections;
    const connectionUtilization = this.totalConnections / maxConnections;
    const averageWaitTime = this.connectionQueue.length > 0 ? 
      this.totalWaitTime / this.connectionQueue.length : 0;

    return {
      activeConnections: this.activeConnections,
      idleConnections: Math.max(0, this.totalConnections - this.activeConnections),
      totalConnections: this.totalConnections,
      waitingClients: this.connectionQueue.length,
      maxConnections,
      connectionUtilization,
      averageWaitTime,
      totalWaitTime: this.totalWaitTime,
      connectionErrors: this.connectionErrors,
      lastError: this.lastError
    };
  }

  // 检查连接管理器健康状态
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeWithRetry(async (connection) => {
        return connection.$queryRaw`SELECT 1 as health_check`;
      });
      return true;
    } catch (error) {
      console.error('连接管理器健康检查失败:', error);
      return false;
    }
  }

  // 重置统计信息
  resetStats(): void {
    this.connectionErrors = 0;
    this.totalWaitTime = 0;
    this.lastError = undefined;
  }

  // 优雅关闭
  async shutdown(): Promise<void> {
    try {
      // 清空等待队列
      this.connectionQueue.forEach(({ reject }) => {
        reject(new ConnectionPoolError(
          '连接管理器正在关闭',
          'SHUTDOWN',
          false
        ));
      });
      this.connectionQueue = [];

      // 等待所有活跃连接完成
      while (this.activeConnections > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('连接管理器已优雅关闭');
    } catch (error) {
      console.error('关闭连接管理器时出错:', error);
      throw error;
    }
  }
}

// 创建默认连接管理器实例
export const connectionManager = new ConnectionManager();

// 导出便捷函数
export const executeWithRetry = <T>(
  operation: (connection: any) => Promise<T>,
  maxRetries?: number
): Promise<T> => {
  return connectionManager.executeWithRetry(operation, maxRetries);
};
