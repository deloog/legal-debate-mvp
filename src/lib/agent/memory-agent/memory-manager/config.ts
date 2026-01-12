/**
 * MemoryManager Configuration
 * TTL配置和常量定义
 */

/**
 * TTL配置（秒）
 */
export const TTL_CONFIG = {
  WORKING: 3600, // 1小时
  HOT: 604800, // 7天
  COLD: Number.MAX_SAFE_INTEGER, // 永久
} as const;

/**
 * 默认重要性评分
 */
export const DEFAULT_IMPORTANCE = 0.5;

/**
 * Agent名称常量
 */
export const AGENT_NAME = 'MemoryAgent' as const;
