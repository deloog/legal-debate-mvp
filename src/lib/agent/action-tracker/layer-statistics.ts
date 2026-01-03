/**
 * LayerStatistics - 分层统计器
 *
 * 负责分析Agent行动的层级分布和健康度
 */

import { prisma } from "@/lib/db/prisma";
import { ActionStatus, ActionLayer } from "@prisma/client";
import type { LayerMetrics, LayerReport, PerformanceFilters } from "./types";

/**
 * 分层统计器类
 */
export class LayerStatistics {
  /**
   * 获取分层报告
   * @param filters 过滤条件
   * @returns 分层报告
   */
  async getLayerReport(filters: PerformanceFilters = {}): Promise<LayerReport> {
    const coreLayer = await this.getLayerMetrics(ActionLayer.CORE, filters);
    const utilityLayer = await this.getLayerMetrics(
      ActionLayer.UTILITY,
      filters,
    );
    const scriptLayer = await this.getLayerMetrics(ActionLayer.SCRIPT, filters);

    // 计算总体统计
    const totalCount = coreLayer.count + utilityLayer.count + scriptLayer.count;
    const corePercentage =
      totalCount > 0 ? (coreLayer.count / totalCount) * 100 : 0;
    const utilityPercentage =
      totalCount > 0 ? (utilityLayer.count / totalCount) * 100 : 0;
    const scriptPercentage =
      totalCount > 0 ? (scriptLayer.count / totalCount) * 100 : 0;

    // 更新占比
    coreLayer.percentage = corePercentage;
    utilityLayer.percentage = utilityPercentage;
    scriptLayer.percentage = scriptPercentage;

    // 计算对比指标
    const coreVsUtilityRatio =
      utilityLayer.avgExecutionTime > 0
        ? coreLayer.avgExecutionTime / utilityLayer.avgExecutionTime
        : 1;
    const utilityVsScriptRatio =
      scriptLayer.avgExecutionTime > 0
        ? utilityLayer.avgExecutionTime / scriptLayer.avgExecutionTime
        : 1;

    // 计算健康度（0-1）
    const healthScore = this.calculateHealthScore(
      coreLayer,
      utilityLayer,
      scriptLayer,
    );

    return {
      generatedAt: new Date(),
      coreLayer,
      utilityLayer,
      scriptLayer,
      comparison: {
        coreVsUtilityRatio,
        utilityVsScriptRatio,
        healthScore,
      },
    };
  }

  /**
   * 获取层级指标
   * @param layer 行动层级
   * @param filters 过滤条件
   * @returns 层级指标
   */
  async getLayerMetrics(
    layer: ActionLayer,
    filters: PerformanceFilters = {},
  ): Promise<LayerMetrics> {
    const where = {
      ...this.buildWhereClause(filters),
      actionLayer: layer,
    };

    // 统计总数
    const count = await prisma.agentAction.count({ where });

    // 统计完成的行动
    const completedWhere = { ...where, status: ActionStatus.COMPLETED };
    const completed = await prisma.agentAction.aggregate({
      where: completedWhere,
      _avg: {
        executionTime: true,
      },
      _count: true,
    });

    // 统计成功率
    const successCount = completed._count;
    const successRate = count > 0 ? successCount / count : 1;

    // 获取唯一行动数
    const uniqueActions = await prisma.agentAction.groupBy({
      by: ["actionName"],
      where,
    });

    // 获取最常用的行动
    const topActionsResult = await prisma.agentAction.groupBy({
      by: ["actionName"],
      where,
      _count: true,
      orderBy: {
        _count: {
          actionName: "desc",
        },
      },
      take: 5,
    });

    const topActions = topActionsResult.map((item) => ({
      actionName: item.actionName,
      count: item._count,
    }));

    return {
      count,
      avgExecutionTime: completed._avg.executionTime ?? 0,
      successRate,
      percentage: 0, // 在getLayerReport中计算
      uniqueActions: uniqueActions.length,
      topActions,
    };
  }

  /**
   * 计算健康度
   * @param coreLayer Core层指标
   * @param utilityLayer Utility层指标
   * @param scriptLayer Script层指标
   * @returns 健康度（0-1）
   */
  private calculateHealthScore(
    coreLayer: LayerMetrics,
    utilityLayer: LayerMetrics,
    scriptLayer: LayerMetrics,
  ): number {
    // 健康度计算基于：
    // 1. 整体成功率（权重0.4）
    // 2. 层级分布合理性（权重0.3）
    // 3. 平均执行时间的合理性（权重0.3）

    const avgSuccessRate =
      (coreLayer.successRate +
        utilityLayer.successRate +
        scriptLayer.successRate) /
      3;

    // 层级分布合理性：Core应该最多，Script应该最少
    const totalCount = coreLayer.count + utilityLayer.count + scriptLayer.count;
    let distributionScore = 0;
    if (totalCount > 0) {
      const coreRatio = coreLayer.count / totalCount;
      const scriptRatio = scriptLayer.count / totalCount;

      // Core占比应该在40%-60%之间
      if (coreRatio >= 0.4 && coreRatio <= 0.6) {
        distributionScore += 0.5;
      } else if (coreRatio > 0.3 && coreRatio < 0.7) {
        distributionScore += 0.3;
      }

      // Script占比应该在20%-40%之间
      if (scriptRatio >= 0.2 && scriptRatio <= 0.4) {
        distributionScore += 0.5;
      } else if (scriptRatio > 0.1 && scriptRatio < 0.5) {
        distributionScore += 0.3;
      }
    }

    // 平均执行时间合理性：Core < Utility < Script
    let executionScore = 0;
    if (
      coreLayer.avgExecutionTime < utilityLayer.avgExecutionTime &&
      utilityLayer.avgExecutionTime < scriptLayer.avgExecutionTime
    ) {
      executionScore = 1;
    } else if (
      coreLayer.avgExecutionTime <= utilityLayer.avgExecutionTime &&
      utilityLayer.avgExecutionTime <= scriptLayer.avgExecutionTime
    ) {
      executionScore = 0.5;
    }

    // 加权计算
    return (
      avgSuccessRate * 0.4 + distributionScore * 0.3 + executionScore * 0.3
    );
  }

  /**
   * 构建where子句
   * @param filters 过滤条件
   * @returns Prisma where子句
   */
  private buildWhereClause(
    filters: PerformanceFilters,
  ): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (filters.agentName) {
      where.agentName = filters.agentName;
    }
    if (filters.actionName) {
      where.actionName = filters.actionName;
    }
    if (filters.actionType) {
      where.actionType = filters.actionType;
    }
    if (filters.caseId) {
      where.caseId = filters.caseId;
    }
    if (filters.debateId) {
      where.debateId = filters.debateId;
    }
    if (filters.startTime || filters.endTime) {
      where.updatedAt = {};
      if (filters.startTime) {
        (where.updatedAt as Record<string, Date>).gte = filters.startTime;
      }
      if (filters.endTime) {
        (where.updatedAt as Record<string, Date>).lte = filters.endTime;
      }
    }

    return where;
  }
}

/**
 * 单例实例
 */
export const layerStatistics = new LayerStatistics();
