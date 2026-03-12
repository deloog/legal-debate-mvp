/**
 * 法律之星服务配置
 *
 * 提供法规查询和向量查询的配置管理
 */

import type { LawStarClientConfig } from '../../types/lawstar-api';

// =============================================================================
// 法律之星默认配置
// =============================================================================

export const DEFAULT_LAWSTAR_CONFIG: LawStarClientConfig = {
  regulation: {
    baseURL:
      process.env.LAWSTAR_REGULATION_BASE_URL || 'https://api.law-star.com',
    appId: process.env.LAWSTAR_REGULATION_APP_ID || '',
    appSecret: process.env.LAWSTAR_REGULATION_APP_SECRET || '',
    timeout: 30000,
  },
  vector: {
    baseURL: process.env.LAWSTAR_VECTOR_BASE_URL || 'https://api.law-star.com',
    appId: process.env.LAWSTAR_VECTOR_APP_ID || '',
    appSecret: process.env.LAWSTAR_VECTOR_APP_SECRET || '',
    timeout: 30000,
  },
  cache: {
    enabled: true,
    ttl: 3600, // 1小时缓存
  },
  retry: {
    maxRetries: 3,
    retryDelay: 1000,
  },
};

// =============================================================================
// 开发环境配置
// =============================================================================

export const DEVELOPMENT_LAWSTAR_CONFIG: LawStarClientConfig = {
  ...DEFAULT_LAWSTAR_CONFIG,
  regulation: {
    ...DEFAULT_LAWSTAR_CONFIG.regulation,
    timeout: 10000, // 开发环境更短的超时
  },
  vector: {
    ...DEFAULT_LAWSTAR_CONFIG.vector,
    timeout: 10000,
  },
  cache: {
    enabled: true,
    ttl: 1800, // 30分钟缓存
  },
  retry: {
    maxRetries: 2,
    retryDelay: 500,
  },
};

// =============================================================================
// 生产环境配置
// =============================================================================

export const PRODUCTION_LAWSTAR_CONFIG: LawStarClientConfig = {
  ...DEFAULT_LAWSTAR_CONFIG,
  regulation: {
    ...DEFAULT_LAWSTAR_CONFIG.regulation,
    timeout: 60000, // 生产环境更长的超时
  },
  vector: {
    ...DEFAULT_LAWSTAR_CONFIG.vector,
    timeout: 60000,
  },
  cache: {
    enabled: true,
    ttl: 7200, // 2小时缓存
  },
  retry: {
    maxRetries: 5,
    retryDelay: 2000,
  },
};

// =============================================================================
// 测试环境配置
// =============================================================================

export const TEST_LAWSTAR_CONFIG: LawStarClientConfig = {
  regulation: {
    baseURL: 'http://localhost:3000/mock/lawstar',
    appId: 'test-regulation-app-id',
    appSecret: 'test-regulation-app-secret',
    timeout: 5000,
  },
  vector: {
    baseURL: 'http://localhost:3000/mock/lawstar',
    appId: 'test-vector-app-id',
    appSecret: 'test-vector-app-secret',
    timeout: 5000,
  },
  cache: {
    enabled: false, // 测试时禁用缓存
    ttl: 60,
  },
  retry: {
    maxRetries: 1,
    retryDelay: 100,
  },
};

// =============================================================================
// 配置选择器
// =============================================================================

export function getLawStarConfig(): LawStarClientConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  switch (nodeEnv) {
    case 'production':
      return PRODUCTION_LAWSTAR_CONFIG;
    case 'test':
      return TEST_LAWSTAR_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_LAWSTAR_CONFIG;
  }
}

// =============================================================================
// 环境变量验证
// =============================================================================

export function validateLawStarConfig(): { valid: boolean; errors: string[] } {
  const config = getLawStarConfig();
  const errors: string[] = [];

  // 验证法规查询配置
  if (!config.regulation.appId) {
    errors.push('Law Star regulation app ID is required');
  }
  if (!config.regulation.appSecret) {
    errors.push('Law Star regulation app secret is required');
  }
  if (!config.regulation.baseURL) {
    errors.push('Law Star regulation base URL is required');
  }

  // 验证向量查询配置
  if (!config.vector.appId) {
    errors.push('Law Star vector app ID is required');
  }
  if (!config.vector.appSecret) {
    errors.push('Law Star vector app secret is required');
  }
  if (!config.vector.baseURL) {
    errors.push('Law Star vector base URL is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 法律之星服务能力配置
// =============================================================================

export const LAWSTAR_CAPABILITIES = {
  regulation: {
    name: '法规查询',
    description: '基于关键词的法条检索',
    features: [
      '关键词搜索',
      '法律类型筛选',
      '效力级别筛选',
      '时效性筛选',
      '分页查询',
    ],
    rateLimits: {
      requestsPerSecond: 10,
      requestsPerMinute: 100,
      requestsPerDay: 10000,
    },
  },
  vector: {
    name: '向量查询',
    description: '基于语义的智能检索',
    features: [
      '语义理解',
      '相似度匹配',
      '智能排序',
      '法律类型过滤',
      '条款匹配',
    ],
    rateLimits: {
      requestsPerSecond: 5,
      requestsPerMinute: 50,
      requestsPerDay: 5000,
    },
  },
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 获取法律之星服务能力
 */
export function getLawStarCapabilities() {
  return LAWSTAR_CAPABILITIES;
}

/**
 * 检查法律之星服务是否可用
 */
export function isLawStarAvailable(): boolean {
  const config = getLawStarConfig();
  return !!(
    config.regulation.appId &&
    config.regulation.appSecret &&
    config.vector.appId &&
    config.vector.appSecret
  );
}

/**
 * 获取法律之星服务状态
 */
export function getLawStarStatus() {
  const config = getLawStarConfig();
  const validation = validateLawStarConfig();

  return {
    available: validation.valid,
    regulation: {
      configured: !!(config.regulation.appId && config.regulation.appSecret),
      baseURL: config.regulation.baseURL,
    },
    vector: {
      configured: !!(config.vector.appId && config.vector.appSecret),
      baseURL: config.vector.baseURL,
    },
    cache: {
      enabled: config.cache?.enabled || false,
      ttl: config.cache?.ttl || 0,
    },
    errors: validation.errors,
  };
}

// =============================================================================
// 默认导出
// =============================================================================

const lawstarConfig = {
  DEFAULT_LAWSTAR_CONFIG,
  DEVELOPMENT_LAWSTAR_CONFIG,
  PRODUCTION_LAWSTAR_CONFIG,
  TEST_LAWSTAR_CONFIG,
  getLawStarConfig,
  validateLawStarConfig,
  LAWSTAR_CAPABILITIES,
  getLawStarCapabilities,
  isLawStarAvailable,
  getLawStarStatus,
};

export default lawstarConfig;
