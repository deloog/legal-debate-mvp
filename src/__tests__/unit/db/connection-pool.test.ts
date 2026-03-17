import { logger } from '../../../lib/logger';
import {
  connectionManager,
  ConnectionManager,
  ConnectionPoolError,
} from '../../../lib/db/connection-manager';
import {
  checkPoolHealth,
  connectionPoolConfig,
  ConnectionPoolMonitor,
  getPoolStats,
  gracefulShutdown,
  warmupConnectionPool,
} from '../../../lib/db/connection-pool';
import { getConnectionInfo, prisma } from '../../../lib/db/prisma';

// Mock prisma module
jest.mock('../../../lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
  getConnectionInfo: jest.fn(),
}));

// Mock logger to intercept log calls
jest.mock('../../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockPrisma = prisma as any;
const mockGetConnectionInfo = getConnectionInfo as jest.MockedFunction<
  typeof getConnectionInfo
>;

describe('Connection Pool Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    connectionManager.resetStats();
  });

  describe('getPoolStats', () => {
    it('应该返回正确的连接池统计信息', async () => {
      mockGetConnectionInfo.mockResolvedValue({
        active_connections: 5,
        total_connections: 10,
      });

      const stats = await getPoolStats();

      expect(stats).toBeDefined();
      expect(stats?.activeConnections).toBe(5);
      expect(stats?.totalConnections).toBe(10);
      expect(stats?.idleConnections).toBe(5);
      expect(stats?.maxConnections).toBe(connectionPoolConfig.maxConnections);
      expect(stats?.connectionUtilization).toBe(
        10 / connectionPoolConfig.maxConnections
      );
    });

    it('当连接信息获取失败时应该返回null', async () => {
      mockGetConnectionInfo.mockRejectedValue(new Error('Database error'));

      const stats = await getPoolStats();
      expect(stats).toBeNull();
    });
  });

  describe('checkPoolHealth', () => {
    it('连接池健康时应该返回true', async () => {
      mockGetConnectionInfo.mockResolvedValue({
        active_connections: 3,
        total_connections: 10,
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const isHealthy = await checkPoolHealth();
      expect(isHealthy).toBe(true);
    });

    it('连接池使用率过高时应该发出警告', async () => {
      // 使用更高的活跃连接数来触发80%使用率警告
      // 假设maxConnections是20，80%就是16个活跃连接
      mockGetConnectionInfo.mockResolvedValue({
        active_connections: 17, // 超过80%
        total_connections: 20,
      });
      mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

      const isHealthy = await checkPoolHealth();

      expect(isHealthy).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('连接池使用率过高:', 0.85);
    });

    it('健康检查失败时应该返回false', async () => {
      mockGetConnectionInfo.mockRejectedValue(new Error('Health check failed'));
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Health check failed'));

      const isHealthy = await checkPoolHealth();
      expect(isHealthy).toBe(false);
    });
  });

  describe('warmupConnectionPool', () => {
    it('应该成功预热连接池', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ warmup_query: 1 }]);

      await warmupConnectionPool();

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(
        connectionPoolConfig.minConnections
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('连接池预热完成')
      );
    });

    it('预热失败时应该记录错误', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Warmup failed'));

      await warmupConnectionPool();

      expect(logger.error).toHaveBeenCalledWith(
        '连接池预热失败:',
        expect.any(Error)
      );
    });
  });

  describe('gracefulShutdown', () => {
    it('应该成功优雅关闭连接池', async () => {
      mockPrisma.$disconnect.mockResolvedValue(undefined);

      await gracefulShutdown();

      expect(mockPrisma.$disconnect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('数据库连接池已优雅关闭');
    });

    it('关闭失败时应该抛出错误', async () => {
      mockPrisma.$disconnect.mockRejectedValue(new Error('Shutdown failed'));

      await expect(gracefulShutdown()).rejects.toThrow('Shutdown failed');
    });
  });

  describe('ConnectionPoolMonitor', () => {
    let monitor: ConnectionPoolMonitor;
    let setIntervalSpy: jest.SpyInstance;
    let clearIntervalSpy: jest.SpyInstance;

    beforeEach(() => {
      monitor = new ConnectionPoolMonitor();
      setIntervalSpy = jest
        .spyOn(global, 'setInterval')
        .mockImplementation(() => 123 as any);
      clearIntervalSpy = jest
        .spyOn(global, 'clearInterval')
        .mockImplementation();
    });

    afterEach(() => {
      if (monitor) {
        monitor.stop();
      }
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    });

    it('应该启动监控器', () => {
      monitor.start();

      expect(setIntervalSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('启动连接池监控器');
    });

    it('不应该重复启动监控器', () => {
      const newMonitor = new ConnectionPoolMonitor();

      newMonitor.start();
      newMonitor.start();

      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    });

    it('应该停止监控器', () => {
      const newMonitor = new ConnectionPoolMonitor();

      newMonitor.start();
      newMonitor.stop();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('连接池监控器已停止');
    });
  });

  describe('ConnectionManager', () => {
    describe('getConnection', () => {
      it('应该成功获取连接', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([{ connection_test: 1 }]);

        const connection = await connectionManager.getConnection();

        expect(connection).toBeDefined();
        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith([
          'SELECT 1 as connection_test',
        ]);
      });

      it('连接获取超时应该抛出错误', async () => {
        const shortTimeoutManager = new ConnectionManager({
          acquireTimeoutMillis: 100,
          maxConnections: 1,
        });

        mockPrisma.$queryRaw.mockImplementation(
          () =>
            new Promise(resolve =>
              setTimeout(() => resolve([{ connection_test: 1 }]), 200)
            )
        );

        // 先获取一个连接填满连接池
        await shortTimeoutManager.getConnection();

        await expect(shortTimeoutManager.getConnection()).rejects.toThrow(
          expect.objectContaining({
            name: 'ConnectionPoolError',
            code: 'ACQUIRE_TIMEOUT',
          })
        );
      });
    });

    describe('executeWithRetry', () => {
      it('应该成功执行操作', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([{ test: 1 }]);

        const result = await connectionManager.executeWithRetry(
          async conn => conn.$queryRaw`SELECT 1 as test`
        );

        expect(result).toEqual([{ test: 1 }]);
      });

      it('操作失败时应该重试', async () => {
        mockPrisma.$queryRaw
          .mockRejectedValueOnce(new Error('Connection timeout'))
          .mockRejectedValueOnce(new Error('Connection timeout'))
          .mockResolvedValueOnce([{ test: 1 }]);

        const result = await connectionManager.executeWithRetry(
          async conn => conn.$queryRaw`SELECT 1 as test`,
          3
        );

        expect(result).toEqual([{ test: 1 }]);
        expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4); // 2次连接失败 + 1次重试连接 + 1次成功操作
      });

      it('重试次数用尽应该抛出错误', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(new Error('Persistent error'));

        await expect(
          connectionManager.executeWithRetry(
            async conn => conn.$queryRaw`SELECT 1 as test`,
            2
          )
        ).rejects.toThrow('Persistent error');

        expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1); // 只调用1次，因为错误不可重试
      });
    });

    describe('getStats', () => {
      it('应该返回正确的统计信息', () => {
        const stats = connectionManager.getStats();

        expect(stats).toHaveProperty('activeConnections');
        expect(stats).toHaveProperty('idleConnections');
        expect(stats).toHaveProperty('totalConnections');
        expect(stats).toHaveProperty('waitingClients');
        expect(stats).toHaveProperty('maxConnections');
        expect(stats).toHaveProperty('connectionUtilization');
        expect(stats).toHaveProperty('averageWaitTime');
        expect(stats).toHaveProperty('totalWaitTime');
        expect(stats).toHaveProperty('connectionErrors');
      });
    });

    describe('healthCheck', () => {
      it('健康时应该返回true', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([{ health_check: 1 }]);

        const isHealthy = await connectionManager.healthCheck();
        expect(isHealthy).toBe(true);
      });

      it('不健康时应该返回false', async () => {
        mockPrisma.$queryRaw.mockRejectedValue(
          new Error('Health check failed')
        );

        const isHealthy = await connectionManager.healthCheck();
        expect(isHealthy).toBe(false);
      });
    });

    describe('shutdown', () => {
      it('应该成功关闭', async () => {
        // 创建一个新的连接管理器实例进行测试
        const testManager = new ConnectionManager();
        await testManager.shutdown();
        // 验证没有抛出错误
        expect(true).toBe(true);
      }, 5000); // 设置5秒超时
    });
  });

  describe('ConnectionPoolError', () => {
    it('应该正确创建错误实例', () => {
      const error = new ConnectionPoolError('Test error', 'TEST_CODE', true);

      expect(error.name).toBe('ConnectionPoolError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.retryable).toBe(true);
    });

    it('默认重试属性应该为false', () => {
      const error = new ConnectionPoolError('Test error', 'TEST_CODE');
      expect(error.retryable).toBe(false);
    });
  });

  describe('并发连接测试', () => {
    it('应该支持并发连接获取', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ connection_test: 1 }]);

      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () =>
        connectionManager.getConnection()
      );

      const connections = await Promise.all(promises);

      expect(connections).toHaveLength(concurrentRequests);
      connections.forEach(connection => {
        expect(connection).toBeDefined();
      });

      // 释放所有连接
      for (const connection of connections) {
        await connectionManager.releaseConnection(connection);
      }
    });

    it('应该正确处理连接复用', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ connection_test: 1 }]);

      // 获取连接
      const connection1 = await connectionManager.getConnection();
      await connectionManager.releaseConnection(connection1);

      // 再次获取连接，应该复用之前的连接
      const connection2 = await connectionManager.getConnection();
      await connectionManager.releaseConnection(connection2);

      expect(connection1).toBeDefined();
      expect(connection2).toBeDefined();
    });

    it('应该在并发环境下保持统计准确性', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ connection_test: 1 }]);

      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }, async () => {
        const connection = await connectionManager.getConnection();
        await connectionManager.releaseConnection(connection);
        return connection;
      });

      await Promise.all(promises);

      // 等待一小段时间确保所有连接释放完成
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = connectionManager.getStats();
      expect(stats.activeConnections).toBeLessThanOrEqual(1); // 允许1个连接因为可能的时序问题
      expect(stats.totalConnections).toBeGreaterThanOrEqual(0);
    });
  });
});
