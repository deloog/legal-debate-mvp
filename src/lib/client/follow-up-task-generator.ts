import { CommunicationType, FollowUpTaskPriority } from '@/types/client';
import { logger } from '@/lib/agent/security/logger';
import { prisma } from '@/lib/db/prisma';

/**
 * 跟进任务生成器类
 * 负责从沟通记录自动生成跟进任务
 */
export class FollowUpTaskGenerator {
  /**
   * 生成跟进任务摘要
   * @param communicationType 沟通类型
   * @param communicationSummary 沟通摘要
   * @returns 任务摘要
   */
  static generateSummary(
    communicationType: CommunicationType,
    communicationSummary: string
  ): string {
    const typeMap: Record<CommunicationType, string> = {
      [CommunicationType.PHONE]: '电话跟进',
      [CommunicationType.EMAIL]: '邮件跟进',
      [CommunicationType.MEETING]: '面谈跟进',
      [CommunicationType.WECHAT]: '微信跟进',
      [CommunicationType.OTHER]: '其他跟进',
    };

    const typeText = typeMap[communicationType] || '跟进';
    return `${typeText}：${communicationSummary}`;
  }

  /**
   * 根据沟通类型确定任务优先级
   * @param communicationType 沟通类型
   * @param isImportant 是否重要
   * @param daysUntilDue 截止日期天数
   * @returns 任务优先级
   */
  static determinePriority(
    _communicationType: CommunicationType,
    isImportant: boolean,
    daysUntilDue: number
  ): FollowUpTaskPriority {
    if (isImportant || daysUntilDue <= 3) {
      return FollowUpTaskPriority.HIGH;
    }
    if (daysUntilDue <= 7) {
      return FollowUpTaskPriority.MEDIUM;
    }
    return FollowUpTaskPriority.LOW;
  }

  /**
   * 从沟通记录生成跟进任务
   * @param communicationId 沟通记录ID
   * @returns 创建的任务ID
   */
  static async generateFromCommunication(
    communicationId: string
  ): Promise<string | null> {
    try {
      // 获取沟通记录
      const communication = await prisma.communicationRecord.findUnique({
        where: { id: communicationId },
        include: {
          client: {
            select: {
              userId: true,
            },
          },
        },
      });

      if (!communication) {
        logger.warn(`沟通记录不存在: ${communicationId}`);
        return null;
      }

      if (!communication.nextFollowUpDate) {
        logger.debug(`沟通记录没有设置跟进日期: ${communicationId}`);
        return null;
      }

      // 检查是否已存在未完成的跟进任务
      const existingTask = await this.findPendingTask(communicationId);

      if (existingTask) {
        logger.debug(`已存在未完成的跟进任务: ${existingTask.id}`);
        return existingTask.id;
      }

      // 计算优先级
      const daysUntilDue = Math.ceil(
        (new Date(communication.nextFollowUpDate).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      );

      const priority = this.determinePriority(
        communication.type as unknown as CommunicationType,
        communication.isImportant,
        daysUntilDue
      );

      // 生成任务摘要
      const summary = this.generateSummary(
        communication.type as unknown as CommunicationType,
        communication.summary
      );

      // 创建跟进任务
      const task = await this.createTask({
        clientId: communication.clientId,
        communicationId,
        userId: communication.client.userId,
        type: communication.type as unknown as CommunicationType,
        summary,
        dueDate: communication.nextFollowUpDate,
        priority,
      });

      logger.info(`成功创建跟进任务: ${task.id}`);
      return task.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `生成跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 查找待处理的任务
   * @param communicationId 沟通记录ID
   * @returns 任务或null
   */
  private static async findPendingTask(
    communicationId: string
  ): Promise<{ id: string } | null> {
    const task = await prisma.followUpTask.findFirst({
      where: {
        communicationId,
        status: 'PENDING' as const,
      },
      select: {
        id: true,
      },
    });
    return task || null;
  }

  /**
   * 创建任务
   * @param data 任务数据
   * @returns 创建的任务
   */
  private static async createTask(data: {
    clientId: string;
    communicationId: string;
    userId: string;
    type: CommunicationType;
    summary: string;
    dueDate: Date;
    priority: FollowUpTaskPriority;
  }): Promise<{ id: string }> {
    const task = await prisma.followUpTask.create({
      data: {
        clientId: data.clientId,
        communicationId: data.communicationId,
        userId: data.userId,
        type: data.type,
        summary: data.summary,
        dueDate: data.dueDate,
        priority: data.priority,
        status: 'PENDING' as const,
      },
    });
    return { id: task.id };
  }

  /**
   * 批量生成跟进任务
   * @param communicationIds 沟通记录ID数组
   * @returns 创建的任务ID数组
   */
  static async generateBatch(communicationIds: string[]): Promise<string[]> {
    const taskIds: string[] = [];

    for (const communicationId of communicationIds) {
      try {
        const taskId = await this.generateFromCommunication(communicationId);
        if (taskId) {
          taskIds.push(taskId);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `批量生成跟进任务失败 (${communicationId}): ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
      }
    }

    return taskIds;
  }

  /**
   * 自动生成待跟进的任务
   * 查找所有设置了跟进日期但未生成任务的沟通记录
   * @param limit 最大生成数量
   * @returns 创建的任务数量
   */
  static async autoGeneratePendingTasks(limit: number = 50): Promise<number> {
    try {
      // 查找所有设置了跟进日期的沟通记录
      const communications = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT cr.id
        FROM communication_records cr
        WHERE cr."nextFollowUpDate" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM follow_up_tasks fut
            WHERE fut."communicationId" = cr.id
              AND fut.status = 'PENDING'::"FollowUpTaskStatus"::"FollowUpTaskStatus"
          )
        ORDER BY cr."nextFollowUpDate" ASC
        LIMIT ${limit}
      `;

      const communicationIds = communications.map(c => c.id);
      const taskIds = await this.generateBatch(communicationIds);

      logger.info(
        `自动生成跟进任务完成: ${taskIds.length}/${communicationIds.length}`
      );
      return taskIds.length;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `自动生成跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }

  /**
   * 根据日期范围自动生成跟进任务
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 创建的任务数量
   */
  static async autoGenerateTasksByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const communications = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT cr.id
        FROM communication_records cr
        WHERE cr."nextFollowUpDate" >= ${startDate}
          AND cr."nextFollowUpDate" <= ${endDate}
          AND NOT EXISTS (
            SELECT 1 FROM follow_up_tasks fut
            WHERE fut."communicationId" = cr.id
              AND fut.status = 'PENDING'
          )
      `;

      const communicationIds = communications.map(c => c.id);
      const taskIds = await this.generateBatch(communicationIds);

      logger.info(`按日期范围生成跟进任务完成: ${taskIds.length}`);
      return taskIds.length;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `按日期范围生成跟进任务失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }
}

export default FollowUpTaskGenerator;
