/**
 * 缓存配置管理器
 * 集中管理所有缓存相关配置，支持环境变量覆盖和类型安全
 */

import { CacheNamespace, defaultCacheConfig } from './types';

/**
 * 命名空间特定配置接口
 */
interface NamespaceConfig {
  namespace: CacheNamespace;
  ttl: number;
  description: string;
  preloadEnabled: boolean;
  preloadKeys: string[];
  refreshThreshold?: number; // 预刷新阈值（秒）
}

/**
 * 缓存预热配置接口
 */
interface PreloadConfig {
  enabled: boolean;
  delayAfterStart: number; // 启动后延迟（毫秒）
  batchDelay: number; // 批次间延迟（毫秒）
  batchSize: number; // 每批次加载数量
}

/**
 * 缓存策略配置接口
 */
interface StrategyConfig {
  defaultStrategy: 'lazy' | 'write_through' | 'write_behind' | 'refresh_ahead';
  enableAutoRefresh: boolean;
  refreshInterval: number; // 自动刷新间隔（秒）
}

/**
 * 缓存配置接口
 */
export interface CacheSystemConfig {
  // 全局配置
  global: typeof defaultCacheConfig;

  // 命名空间配置
  namespaces: Record<CacheNamespace, NamespaceConfig>;

  // 预加载配置
  preload: PreloadConfig;

  // 策略配置
  strategy: StrategyConfig;

  // 监控配置
  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
    metricsInterval: number;
    alertThresholds: {
      slowResponse: number;
      lowHitRate: number;
      highMemory: number;
    };
  };
}

/**
 * 命名空间配置映射
 */
const namespaceConfigs: Record<CacheNamespace, NamespaceConfig> = {
  [CacheNamespace.USER_SESSION]: {
    namespace: CacheNamespace.USER_SESSION,
    ttl: parseInt(process.env.CACHE_SESSION_TTL || '1800', 10), // 30分钟
    description: '用户会话缓存',
    preloadEnabled: false,
    preloadKeys: [],
  },
  [CacheNamespace.USER_DATA]: {
    namespace: CacheNamespace.USER_DATA,
    ttl: parseInt(process.env.CACHE_USER_DATA_TTL || '3600', 10), // 1小时
    description: '用户数据缓存',
    preloadEnabled: true,
    preloadKeys: ['active_users', 'permissions'],
  },
  [CacheNamespace.AI_RESPONSE]: {
    namespace: CacheNamespace.AI_RESPONSE,
    ttl: parseInt(process.env.CACHE_AI_RESPONSE_TTL || '3600', 10), // 1小时
    description: 'AI响应缓存',
    preloadEnabled: false,
    preloadKeys: [],
    refreshThreshold: 300, // 5分钟
  },
  [CacheNamespace.CONFIGURATION]: {
    namespace: CacheNamespace.CONFIGURATION,
    ttl: parseInt(process.env.CACHE_CONFIG_TTL || '86400', 10), // 24小时
    description: '系统配置缓存',
    preloadEnabled: true,
    preloadKeys: ['system', 'feature', 'ui'],
  },
  [CacheNamespace.DATABASE_QUERY]: {
    namespace: CacheNamespace.DATABASE_QUERY,
    ttl: parseInt(process.env.CACHE_DB_QUERY_TTL || '1800', 10), // 30分钟
    description: '数据库查询结果缓存',
    preloadEnabled: false,
    preloadKeys: [],
  },
  [CacheNamespace.API_RESPONSE]: {
    namespace: CacheNamespace.API_RESPONSE,
    ttl: parseInt(process.env.CACHE_API_RESPONSE_TTL || '300', 10), // 5分钟
    description: 'API响应缓存',
    preloadEnabled: false,
    preloadKeys: [],
  },
  [CacheNamespace.TEMPORARY]: {
    namespace: CacheNamespace.TEMPORARY,
    ttl: parseInt(process.env.CACHE_TEMP_TTL || '60', 10), // 1分钟
    description: '临时数据缓存',
    preloadEnabled: false,
    preloadKeys: [],
  },
  [CacheNamespace.SYSTEM]: {
    namespace: CacheNamespace.SYSTEM,
    ttl: parseInt(process.env.CACHE_SYSTEM_TTL || '7200', 10), // 2小时
    description: '系统数据缓存',
    preloadEnabled: true,
    preloadKeys: ['stats', 'health'],
  },
};

/**
 * 预加载配置
 */
const preloadConfig: PreloadConfig = {
  enabled: process.env.CACHE_PRELOAD_ENABLED !== 'false',
  delayAfterStart: parseInt(process.env.CACHE_PRELOAD_DELAY || '5000', 10), // 5秒
  batchDelay: parseInt(process.env.CACHE_PRELOAD_BATCH_DELAY || '100', 10), // 100毫秒
  batchSize: parseInt(process.env.CACHE_PRELOAD_BATCH_SIZE || '10', 10),
};

/**
 * 策略配置
 */
const strategyConfig: StrategyConfig = {
  defaultStrategy: (process.env.CACHE_DEFAULT_STRATEGY || 'lazy') as
    | 'lazy'
    | 'write_through'
    | 'write_behind'
    | 'refresh_ahead',
  enableAutoRefresh: process.env.CACHE_AUTO_REFRESH_ENABLED === 'true',
  refreshInterval: parseInt(process.env.CACHE_REFRESH_INTERVAL || '300', 10), // 5分钟
};

/**
 * 监控配置
 */
const monitoringConfig: CacheSystemConfig['monitoring'] = {
  enabled: process.env.CACHE_MONITORING_ENABLED !== 'false',
  healthCheckInterval: parseInt(
    process.env.CACHE_HEALTH_CHECK_INTERVAL || '30000',
    10
  ), // 30秒
  metricsInterval: parseInt(process.env.CACHE_METRICS_INTERVAL || '60000', 10), // 1分钟
  alertThresholds: {
    slowResponse: parseInt(process.env.CACHE_ALERT_SLOW_RESPONSE || '1000', 10), // 1秒
    lowHitRate: parseInt(process.env.CACHE_ALERT_LOW_HIT_RATE || '50', 10), // 50%
    highMemory: parseInt(
      process.env.CACHE_ALERT_HIGH_MEMORY || '1073741824',
      10
    ), // 1GB
  },
};

/**
 * 缓存系统完整配置
 */
export const cacheSystemConfig: CacheSystemConfig = {
  global: defaultCacheConfig,
  namespaces: namespaceConfigs,
  preload: preloadConfig,
  strategy: strategyConfig,
  monitoring: monitoringConfig,
};

/**
 * 获取命名空间配置
 */
export function getNamespaceConfig(
  namespace: CacheNamespace
): NamespaceConfig | null {
  return namespaceConfigs[namespace] || null;
}

/**
 * 设置命名空间TTL
 */
export function setNamespaceTTL(
  namespace: CacheNamespace,
  ttl: number
): boolean {
  const config = namespaceConfigs[namespace];
  if (!config) {
    console.warn(`未找到命名空间配置: ${namespace}`);
    return false;
  }

  config.ttl = ttl;
  console.log(`更新命名空间TTL: ${namespace} = ${ttl}秒`);
  return true;
}

/**
 * 获取所有预加载键
 */
export function getAllPreloadKeys(): Array<{
  namespace: CacheNamespace;
  keys: string[];
}> {
  const preloadKeys: Array<{
    namespace: CacheNamespace;
    keys: string[];
  }> = [];

  for (const [namespace, config] of Object.entries(namespaceConfigs)) {
    if (config.preloadEnabled && config.preloadKeys.length > 0) {
      preloadKeys.push({
        namespace: namespace as CacheNamespace,
        keys: config.preloadKeys,
      });
    }
  }

  return preloadKeys;
}

/**
 * 检查是否应该自动刷新
 */
export function shouldAutoRefresh(namespace: CacheNamespace): boolean {
  const config = getNamespaceConfig(namespace);
  if (!config || !config.refreshThreshold) {
    return false;
  }

  return strategyConfig.enableAutoRefresh;
}

/**
 * 获取刷新阈值
 */
export function getRefreshThreshold(
  namespace: CacheNamespace
): number | undefined {
  const config = getNamespaceConfig(namespace);
  return config?.refreshThreshold;
}

/**
 * 验证缓存配置
 */
export function validateConfig(config: Partial<CacheSystemConfig>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证TTL值
  if (config.namespaces) {
    for (const [ns, nsConfig] of Object.entries(config.namespaces)) {
      if (nsConfig.ttl < 0) {
        errors.push(`命名空间 ${ns} 的TTL不能为负数`);
      }
      if (nsConfig.ttl > 86400 * 7) {
        // 7天
        errors.push(`命名空间 ${ns} 的TTL过长 (${nsConfig.ttl}秒)`);
      }
    }
  }

  // 验证预加载配置
  if (config.preload) {
    if (config.preload.batchSize < 1) {
      errors.push('预加载批次大小必须大于0');
    }
    if (config.preload.batchSize > 100) {
      errors.push('预加载批次大小不应超过100');
    }
    if (config.preload.batchDelay < 0) {
      errors.push('预加载批次延迟不能为负数');
    }
  }

  // 验证监控配置
  if (config.monitoring) {
    if (
      config.monitoring.alertThresholds.slowResponse < 0 ||
      config.monitoring.alertThresholds.slowResponse > 10000
    ) {
      errors.push('慢响应告警阈值应在0-10000ms之间');
    }
    if (
      config.monitoring.alertThresholds.lowHitRate < 0 ||
      config.monitoring.alertThresholds.lowHitRate > 100
    ) {
      errors.push('低命中率告警阈值应在0-100%之间');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 获取配置摘要
 */
export function getConfigSummary(): string {
  const summary = `
缓存系统配置摘要
================

全局配置
- 键前缀: ${cacheSystemConfig.global.keyPrefix}
- 默认TTL: ${cacheSystemConfig.global.defaultTtl}秒
- 指标收集: ${cacheSystemConfig.global.enableMetrics ? '启用' : '禁用'}

命名空间配置
${Object.values(namespaceConfigs)
  .map(
    config =>
      `- ${config.namespace}: ${config.ttl}秒, 预加载: ${config.preloadEnabled}`
  )
  .join('\n')}

预加载配置
- 启用: ${cacheSystemConfig.preload.enabled}
- 启动延迟: ${cacheSystemConfig.preload.delayAfterStart}ms
- 批次大小: ${cacheSystemConfig.preload.batchSize}

策略配置
- 默认策略: ${cacheSystemConfig.strategy.defaultStrategy}
- 自动刷新: ${cacheSystemConfig.strategy.enableAutoRefresh}

监控配置
- 启用: ${cacheSystemConfig.monitoring.enabled}
- 健康检查间隔: ${cacheSystemConfig.monitoring.healthCheckInterval}ms
- 指标收集间隔: ${cacheSystemConfig.monitoring.metricsInterval}ms
`.trim();

  return summary;
}

/**
 * 导出默认配置实例
 */
export default cacheSystemConfig;
