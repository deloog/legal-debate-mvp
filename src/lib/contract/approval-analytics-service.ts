/**
 * 审批效率分析服务
 * 提供审批流程的效率统计、瓶颈检测和优化建议
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// ==================== 类型定义 ====================

/** 步骤级别的效率统计 */
export interface StepAnalytics {
  approverRole: string;
  avgProcessingTimeHours: number;
  totalProcessed: number;
  approveRate: number;
  rejectRate: number;
}

/** 瓶颈信息 */
export interface BottleneckInfo {
  approverRole: string;
  avgProcessingTimeHours: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
}

/** 整体审批效率分析 */
export interface ApprovalAnalytics {
  period: {
    start: Date;
    end: Date;
  };
  totalApprovals: number;
  completedApprovals: number;
  avgCompletionTimeHours: number;
  approvalPassRate: number;
  stepAnalytics: StepAnalytics[];
  bottlenecks: BottleneckInfo[];
  suggestions: string[];
}

/** 查询过滤条件 */
export interface AnalyticsFilter {
  startDate?: Date;
  endDate?: Date;
  contractId?: string;
}

// ==================== 辅助类型（来自 Prisma 结果） ====================

interface ApprovalStepRecord {
  id: string;
  approverRole: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

interface ContractApprovalRecord {
  id: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  steps: ApprovalStepRecord[];
}

// ==================== 服务实现 ====================

export class ApprovalAnalyticsService {
  /**
   * 获取指定时间段内的审批效率分析
   * 使用审批记录中内嵌的步骤数据，避免额外的数据库查询
   */
  async getApprovalAnalytics(
    filter: AnalyticsFilter = {}
  ): Promise<ApprovalAnalytics> {
    const { startDate, endDate } = filter;

    const approvals = await this._fetchApprovals(filter);

    const totalApprovals = approvals.length;
    const completedApprovals = approvals.filter(
      a => a.status === 'APPROVED' || a.status === 'REJECTED'
    );

    const avgCompletionTimeHours =
      this._calcAvgCompletionTime(completedApprovals);
    const approvalPassRate = this._calcPassRate(completedApprovals);

    // 从已加载的审批记录中提取步骤数据，避免额外的数据库查询
    const allEmbeddedSteps: ApprovalStepRecord[] = approvals.flatMap(
      a => a.steps ?? []
    );
    const stepAnalytics = this._calcStepAnalyticsFromSteps(allEmbeddedSteps);
    const bottlenecks = this._detectBottlenecksFromStepAnalytics(stepAnalytics);
    const suggestions = this.generateOptimizationSuggestions({
      period: {
        start: startDate ?? new Date(0),
        end: endDate ?? new Date(),
      },
      totalApprovals,
      completedApprovals: completedApprovals.length,
      avgCompletionTimeHours,
      approvalPassRate,
      stepAnalytics,
      bottlenecks,
      suggestions: [],
    });

    return {
      period: {
        start: startDate ?? new Date(0),
        end: endDate ?? new Date(),
      },
      totalApprovals,
      completedApprovals: completedApprovals.length,
      avgCompletionTimeHours,
      approvalPassRate,
      stepAnalytics,
      bottlenecks,
      suggestions,
    };
  }

  /**
   * 获取各审批角色的步骤级别统计（独立查询，适用于专项分析）
   */
  async getStepAnalytics(
    filter: AnalyticsFilter = {}
  ): Promise<StepAnalytics[]> {
    const steps = await this._fetchSteps(filter);
    return this._calcStepAnalyticsFromSteps(steps);
  }

  /**
   * 检测审批流程中的瓶颈（独立查询）
   */
  async detectBottlenecks(
    filter: AnalyticsFilter = {}
  ): Promise<BottleneckInfo[]> {
    const stepAnalytics = await this.getStepAnalytics(filter);
    return this._detectBottlenecksFromStepAnalytics(stepAnalytics);
  }

  /**
   * 生成优化建议
   */
  generateOptimizationSuggestions(analytics: ApprovalAnalytics): string[] {
    const suggestions: string[] = [];

    // 1. 瓶颈角色建议
    for (const bottleneck of analytics.bottlenecks) {
      if (
        bottleneck.severity === 'critical' ||
        bottleneck.severity === 'high'
      ) {
        suggestions.push(
          `【审批瓶颈】${bottleneck.approverRole} 平均处理时间 ${Math.round(bottleneck.avgProcessingTimeHours)} 小时，` +
            `建议：${bottleneck.suggestion}`
        );
      }
    }

    // 2. 通过率相关建议
    if (analytics.approvalPassRate < 0.5 && analytics.completedApprovals > 5) {
      suggestions.push(
        `【通过率偏低】当前审批通过率 ${Math.round(analytics.approvalPassRate * 100)}%，` +
          `建议优化提交前的自检标准，或明确审批不通过的具体原因`
      );
    }

    // 3. 平均完成时间建议
    if (
      analytics.avgCompletionTimeHours > 72 &&
      analytics.completedApprovals > 0
    ) {
      suggestions.push(
        `【效率优化】平均审批周期 ${Math.round(analytics.avgCompletionTimeHours)} 小时，超过3天，` +
          `建议引入并行审批或设置审批超时提醒`
      );
    }

    // 4. 并行审批建议（当有多个串行步骤且各步骤时间不长时）
    const longSerialSteps = analytics.stepAnalytics.filter(
      s => s.avgProcessingTimeHours > 24 && s.totalProcessed > 3
    );
    if (longSerialSteps.length >= 2) {
      suggestions.push(
        `【并行优化】发现 ${longSerialSteps.length} 个步骤平均处理时间超过24小时，` +
          `建议评估是否可以改为并行审批以缩短总周期`
      );
    }

    // 5. 正向反馈（效率良好时）
    if (
      analytics.approvalPassRate >= 0.9 &&
      analytics.avgCompletionTimeHours <= 24 &&
      analytics.completedApprovals > 0
    ) {
      suggestions.push(
        `【流程健康】当前审批流程通过率 ${Math.round(analytics.approvalPassRate * 100)}%，` +
          `平均周期 ${Math.round(analytics.avgCompletionTimeHours)} 小时，运行状态良好`
      );
    }

    return suggestions;
  }

  /**
   * 生成完整的分析报告
   */
  async generateAnalyticsReport(
    filter: AnalyticsFilter = {}
  ): Promise<ApprovalAnalytics> {
    logger.info('生成审批分析报告', { filter });
    return this.getApprovalAnalytics(filter);
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 从步骤记录列表计算各角色统计（内部公共逻辑）
   */
  private _calcStepAnalyticsFromSteps(
    steps: ApprovalStepRecord[]
  ): StepAnalytics[] {
    // 按角色分组
    const roleMap = new Map<string, ApprovalStepRecord[]>();
    for (const step of steps) {
      const existing = roleMap.get(step.approverRole) ?? [];
      existing.push(step);
      roleMap.set(step.approverRole, existing);
    }

    const result: StepAnalytics[] = [];
    for (const [role, roleSteps] of roleMap.entries()) {
      // 只统计已完成的步骤
      const completedSteps = roleSteps.filter(s => s.completedAt !== null);
      const approvedSteps = completedSteps.filter(s => s.status === 'APPROVED');
      const rejectedSteps = completedSteps.filter(s => s.status === 'REJECTED');

      const totalProcessed = completedSteps.length;
      const approveRate =
        totalProcessed > 0 ? approvedSteps.length / totalProcessed : 0;
      const rejectRate =
        totalProcessed > 0 ? rejectedSteps.length / totalProcessed : 0;

      const avgProcessingTimeHours = this._calcAvgStepTime(completedSteps);

      result.push({
        approverRole: role,
        avgProcessingTimeHours,
        totalProcessed,
        approveRate,
        rejectRate,
      });
    }

    // 按处理时长降序排列（慢的在前）
    return result.sort(
      (a, b) => b.avgProcessingTimeHours - a.avgProcessingTimeHours
    );
  }

  /**
   * 从已计算的步骤分析数据中检测瓶颈（避免重复 DB 查询）
   */
  private _detectBottlenecksFromStepAnalytics(
    stepAnalytics: StepAnalytics[]
  ): BottleneckInfo[] {
    if (stepAnalytics.length === 0) return [];

    // 计算平均处理时长，用于对比
    const avgTime =
      stepAnalytics.reduce((sum, s) => sum + s.avgProcessingTimeHours, 0) /
      stepAnalytics.length;

    return stepAnalytics
      .filter(s => s.totalProcessed > 0) // 至少有1次处理记录
      .map(s => {
        const severity = this._calcBottleneckSeverity(
          s.avgProcessingTimeHours,
          avgTime
        );
        const suggestion = this._generateBottleneckSuggestion(s, severity);
        return {
          approverRole: s.approverRole,
          avgProcessingTimeHours: s.avgProcessingTimeHours,
          severity,
          suggestion,
        };
      })
      .filter(b => b.severity !== 'low') // 只返回中级以上的瓶颈
      .sort((a, b) => b.avgProcessingTimeHours - a.avgProcessingTimeHours);
  }

  private async _fetchApprovals(
    filter: AnalyticsFilter
  ): Promise<ContractApprovalRecord[]> {
    const where: Record<string, unknown> = {};

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.startDate) dateFilter.gte = filter.startDate;
      if (filter.endDate) dateFilter.lte = filter.endDate;
      where.createdAt = dateFilter;
    }

    if (filter.contractId) {
      where.contractId = filter.contractId;
    }

    return prisma.contractApproval.findMany({
      where,
      include: {
        steps: {
          select: {
            id: true,
            approverRole: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ContractApprovalRecord[]>;
  }

  private async _fetchSteps(
    filter: AnalyticsFilter
  ): Promise<ApprovalStepRecord[]> {
    const where: Record<string, unknown> = {};

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.startDate) dateFilter.gte = filter.startDate;
      if (filter.endDate) dateFilter.lte = filter.endDate;
      where.createdAt = dateFilter;
    }

    return prisma.approvalStep.findMany({
      where,
      select: {
        id: true,
        approverRole: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ApprovalStepRecord[]>;
  }

  private _calcAvgCompletionTime(
    completedApprovals: ContractApprovalRecord[]
  ): number {
    const withTime = completedApprovals.filter(
      a => a.completedAt !== null && a.createdAt
    );
    if (withTime.length === 0) return 0;

    const totalMs = withTime.reduce((sum, a) => {
      const diff =
        new Date(a.completedAt!).getTime() - new Date(a.createdAt).getTime();
      return sum + diff;
    }, 0);

    return totalMs / withTime.length / 3_600_000; // 转换为小时
  }

  private _calcPassRate(completedApprovals: ContractApprovalRecord[]): number {
    if (completedApprovals.length === 0) return 0;
    const approved = completedApprovals.filter(a => a.status === 'APPROVED');
    return approved.length / completedApprovals.length;
  }

  private _calcAvgStepTime(completedSteps: ApprovalStepRecord[]): number {
    const withTime = completedSteps.filter(s => s.completedAt !== null);
    if (withTime.length === 0) return 0;

    const totalMs = withTime.reduce((sum, s) => {
      const diff =
        new Date(s.completedAt!).getTime() - new Date(s.createdAt).getTime();
      return sum + diff;
    }, 0);

    return totalMs / withTime.length / 3_600_000;
  }

  /**
   * 计算瓶颈严重程度
   * - critical: 处理时间超过平均的 3 倍或超过 72 小时
   * - high: 超过平均的 2 倍或超过 48 小时
   * - medium: 超过平均的 1.5 倍或超过 24 小时
   * - low: 其他
   */
  private _calcBottleneckSeverity(
    avgHours: number,
    overallAvgHours: number
  ): BottleneckInfo['severity'] {
    const ratio = overallAvgHours > 0 ? avgHours / overallAvgHours : 1;

    if (avgHours >= 72 || ratio >= 3) return 'critical';
    if (avgHours >= 48 || ratio >= 2) return 'high';
    if (avgHours >= 24 || ratio >= 1.5) return 'medium';
    return 'low';
  }

  private _generateBottleneckSuggestion(
    step: StepAnalytics,
    severity: BottleneckInfo['severity']
  ): string {
    if (severity === 'critical') {
      return `${step.approverRole} 严重滞后，建议委托审批权限或增加审批人`;
    }
    if (severity === 'high') {
      return `建议为 ${step.approverRole} 设置审批超时提醒（建议24小时）`;
    }
    return `建议优化 ${step.approverRole} 的审批流程，或考虑并行处理`;
  }
}

// 导出单例
export const approvalAnalyticsService = new ApprovalAnalyticsService();
