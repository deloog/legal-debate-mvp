/**
 * 使用量记录兼容门面
 * 统一复用 membership/usage-tracker 的实现，避免两套逻辑继续漂移
 */

export type {
  RecordUsageParams,
  UsageHistoryOptions,
  UsageStats,
  UsageType,
} from '@/lib/membership/usage-tracker';

export {
  batchRecordUsage,
  checkUsageLimit,
  getUsageHistory,
  getUsageStats,
  recordUsage,
} from '@/lib/membership/usage-tracker';
