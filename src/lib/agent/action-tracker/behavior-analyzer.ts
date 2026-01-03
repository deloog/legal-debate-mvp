/**
 * BehaviorAnalyzer - 行为分析器
 *
 * 负责分析Agent的行为模式，包括常用路径、错误模式等
 */

import { prisma } from "@/lib/db/prisma";
import { ActionStatus } from "@prisma/client";
import type { BehaviorReport, BehaviorFilters } from "./types";

/**
 * 行为分析器类
 */
export class BehaviorAnalyzer {
  /**
   * 分析常用路径
   * @param filters 过滤条件
   * @returns 常用路径列表
   */
  async analyzeCommonPaths(filters: BehaviorFilters = {}): Promise<
    {
      path: string[];
      count: number;
      avgExecutionTime: number;
    }[]
  > {
    // 查询所有行动
    const actions = await prisma.agentAction.findMany({
      where: this.buildWhereClause(filters),
      orderBy: { createdAt: "asc" },
    });

    // 构建路径图
    const pathMap = new Map<string, { count: number; totalTime: number }>();

    for (const action of actions) {
      if (action.parentActionId) {
        const parent = actions.find((a) => a.id === action.parentActionId);
        if (parent) {
          const path = `${parent.agentName}:${parent.actionName} -> ${action.agentName}:${action.actionName}`;
          const existing = pathMap.get(path);
          const execTime = action.executionTime ?? 0;

          if (existing) {
            existing.count++;
            existing.totalTime += execTime;
          } else {
            pathMap.set(path, { count: 1, totalTime: execTime });
          }
        }
      }
    }

    // 转换为数组并排序
    return Array.from(pathMap.entries())
      .map(([path, data]) => ({
        path: path.split(" -> "),
        count: data.count,
        avgExecutionTime: data.totalTime / data.count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 分析错误模式
   * @param filters 过滤条件
   * @returns 错误模式列表
   */
  async analyzeErrorPatterns(filters: BehaviorFilters = {}): Promise<
    {
      pattern: string;
      count: number;
      lastOccurrence: Date;
    }[]
  > {
    const where = this.buildWhereClause(filters);

    // 查询失败的行动
    const failedActions = await prisma.agentAction.findMany({
      where: {
        ...where,
        status: ActionStatus.FAILED,
      },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });

    // 统计错误模式
    const errorMap = new Map<string, { count: number; lastOccurrence: Date }>();

    for (const action of failedActions) {
      // 按行动名称和Agent组合
      const pattern = `${action.agentName}:${action.actionName}`;
      const existing = errorMap.get(pattern);

      if (existing) {
        existing.count++;
        if (action.updatedAt > existing.lastOccurrence) {
          existing.lastOccurrence = action.updatedAt;
        }
      } else {
        errorMap.set(pattern, {
          count: 1,
          lastOccurrence: action.updatedAt ?? new Date(),
        });
      }
    }

    return Array.from(errorMap.entries())
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        lastOccurrence: data.lastOccurrence,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 分析行为报告
   * @param filters 过滤条件
   * @returns 行为报告
   */
  async getBehaviorReport(
    filters: BehaviorFilters = {},
  ): Promise<BehaviorReport> {
    const commonPaths = await this.analyzeCommonPaths(filters);
    const errorPatterns = await this.analyzeErrorPatterns(filters);

    // 分析行动层级偏好
    const layerPreference = await this.analyzeLayerPreference(filters);

    // 分析重试模式
    const retryPatterns = await this.analyzeRetryPatterns(filters);

    return {
      generatedAt: new Date(),
      filters,
      commonPaths,
      errorPatterns,
      layerPreference,
      retryPatterns,
    };
  }

  /**
   * 分析行动层级偏好
   * @param filters 过滤条件
   * @returns 层级使用统计
   */
  private async analyzeLayerPreference(
    filters: BehaviorFilters = {},
  ): Promise<Record<string, { count: number; avgExecutionTime: number }>> {
    const where = this.buildWhereClause(filters);

    const result = await prisma.agentAction.groupBy({
      by: ["actionLayer"],
      where,
      _count: true,
      _avg: {
        executionTime: true,
      },
    });

    const preference: Record<
      string,
      { count: number; avgExecutionTime: number }
    > = {};

    for (const item of result) {
      preference[item.actionLayer] = {
        count: item._count,
        avgExecutionTime: item._avg.executionTime ?? 0,
      };
    }

    return preference;
  }

  /**
   * 分析重试模式
   * @param filters 过滤条件
   * @returns 重试统计
   */
  private async analyzeRetryPatterns(
    filters: BehaviorFilters = {},
  ): Promise<Map<string, number>> {
    const where = this.buildWhereClause(filters);

    // 按行动名称统计重试
    const actions = await prisma.agentAction.findMany({
      where: {
        ...where,
        retryCount: {
          gt: 0,
        },
      },
      select: {
        actionName: true,
        retryCount: true,
      },
    });

    const byAction = new Map<string, number>();
    for (const action of actions) {
      if (action.retryCount && action.retryCount > 0) {
        const current = byAction.get(action.actionName) ?? 0;
        byAction.set(action.actionName, current + action.retryCount);
      }
    }

    return byAction;
  }

  /**
   * 构建where子句
   * @param filters 过滤条件
   * @returns Prisma where子句
   */
  private buildWhereClause(filters: BehaviorFilters): Record<string, unknown> {
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
    if (filters.actionLayer) {
      where.actionLayer = filters.actionLayer;
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
export const behaviorAnalyzer = new BehaviorAnalyzer();
