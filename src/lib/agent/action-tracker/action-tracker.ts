/**
 * ActionTracker - Agent行动追踪系统
 *
 * 核心追踪器，整合所有子模块，提供统一的追踪和分析接口
 */

import { actionLogger } from './action-logger';
import { performanceAnalyzer } from './performance-analyzer';
import { behaviorAnalyzer } from './behavior-analyzer';
import { layerStatistics } from './layer-statistics';
import { DEFAULT_ACTION_TRACKER_CONFIG } from './types';
import type {
  ActionLogInput,
  ActionChain,
  ComprehensiveReport,
  PerformanceReport,
  BehaviorReport,
  LayerReport,
  ReportFilters,
  RealtimeMetrics,
  ActionTrackerConfig,
} from './types';

/**
 * Agent行动追踪器类
 */
export class ActionTracker {
  private config: ActionTrackerConfig;

  constructor(config?: Partial<ActionTrackerConfig>) {
    this.config = { ...DEFAULT_ACTION_TRACKER_CONFIG, ...config };
  }

  /**
   * 更新配置
   * @param config 新配置
   */
  updateConfig(config: Partial<ActionTrackerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   * @returns 当前配置
   */
  getConfig(): ActionTrackerConfig {
    return { ...this.config };
  }

  /**
   * 记录并执行行动（快捷方法）
   * @param input 行动输入
   * @param executeFn 执行函数
   * @returns 执行结果
   */
  async trackAction<T>(
    input: ActionLogInput,
    executeFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.autoTrackingEnabled) {
      return executeFn();
    }
    return actionLogger.logAction(input, executeFn);
  }

  /**
   * 构建行动链
   * @param rootActionId 根行动ID
   * @returns 行动链
   */
  async buildActionChain(rootActionId: string): Promise<ActionChain> {
    return actionLogger.buildActionChain(rootActionId);
  }

  /**
   * 生成性能报告
   * @param filters 过滤条件
   * @returns 性能报告
   */
  async generatePerformanceReport(
    filters = {} as Partial<ReportFilters>
  ): Promise<PerformanceReport> {
    return performanceAnalyzer.getPerformanceReport(filters);
  }

  /**
   * 生成行为报告
   * @param filters 过滤条件
   * @returns 行为报告
   */
  async generateBehaviorReport(
    filters = {} as Partial<ReportFilters>
  ): Promise<BehaviorReport> {
    return behaviorAnalyzer.getBehaviorReport(filters);
  }

  /**
   * 生成分层报告
   * @param filters 过滤条件
   * @returns 分层报告
   */
  async generateLayerReport(
    filters = {} as Partial<ReportFilters>
  ): Promise<LayerReport> {
    return layerStatistics.getLayerReport(filters);
  }

  /**
   * 生成综合报告
   * @param filters 过滤条件
   * @returns 综合报告
   */
  async generateComprehensiveReport(
    filters: ReportFilters = {}
  ): Promise<ComprehensiveReport> {
    const performanceReport = filters.includePerformance
      ? await this.generatePerformanceReport(filters)
      : undefined;
    const behaviorReport = filters.includeBehavior
      ? await this.generateBehaviorReport(filters)
      : undefined;
    const layerReport = filters.includeLayers
      ? await this.generateLayerReport(filters)
      : undefined;

    // 生成总体摘要
    const summary = await this.generateSummary(filters);

    return {
      generatedAt: new Date(),
      filters,
      performanceReport,
      behaviorReport,
      layerReport,
      summary,
    };
  }

  /**
   * 获取实时指标
   * @returns 实时指标
   */
  async getRealtimeMetrics(): Promise<RealtimeMetrics> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    // 当前执行中的行动
    const runningActions = await actionLogger
      .queryActions({
        startTime: oneMinuteAgo,
      })
      .then(actions => actions.filter(a => a.status === 'RUNNING'));
    const runningCount = runningActions.length;

    // 最近1分钟的成功行动
    const recentSuccessActions = await actionLogger
      .queryActions({
        startTime: oneMinuteAgo,
      })
      .then(actions => actions.filter(a => a.status === 'COMPLETED'));
    const recentSuccessCount = recentSuccessActions.length;

    // 最近1分钟的失败行动
    const recentFailureActions = await actionLogger
      .queryActions({
        startTime: oneMinuteAgo,
      })
      .then(actions => actions.filter(a => a.status === 'FAILED'));
    const recentFailureCount = recentFailureActions.length;

    // 计算最近1分钟的平均耗时
    const recentCompleted = recentSuccessActions.filter(
      a => a.executionTime !== null
    );
    const recentAvgExecutionTime =
      recentCompleted.length > 0
        ? recentCompleted.reduce((sum, a) => sum + (a.executionTime ?? 0), 0) /
          recentCompleted.length
        : 0;

    // 计算当前错误率
    const recentTotal = recentSuccessCount + recentFailureCount;
    const currentErrorRate =
      recentTotal > 0 ? recentFailureCount / recentTotal : 0;

    // 峰值并发数（简化计算，使用当前运行数）
    const peakConcurrency = runningCount;

    return {
      updatedAt: now,
      runningActions: runningCount,
      recentSuccessCount,
      recentFailureCount,
      recentAvgExecutionTime,
      currentErrorRate,
      peakConcurrency,
    };
  }

  /**
   * 清理过期数据
   * @param retentionDays 保留天数
   * @returns 清理的记录数
   */
  async cleanup(retentionDays?: number): Promise<number> {
    return actionLogger.cleanupOldActions(
      retentionDays ?? this.config.dataRetentionDays
    );
  }

  /**
   * 生成总体摘要
   * @param filters 过滤条件
   * @returns 总体摘要
   */
  private async generateSummary(
    filters = {} as Partial<ReportFilters>
  ): Promise<ComprehensiveReport['summary']> {
    // 构建查询参数（只传递ActionLogger支持的参数）
    const queryFilters: Parameters<typeof actionLogger.queryActions>[0] = {
      agentName: filters.agentName,
      actionName: filters.actionName,
      startTime: filters.startTime,
      endTime: filters.endTime,
    };

    // 获取总行动数
    const allActions = await actionLogger.queryActions(queryFilters);
    const totalActions = allActions.length;

    // 计算平均执行时间
    const completedActions = allActions.filter(a => a.executionTime !== null);
    const avgExecutionTime =
      completedActions.length > 0
        ? completedActions.reduce((sum, a) => sum + (a.executionTime ?? 0), 0) /
          completedActions.length
        : 0;

    // 计算整体成功率
    const successActions = allActions.filter(a => a.status === 'COMPLETED');
    const overallSuccessRate =
      totalActions > 0 ? successActions.length / totalActions : 1;

    // 找出最活跃的Agent
    const agentCounts = new Map<string, number>();
    for (const action of allActions) {
      const current = agentCounts.get(action.agentName) ?? 0;
      agentCounts.set(action.agentName, current + 1);
    }
    const mostActiveAgent =
      Array.from(agentCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      '';

    // 找出最常用的行动
    const actionCounts = new Map<string, number>();
    for (const action of allActions) {
      const current = actionCounts.get(action.actionName) ?? 0;
      actionCounts.set(action.actionName, current + 1);
    }
    const mostUsedAction =
      Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      '';

    // 找出性能瓶颈
    const performanceBottlenecks: string[] = [];
    const avgTimeByAction = new Map<string, number>();
    const countByAction = new Map<string, number>();

    for (const action of completedActions) {
      const time = avgTimeByAction.get(action.actionName) ?? 0;
      const count = countByAction.get(action.actionName) ?? 0;
      avgTimeByAction.set(
        action.actionName,
        time + (action.executionTime ?? 0)
      );
      countByAction.set(action.actionName, count + 1);
    }

    for (const [name, totalTime] of avgTimeByAction.entries()) {
      const count = countByAction.get(name) ?? 0;
      const avgTime = totalTime / count;
      if (avgTime > this.config.inefficientThreshold) {
        performanceBottlenecks.push(name);
      }
    }

    return {
      totalActions,
      avgExecutionTime,
      overallSuccessRate,
      mostActiveAgent,
      mostUsedAction,
      performanceBottlenecks,
    };
  }
}

/**
 * 默认实例
 */
export const actionTracker = new ActionTracker();
