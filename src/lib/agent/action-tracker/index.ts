/**
 * AgentAction追踪系统
 *
 * 基于Manus架构的行动空间管理，提供完整的Agent行动追踪、分析和报告功能
 */

// 类型定义
export type {
  ActionLogInput,
  ActionLogOutput,
  ActionStartInput,
  ActionCompleteInput,
  ActionFailedInput,
  PerformanceFilters,
  PerformanceMetrics,
  PerformanceReport,
  BehaviorFilters,
  BehaviorReport,
  IneffectiveAction,
  LayerFilters,
  LayerMetrics,
  LayerReport,
  ReportFilters,
  ComprehensiveReport,
  RealtimeMetrics,
  ActionChain,
  ActionTrackerConfig,
} from "./types";

export { DEFAULT_ACTION_TRACKER_CONFIG } from "./types";

// ActionLogger - 行动记录器
export { ActionLogger, actionLogger } from "./action-logger";

// PerformanceAnalyzer - 性能分析器
export {
  PerformanceAnalyzer,
  performanceAnalyzer,
} from "./performance-analyzer";

// BehaviorAnalyzer - 行为分析器
export { BehaviorAnalyzer, behaviorAnalyzer } from "./behavior-analyzer";

// LayerStatistics - 分层统计器
export { LayerStatistics, layerStatistics } from "./layer-statistics";

// ActionTracker - 主追踪器
export { ActionTracker, actionTracker } from "./action-tracker";
