/**
 * AI检测器配置
 *
 * 功能：
 * 1. 批处理配置
 * 2. 降级策略
 * 3. 质量控制
 */

/**
 * AI检测器配置
 */
export const AI_DETECTOR_CONFIG = {
  // 批处理配置
  maxBatchSize: 5, // 单次批量处理的最大法条数
  maxDailyRequests: 1000, // 每日最大API调用次数
  maxCostPerDay: 100, // 每日最大成本（美元）

  // 降级策略
  fallbackToRuleBasedOnError: true, // AI服务失败时降级到规则匹配
  retryAttempts: 2, // 重试次数
  retryDelay: 1000, // 重试延迟（毫秒）

  // 质量控制
  minConfidenceThreshold: 0.6, // 最小置信度阈值
  maxTextLength: 2000, // 单个法条截取长度

  // AI模型配置
  model: 'gpt-4', // 使用的AI模型
  temperature: 0.3, // 温度参数（0-1，越低越确定）
  maxTokens: 500, // 最大token数
} as const;

/**
 * AI检测器配置类型
 */
export type AIDetectorConfig = typeof AI_DETECTOR_CONFIG;
