/**
 * MemoryMigrator Configuration
 * 迁移配置常量定义
 */

/**
 * 迁移配置
 */
export const MIGRATION_CONFIG = {
  WORKING_TO_HOT_CRON: '0 * * * *', // 每小时
  HOT_TO_COLD_CRON: '0 0 * * *', // 每天
  MAX_MIGRATION_COUNT: 1000, // 单次最大迁移数量
  MIN_ACCESS_COUNT: 3, // 最低访问次数才迁移
} as const;

/**
 * 过滤条件常量
 */
export const FILTER_CONSTANTS = {
  WORKING_EXPIRY_THRESHOLD: 30 * 60 * 1000, // 30分钟（毫秒）
  HOT_EXPIRY_THRESHOLD: 24 * 60 * 60 * 1000, // 24小时（毫秒）
  WORKING_MIN_IMPORTANCE: 0.5, // Working Memory最低重要性
  HOT_MIN_IMPORTANCE: 0.8, // Hot Memory最低重要性
} as const;
