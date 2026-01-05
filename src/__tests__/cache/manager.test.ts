import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import { CacheManager } from "@/lib/cache/manager";
import { CacheNamespace } from "@/lib/cache/types";
import { redis } from "@/lib/cache/redis";

describe("CacheManager", () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    cacheManager = new CacheManager();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("基本操作", () => {
    it("应该成功设置和获取缓存", async () => {
      const mockGet = jest
        .spyOn(redis, "get")
        .mockResolvedValue('"test-value"');
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      const setResult = await cacheManager.set("test-key", "test-value");
      expect(setResult).toBe(true);

      const getResult = await cacheManager.get("test-key");
      expect(getResult).toBe("test-value");

      mockGet.mockRestore();
      mockSet.mockRestore();
    });

    it("应该正确处理JSON对象", async () => {
      const mockGet = jest
        .spyOn(redis, "get")
        .mockResolvedValue(JSON.stringify({ name: "test", value: 123 }));
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      const testObj = { name: "test", value: 123 };
      const setResult = await cacheManager.set("obj-key", testObj);
      expect(setResult).toBe(true);

      const getResult = await cacheManager.get("obj-key");
      expect(getResult).toEqual(testObj);

      mockGet.mockRestore();
      mockSet.mockRestore();
    });

    it("应该删除缓存", async () => {
      const mockDel = jest.spyOn(redis, "del").mockResolvedValue(1);

      const result = await cacheManager.delete("test-key");
      expect(result).toBe(true);

      mockDel.mockRestore();
    });

    it("应该检查缓存是否存在", async () => {
      const mockExists = jest.spyOn(redis, "exists").mockResolvedValue(1);

      const result = await cacheManager.exists("test-key");
      expect(result).toBe(true);

      mockExists.mockRestore();
    });

    it("应该处理缓存未命中", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue(null);

      const result = await cacheManager.get("non-existent-key");
      expect(result).toBe(null);

      mockGet.mockRestore();
    });
  });

  describe("TTL操作", () => {
    it("应该设置TTL", async () => {
      const mockExpire = jest.spyOn(redis, "expire").mockResolvedValue(1);

      const result = await cacheManager.expire("test-key", 300);
      expect(result).toBe(true);

      mockExpire.mockRestore();
    });

    it("应该获取TTL", async () => {
      const mockTtl = jest.spyOn(redis, "ttl").mockResolvedValue(300);

      const result = await cacheManager.ttl("test-key");
      expect(result).toBe(300);

      mockTtl.mockRestore();
    });

    it("应该使用默认TTL", async () => {
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      await cacheManager.set("test-key", "test-value");

      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining("test-key"),
        3600, // 默认TTL
        expect.any(String),
      );

      mockSet.mockRestore();
    });
  });

  describe("批量操作", () => {
    it("应该批量获取缓存", async () => {
      const mockMget = jest
        .spyOn(redis, "mget")
        .mockResolvedValue(['"value1"', '"value2"', null]);

      const keys = ["key1", "key2", "key3"];
      const result = await cacheManager.mget(keys);

      expect(result.size).toBe(3);
      expect(result.get("key1")).toBe("value1");
      expect(result.get("key2")).toBe("value2");
      expect(result.get("key3")).toBe(null);

      mockMget.mockRestore();
    });

    it("应该批量设置缓存", async () => {
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      const items = [
        { key: "key1", value: "value1" },
        { key: "key2", value: "value2" },
      ];

      const result = await cacheManager.mset(items);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(2);
      expect(result.failureCount).toBe(0);

      mockSet.mockRestore();
    });

    it("应该批量删除缓存", async () => {
      const mockDel = jest.spyOn(redis, "del").mockResolvedValue(3);

      const keys = ["key1", "key2", "key3"];
      const result = await cacheManager.mdelete(keys);

      expect(result).toBe(3);

      mockDel.mockRestore();
    });

    it("应该处理批量操作中的失败", async () => {
      const mockSet = jest
        .spyOn(redis, "setex")
        .mockResolvedValueOnce("OK")
        .mockRejectedValueOnce(new Error("Redis error"));

      const items = [
        { key: "key1", value: "value1" },
        { key: "key2", value: "value2" },
      ];

      const result = await cacheManager.mset(items);

      expect(result.totalCount).toBe(2);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);

      mockSet.mockRestore();
    });
  });

  describe("命名空间操作", () => {
    it("应该清空命名空间", async () => {
      const mockKeys = jest
        .spyOn(redis, "keys")
        .mockResolvedValue(["ns:key1", "ns:key2"]);
      const mockDel = jest.spyOn(redis, "del").mockResolvedValue(2);

      const result = await cacheManager.clearNamespace(
        CacheNamespace.USER_DATA,
      );

      expect(result).toBe(2);

      mockKeys.mockRestore();
      mockDel.mockRestore();
    });

    it("应该处理空命名空间", async () => {
      const mockKeys = jest.spyOn(redis, "keys").mockResolvedValue([]);

      const result = await cacheManager.clearNamespace(
        CacheNamespace.USER_DATA,
      );

      expect(result).toBe(0);

      mockKeys.mockRestore();
    });

    it("应该使用命名空间生成键", async () => {
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      await cacheManager.set("test-key", "value", {
        namespace: CacheNamespace.USER_DATA,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.stringContaining(CacheNamespace.USER_DATA),
        expect.any(Number),
        expect.any(String),
      );

      mockSet.mockRestore();
    });
  });

  describe("统计信息", () => {
    it("应该获取统计信息", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue('"value"');
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      await cacheManager.set("test-key", "value");
      await cacheManager.get("test-key");

      const stats = cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalRequests).toBeGreaterThan(0);

      mockGet.mockRestore();
      mockSet.mockRestore();
    });

    it("应该重置统计信息", async () => {
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      await cacheManager.set("test-key", "value");

      cacheManager.resetStats();

      const stats = cacheManager.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);

      mockSet.mockRestore();
    });

    it("应该计算命中率", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue('"value"');

      await cacheManager.get("test-key");
      await cacheManager.get("test-key");

      const stats = cacheManager.getStats();

      expect(stats.hitRate).toBe(100);

      mockGet.mockRestore();
    });
  });

  describe("错误处理", () => {
    it("应该处理Redis连接错误", async () => {
      const mockGet = jest
        .spyOn(redis, "get")
        .mockRejectedValue(new Error("Redis connection failed"));

      const result = await cacheManager.get("test-key");

      expect(result).toBe(null);

      mockGet.mockRestore();
    });

    it("应该处理键长度超限", async () => {
      const longKey = "a".repeat(3000);

      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      await expect(cacheManager.set(longKey, "value")).rejects.toThrow(
        "缓存键长度超过限制",
      );

      mockSet.mockRestore();
    });

    it("应该处理值大小超限", async () => {
      const largeValue = "a".repeat(2 * 1024 * 1024); // 2MB

      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      await expect(cacheManager.set("test-key", largeValue)).rejects.toThrow(
        "缓存值大小超过限制",
      );

      mockSet.mockRestore();
    });
  });

  describe("getOrSet操作", () => {
    it("应该从缓存获取值", async () => {
      const mockGet = jest
        .spyOn(redis, "get")
        .mockResolvedValue('"cached-value"');

      const valueProvider = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve("new-value"),
        ) as unknown as () => Promise<string>;

      const result = await cacheManager.getOrSet("test-key", valueProvider);

      expect(result).toBe("cached-value");
      expect(valueProvider).not.toHaveBeenCalled();

      mockGet.mockRestore();
    });

    it("应该设置新值到缓存", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue(null);
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");

      const valueProvider = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve("new-value"),
        ) as unknown as () => Promise<string>;

      const result = await cacheManager.getOrSet("test-key", valueProvider);

      expect(result).toBe("new-value");
      expect(valueProvider).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();

      mockGet.mockRestore();
      mockSet.mockRestore();
    });

    it("应该处理getOrSet中的错误", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue(null);

      const valueProvider = jest
        .fn()
        .mockImplementation(() =>
          Promise.reject(new Error("Value provider error")),
        ) as unknown as () => Promise<string>;

      const result = await cacheManager.getOrSet("test-key", valueProvider);

      expect(result).toBe(null);

      mockGet.mockRestore();
    });
  });

  describe("事件监听器", () => {
    it("应该添加和触发事件监听器", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue('"value"');

      const eventListener = jest.fn();
      cacheManager.addEventListener(eventListener);

      await cacheManager.get("test-key");

      expect(eventListener).toHaveBeenCalled();

      mockGet.mockRestore();
    });

    it("应该移除事件监听器", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue('"value"');

      const eventListener = jest.fn();
      cacheManager.addEventListener(eventListener);
      cacheManager.removeEventListener(eventListener);

      await cacheManager.get("test-key");

      expect(eventListener).not.toHaveBeenCalled();

      mockGet.mockRestore();
    });

    it("应该处理事件监听器错误", async () => {
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue('"value"');

      const eventListener = jest.fn().mockImplementation(() => {
        throw new Error("Listener error");
      });
      cacheManager.addEventListener(eventListener);

      // 不应该抛出错误
      await expect(cacheManager.get("test-key")).resolves.toBeDefined();

      mockGet.mockRestore();
    });
  });

  describe("序列化", () => {
    it("应该支持禁用序列化", async () => {
      const mockSet = jest.spyOn(redis, "setex").mockResolvedValue("OK");
      const mockGet = jest.spyOn(redis, "get").mockResolvedValue("raw-string");

      const result = await cacheManager.set("test-key", "raw-string", {
        serialize: false,
      });

      expect(result).toBe(true);

      const getValue = await cacheManager.get("test-key", { serialize: false });

      expect(getValue).toBe("raw-string");

      mockSet.mockRestore();
      mockGet.mockRestore();
    });

    it("应该处理序列化错误", async () => {
      const circularObj: Record<string, unknown> = {};
      circularObj.self = circularObj;

      await expect(cacheManager.set("test-key", circularObj)).rejects.toThrow(
        "序列化失败",
      );
    });

    it("应该处理反序列化错误", async () => {
      const mockGet = jest
        .spyOn(redis, "get")
        .mockResolvedValue("invalid-json");

      const result = await cacheManager.get("test-key");

      expect(result).toBe(null);

      mockGet.mockRestore();
    });
  });

  describe("配置", () => {
    it("应该使用自定义配置创建", () => {
      const customConfig = {
        keyPrefix: "custom:",
        defaultTtl: 1800,
      };

      const customManager = new CacheManager(customConfig);

      const config = customManager.getConfig();

      expect(config.keyPrefix).toBe("custom:");
      expect(config.defaultTtl).toBe(1800);
    });

    it("应该支持设置自定义序列化器", () => {
      const customSerializer = {
        serialize: jest.fn((value: unknown) => {
          if (typeof value === "string") {
            return `custom:${value}`;
          }
          return String(value);
        }) as <T>(value: T) => string,
        deserialize: jest.fn((value: string) => {
          return value.replace("custom:", "");
        }) as <T>(value: string) => T,
      };

      cacheManager.setSerializer(customSerializer);

      expect(customSerializer.serialize).toBeDefined();
      expect(customSerializer.deserialize).toBeDefined();
    });
  });
});
