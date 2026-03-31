import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  CommunicationType,
  CompleteFollowUpTaskInput,
  CreateFollowUpTaskInput,
  FollowUpTask,
  FollowUpTaskListResponse,
  FollowUpTaskPriority,
  FollowUpTaskQueryParams,
  FollowUpTaskStatus,
  UpdateFollowUpTaskInput,
} from '@/types/client';
import { logger } from '@/lib/agent/security/logger';

/**
 * 跟进任务处理器类
 * 负责跟进任务的CRUD操作
 */
export class FollowUpTaskProcessor {
  /**
   * 获取跟进任务列表
   * @param params 查询参数
   * @returns 任务列表响应
   */
  static async getTasks(
    params: FollowUpTaskQueryParams
  ): Promise<FollowUpTaskListResponse> {
    try {
      const page = params.page || 1;
      const limit = Math.min(params.limit || 20, 100);
      const offset = (page - 1) * limit;

      // 构建参数化WHERE条件（防止SQL注入）
      const sqlConditions: Prisma.Sql[] = [];

      if (params.userId) {
        sqlConditions.push(Prisma.sql`fut."userId" = ${params.userId}`);
      }
      if (params.clientId) {
        sqlConditions.push(Prisma.sql`fut."clientId" = ${params.clientId}`);
      }
      if (params.status) {
        sqlConditions.push(
          Prisma.sql`fut.status = ${params.status}::"FollowUpTaskStatus"`
        );
      }
      if (params.priority) {
        sqlConditions.push(
          Prisma.sql`fut.priority = ${params.priority}::"FollowUpTaskPriority"`
        );
      }
      if (params.dueDateFrom) {
        sqlConditions.push(Prisma.sql`fut."dueDate" >= ${params.dueDateFrom}`);
      }
      if (params.dueDateTo) {
        sqlConditions.push(Prisma.sql`fut."dueDate" <= ${params.dueDateTo}`);
      }

      const whereExpr =
        sqlConditions.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(sqlConditions, ' AND ')}`
          : Prisma.sql``;

      // 排序字段和方向使用白名单 + Prisma.raw（服务端控制，无用户插值风险）
      const allowedSortFields = [
        'dueDate',
        'createdAt',
        'updatedAt',
        'priority',
        'status',
      ];
      const sortBy = allowedSortFields.includes(params.sortBy || '')
        ? params.sortBy!
        : 'dueDate';

      const sortOrder = ['asc', 'desc'].includes(
        params.sortOrder?.toLowerCase() || ''
      )
        ? params.sortOrder!.toLowerCase()
        : 'asc';

      const sortExpr = Prisma.raw(`fut."${sortBy}" ${sortOrder.toUpperCase()}`);

      // 查询总数
      const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
        Prisma.sql`SELECT COUNT(*) as count FROM follow_up_tasks fut ${whereExpr}`
      );
      const total = Number(countResult[0].count);
      const totalPages = Math.ceil(total / limit);

      // 查询任务列表
      const tasks = await prisma.$queryRaw<
        Array<{
          id: string;
          clientId: string;
          communicationId: string;
          userId: string;
          type: string;
          summary: string;
          dueDate: Date;
          priority: string;
          status: string;
          completedAt: Date | null;
          notes: string | null;
          metadata: unknown;
          createdAt: Date;
          updatedAt: Date;
          clientName: string;
          clientPhone: string | null;
          clientEmail: string | null;
        }>
      >(
        Prisma.sql`
          SELECT
            fut.id,
            fut."clientId",
            fut."communicationId",
            fut."userId",
            fut.type,
            fut.summary,
            fut."dueDate",
            fut.priority,
            fut.status,
            fut."completedAt",
            fut.notes,
            fut.metadata,
            fut."createdAt",
            fut."updatedAt",
            c.name as "clientName",
            c.phone as "clientPhone",
            c.email as "clientEmail"
          FROM follow_up_tasks fut
          INNER JOIN clients c ON fut."clientId" = c.id
          ${whereExpr}
          ORDER BY ${sortExpr}
          LIMIT ${limit} OFFSET ${offset}
        `
      );

      logger.info(`获取跟进任务列表: ${tasks.length} 条记录，共 ${total} 条`);

      return {
        tasks: tasks.map(this.transformTask),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `获取跟进任务列表失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 获取单个跟进任务
   * @param taskId 任务ID
   * @param userId 用户ID（用于权限验证）
   * @returns 任务详情
   */
  static async getTask(
    taskId: string,
    userId: string
  ): Promise<FollowUpTask | null> {
    try {
      const result = await prisma.$queryRaw<
        Array<{
          id: string;
          clientId: string;
          communicationId: string;
          userId: string;
          type: string;
          summary: string;
          dueDate: Date;
          priority: string;
          status: string;
          completedAt: Date | null;
          notes: string | null;
          metadata: unknown;
          createdAt: Date;
          updatedAt: Date;
          clientName: string;
          clientPhone: string | null;
          clientEmail: string | null;
        }>
      >`
        SELECT
          fut.id,
          fut."clientId",
          fut."communicationId",
          fut."userId",
          fut.type,
          fut.summary,
          fut."dueDate",
          fut.priority,
          fut.status,
          fut."completedAt",
          fut.notes,
          fut.metadata,
          fut."createdAt",
          fut."updatedAt",
          c.name as "clientName",
          c.phone as "clientPhone",
          c.email as "clientEmail"
        FROM follow_up_tasks fut
        INNER JOIN clients c ON fut."clientId" = c.id
        WHERE fut.id = ${taskId}
          AND fut."userId" = ${userId}
      `;

      if (result.length === 0) {
        return null;
      }

      return this.transformTask(result[0]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `获取跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 标记任务为完成
   * @param taskId 任务ID
   * @param userId 用户ID
   * @param input 完成输入
   * @returns 更新后的任务
   */
  static async completeTask(
    taskId: string,
    userId: string,
    input: CompleteFollowUpTaskInput
  ): Promise<FollowUpTask | null> {
    try {
      // 检查任务是否存在
      const existingTask = await this.getTask(taskId, userId);
      if (!existingTask) {
        logger.warn(`任务不存在或无权限访问: ${taskId}`);
        return null;
      }

      if (existingTask.status === FollowUpTaskStatus.COMPLETED) {
        logger.warn(`任务已完成: ${taskId}`);
        return existingTask;
      }

      // 更新任务状态
      await prisma.$queryRaw`
        UPDATE follow_up_tasks
        SET status = 'COMPLETED',
            "completedAt" = NOW(),
            notes = ${input.notes},
            "updatedAt" = NOW()
        WHERE id = ${taskId}
      `;

      logger.info(`跟进任务已完成: ${taskId}`);

      // 返回更新后的任务
      return await this.getTask(taskId, userId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `完成跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 更新跟进任务
   * @param taskId 任务ID
   * @param userId 用户ID
   * @param input 更新输入
   * @returns 更新后的任务
   */
  static async updateTask(
    taskId: string,
    userId: string,
    input: UpdateFollowUpTaskInput
  ): Promise<FollowUpTask | null> {
    try {
      // 检查任务是否存在
      const existingTask = await this.getTask(taskId, userId);
      if (!existingTask) {
        logger.warn(`任务不存在或无权限访问: ${taskId}`);
        return null;
      }

      // 构建参数化更新字段（防止SQL注入）
      const setClauses: Prisma.Sql[] = [];

      if (input.status) {
        setClauses.push(Prisma.sql`status = ${input.status}`);
      }

      if (input.priority) {
        setClauses.push(Prisma.sql`priority = ${input.priority}`);
      }

      if (input.notes !== undefined) {
        setClauses.push(Prisma.sql`notes = ${input.notes}`);
      }

      if (input.completedAt !== undefined) {
        setClauses.push(Prisma.sql`"completedAt" = ${input.completedAt}`);
      }

      if (setClauses.length === 0) {
        return existingTask;
      }

      setClauses.push(Prisma.sql`"updatedAt" = NOW()`);

      // 执行更新
      await prisma.$queryRaw(
        Prisma.sql`
          UPDATE follow_up_tasks
          SET ${Prisma.join(setClauses, ', ')}
          WHERE id = ${taskId}
        `
      );

      logger.info(`跟进任务已更新: ${taskId}`);

      // 返回更新后的任务
      return await this.getTask(taskId, userId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `更新跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 创建跟进任务
   * @param input 创建任务输入
   * @returns 创建的任务
   */
  static async createTask(
    input: CreateFollowUpTaskInput
  ): Promise<FollowUpTask> {
    try {
      // 使用 Prisma 创建任务
      const task = await prisma.followUpTask.create({
        data: {
          clientId: input.clientId,
          communicationId: input.communicationId || '',
          userId: input.userId,
          type: input.type,
          summary: input.summary,
          dueDate: input.dueDate,
          priority: input.priority || FollowUpTaskPriority.MEDIUM,
          status: FollowUpTaskStatus.PENDING,
          notes: input.notes,
          metadata:
            (input.metadata as import('@prisma/client').Prisma.InputJsonValue) ??
            undefined,
        },
      });

      logger.info(`创建跟进任务成功: ${task.id}`);

      // 获取完整的任务信息（包含客户名称）
      const fullTask = await this.getTask(task.id, input.userId);
      if (!fullTask) {
        throw new Error('创建任务后无法获取任务详情');
      }

      return fullTask;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `创建跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 取消跟进任务
   * @param taskId 任务ID
   * @param userId 用户ID
   * @returns 是否成功
   */
  static async cancelTask(taskId: string, userId: string): Promise<boolean> {
    try {
      // 检查任务是否存在
      const existingTask = await this.getTask(taskId, userId);
      if (!existingTask) {
        logger.warn(`任务不存在或无权限访问: ${taskId}`);
        return false;
      }

      if (existingTask.status === FollowUpTaskStatus.CANCELLED) {
        logger.warn(`任务已取消: ${taskId}`);
        return true;
      }

      // 更新任务状态
      const result = await prisma.$queryRaw<Array<{ status: string }>>`
        UPDATE follow_up_tasks
        SET status = 'CANCELLED', "updatedAt" = NOW()
        WHERE id = ${taskId}
        RETURNING status
      `;

      logger.info(`跟进任务已取消: ${taskId}`);
      return result.length > 0;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `取消跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 获取待处理的任务数量
   * @param userId 用户ID
   * @returns 任务数量
   */
  static async getPendingCount(userId: string): Promise<number> {
    try {
      const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM follow_up_tasks
        WHERE "userId" = ${userId}
          AND status = 'PENDING'
      `;

      return Number(result[0].count);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `获取待处理任务数量失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 获取即将到期的任务
   * @param userId 用户ID
   * @param days 天数
   * @returns 任务列表
   */
  static async getUpcomingTasks(
    userId: string,
    days: number = 7
  ): Promise<FollowUpTask[]> {
    try {
      const result = await prisma.$queryRaw<
        Array<{
          id: string;
          clientId: string;
          communicationId: string;
          userId: string;
          type: string;
          summary: string;
          dueDate: Date;
          priority: string;
          status: string;
          completedAt: Date | null;
          notes: string | null;
          metadata: unknown;
          createdAt: Date;
          updatedAt: Date;
          clientName: string;
          clientPhone: string | null;
          clientEmail: string | null;
        }>
      >`
        SELECT
          fut.id,
          fut."clientId",
          fut."communicationId",
          fut."userId",
          fut.type,
          fut.summary,
          fut."dueDate",
          fut.priority,
          fut.status,
          fut."completedAt",
          fut.notes,
          fut.metadata,
          fut."createdAt",
          fut."updatedAt",
          c.name as "clientName",
          c.phone as "clientPhone",
          c.email as "clientEmail"
        FROM follow_up_tasks fut
        INNER JOIN clients c ON fut."clientId" = c.id
        WHERE fut."userId" = ${userId}
          AND fut.status = 'PENDING'::"FollowUpTaskStatus"
          AND fut."dueDate" <= NOW() + INTERVAL '${days} days'
        ORDER BY fut."dueDate" ASC
      `;

      logger.info(`获取即将到期的任务: ${result.length} 条`);
      return result.map(this.transformTask);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `获取即将到期任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 转换任务数据
   * @param task 原始任务数据
   * @returns 标准化任务对象
   */
  private static transformTask(task: {
    id: string;
    clientId: string;
    communicationId: string;
    userId: string;
    type: string;
    summary: string;
    dueDate: Date;
    priority: string;
    status: string;
    completedAt: Date | null;
    notes: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
    clientName: string;
    clientPhone: string | null;
    clientEmail: string | null;
  }): FollowUpTask {
    return {
      id: task.id,
      clientId: task.clientId,
      communicationId: task.communicationId,
      userId: task.userId,
      type: task.type as CommunicationType,
      summary: task.summary,
      dueDate: task.dueDate,
      priority: task.priority as FollowUpTaskPriority,
      status: task.status as FollowUpTaskStatus,
      completedAt: task.completedAt,
      notes: task.notes,
      metadata: task.metadata as Record<string, unknown> | null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      clientName: task.clientName,
      clientPhone: task.clientPhone || undefined,
      clientEmail: task.clientEmail || undefined,
    };
  }
}

export default FollowUpTaskProcessor;
