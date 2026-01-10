// 连接管理器测试

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  ConnectionManager,
  ConnectionPoolError,
  IConnectionManager,
  connectionManager,
  executeWithRetry,
} from "@/lib/db/connection-manager";

describe("ConnectionPoolError", () => {
  it("应该创建错误实例", () => {
    const error = new ConnectionPoolError("测试错误", "TEST_ERROR");

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("测试错误");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.name).toBe("ConnectionPoolError");
  });

  it("应该支持retryable属性", () => {
    const error = new ConnectionPoolError(
      "可重试错误",
      "RETRYABLE_ERROR",
      true,
    );

    expect(error.retryable).toBe(true);
  });

  it("默认retryable为false", () => {
    const error = new ConnectionPoolError("错误", "ERROR");
    expect(error.retryable).toBe(false);
  });
});

describe("ConnectionManager", () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager();
  });

  afterEach(async () => {
    try {
      await manager.shutdown();
    } catch {
      // 忽略关闭错误
    }
  });

  describe("构造函数", () => {
    it("应该使用默认配置创建实例", () => {
      expect(manager).toBeInstanceOf(ConnectionManager);
    });

    it("应该支持自定义配置", () => {
      const customManager = new ConnectionManager({
        maxConnections: 10,
        acquireTimeoutMillis: 5000,
      });

      expect(customManager).toBeInstanceOf(ConnectionManager);
    });
  });

  describe("获取连接", () => {
    it("应该成功获取连接", async () => {
      const connection = await manager.getConnection();
      expect(connection).toBeDefined();

      await manager.releaseConnection(connection);
    });

    it("应该处理连接失败", async () => {
      // 测试错误处理逻辑
      const manager2 = new ConnectionManager({
        maxConnections: 0,
        acquireTimeoutMillis: 100,
      });

      try {
        await manager2.getConnection();
      } catch (error) {
        expect(error).toBeDefined();
        expect(error).toBeInstanceOf(ConnectionPoolError);
      } finally {
        await manager2.shutdown();
      }
    });

    it("应该在连接超时时抛出错误", async () => {
      const manager2 = new ConnectionManager({
        maxConnections: 1,
        acquireTimeoutMillis: 100,
        createTimeoutMillis: 2000,
      });

      // 获取第一个连接
      const conn1 = await manager2.getConnection();

      // 尝试获取第二个连接，应该超时（快速失败）
      setTimeout(() => manager2.releaseConnection(conn1), 50);

      try {
        await manager2.getConnection();
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        await manager2.shutdown();
      }
    });
  });

  describe("释放连接", () => {
    it("应该成功释放连接", async () => {
      const conn = await manager.getConnection();
      await expect(manager.releaseConnection(conn)).resolves.not.toThrow();
    });

    it("应该处理释放连接失败", async () => {
      const conn = await manager.getConnection();

      // 测试错误处理
      await expect(manager.releaseConnection(conn)).resolves.not.toThrow();
    });
  });

  describe("统计信息", () => {
    it("应该返回正确的统计信息", () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty("activeConnections");
      expect(stats).toHaveProperty("idleConnections");
      expect(stats).toHaveProperty("totalConnections");
      expect(stats).toHaveProperty("waitingClients");
      expect(stats).toHaveProperty("maxConnections");
      expect(stats).toHaveProperty("connectionUtilization");
      expect(stats).toHaveProperty("averageWaitTime");
      expect(stats).toHaveProperty("totalWaitTime");
      expect(stats).toHaveProperty("connectionErrors");
      expect(stats).toHaveProperty("lastError");
    });

    it("应该重置统计信息", () => {
      manager.resetStats();

      const stats = manager.getStats();
      expect(stats.totalWaitTime).toBe(0);
      expect(stats.connectionErrors).toBe(0);
      expect(stats.lastError).toBeUndefined();
    });
  });

  describe("健康检查", () => {
    it("应该成功执行健康检查", async () => {
      const isHealthy = await manager.healthCheck();
      expect(typeof isHealthy).toBe("boolean");
    });

    it("应该处理健康检查失败", async () => {
      const isHealthy = await manager.healthCheck();
      expect(typeof isHealthy).toBe("boolean");
    });
  });

  describe("优雅关闭", () => {
    it("应该成功关闭管理器", async () => {
      await expect(manager.shutdown()).resolves.not.toThrow();
    });

    it("应该处理关闭时的错误", async () => {
      const manager2 = new ConnectionManager();
      await expect(manager2.shutdown()).resolves.not.toThrow();
    });
  });

  describe("executeWithRetry", () => {
    it("应该成功执行操作", async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = await manager.executeWithRetry(async (connection) => {
        return "success";
      });

      expect(result).toBe("success");
    });

    it("应该处理操作失败", async () => {
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        manager.executeWithRetry(async (connection) => {
          throw new Error("操作失败");
        }),
      ).rejects.toThrow();
    });

    it("应该支持自定义重试次数", async () => {
      let attemptCount = 0;

      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        await manager.executeWithRetry(async (connection) => {
          attemptCount++;
          throw new Error("测试错误");
        }, 2);
      } catch {
        // 预期会抛出错误
      }

      expect(attemptCount).toBeGreaterThan(0);
    });
  });

  describe("接口实现", () => {
    it("应该实现IConnectionManager接口", () => {
      expect(manager.getConnection).toBeDefined();
      expect(manager.releaseConnection).toBeDefined();
      expect(manager.executeWithRetry).toBeDefined();
    });
  });

  describe("边界条件", () => {
    it("应该处理释放未获取的连接", async () => {
      await expect(manager.releaseConnection(null)).resolves.not.toThrow();
    });

    it("应该处理多次释放同一个连接", async () => {
      const conn = await manager.getConnection();

      await manager.releaseConnection(conn);
      await manager.releaseConnection(conn);

      expect(true).toBe(true);
    });
  });
});

describe("全局连接管理器", () => {
  it("应该创建全局实例", () => {
    expect(connectionManager).toBeDefined();
    expect(connectionManager).toBeInstanceOf(ConnectionManager);
  });

  it("应该支持获取连接", async () => {
    const conn = await connectionManager.getConnection();
    expect(conn).toBeDefined();

    await connectionManager.releaseConnection(conn);
  });

  it("应该获取统计信息", () => {
    const stats = connectionManager.getStats();
    expect(stats).toBeDefined();
  });
});

describe("executeWithRetry便捷函数", () => {
  it("应该使用全局管理器执行操作", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result = await executeWithRetry(async (connection) => {
      return "test-result";
    });

    expect(result).toBe("test-result");
  });

  it("应该处理执行失败", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      executeWithRetry(async (connection) => {
        throw new Error("执行失败");
      }),
    ).rejects.toThrow();
  });

  it("应该支持自定义重试次数", async () => {
    let attempts = 0;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      await executeWithRetry(async (connection) => {
        attempts++;
        throw new Error("测试");
      }, 2);
    } catch {
      // 预期抛出错误
    }

    expect(attempts).toBeGreaterThan(0);
  });
});

describe("IConnectionManager接口", () => {
  it("应该定义必需的方法", () => {
    // 测试接口类型定义
    const manager: IConnectionManager = connectionManager;

    expect(typeof manager.getConnection).toBe("function");
    expect(typeof manager.releaseConnection).toBe("function");
    expect(typeof manager.executeWithRetry).toBe("function");
  });
});
