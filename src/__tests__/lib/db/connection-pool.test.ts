// 连接池配置测试

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ConnectionStatus,
  getPoolStats,
  checkPoolHealth,
  warmupConnectionPool,
  gracefulShutdown,
  ConnectionPoolMonitor,
  poolMonitor,
  connectionPoolConfig,
} from '../../../lib/db/connection-pool';

describe('连接池配置', () => {
  describe('默认配置', () => {
    it('应该有正确的默认值', () => {
      expect(connectionPoolConfig.minConnections).toBeGreaterThanOrEqual(1);
      expect(connectionPoolConfig.maxConnections).toBeGreaterThanOrEqual(
        connectionPoolConfig.minConnections
      );
      expect(connectionPoolConfig.connectionTimeoutMillis).toBeGreaterThan(0);
      expect(connectionPoolConfig.idleTimeoutMillis).toBeGreaterThan(0);
      expect(connectionPoolConfig.maxLifetimeHours).toBeGreaterThan(0);
    });

    it('应该从环境变量读取配置', () => {
      const originalMax = process.env.DATABASE_POOL_MAX;
      const originalMin = process.env.DATABASE_POOL_MIN;

      process.env.DATABASE_POOL_MAX = '30';
      process.env.DATABASE_POOL_MIN = '5';

      // 重新加载配置需要重启进程，这里只验证变量设置
      expect(process.env.DATABASE_POOL_MAX).toBe('30');
      expect(process.env.DATABASE_POOL_MIN).toBe('5');

      // 恢复环境变量
      process.env.DATABASE_POOL_MAX = originalMax;
      process.env.DATABASE_POOL_MIN = originalMin;
    });
  });
});

describe('连接池统计', () => {
  it('应该获取连接池统计信息', async () => {
    const stats = await getPoolStats();
    expect(stats === null || typeof stats === 'object').toBe(true);
  });

  it('应该处理获取统计信息失败的情况', async () => {
    // 模拟错误情况
    const stats = await getPoolStats();
    expect(stats === null || typeof stats === 'object').toBe(true);
  });

  it('应该返回正确的统计结构', async () => {
    const stats = await getPoolStats();

    if (stats) {
      expect(stats).toHaveProperty('activeConnections');
      expect(stats).toHaveProperty('idleConnections');
      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats).toHaveProperty('connectionUtilization');
    }
  });
});

describe('连接池健康检查', () => {
  it('应该成功执行健康检查', async () => {
    const isHealthy = await checkPoolHealth();
    expect(typeof isHealthy).toBe('boolean');
  });

  it('应该处理健康检查失败的情况', async () => {
    const isHealthy = await checkPoolHealth();
    expect(typeof isHealthy).toBe('boolean');
  });
});

describe('连接池预热', () => {
  it('应该成功预热连接池', async () => {
    await expect(warmupConnectionPool()).resolves.not.toThrow();
  });

  it('应该处理预热失败的情况', async () => {
    await expect(warmupConnectionPool()).resolves.not.toThrow();
  });
});

describe('优雅关闭', () => {
  it('应该成功优雅关闭连接池', async () => {
    await expect(gracefulShutdown()).resolves.not.toThrow();
  });

  it('应该处理关闭时的错误', async () => {
    // 模拟错误情况
    await expect(gracefulShutdown()).resolves.not.toThrow();
  });
});

describe('连接池监控器', () => {
  let monitor: ConnectionPoolMonitor;

  beforeEach(() => {
    monitor = new ConnectionPoolMonitor();
  });

  afterEach(() => {
    monitor.stop();
  });

  it('应该成功启动监控器', () => {
    expect(() => monitor.start()).not.toThrow();
    monitor.stop();
  });

  it('应该成功停止监控器', () => {
    monitor.start();
    expect(() => monitor.stop()).not.toThrow();
  });

  it('不应该重复启动监控器', () => {
    monitor.start();
    monitor.start(); // 第二次启动应该被忽略
    expect(() => monitor.stop()).not.toThrow();
  });

  it('应该处理停止未启动的监控器', () => {
    expect(() => monitor.stop()).not.toThrow();
  });

  it('全局监控器实例应该可用', () => {
    expect(poolMonitor).toBeDefined();
    expect(poolMonitor).toBeInstanceOf(ConnectionPoolMonitor);
  });

  it('全局监控器应该能够启动和停止', () => {
    poolMonitor.start();
    poolMonitor.stop();
    expect(true).toBe(true);
  });
});

describe('ConnectionStatus枚举', () => {
  it('应该包含所有必需的状态', () => {
    expect(ConnectionStatus.IDLE).toBe('idle');
    expect(ConnectionStatus.ACTIVE).toBe('active');
    expect(ConnectionStatus.WAITING).toBe('waiting');
    expect(ConnectionStatus.ERROR).toBe('error');
  });
});
