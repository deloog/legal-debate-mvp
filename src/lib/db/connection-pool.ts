import { prisma, getConnectionInfo } from './prisma';

// 连接池配置接口
export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  maxLifetimeHours: number;
}

// 默认连接池配置
const defaultPoolConfig: ConnectionPoolConfig = {
  minConnections: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
  maxConnections: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  maxLifetimeHours: 24,
};

// 连接池监控接口
export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingClients: number;
  maxConnections: number;
}

// 获取连接池统计信息
export const getPoolStats = async (): Promise<PoolStats | null> => {
  try {
    const connectionInfo = await getConnectionInfo();
    if (!connectionInfo) {
      return null;
    }

    return {
      activeConnections: connectionInfo.active_connections,
      idleConnections: Math.max(0, connectionInfo.total_connections - connectionInfo.active_connections),
      totalConnections: connectionInfo.total_connections,
      waitingClients: 0, // PostgreSQL不直接提供此信息
      maxConnections: defaultPoolConfig.maxConnections,
    };
  } catch (error) {
    console.error('获取连接池统计信息失败:', error);
    return null;
  }
};

// 连接池健康检查
export const checkPoolHealth = async (): Promise<boolean> => {
  try {
    // 执行简单查询来测试连接池健康状态
    await prisma.$queryRaw`SELECT 1 as health_check`;
    
    const stats = await getPoolStats();
    if (!stats) {
      return false;
    }

    // 检查是否达到最大连接数的80%
    const connectionUtilization = stats.activeConnections / stats.maxConnections;
    if (connectionUtilization > 0.8) {
      console.warn('连接池使用率过高:', connectionUtilization);
    }

    return true;
  } catch (error) {
    console.error('连接池健康检查失败:', error);
    return false;
  }
};

// 连接池预热（如果支持）
export const warmupConnectionPool = async (): Promise<void> => {
  try {
    const promises: Promise<unknown>[] = [];
    
    // 创建几个并发连接来预热连接池
    for (let i = 0; i < defaultPoolConfig.minConnections; i++) {
      promises.push(
        prisma.$queryRaw`SELECT ${i} as warmup_query`
      );
    }

    await Promise.all(promises);
    console.log(`连接池预热完成，创建了 ${defaultPoolConfig.minConnections} 个连接`);
  } catch (error) {
    console.error('连接池预热失败:', error);
  }
};

// 优雅关闭连接池
export const gracefulShutdown = async (): Promise<void> => {
  try {
    console.log('开始优雅关闭数据库连接池...');
    
    // 等待所有活跃操作完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 关闭所有连接
    await prisma.$disconnect();
    
    console.log('数据库连接池已优雅关闭');
  } catch (error) {
    console.error('关闭连接池时出错:', error);
    throw error;
  }
};

// 连接池监控器
export class ConnectionPoolMonitor {
  private interval: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs: number = 30000; // 30秒检查一次

  start(): void {
    if (this.interval) {
      return;
    }

    console.log('启动连接池监控器');
    this.interval = setInterval(async () => {
      const stats = await getPoolStats();
      if (stats) {
        console.log('连接池状态:', {
          active: stats.activeConnections,
          total: stats.totalConnections,
          utilization: `${((stats.activeConnections / stats.maxConnections) * 100).toFixed(1)}%`,
        });
      }

      const isHealthy = await checkPoolHealth();
      if (!isHealthy) {
        console.error('连接池健康检查失败');
      }
    }, this.checkIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('连接池监控器已停止');
    }
  }
}

// 创建全局监控器实例
export const poolMonitor = new ConnectionPoolMonitor();

// 导出配置
export { defaultPoolConfig as connectionPoolConfig };
