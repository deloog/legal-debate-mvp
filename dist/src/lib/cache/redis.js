"use strict";
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisConfig =
  exports.connectRedis =
  exports.getRedisInfo =
  exports.disconnectRedis =
  exports.checkRedisConnection =
  exports.redis =
    void 0;
const ioredis_1 = __importDefault(require("ioredis"));
// 默认Redis配置
const defaultRedisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || "0", 10),
  tls: process.env.REDIS_TLS === "true",
  maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || "3", 10),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || "10000", 10),
  idleTimeout: parseInt(process.env.REDIS_IDLE_TIMEOUT || "30000", 10),
  maxRetriesPerRequest: parseInt(
    process.env.REDIS_MAX_RETRIES_PER_REQUEST || "3",
    10,
  ),
};
exports.redisConfig = defaultRedisConfig;
// 创建Redis客户端实例
function createRedisClient() {
  const client = new ioredis_1.default({
    host: defaultRedisConfig.host,
    port: defaultRedisConfig.port,
    password: defaultRedisConfig.password,
    db: defaultRedisConfig.db,
    tls: defaultRedisConfig.tls ? {} : undefined,
    maxRetriesPerRequest: defaultRedisConfig.maxRetriesPerRequest,
    connectTimeout: defaultRedisConfig.connectTimeout,
    lazyConnect: true,
    enableReadyCheck: true,
    keepAlive: 30000,
    family: 4,
    // 重连策略
    retryStrategy: (times) => {
      if (times >= defaultRedisConfig.maxRetries) {
        console.error("Redis重连次数已达上限，停止重连");
        return null;
      }
      const delay = Math.min(times * 1000, 30000);
      console.warn(`Redis连接失败，${delay}ms后进行第${times + 1}次重连`);
      return delay;
    },
  });
  // 连接事件监听
  client.on("connect", () => {
    console.log("Redis客户端连接成功");
  });
  client.on("ready", () => {
    console.log("Redis客户端准备就绪");
  });
  client.on("error", (error) => {
    console.error("Redis客户端错误:", error);
  });
  client.on("close", () => {
    console.warn("Redis客户端连接关闭");
  });
  client.on("reconnecting", () => {
    console.info("Redis客户端正在重连...");
  });
  client.on("end", () => {
    console.warn("Redis客户端连接结束");
  });
  return client;
}
// 获取Redis客户端实例（单例模式）
exports.redis = globalThis.__redis ?? createRedisClient();
// 开发环境下，将客户端实例保存到全局变量，避免热重载时创建多个实例
if (process.env.NODE_ENV === "development") {
  globalThis.__redis = exports.redis;
}
// Redis连接健康检查
const checkRedisConnection = async () => {
  try {
    const result = await exports.redis.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis连接检查失败:", error);
    return false;
  }
};
exports.checkRedisConnection = checkRedisConnection;
// 优雅关闭Redis连接
const disconnectRedis = async () => {
  try {
    await exports.redis.quit();
    console.log("Redis连接已断开");
  } catch (error) {
    console.error("断开Redis连接时出错:", error);
    throw error;
  }
};
exports.disconnectRedis = disconnectRedis;
// 获取Redis连接信息
const getRedisInfo = async () => {
  try {
    const info = await exports.redis.info();
    const serverInfo = await exports.redis.info("server");
    const memoryInfo = await exports.redis.info("memory");
    const statsInfo = await exports.redis.info("stats");
    return {
      connected: exports.redis.status === "ready",
      server: parseRedisInfo(serverInfo),
      memory: parseRedisInfo(memoryInfo),
      stats: parseRedisInfo(statsInfo),
      info: parseRedisInfo(info),
    };
  } catch (error) {
    console.error("获取Redis信息失败:", error);
    return null;
  }
};
exports.getRedisInfo = getRedisInfo;
// 解析Redis INFO命令返回的字符串
const parseRedisInfo = (infoString) => {
  const lines = infoString.split("\r\n");
  const info = {};
  for (const line of lines) {
    if (line && !line.startsWith("#")) {
      const [key, value] = line.split(":");
      if (key && value) {
        info[key.trim()] = value.trim();
      }
    }
  }
  return info;
};
// 连接到Redis
const connectRedis = async () => {
  try {
    if (exports.redis.status !== "ready") {
      await exports.redis.connect();
    }
    console.log("Redis连接已建立");
  } catch (error) {
    console.error("Redis连接失败:", error);
    throw error;
  }
};
exports.connectRedis = connectRedis;
exports.default = exports.redis;
