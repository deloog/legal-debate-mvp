import { PrismaClient } from '@prisma/client';
import {
  CommunicationType,
  CompleteFollowUpTaskInput,
  FollowUpTask,
  FollowUpTaskListResponse,
  FollowUpTaskPriority,
  FollowUpTaskQueryParams,
  FollowUpTaskStatus,
  UpdateFollowUpTaskInput,
} from '@/types/client';
import { logger } from '@/lib/agent/security/logger';

const prisma = new PrismaClient();

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

      // 构建查询条件
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (params.userId) {
        conditions.push('fut."userId" = $1');
        values.push(params.userId);
      }

      if (params.clientId) {
        conditions.push(`fut."clientId" = $${values.length + 1}`);
        values.push(params.clientId);
      }

      if (params.status) {
        conditions.push(`fut.status = $${values.length + 1}`);
        values.push(params.status);
      }

      if (params.priority) {
        conditions.push(`fut.priority = $${values.length + 1}`);
        values.push(params.priority);
      }

      if (params.dueDateFrom) {
        conditions.push(`fut."dueDate" >= $${values.length + 1}`);
        values.push(params.dueDateFrom);
      }

      if (params.dueDateTo) {
        conditions.push(`fut."dueDate" <= $${values.length + 1}`);
        values.push(params.dueDateTo);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 排序
      const sortBy = params.sortBy || 'dueDate';
      const sortOrder = params.sortOrder || 'asc';
      const sortClause = `ORDER BY fut."${sortBy}" ${sortOrder.toUpperCase()}`;

      // 查询总数
      const countQuery = `SELECT COUNT(*) as count FROM follow_up_tasks fut ${whereClause}`;
      const countResult = await prisma.$queryRawUnsafe<
        Array<{ count: bigint }>
      >(countQuery, ...values);
      const total = Number(countResult[0].count);
      const totalPages = Math.ceil(total / limit);

      // 查询任务列表
      const tasksQuery = `
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
        ${whereClause}
        ${sortClause}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const tasks = await prisma.$queryRawUnsafe<
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
      >(tasksQuery, ...values);

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
      logger.error(`获取跟进任务列表失败: ${errorMessage}`, error);
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
      logger.error(`获取跟进任务失败: ${errorMessage}`, error);
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
      logger.error(`完成跟进任务失败: ${errorMessage}`, error);
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

      // 构建更新字段
      const updateFields: string[] = [];
      const values: unknown[] = [];

      if (input.status) {
        updateFields.push(`status = $${values.length + 1}`);
        values.push(input.status);
      }

      if (input.priority) {
        updateFields.push(`priority = $${values.length + 1}`);
        values.push(input.priority);
      }

      if (input.notes !== undefined) {
        updateFields.push(`notes = $${values.length + 1}`);
        values.push(input.notes);
      }

      if (input.completedAt !== undefined) {
        updateFields.push(`"completedAt" = $${values.length + 1}`);
        values.push(input.completedAt);
      }

      if (updateFields.length === 0) {
        return existingTask;
      }

      updateFields.push('"updatedAt" = NOW()');

      // 执行更新
      const updateQuery = `
        UPDATE follow_up_tasks
        SET ${updateFields.join(', ')}
        WHERE id = $${values.length + 1}
      `;
      values.push(taskId);
      await prisma.$queryRawUnsafe(updateQuery, ...values);

      logger.info(`跟进任务已更新: ${taskId}`);

      // 返回更新后的任务
      return await this.getTask(taskId, userId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`更新跟进任务失败: ${errorMessage}`, error);
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
      logger.error(`取消跟进任务失败: ${errorMessage}`, error);
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
      logger.error(`获取待处理任务数量失败: ${errorMessage}`, error);
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
          AND fut.status = 'PENDING'
          AND fut."dueDate" <= NOW() + INTERVAL '${days} days'
        ORDER BY fut."dueDate" ASC
      `;

      logger.info(`获取即将到期的任务: ${result.length} 条`);
      return result.map(this.transformTask);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`获取即将到期任务失败: ${errorMessage}`, error);
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
