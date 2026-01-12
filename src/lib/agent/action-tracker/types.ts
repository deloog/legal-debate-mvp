/**
 * Agent行动追踪系统类型定义
 *
 * 基于Manus架构的行动空间管理，支持：
 * - Core层：核心原子函数（<20个）
 * - Utility层：实用程序层（组合操作）
 * - Script层：脚本与API层（复杂计算）
 */

import { ActionType, ActionLayer, ActionStatus } from '@prisma/client';

/**
 * 行动记录输入参数
 */
export interface ActionLogInput {
  /** 用户ID（可选） */
  userId?: string;
  /** 案件ID（可选） */
  caseId?: string;
  /** 辩论ID（可选） */
  debateId?: string;
  /** Agent名称 */
  agentName: string;
  /** 行动类型 */
  actionType: ActionType;
  /** 行动名称 */
  actionName: string;
  /** 行动层级 */
  actionLayer: ActionLayer;
  /** 行动参数 */
  parameters: unknown;
  /** 父行动ID（支持行动链） */
  parentActionId?: string;
  /** 子行动ID数组 */
  childActions?: string[];
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 行动记录输出结果
 */
export interface ActionLogOutput {
  /** 行动ID */
  actionId: string;
  /** 记录时间 */
  recordedAt: Date;
  /** 记录状态 */
  status: 'SUCCESS' | 'FAILED';
  /** 错误信息（如果有） */
  error?: string;
}

/**
 * 行动开始记录
 */
export interface ActionStartInput extends Omit<ActionLogInput, 'parameters'> {
  /** 行动参数 */
  parameters: unknown;
  /** 执行开始时间 */
  startedAt: Date;
}

/**
 * 行动完成记录
 */
export interface ActionCompleteInput {
  /** 行动ID */
  actionId: string;
  /** 执行结果 */
  result: unknown;
  /** 执行耗时（毫秒） */
  executionTime: number;
  /** 重试次数 */
  retryCount?: number;
  /** 完成时间 */
  completedAt: Date;
}

/**
 * 行动失败记录
 */
export interface ActionFailedInput {
  /** 行动ID */
  actionId: string;
  /** 错误信息 */
  error: Error;
  /** 执行耗时（毫秒） */
  executionTime: number;
  /** 失败时间 */
  failedAt: Date;
  /** 重试次数 */
  retryCount?: number;
}

/**
 * 性能过滤条件
 */
export interface PerformanceFilters {
  /** Agent名称 */
  agentName?: string;
  /** 行动名称 */
  actionName?: string;
  /** 行动层级 */
  actionLayer?: ActionLayer;
  /** 行动类型 */
  actionType?: ActionType;
  /** 开始时间范围 */
  startTime?: Date;
  /** 结束时间范围 */
  endTime?: Date;
  /** 案件ID */
  caseId?: string;
  /** 辩论ID */
  debateId?: string;
}

/**
 * 性能统计指标
 */
export interface PerformanceMetrics {
  /** 执行次数 */
  count: number;
  /** 平均执行时间（毫秒） */
  avgExecutionTime: number;
  /** 最小执行时间（毫秒） */
  minExecutionTime: number;
  /** 最大执行时间（毫秒） */
  maxExecutionTime: number;
  /** 成功率（0-1） */
  successRate: number;
  /** 错误率（0-1） */
  errorRate: number;
  /** 平均重试次数 */
  avgRetryCount: number;
}

/**
 * 性能报告
 */
export interface PerformanceReport {
  /** 报告生成时间 */
  generatedAt: Date;
  /** 过滤条件 */
  filters: PerformanceFilters;
  /** 总体指标 */
  overallMetrics: PerformanceMetrics;
  /** 按行动名称分组的指标 */
  byActionName: Map<string, PerformanceMetrics>;
  /** 按Agent名称分组的指标 */
  byAgentName: Map<string, PerformanceMetrics>;
  /** 按行动层级分组的指标 */
  byActionLayer: Map<ActionLayer, PerformanceMetrics>;
}

/**
 * 行为过滤条件
 */
export interface BehaviorFilters extends PerformanceFilters {
  /** 最小执行频率 */
  minFrequency?: number;
  /** 最小平均耗时（毫秒） */
  minAvgTime?: number;
  /** 最大平均耗时（毫秒） */
  maxAvgTime?: number;
  /** 最小成功率 */
  minSuccessRate?: number;
}

/**
 * 行为模式
 */
export interface BehaviorPattern {
  /** 行动名称 */
  actionName: string;
  /** 执行次数 */
  frequency: number;
  /** 频率排名 */
  rank: number;
  /** 平均耗时（毫秒） */
  avgExecutionTime: number;
  /** 成功率 */
  successRate: number;
  /** 重试率 */
  retryRate: number;
  /** 是否高效 */
  isEfficient: boolean;
}

/**
 * 低效行动
 */
export interface IneffectiveAction {
  /** 行动名称 */
  actionName: string;
  /** 执行次数 */
  count: number;
  /** 平均耗时（毫秒） */
  avgExecutionTime: number;
  /** 阈值（毫秒） */
  threshold: number;
  /** 超出阈值百分比 */
  exceedPercentage: number;
  /** 建议优化方向 */
  suggestion: string;
}

/**
 * 行为报告
 */
export interface BehaviorReport {
  /** 报告生成时间 */
  generatedAt: Date;
  /** 过滤条件 */
  filters: BehaviorFilters;
  /** 常用路径 */
  commonPaths: {
    path: string[];
    count: number;
    avgExecutionTime: number;
  }[];
  /** 错误模式 */
  errorPatterns: {
    pattern: string;
    count: number;
    lastOccurrence: Date;
  }[];
  /** 层级偏好 */
  layerPreference: Record<string, { count: number; avgExecutionTime: number }>;
  /** 重试模式 */
  retryPatterns: Map<string, number>;
}

/**
 * 分层过滤条件
 */
export interface LayerFilters extends PerformanceFilters {
  /** 行动层级 */
  actionLayer: ActionLayer;
}

/**
 * 分层统计指标
 */
export interface LayerMetrics {
  /** 执行次数 */
  count: number;
  /** 平均执行时间（毫秒） */
  avgExecutionTime: number;
  /** 成功率 */
  successRate: number;
  /** 占比 */
  percentage: number;
  /** 唯一行动数 */
  uniqueActions: number;
  /** 最常用行动 */
  topActions: Array<{ actionName: string; count: number }>;
}

/**
 * 分层报告
 */
export interface LayerReport {
  /** 报告生成时间 */
  generatedAt: Date;
  /** Core层统计 */
  coreLayer: LayerMetrics;
  /** Utility层统计 */
  utilityLayer: LayerMetrics;
  /** Script层统计 */
  scriptLayer: LayerMetrics;
  /** 层级对比 */
  comparison: {
    /** Core vs Utility耗时比 */
    coreVsUtilityRatio: number;
    /** Utility vs Script耗时比 */
    utilityVsScriptRatio: number;
    /** 整体分层健康度（0-1） */
    healthScore: number;
  };
}

/**
 * 综合报告过滤条件
 */
export interface ReportFilters extends BehaviorFilters {
  /** 包含性能分析 */
  includePerformance?: boolean;
  /** 包含行为分析 */
  includeBehavior?: boolean;
  /** 包含分层统计 */
  includeLayers?: boolean;
}

/**
 * 综合报告
 */
export interface ComprehensiveReport {
  /** 报告生成时间 */
  generatedAt: Date;
  /** 过滤条件 */
  filters: ReportFilters;
  /** 性能报告 */
  performanceReport?: PerformanceReport;
  /** 行为报告 */
  behaviorReport?: BehaviorReport;
  /** 分层报告 */
  layerReport?: LayerReport;
  /** 总体摘要 */
  summary: {
    /** 总行动数 */
    totalActions: number;
    /** 平均执行时间 */
    avgExecutionTime: number;
    /** 整体成功率 */
    overallSuccessRate: number;
    /** 最活跃Agent */
    mostActiveAgent: string;
    /** 最常用行动 */
    mostUsedAction: string;
    /** 性能瓶颈 */
    performanceBottlenecks: string[];
  };
}

/**
 * 实时指标
 */
export interface RealtimeMetrics {
  /** 最后更新时间 */
  updatedAt: Date;
  /** 当前执行中的行动数 */
  runningActions: number;
  /** 最近1分钟成功数 */
  recentSuccessCount: number;
  /** 最近1分钟失败数 */
  recentFailureCount: number;
  /** 最近1分钟平均耗时 */
  recentAvgExecutionTime: number;
  /** 当前错误率 */
  currentErrorRate: number;
  /** 峰值并发数 */
  peakConcurrency: number;
}

/**
 * 行动链信息
 */
export interface ActionChain {
  /** 链ID */
  chainId: string;
  /** 根行动ID */
  rootActionId: string;
  /** 行动层级（深度） */
  depth: number;
  /** 链中所有行动 */
  actions: Array<{
    actionId: string;
    actionName: string;
    agentName: string;
    executionTime: number;
    status: ActionStatus;
  }>;
  /** 总执行时间 */
  totalExecutionTime: number;
}

/**
 * ActionTracker配置
 */
export interface ActionTrackerConfig {
  /** 是否启用自动追踪 */
  autoTrackingEnabled: boolean;
  /** 是否启用性能分析 */
  performanceAnalysisEnabled: boolean;
  /** 是否启用行为分析 */
  behaviorAnalysisEnabled: boolean;
  /** 低效行动阈值（毫秒） */
  inefficientThreshold: number;
  /** 实时统计窗口大小（秒） */
  realtimeWindowSize: number;
  /** 数据保留天数 */
  dataRetentionDays: number;
}

/**
 * 默认配置
 */
export const DEFAULT_ACTION_TRACKER_CONFIG: ActionTrackerConfig = {
  autoTrackingEnabled: true,
  performanceAnalysisEnabled: true,
  behaviorAnalysisEnabled: true,
  inefficientThreshold: 5000, // 5秒
  realtimeWindowSize: 60, // 1分钟
  dataRetentionDays: 30, // 30天
};
