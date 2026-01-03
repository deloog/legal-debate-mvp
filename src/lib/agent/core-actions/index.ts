/**
 * 核心原子函数模块入口
 * 统一导出所有子模块的函数
 */

// 文本操作函数
export {
  analyze_text,
  classify_content,
  generate_summary,
} from "./text-analysis";
export { extract_entities } from "./entity-extraction";

// 数据操作函数
export { validate_data } from "./data-validation";
export { filter_data } from "./data-filter";
export { rank_items } from "./data-rank";
export { merge_results } from "./data-merge";
export { compare_versions } from "./version-compare";

// AI操作函数
export { call_ai_service, search_database } from "./ai-operations";

// 格式操作函数
export { transform_format, format_transform } from "./format-operations";

// 缓存操作函数
export { cache_result } from "./cache-operations";

// 日志操作函数
export { log_action, verify_output, handle_error } from "./logging-operations";

// 重试操作函数
export { retry_operation } from "./retry-operations";

// 记忆操作函数
export { update_memory } from "./memory-operations";

// 导出类型
export type {
  TextAnalysisResult,
  EntityExtractionResult,
  ClassificationResult,
  DatabaseSearchResult,
  AIServiceCallResult,
  ValidationResult,
  FormatTransformResult,
  CacheResult,
  LogActionResult,
  VerifyOutputResult,
  HandleErrorResult,
  RetryOperationResult,
  MergeResultsResult,
  FilterDataResult,
  RankItemsResult,
  GenerateSummaryResult,
  CompareVersionsResult,
  UpdateMemoryResult,
  DatabaseSearchParams,
  AIServiceCallParams,
  ValidationRule,
  HandleErrorParams,
  RetryOperationParams,
  MergeResultsParams,
  GenerateSummaryParams,
} from "./types";
