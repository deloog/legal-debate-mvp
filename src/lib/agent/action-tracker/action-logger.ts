/**
 * ActionLogger - 行动记录器
 *
 * 负责记录Agent执行的每个行动，支持行动链追踪
 */

import { prisma } from "@/lib/db/prisma";
import { ErrorLogger } from "@/lib/error/error-logger";
import { ActionStatus } from "@prisma/client";
import type {
  ActionLogInput,
  ActionLogOutput,
  ActionStartInput,
  ActionCompleteInput,
  ActionFailedInput,
  ActionChain,
} from "./types";

/**
 * 行动记录器类
 */
export class ActionLogger {
  private errorLogger: ErrorLogger;

  constructor() {
    this.errorLogger = new ErrorLogger();
  }

  /**
   * 记录行动开始
   * @param input 行动开始输入
   * @returns 行动ID
   */
  async logActionStart(input: ActionStartInput): Promise<string> {
    try {
      const action = await prisma.agentAction.create({
        data: {
          userId: input.userId,
          caseId: input.caseId,
          debateId: input.debateId,
          agentName: input.agentName,
          actionType: input.actionType,
          actionName: input.actionName,
          actionLayer: input.actionLayer,
          parameters: this.sanitizeParameters(input.parameters) as never,
          status: ActionStatus.RUNNING,
          parentActionId: input.parentActionId,
          metadata: input.metadata as never,
          createdAt: input.startedAt,
        },
      });

      return action.id;
    } catch (error) {
      await this.errorLogger.captureError(error as Error, {
        executionEnvironment: {
          userId: input.userId,
          caseId: input.caseId,
        },
      });
      throw error;
    }
  }

  /**
   * 记录行动完成
   * @param input 行动完成输入
   * @returns 记录结果
   */
  async logActionComplete(
    input: ActionCompleteInput,
  ): Promise<ActionLogOutput> {
    try {
      const action = await prisma.agentAction.update({
        where: { id: input.actionId },
        data: {
          status: ActionStatus.COMPLETED,
          result: this.sanitizeResult(input.result) as never,
          executionTime: input.executionTime,
          retryCount: input.retryCount ?? 0,
          updatedAt: input.completedAt,
        },
      });

      return {
        actionId: action.id,
        recordedAt: action.updatedAt ?? new Date(),
        status: "SUCCESS",
      };
    } catch (error) {
      await this.errorLogger.captureError(error as Error, {
        operation: "logActionComplete",
      });
      throw error;
    }
  }

  /**
   * 记录行动失败
   * @param input 行动失败输入
   * @returns 记录结果
   */
  async logActionFailed(input: ActionFailedInput): Promise<ActionLogOutput> {
    try {
      const errorMessage = this.formatErrorMessage(input.error);

      const action = await prisma.agentAction.update({
        where: { id: input.actionId },
        data: {
          status: ActionStatus.FAILED,
          metadata: {
            errorMessage,
          } as never,
          executionTime: input.executionTime,
          retryCount: input.retryCount ?? 0,
          updatedAt: input.failedAt,
        },
      });

      return {
        actionId: action.id,
        recordedAt: action.updatedAt ?? new Date(),
        status: "FAILED",
        error: errorMessage,
      };
    } catch (error) {
      await this.errorLogger.captureError(error as Error, {
        operation: "logActionFailed",
      });
      throw error;
    }
  }

  /**
   * 记录完整行动（快捷方法）
   * @param input 行动输入
   * @param executeFn 执行函数
   * @returns 执行结果
   */
  async logAction<T>(
    input: ActionLogInput,
    executeFn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date();
    const actionId = await this.logActionStart({
      ...input,
      startedAt,
    });

    const startTime = Date.now();
    const retryCount = 0;

    try {
      const result = await executeFn();
      const executionTime = Date.now() - startTime;

      await this.logActionComplete({
        actionId,
        result,
        executionTime,
        retryCount,
        completedAt: new Date(),
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      await this.logActionFailed({
        actionId,
        error: error as Error,
        executionTime,
        retryCount,
        failedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * 构建行动链
   * @param rootActionId 根行动ID
   * @returns 行动链信息
   */
  async buildActionChain(rootActionId: string): Promise<ActionChain> {
    try {
      const actions = await prisma.agentAction.findMany({
        where: {
          OR: [{ id: rootActionId }, { parentActionId: rootActionId }],
        },
        orderBy: { createdAt: "asc" },
      });

      if (actions.length === 0) {
        throw new Error(`Action not found: ${rootActionId}`);
      }

      const actionMap = new Map(actions.map((a) => [a.id, a]));
      const maxDepth = this.calculateMaxDepth(rootActionId, actionMap);

      return {
        chainId: rootActionId,
        rootActionId,
        depth: maxDepth,
        actions: actions.map((a) => ({
          actionId: a.id,
          actionName: a.actionName,
          agentName: a.agentName,
          executionTime: a.executionTime ?? 0,
          status: a.status,
        })),
        totalExecutionTime: actions.reduce(
          (sum, a) => sum + (a.executionTime ?? 0),
          0,
        ),
      };
    } catch (error) {
      await this.errorLogger.captureError(error as Error, {
        operation: "buildActionChain",
      });
      throw error;
    }
  }

  /**
   * 清理过期行动记录
   * @param retentionDays 保留天数
   * @returns 清理的记录数
   */
  async cleanupOldActions(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.agentAction.deleteMany({
        where: {
          updatedAt: {
            lt: cutoffDate,
          },
          status: {
            in: [ActionStatus.COMPLETED, ActionStatus.FAILED],
          },
        },
      });

      return result.count;
    } catch (error) {
      await this.errorLogger.captureError(error as Error, {
        operation: "cleanupOldActions",
        executionEnvironment: {},
      });
      throw error;
    }
  }

  /**
   * 获取行动记录
   * @param actionId 行动ID
   * @returns 行动记录
   */
  async getAction(actionId: string) {
    return prisma.agentAction.findUnique({
      where: { id: actionId },
    });
  }

  /**
   * 查询行动记录
   * @param filters 过滤条件
   * @returns 行动记录列表
   */
  async queryActions(filters: {
    agentName?: string;
    actionName?: string;
    actionLayer?: ActionStatus;
    status?: ActionStatus;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.agentName) {
      where.agentName = filters.agentName;
    }
    if (filters.actionName) {
      where.actionName = filters.actionName;
    }
    if (filters.status) {
      where.status = filters.status;
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

    return prisma.agentAction.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: filters.limit,
      skip: filters.offset,
    });
  }

  /**
   * 敏感参数清理（脱敏）
   * @param parameters 原始参数
   * @returns 清理后的参数
   */
  private sanitizeParameters(parameters: unknown): unknown {
    if (typeof parameters !== "object" || parameters === null) {
      return parameters;
    }

    const sanitized = { ...(parameters as Record<string, unknown>) };
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "apiKey",
      "apiSecret",
    ];

    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = "***REDACTED***";
      }
    }

    return sanitized;
  }

  /**
   * 结果清理（限制大小）
   * @param result 原始结果
   * @returns 清理后的结果
   */
  private sanitizeResult(result: unknown): unknown {
    const MAX_RESULT_SIZE = 10000; // 10KB

    if (typeof result === "string") {
      return result.length > MAX_RESULT_SIZE
        ? result.substring(0, MAX_RESULT_SIZE) + "... (truncated)"
        : result;
    }

    if (typeof result === "object" && result !== null) {
      const json = JSON.stringify(result);
      if (json.length > MAX_RESULT_SIZE) {
        return {
          ...result,
          _truncated: true,
          _size: json.length,
        };
      }
    }

    return result;
  }

  /**
   * 格式化错误消息
   * @param error 错误对象
   * @returns 格式化的错误消息
   */
  private formatErrorMessage(error: Error): string {
    const message = error.message || "Unknown error";
    const stack = error.stack ? error.stack.split("\n")[0] : "";

    return stack ? `${message} (${stack.trim()})` : message;
  }

  /**
   * 计算行动链最大深度
   * @param actionId 行动ID
   * @param actionMap 行动映射
   * @param currentDepth 当前深度
   * @returns 最大深度
   */
  private calculateMaxDepth(
    actionId: string,
    actionMap: Map<string, unknown>,
    currentDepth: number = 0,
  ): number {
    const action = actionMap.get(actionId) as
      | { childActions?: string[] }
      | undefined;

    if (!action?.childActions || action.childActions.length === 0) {
      return currentDepth;
    }

    const childDepths = action.childActions.map((childId) =>
      this.calculateMaxDepth(childId, actionMap, currentDepth + 1),
    );

    return Math.max(...childDepths);
  }
}

/**
 * 单例实例
 */
export const actionLogger = new ActionLogger();
