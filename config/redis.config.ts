/**
 * 生产环境Redis配置模块
 * 提供Redis连接和运维配置，支持单实例、哨兵、集群模式
 */

import { getStringEnv, getNumberEnv, getBooleanEnv } from './load-env';

/**
 * Redis连接模式枚举
 */
export enum RedisMode {
  SINGLE = 'single', // 单实例模式
  SENTINEL = 'sentinel', // 哨兵模式
  CLUSTER = 'cluster', // 集群模式
}

/**
 * 持久化策略枚举
 */
export enum PersistenceMode {
  AOF = 'aof', // 仅AOF
  RDB = 'rdb', // 仅RDB
  MIXED = 'mixed', // 混合模式（AOF + RDB）
  OFF = 'off', // 关闭持久化
}

/**
 * 淘汰策略枚举
 */
export enum EvictionPolicy {
  NO_EVICTION = 'noeviction', // 不淘汰
  ALL_KEYS_LRU = 'allkeys-lru', // 所有键LRU
  VOLATILE_LRU = 'volatile-lru', // 过期键LRU
  ALL_KEYS_LFU = 'allkeys-lfu', // 所有键LFU
  VOLATILE_LFU = 'volatile-lfu', // 过期键LFU
  ALL_KEYS_RANDOM = 'allkeys-random', // 所有键随机
  VOLATILE_RANDOM = 'volatile-random', // 过期键随机
}

/**
 * Redis配置接口
 */
export interface RedisConfig {
  // 连接配置
  mode: RedisMode;
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;

  // 性能配置
  maxRetries: number;
  connectTimeout: number;
  idleTimeout: number;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  lazyConnect: boolean;
  keepAlive: number;

  // 持久化配置
  persistenceMode: PersistenceMode;
  saveEnabled: boolean;
  appendOnly: boolean;
  appendFsync: 'always' | 'everysec' | 'no';
  saveSeconds: number;
  saveChanges: number;

  // 内存配置
  maxMemory: number;
  maxMemoryPolicy: EvictionPolicy;
  maxMemorySamples: number;

  // 安全配置
  requirepass: boolean;
  bindAddresses: string[];
  protectedMode: boolean;
  renameCommands: Record<string, string>;

  // 监控配置
  slowlogLogSlowerThan: number;
  slowlogMaxLen: number;
  latencyMonitorThreshold: number;

  // 集群/哨兵配置
  sentinelHosts?: string[];
  sentinelMasterName?: string;
  sentinelPassword?: string;
  clusterNodes?: Array<{ host: string; port: number }>;
}

/**
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 获取Redis连接模式
 */
export function getRedisMode(): RedisMode {
  const mode = getStringEnv('REDIS_MODE', RedisMode.SINGLE);
  return mode as RedisMode;
}

/**
 * 获取Redis持久化策略
 */
export function getPersistenceMode(): PersistenceMode {
  const mode = getStringEnv('REDIS_PERSISTENCE_MODE', PersistenceMode.MIXED);
  return mode as PersistenceMode;
}

/**
 * 加载Redis配置
 */
export function loadRedisConfig(): RedisConfig {
  const mode = getRedisMode();
  const isProduction = process.env.NODE_ENV === 'production';

  const redisPassword = getStringEnv('REDIS_PASSWORD');
  const config: RedisConfig = {
    // 连接配置
    mode,
    host: getStringEnv('REDIS_HOST', isProduction ? 'redis-prod' : 'localhost'),
    port: getNumberEnv('REDIS_PORT', 6379, { min: 1, max: 65535 }),
    ...(redisPassword && { password: redisPassword }),
    db: getNumberEnv('REDIS_DB', 0, { min: 0, max: 15 }),
    tls: getBooleanEnv('REDIS_TLS', mode === RedisMode.SINGLE && isProduction),

    // 性能配置
    maxRetries: getNumberEnv('REDIS_MAX_RETRIES', isProduction ? 5 : 3, {
      min: 0,
      max: 10,
    }),
    connectTimeout: getNumberEnv(
      'REDIS_CONNECT_TIMEOUT',
      isProduction ? 15000 : 10000,
      { min: 1000, max: 60000 }
    ),
    idleTimeout: getNumberEnv('REDIS_IDLE_TIMEOUT', 30000, {
      min: 0,
      max: 300000,
    }),
    maxRetriesPerRequest: getNumberEnv('REDIS_MAX_RETRIES_PER_REQUEST', 3, {
      min: 0,
      max: 5,
    }),
    enableReadyCheck: getBooleanEnv('REDIS_ENABLE_READY_CHECK', true),
    lazyConnect: getBooleanEnv('REDIS_LAZY_CONNECT', true),
    keepAlive: getNumberEnv('REDIS_KEEP_ALIVE', 30000, { min: 0, max: 120000 }),

    // 持久化配置
    persistenceMode: getPersistenceMode(),
    saveEnabled: getBooleanEnv('REDIS_SAVE_ENABLED', isProduction),
    appendOnly: getBooleanEnv('REDIS_APPEND_ONLY', true),
    appendFsync: getStringEnv('REDIS_APPEND_FSYNC', 'everysec') as
      | 'always'
      | 'everysec'
      | 'no',
    saveSeconds: getNumberEnv('REDIS_SAVE_SECONDS', 900, { min: 1, max: 3600 }),
    saveChanges: getNumberEnv('REDIS_SAVE_CHANGES', 1, { min: 1, max: 10000 }),

    // 内存配置
    maxMemory: getNumberEnv(
      'REDIS_MAX_MEMORY',
      isProduction ? 2147483648 : 1073741824,
      { min: 1048576, max: Number.MAX_SAFE_INTEGER }
    ), // 生产2GB，开发1GB
    maxMemoryPolicy: getStringEnv(
      'REDIS_MAX_MEMORY_POLICY',
      EvictionPolicy.VOLATILE_LRU
    ) as EvictionPolicy,
    maxMemorySamples: getNumberEnv('REDIS_MAX_MEMORY_SAMPLES', 5, {
      min: 1,
      max: 10,
    }),

    // 安全配置
    requirepass: getBooleanEnv('REDIS_REQUIREPASS', isProduction),
    bindAddresses: (process.env.REDIS_BIND_ADDRESSES || '127.0.0.1')
      .split(',')
      .map(s => s.trim()),
    protectedMode: getBooleanEnv('REDIS_PROTECTED_MODE', false),
    renameCommands: JSON.parse(
      process.env.REDIS_RENAME_COMMANDS || '{}'
    ) as Record<string, string>,

    // 监控配置
    slowlogLogSlowerThan: getNumberEnv('REDIS_SLOWLOG_LOG_SLOWER_THAN', 10000, {
      min: -1,
      max: 1000000,
    }),
    slowlogMaxLen: getNumberEnv('REDIS_SLOWLOG_MAX_LEN', 128, {
      min: 0,
      max: 1024,
    }),
    latencyMonitorThreshold: getNumberEnv(
      'REDIS_LATENCY_MONITOR_THRESHOLD',
      100,
      { min: 0, max: 10000 }
    ),
  };

  // 哨兵模式配置
  if (mode === RedisMode.SENTINEL) {
    config.sentinelHosts = (
      process.env.REDIS_SENTINEL_HOSTS || '127.0.0.1:26379'
    )
      .split(',')
      .map(h => h.trim());
    config.sentinelMasterName = getStringEnv(
      'REDIS_SENTINEL_MASTER_NAME',
      'mymaster'
    );
    if (process.env.REDIS_SENTINEL_PASSWORD) {
      config.sentinelPassword = process.env.REDIS_SENTINEL_PASSWORD;
    }
  }

  // 集群模式配置
  if (mode === RedisMode.CLUSTER) {
    const nodes =
      process.env.REDIS_CLUSTER_NODES || '127.0.0.1:7000,127.0.0.1:7001';
    config.clusterNodes = nodes.split(',').map(node => {
      const [host, port] = node.split(':');
      return {
        host: host || '127.0.0.1',
        port: port ? parseInt(port, 10) : 7000,
      };
    });
  }

  return config;
}

/**
 * 验证Redis配置
 */
export function validateRedisConfig(
  config: RedisConfig
): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 验证端口
  if (config.port < 1 || config.port > 65535) {
    errors.push(`Redis端口无效: ${config.port} (有效范围: 1-65535)`);
  }

  // 验证主机地址
  if (!config.host || config.host.trim() === '') {
    errors.push('Redis主机地址不能为空');
  }

  // 验证数据库索引
  if (config.db < 0 || config.db > 15) {
    errors.push(`Redis数据库索引无效: ${config.db} (有效范围: 0-15)`);
  }

  // 验证TLS配置
  if (config.tls && !config.password) {
    warnings.push('TLS连接建议使用密码认证');
  }

  // 验证持久化配置
  if (config.persistenceMode !== PersistenceMode.OFF && !config.saveEnabled) {
    warnings.push('持久化模式已启用但saveEnabled为false');
  }

  // 验证内存配置
  if (config.maxMemory < 1048576) {
    errors.push(`Redis最大内存过小: ${config.maxMemory} (最小: 1MB)`);
  }

  // 验证淘汰策略
  if (
    config.maxMemory <= 0 &&
    config.maxMemoryPolicy !== EvictionPolicy.NO_EVICTION
  ) {
    warnings.push('未设置maxMemory但启用了淘汰策略');
  }

  // 验证超时配置
  if (config.connectTimeout < 1000) {
    warnings.push(
      `连接超时时间过短: ${config.connectTimeout}ms (建议>=1000ms)`
    );
  }

  // 验证哨兵配置
  if (config.mode === RedisMode.SENTINEL) {
    if (!config.sentinelHosts || config.sentinelHosts.length === 0) {
      errors.push('哨兵模式需要配置sentinelHosts');
    }
    if (!config.sentinelMasterName) {
      errors.push('哨兵模式需要配置sentinelMasterName');
    }
  }

  // 验证集群配置
  if (config.mode === RedisMode.CLUSTER) {
    if (!config.clusterNodes || config.clusterNodes.length < 3) {
      errors.push('集群模式至少需要3个节点');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 获取配置摘要
 */
export function getConfigSummary(config: RedisConfig): string {
  return `
Redis配置摘要
================

连接配置
- 模式: ${config.mode}
- 主机: ${config.host}
- 端口: ${config.port}
- 数据库: ${config.db}
- TLS: ${config.tls ? '启用' : '禁用'}
- 密码认证: ${config.password ? '启用' : '禁用'}

性能配置
- 最大重试次数: ${config.maxRetries}
- 连接超时: ${config.connectTimeout}ms
- 空闲超时: ${config.idleTimeout}ms
- 每请求最大重试: ${config.maxRetriesPerRequest}
- Ready检查: ${config.enableReadyCheck ? '启用' : '禁用'}
- 懒连接: ${config.lazyConnect ? '启用' : '禁用'}
- KeepAlive: ${config.keepAlive}ms

持久化配置
- 持久化模式: ${config.persistenceMode}
- 启用保存: ${config.saveEnabled}
- AOF: ${config.appendOnly ? '启用' : '禁用'}
- AOF Fsync: ${config.appendFsync}
  - 保存间隔: ${config.saveSeconds}秒
  - 保存触发: ${config.saveChanges}次修改

内存配置
- 最大内存: ${(config.maxMemory / 1024 / 1024).toFixed(2)}MB
- 淘汰策略: ${config.maxMemoryPolicy}
- 内存采样数: ${config.maxMemorySamples}

安全配置
- 密码验证: ${config.requirepass ? '启用' : '禁用'}
- 绑定地址: ${config.bindAddresses.join(', ')}
- 保护模式: ${config.protectedMode ? '启用' : '禁用'}
- 重命名命令: ${Object.keys(config.renameCommands).length}个

监控配置
- 慢日志阈值: ${config.slowlogLogSlowerThan}ms
- 慢日志长度: ${config.slowlogMaxLen}
- 延迟监控: ${config.latencyMonitorThreshold}ms

${
  config.mode === RedisMode.SENTINEL
    ? `
哨兵配置
- 哨兵主机: ${config.sentinelHosts?.join(', ')}
- 主节点名称: ${config.sentinelMasterName}
- 哨兵密码: ${config.sentinelPassword ? '已配置' : '未配置'}
`
    : ''
}${
    config.mode === RedisMode.CLUSTER
      ? `
集群配置
- 集群节点: ${config.clusterNodes?.map(n => `${n.host}:${n.port}`).join(', ')}
`
      : ''
  }
`.trim();
}

/**
 * 导出默认配置
 */
export const defaultRedisConfig = loadRedisConfig();

export default defaultRedisConfig;
