/**
 * Redis缓存工具
 *
 * 用于优化API性能，减少数据库查询
 * 目标：将API响应时间从<2秒优化到<1秒
 */

import Redis from 'ioredis';

// Redis客户端实例
let redis: Redis | null = null;

/**
 * 获取Redis客户端
 */
export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: times => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: err => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    redis.on('error', err => {
      console.error('Redis连接错误:', err);
    });

    redis.on('connect', () => {
      console.log('✅ Redis连接成功');
    });
  }

  return redis;
}

/**
 * 缓存配置
 */
export const CacheConfig = {
  // 法条查询缓存（1小时）
  LAW_ARTICLE: 3600,
  // 法条列表缓存（30分钟）
  LAW_ARTICLE_LIST: 1800,
  // 法条关系缓存（1小时）
  LAW_ARTICLE_RELATION: 3600,
  // 推荐结果缓存（15分钟）
  RECOMMENDATION: 900,
  // 用户信息缓存（5分钟）
  USER_INFO: 300,
  // 统计数据缓存（10分钟）
  STATS: 600,
  // 知识图谱缓存（30分钟）
  KNOWLEDGE_GRAPH: 1800,
};

/**
 * 生成缓存键
 */
export function generateCacheKey(
  prefix: string,
  ...args: (string | number)[]
): string {
  return `${prefix}:${args.join(':')}`;
}

/**
 * 获取缓存数据
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedisClient();
    const cached = await client.get(key);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('获取缓存失败:', error);
    return null;
  }
}

/**
 * 设置缓存数据
 */
export async function setCached<T>(
  key: string,
  data: T,
  ttl: number = 3600
): Promise<void> {
  try {
    const client = getRedisClient();
    await client.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('设置缓存失败:', error);
  }
}

/**
 * 带缓存的查询函数
 */
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  // 尝试从缓存获取
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }

  // 缓存未命中，执行查询
  const data = await fetcher();

  // 存入缓存
  await setCached(key, data, ttl);

  return data;
}

/**
 * 获取Redis服务器信息
 */
export interface RedisInfo {
  connected: boolean;
  client: string;
  usedMemory: string;
  uptime: string;
  version: string;
  // 扩展字段用于监控
  memory?: {
    used: number;
    peak: number;
    fragmentation: number;
    used_memory?: string; // 兼容旧代码
  };
  stats?: {
    totalConnections: number;
    commandsProcessed: number;
    keyspaceHits: number;
    keyspaceMisses: number;
    keyspace_hits?: string; // 兼容旧代码
    keyspace_misses?: string; // 兼容旧代码
  };
}

export async function getRedisInfo(): Promise<RedisInfo | null> {
  try {
    const client = getRedisClient();
    const info = await client.info('memory');
    const uptime = await client.info('server');

    const usedMemoryMatch = info.match(/used_memory_human:(\S+)/);
    const uptimeMatch = uptime.match(/uptime_in_days:(\d+)/);
    const versionMatch = uptime.match(/redis_version:(\S+)/);

    return {
      connected: client.status === 'ready',
      client: 'ioredis',
      usedMemory: usedMemoryMatch ? usedMemoryMatch[1] : 'unknown',
      uptime: uptimeMatch ? `${uptimeMatch[1]} days` : 'unknown',
      version: versionMatch ? versionMatch[1] : 'unknown',
    };
  } catch (error) {
    console.error('获取Redis信息失败:', error);
    return null;
  }
}

/**
 * 检查Redis连接状态
 */
export async function checkRedisConnection(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('Redis连接检查失败:', error);
    return false;
  }
}

/**
 * 连接Redis
 */
export async function connectRedis(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (error) {
    console.error('Redis连接失败:', error);
    return false;
  }
}

/**
 * 断开Redis连接
 */
export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export { redis };
