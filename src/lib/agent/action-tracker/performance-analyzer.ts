/**
 * PerformanceAnalyzer - 性能分析器
 *
 * 负责分析Agent行动的性能指标，包括平均耗时、成功率、错误率等
 */

import { prisma } from "@/lib/db/prisma";
import { ActionStatus, ActionLayer } from "@prisma/client";
import type {
  PerformanceMetrics,
  PerformanceReport,
  PerformanceFilters,
} from "./types";

/**
 * 性能分析器类
 */
export class PerformanceAnalyzer {
  /**
   * 获取平均执行时间
   * @param filters 过滤条件
   * @returns 平均执行时间（毫秒）
   */
  async getAverageExecutionTime(
    filters: PerformanceFilters = {},
  ): Promise<number> {
    const where = this.buildWhereClause(filters);

    const result = await prisma.agentAction.aggregate({
      where: {
        ...where,
        status: ActionStatus.COMPLETED,
      },
      _avg: {
        executionTime: true,
      },
    });

    return result._avg.executionTime ?? 0;
  }

  /**
   * 获取成功率
   * @param filters 过滤条件
   * @returns 成功率（0-1）
   */
  async getSuccessRate(filters: PerformanceFilters = {}): Promise<number> {
    const where = this.buildWhereClause(filters);

    const total = await prisma.agentAction.count({ where });
    const completed = await prisma.agentAction.count({
      where: {
        ...where,
        status: ActionStatus.COMPLETED,
      },
    });

    return total > 0 ? completed / total : 1.0;
  }

  /**
   * 获取错误率
   * @param filters 过滤条件
   * @returns 错误率（0-1）
   */
  async getErrorRate(filters: PerformanceFilters = {}): Promise<number> {
    return 1.0 - (await this.getSuccessRate(filters));
  }

  /**
   * 获取性能报告
   * @param filters 过滤条件
   * @returns 性能报告
   */
  async getPerformanceReport(
    filters: PerformanceFilters = {},
  ): Promise<PerformanceReport> {
    const overallMetrics = await this.calculateMetrics(filters);

    // 按行动名称分组
    const byActionName = new Map<string, PerformanceMetrics>();
    const actionNames = await this.getUniqueActionNames(filters);
    for (const actionName of actionNames) {
      const metrics = await this.calculateMetrics({
        ...filters,
        actionName,
      });
      byActionName.set(actionName, metrics);
    }

    // 按Agent名称分组
    const byAgentName = new Map<string, PerformanceMetrics>();
    const agentNames = await this.getUniqueAgentNames(filters);
    for (const agentName of agentNames) {
      const metrics = await this.calculateMetrics({
        ...filters,
        agentName,
      });
      byAgentName.set(agentName, metrics);
    }

    // 按行动层级分组
    const byActionLayer = new Map<ActionLayer, PerformanceMetrics>();
    const layers = await this.getUniqueActionLayers(filters);
    for (const layer of layers) {
      const metrics = await this.calculateMetrics({
        ...filters,
        actionLayer: layer,
      });
      if (metrics.count > 0) {
        byActionLayer.set(layer, metrics);
      }
    }

    return {
      generatedAt: new Date(),
      filters,
      overallMetrics,
      byActionName,
      byAgentName,
      byActionLayer,
    };
  }

  /**
   * 比较性能
   * @param filters1 第一个过滤条件
   * @param filters2 第二个过滤条件
   * @returns 性能对比结果
   */
  async comparePerformance(
    filters1: PerformanceFilters,
    filters2: PerformanceFilters,
  ): Promise<{
    metrics1: PerformanceMetrics;
    metrics2: PerformanceMetrics;
    improvement: {
      executionTime: number; // 执行时间改进百分比
      successRate: number; // 成功率改进百分比
      errorRate: number; // 错误率改进百分比
    };
  }> {
    const metrics1 = await this.calculateMetrics(filters1);
    const metrics2 = await this.calculateMetrics(filters2);

    // 计算改进百分比
    const executionTimeImprovement =
      metrics1.avgExecutionTime > 0
        ? ((metrics1.avgExecutionTime - metrics2.avgExecutionTime) /
            metrics1.avgExecutionTime) *
          100
        : 0;

    const successRateImprovement =
      (metrics2.successRate - metrics1.successRate) * 100;
    const errorRateImprovement =
      (metrics1.errorRate - metrics2.errorRate) * 100;

    return {
      metrics1,
      metrics2,
      improvement: {
        executionTime: executionTimeImprovement,
        successRate: successRateImprovement,
        errorRate: errorRateImprovement,
      },
    };
  }

  /**
   * 计算性能指标
   * @param filters 过滤条件
   * @returns 性能指标
   */
  private async calculateMetrics(
    filters: PerformanceFilters,
  ): Promise<PerformanceMetrics> {
    const where = this.buildWhereClause(filters);

    // 总数
    const count = await prisma.agentAction.count({ where });

    // 完成的行动
    const completedWhere = { ...where, status: ActionStatus.COMPLETED };
    const completed = await prisma.agentAction.aggregate({
      where: completedWhere,
      _avg: { executionTime: true, retryCount: true },
      _min: { executionTime: true },
      _max: { executionTime: true },
      _count: true,
    });

    const completedCount = completed._count;
    const successRate = count > 0 ? completedCount / count : 1.0;
    const errorRate = 1.0 - successRate;

    return {
      count,
      avgExecutionTime: completed._avg.executionTime ?? 0,
      minExecutionTime: completed._min.executionTime ?? 0,
      maxExecutionTime: completed._max.executionTime ?? 0,
      successRate,
      errorRate,
      avgRetryCount: completed._avg.retryCount ?? 0,
    };
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

  /**
   * 获取唯一的行动名称列表
   * @param filters 过滤条件
   * @returns 行动名称列表
   */
  private async getUniqueActionNames(
    filters: PerformanceFilters,
  ): Promise<string[]> {
    const actions = await prisma.agentAction.findMany({
      where: this.buildWhereClause(filters),
      select: {
        actionName: true,
      },
      distinct: ["actionName"],
    });

    return actions.map((a) => a.actionName);
  }

  /**
   * 获取唯一的Agent名称列表
   * @param filters 过滤条件
   * @returns Agent名称列表
   */
  private async getUniqueAgentNames(
    filters: PerformanceFilters,
  ): Promise<string[]> {
    const actions = await prisma.agentAction.findMany({
      where: this.buildWhereClause(filters),
      select: {
        agentName: true,
      },
      distinct: ["agentName"],
    });

    return actions.map((a) => a.agentName);
  }

  /**
   * 获取唯一的行动层级列表
   * @param filters 过滤条件
   * @returns 行动层级列表
   */
  private async getUniqueActionLayers(
    filters: PerformanceFilters,
  ): Promise<ActionLayer[]> {
    const actions = await prisma.agentAction.findMany({
      where: this.buildWhereClause(filters),
      select: {
        actionLayer: true,
      },
      distinct: ["actionLayer"],
    });

    return actions.map((a) => a.actionLayer);
  }
}

/**
 * 单例实例
 */
export const performanceAnalyzer = new PerformanceAnalyzer();
