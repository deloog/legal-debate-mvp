import Redis from "ioredis";

// Redis配置接口
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;
  maxRetries: number;
  connectTimeout: number;
  idleTimeout: number;
  maxRetriesPerRequest: number;
}

// 默认Redis配置
const defaultRedisConfig: RedisConfig = {
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

// 全局变量，用于存储Redis客户端实例
declare global {
  // 允许在开发热重载时保持单一实例
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

// 创建Redis客户端实例
function createRedisClient(): Redis {
  const client = new Redis({
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
export const redis = globalThis.__redis ?? createRedisClient();

// 开发环境下，将客户端实例保存到全局变量，避免热重载时创建多个实例
if (process.env.NODE_ENV === "development") {
  globalThis.__redis = redis;
}

// Redis连接健康检查
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch (error) {
    console.error("Redis连接检查失败:", error);
    return false;
  }
};

// 优雅关闭Redis连接
export const disconnectRedis = async (): Promise<void> => {
  try {
    await redis.quit();
    console.log("Redis连接已断开");
  } catch (error) {
    console.error("断开Redis连接时出错:", error);
    throw error;
  }
};

// 获取Redis连接信息
export const getRedisInfo = async (): Promise<any> => {
  try {
    const info = await redis.info();
    const serverInfo = await redis.info("server");
    const memoryInfo = await redis.info("memory");
    const statsInfo = await redis.info("stats");

    return {
      connected: redis.status === "ready",
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

// 解析Redis INFO命令返回的字符串
const parseRedisInfo = (infoString: string): Record<string, string> => {
  const lines = infoString.split("\r\n");
  const info: Record<string, string> = {};

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
export const connectRedis = async (): Promise<void> => {
  try {
    if (redis.status !== "ready") {
      await redis.connect();
    }
    console.log("Redis连接已建立");
  } catch (error) {
    console.error("Redis连接失败:", error);
    throw error;
  }
};

// 导出配置
export { defaultRedisConfig as redisConfig };

export default redis;
