import { config } from 'dotenv';
import type { AIServiceConfig, AIProvider } from '../../types/ai-service';

// 确保环境变量已加载
config();

// =============================================================================
// AI服务默认配置
// =============================================================================

export const DEFAULT_AI_SERVICE_CONFIG: AIServiceConfig = {
  clients: [
    {
      provider: 'zhipu',
      apiKey: process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY || '',
      baseURL:
        process.env.ZHIPUAI_BASE_URL ||
        process.env.ZHIPU_BASE_URL ||
        'https://open.bigmodel.cn/api/paas/v4/',
      timeout: 45000, // 增加到45秒，避免智谱清言API超时
      retryStrategy: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: [
          'timeout_error',
          'network_error',
          'rate_limit_error',
          'api_error',
        ],
      },
      rateLimits: {
        requestsPerSecond: 10,
        requestsPerMinute: 100,
        tokensPerMinute: 60000,
        tokensPerDay: 1000000,
      },
    },
    {
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      timeout: 15000, // 缩短超时时间，快速失败
      retryStrategy: {
        maxAttempts: 2, // 减少重试次数，避免长时间等待
        baseDelay: 800, // 缩短基础延迟
        maxDelay: 4000, // 缩短最大延迟
        backoffMultiplier: 1.5, // 降低退避倍数
        jitter: true,
        retryableErrors: ['timeout_error', 'network_error', 'rate_limit_error'],
      },
      rateLimits: {
        requestsPerSecond: 5,
        requestsPerMinute: 50,
        tokensPerMinute: 40000,
        tokensPerDay: 800000,
      },
    },
  ],
  loadBalancer: {
    strategy: 'weighted_round_robin',
    healthCheckInterval: 30000, // 30秒
    healthCheckTimeout: 5000, // 5秒
    failureThreshold: 3,
    recoveryThreshold: 2,
    weights: {
      zhipu: 0.6,
      deepseek: 0.4,
      openai: 0.0,
    },
    roundRobin: false,
  },
  monitor: {
    enabled: true,
    metricsInterval: 60000, // 1分钟
    logLevel: 'info',
    persistMetrics: true,
    alertThresholds: {
      responseTime: 8000, // 增加到8秒，适应智谱清言API的响应时间
      errorRate: 0.1, // 10%
      rateLimitHits: 10,
      queueLength: 100,
    },
  },
  fallback: {
    enabled: true,
    strategies: [
      {
        priority: 1,
        condition: 'provider_error',
        action: 'switch_provider',
      },
      {
        priority: 2,
        condition: 'rate_limit',
        action: 'use_cache',
      },
      {
        priority: 3,
        condition: 'timeout',
        action: 'simplified_request',
      },
      {
        priority: 4,
        condition: 'all_providers_down',
        action: 'local_processing',
      },
      {
        priority: 5,
        condition: 'provider_error',
        action: 'return_error',
      },
    ],
    cacheFallback: {
      enabled: true,
      ttl: 300, // 5分钟
      maxAge: 3600, // 1小时
    },
    simplifiedMode: {
      enabled: true,
      maxTokens: 1000,
      simplifiedPrompts: true,
    },
    localProcessing: {
      enabled: true,
      capabilities: ['text_generation', 'template_response'],
    },
  },
  defaultProvider: 'zhipu',
  defaultModel: 'glm-4.6',
  globalTimeout: 90000, // 增加到90秒，给更充足的处理时间
  enableMetrics: true,
};

// =============================================================================
// 开发环境配置
// =============================================================================

export const DEVELOPMENT_AI_CONFIG: AIServiceConfig = {
  ...DEFAULT_AI_SERVICE_CONFIG,
  clients: DEFAULT_AI_SERVICE_CONFIG.clients.map(client => ({
    ...client,
    timeout: 30000, // 开发环境使用30秒超时
  })),
  loadBalancer: {
    ...DEFAULT_AI_SERVICE_CONFIG.loadBalancer,
    healthCheckInterval: 10000, // 10秒
    healthCheckTimeout: 2000, // 2秒
  },
  monitor: {
    ...DEFAULT_AI_SERVICE_CONFIG.monitor,
    logLevel: 'debug',
    metricsInterval: 30000, // 30秒
  },
  fallback: {
    ...DEFAULT_AI_SERVICE_CONFIG.fallback,
    localProcessing: {
      ...DEFAULT_AI_SERVICE_CONFIG.fallback.localProcessing,
      enabled: true, // 开发时启用本地处理
    },
  },
};

// =============================================================================
// 生产环境配置
// =============================================================================

export const PRODUCTION_AI_CONFIG: AIServiceConfig = {
  ...DEFAULT_AI_SERVICE_CONFIG,
  clients: DEFAULT_AI_SERVICE_CONFIG.clients.map(client => ({
    ...client,
    timeout: 60000, // 生产环境使用60秒超时
    retryStrategy: {
      ...client.retryStrategy!,
      maxAttempts: 5, // 生产环境更多重试
    },
  })),
  loadBalancer: {
    ...DEFAULT_AI_SERVICE_CONFIG.loadBalancer,
    healthCheckInterval: 15000, // 15秒
    failureThreshold: 5, // 生产环境更严格的失败阈值
  },
  monitor: {
    ...DEFAULT_AI_SERVICE_CONFIG.monitor,
    logLevel: 'warn', // 生产环境只记录警告和错误
    persistMetrics: true,
    alertThresholds: {
      ...DEFAULT_AI_SERVICE_CONFIG.monitor.alertThresholds!,
      responseTime: 5000, // 更严格的响应时间要求
      errorRate: 0.05, // 5%错误率阈值
    },
  },
  fallback: {
    ...DEFAULT_AI_SERVICE_CONFIG.fallback,
    strategies: [
      {
        priority: 1,
        condition: 'provider_error',
        action: 'switch_provider',
      },
      {
        priority: 2,
        condition: 'rate_limit',
        action: 'switch_provider',
      },
      {
        priority: 3,
        condition: 'timeout',
        action: 'switch_provider',
      },
      {
        priority: 4,
        condition: 'all_providers_down',
        action: 'use_cache',
      },
      {
        priority: 5,
        condition: 'all_providers_down',
        action: 'local_processing',
      },
      {
        priority: 6,
        condition: 'provider_error',
        action: 'return_error',
      },
    ],
  },
  enableMetrics: true,
};

// =============================================================================
// 准确性测试环境配置（使用真实API）
// =============================================================================

export const ACCURACY_TEST_AI_CONFIG: AIServiceConfig = {
  ...DEFAULT_AI_SERVICE_CONFIG,
  clients: [
    {
      provider: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
      timeout: 60000, // 准确性测试使用较长超时时间
      retryStrategy: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['timeout_error', 'network_error', 'rate_limit_error'],
      },
    },
    {
      provider: 'zhipu',
      apiKey: process.env.ZHIPUAI_API_KEY || process.env.ZHIPU_API_KEY || '',
      baseURL:
        process.env.ZHIPUAI_BASE_URL ||
        process.env.ZHIPU_BASE_URL ||
        'https://open.bigmodel.cn/api/paas/v4/',
      timeout: 45000,
      retryStrategy: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: [
          'timeout_error',
          'network_error',
          'rate_limit_error',
          'api_error',
        ],
      },
    },
  ],
  loadBalancer: {
    strategy: 'weighted_round_robin',
    healthCheckInterval: 60000, // 准确性测试降低检查频率
    healthCheckTimeout: 10000,
    failureThreshold: 5,
    recoveryThreshold: 3,
    weights: {
      zhipu: 0.3,
      deepseek: 0.7,
      openai: 0.0,
    },
    roundRobin: false,
  },
  monitor: {
    enabled: true,
    metricsInterval: 60000,
    logLevel: 'info',
    persistMetrics: false,
    alertThresholds: {
      responseTime: 30000,
      errorRate: 0.2,
      rateLimitHits: 10,
      queueLength: 100,
    },
  },
  fallback: {
    enabled: false, // 准确性测试禁用降级，确保使用真实API
    strategies: [],
    cacheFallback: {
      enabled: false,
      ttl: 300,
      maxAge: 3600,
    },
    simplifiedMode: {
      enabled: false,
      maxTokens: 1000,
      simplifiedPrompts: false,
    },
    localProcessing: {
      enabled: false,
      capabilities: [],
    },
  },
  defaultProvider: 'deepseek',
  defaultModel: 'deepseek-chat',
  globalTimeout: 90000,
  enableMetrics: false,
};

// =============================================================================
// 测试环境配置
// =============================================================================

export const TEST_AI_CONFIG: AIServiceConfig = {
  ...DEFAULT_AI_SERVICE_CONFIG,
  clients: [
    {
      provider: 'zhipu',
      apiKey: 'test-key',
      baseURL: 'http://localhost:3000/mock/zhipu',
      timeout: 5000,
      retryStrategy: {
        maxAttempts: 1,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: false,
        retryableErrors: [],
      },
    },
  ],
  loadBalancer: {
    strategy: 'round_robin',
    healthCheckInterval: 5000,
    healthCheckTimeout: 1000,
    failureThreshold: 1,
    recoveryThreshold: 1,
    roundRobin: true,
  },
  monitor: {
    enabled: false, // 测试时禁用监控
    logLevel: 'error',
    persistMetrics: false,
    metricsInterval: 60000, // 添加缺少的metricsInterval属性
  },
  fallback: {
    enabled: true,
    strategies: [
      {
        priority: 1,
        condition: 'provider_error',
        action: 'local_processing',
      },
    ],
    cacheFallback: {
      enabled: true,
      ttl: 60,
      maxAge: 300,
    },
    simplifiedMode: {
      enabled: true,
      maxTokens: 500,
      simplifiedPrompts: true,
    },
    localProcessing: {
      enabled: true,
      capabilities: ['text_generation', 'template_response'],
    },
  },
  defaultProvider: 'zhipu',
  defaultModel: 'test-model',
  globalTimeout: 10000,
  enableMetrics: false,
};

// =============================================================================
// 配置选择器
// =============================================================================

export function getAIConfig(useRealAPI: boolean = false): AIServiceConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // 检查环境变量 USE_REAL_AI 是否设置为 true
  const useRealAIEnv = process.env.USE_REAL_AI === 'true';

  // 如果明确指定使用真实API（准确性测试）或通过环境变量设置
  if (useRealAPI || useRealAIEnv) {
    return ACCURACY_TEST_AI_CONFIG;
  }

  switch (nodeEnv) {
    case 'production':
      return PRODUCTION_AI_CONFIG;
    case 'test':
      return TEST_AI_CONFIG;
    case 'development':
    default:
      return DEVELOPMENT_AI_CONFIG;
  }
}

// =============================================================================
// 环境变量验证
// =============================================================================

export function validateAIConfig(): { valid: boolean; errors: string[] } {
  const config = getAIConfig();
  const errors: string[] = [];

  // 验证必需的API密钥
  for (const client of config.clients) {
    if (!client.apiKey) {
      errors.push(`API key is required for provider: ${client.provider}`);
    }
  }

  // 验证负载均衡配置
  if (config.loadBalancer.weights) {
    const totalWeight = Object.values(config.loadBalancer.weights).reduce(
      (sum, weight) => sum + weight,
      0
    );
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      errors.push(
        `Load balancer weights must sum to 1.0, current sum: ${totalWeight}`
      );
    }
  }

  // 验证默认提供商
  const availableProviders = config.clients.map(client => client.provider);
  if (
    config.defaultProvider &&
    !availableProviders.includes(config.defaultProvider)
  ) {
    errors.push(
      `Default provider ${config.defaultProvider} is not configured in clients`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// 提供商特定配置
// =============================================================================

export const PROVIDER_CONFIGS = {
  zhipu: {
    defaultModels: {
      chat: 'glm-4-flash',
      embedding: 'embedding-2',
    },
    supportedModels: [
      'glm-4-flash',
      'glm-4',
      'glm-3-turbo',
      'embedding-2',
      'embedding-3',
    ],
    rateLimits: {
      requestsPerSecond: 10,
      requestsPerMinute: 100,
      tokensPerMinute: 60000,
      tokensPerDay: 1000000,
    },
  },
  deepseek: {
    defaultModels: {
      chat: 'deepseek-chat',
      embedding: 'deepseek-chat',
    },
    supportedModels: ['deepseek-chat', 'deepseek-coder'],
    rateLimits: {
      requestsPerSecond: 5,
      requestsPerMinute: 50,
      tokensPerMinute: 40000,
      tokensPerDay: 800000,
    },
  },
  openai: {
    defaultModels: {
      chat: 'gpt-3.5-turbo',
      embedding: 'text-embedding-ada-002',
    },
    supportedModels: [
      'gpt-3.5-turbo',
      'gpt-4',
      'gpt-4-turbo',
      'text-embedding-ada-002',
      'text-embedding-3-small',
      'text-embedding-3-large',
    ],
    rateLimits: {
      requestsPerSecond: 3,
      requestsPerMinute: 200,
      tokensPerMinute: 90000,
      tokensPerDay: 1000000,
    },
  },
};

// =============================================================================
// 工具函数
// =============================================================================

export function getProviderConfig(
  provider: AIProvider
): (typeof PROVIDER_CONFIGS)[AIProvider] {
  return PROVIDER_CONFIGS[provider];
}

export function getDefaultModel(
  provider: AIProvider,
  type: 'chat' | 'embedding'
): string {
  const config = getProviderConfig(provider);
  const model = config.defaultModels[type];

  if (!model) {
    throw new Error(`Provider ${provider} does not support ${type} models`);
  }

  return model;
}

export function isModelSupported(provider: AIProvider, model: string): boolean {
  const config = getProviderConfig(provider);
  return config.supportedModels.includes(model);
}

export function validateModel(provider: AIProvider, model: string): boolean {
  try {
    return isModelSupported(provider, model);
  } catch {
    return false;
  }
}

// =============================================================================
// 默认导出
// =============================================================================

const aiConfigExport = {
  DEFAULT_AI_SERVICE_CONFIG,
  DEVELOPMENT_AI_CONFIG,
  PRODUCTION_AI_CONFIG,
  TEST_AI_CONFIG,
  getAIConfig,
  validateAIConfig,
  PROVIDER_CONFIGS,
  getProviderConfig,
  getDefaultModel,
  isModelSupported,
  validateModel,
};

export default aiConfigExport;
