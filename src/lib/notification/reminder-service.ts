/**
 * 提醒服务模块
 *
 * 负责提醒的创建、更新、查询和状态管理。
 */

import { logger } from '@/lib/agent/security/logger';
import { prisma } from '@/lib/db/prisma';
import {
  CreateReminderInput,
  NotificationChannel,
  Reminder,
  ReminderListResponse,
  ReminderQueryParams,
  ReminderStatus,
  ReminderType,
  UpdateReminderInput,
} from '@/types/notification';
import { Prisma } from '@prisma/client';

// =============================================================================
// 提醒服务
// =============================================================================

class ReminderService {
  /**
   * 创建提醒
   */
  async createReminder(input: CreateReminderInput): Promise<Reminder> {
    try {
      const reminder = await prisma.reminder.create({
        data: {
          userId: input.userId!,
          type: input.type as never,
          title: input.title,
          message: input.message ?? input.content ?? null,
          reminderTime: input.reminderTime ?? input.scheduledAt ?? new Date(),
          channels: input.channels ?? (input.channel ? [input.channel] : []),
          relatedType: input.relatedType ?? null,
          relatedId: input.relatedId ?? null,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      logger.info(`创建提醒成功: ${reminder.id}`, {
        userId: reminder.userId,
        type: reminder.type,
      } as never);

      return this.toReminder(reminder);
    } catch (error) {
      logger.error('创建提醒失败', error as Error as never);
      throw error;
    }
  }

  /**
   * 批量创建提醒
   */
  async createReminders(inputs: CreateReminderInput[]): Promise<Reminder[]> {
    const reminders: Reminder[] = [];

    for (const input of inputs) {
      try {
        const reminder = await this.createReminder(input);
        reminders.push(reminder);
      } catch (error) {
        logger.error(
          `批量创建提醒失败: ${input.title}`,
          error as Error as never
        );
      }
    }

    return reminders;
  }

  /**
   * 更新提醒
   */
  async updateReminder(
    id: string,
    userId: string,
    input: UpdateReminderInput
  ): Promise<Reminder> {
    try {
      const updateData: Prisma.ReminderUpdateInput = {
        ...(input.title !== undefined && { title: input.title }),
        ...((input.message !== undefined || input.content !== undefined) && {
          message: input.message ?? input.content ?? null,
        }),
        ...((input.reminderTime !== undefined ||
          input.scheduledAt !== undefined) && {
          reminderTime: input.reminderTime ?? input.scheduledAt,
        }),
        ...((input.channels !== undefined || input.channel !== undefined) && {
          channels: input.channels ?? (input.channel ? [input.channel] : []),
        }),
        ...(input.status !== undefined && { status: input.status as never }),
        ...(input.metadata !== undefined && {
          metadata: input.metadata as Prisma.InputJsonValue,
        }),
      };

      const reminder = await prisma.reminder.update({
        where: {
          id,
          userId,
        },
        data: updateData,
      });

      logger.info(`更新提醒成功: ${id}`);

      return this.toReminder(reminder);
    } catch (error) {
      logger.error(`更新提醒失败: ${id}`, error as Error as never);
      throw error;
    }
  }

  /**
   * 删除提醒
   */
  async deleteReminder(id: string, userId: string): Promise<boolean> {
    try {
      await prisma.reminder.delete({
        where: {
          id,
          userId,
        },
      });

      logger.info(`删除提醒成功: ${id}`);
      return true;
    } catch (error) {
      logger.error(`删除提醒失败: ${id}`, error as Error as never);
      return false;
    }
  }

  /**
   * 根据ID获取提醒
   */
  async getReminderById(id: string, userId: string): Promise<Reminder | null> {
    try {
      const reminder = await prisma.reminder.findUnique({
        where: {
          id,
          userId,
        },
      });

      return reminder ? this.toReminder(reminder) : null;
    } catch (error) {
      logger.error(`获取提醒失败: ${id}`, error as Error as never);
      return null;
    }
  }

  /**
   * 查询提醒列表
   */
  async getReminders(
    params: ReminderQueryParams
  ): Promise<ReminderListResponse> {
    try {
      const {
        userId,
        type,
        status,
        startTime,
        endTime,
        page: pageStr = '1',
        limit: limitStr = '20',
      } = params;

      const page =
        typeof pageStr === 'string' ? parseInt(pageStr, 10) : pageStr;
      const limit =
        typeof limitStr === 'string' ? parseInt(limitStr, 10) : limitStr;

      const skip = (page - 1) * limit;
      const reminderTime: Prisma.DateTimeFilter | undefined =
        startTime || endTime
          ? {
              ...(startTime && { gte: new Date(startTime) }),
              ...(endTime && { lte: new Date(endTime) }),
            }
          : undefined;

      const where: Prisma.ReminderWhereInput = {
        userId,
        ...(type && { type: type as never }),
        ...(status && { status: status as never }),
        ...(reminderTime && { reminderTime }),
      };

      const [reminders, total] = await Promise.all([
        prisma.reminder.findMany({
          where,
          orderBy: { reminderTime: 'asc' },
          skip,
          take: limit,
        }),
        prisma.reminder.count({ where }),
      ]);

      return {
        reminders: reminders.map(r => this.toReminder(r)),
        total,
        page,
        limit,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('查询提醒列表失败', error as Error as never);
      throw error;
    }
  }

  /**
   * 获取待发送的提醒
   */
  async getPendingReminders(): Promise<Reminder[]> {
    try {
      const now = new Date();
      const reminders = await prisma.reminder.findMany({
        where: {
          status: ReminderStatus.PENDING,
          reminderTime: { lte: now },
        },
        orderBy: { reminderTime: 'asc' },
      });

      return reminders.map(r => this.toReminder(r));
    } catch (error) {
      logger.error('获取待发送提醒失败', error as Error as never);
      throw error;
    }
  }

  /**
   * 更新提醒状态为已发送
   */
  async markAsSent(id: string): Promise<Reminder> {
    try {
      const reminder = await prisma.reminder.update({
        where: { id },
        data: { status: ReminderStatus.SENT },
      });

      return this.toReminder(reminder);
    } catch (error) {
      logger.error(`标记提醒已发送失败: ${id}`, error as Error as never);
      throw error;
    }
  }

  /**
   * 更新提醒状态为已读
   */
  async markAsRead(id: string, userId: string): Promise<Reminder> {
    try {
      const reminder = await prisma.reminder.update({
        where: { id, userId },
        data: { status: ReminderStatus.READ },
      });

      logger.info(`标记提醒已读: ${id}`);
      return this.toReminder(reminder);
    } catch (error) {
      logger.error(`标记提醒已读失败: ${id}`, error as Error as never);
      throw error;
    }
  }

  /**
   * 忽略提醒
   */
  async dismissReminder(id: string, userId: string): Promise<Reminder> {
    try {
      const reminder = await prisma.reminder.update({
        where: { id, userId },
        data: { status: ReminderStatus.DISMISSED },
      });

      logger.info(`忽略提醒: ${id}`);
      return this.toReminder(reminder);
    } catch (error) {
      logger.error(`忽略提醒失败: ${id}`, error as Error as never);
      throw error;
    }
  }

  /**
   * 获取用户提醒统计
   */
  async getUserReminderStats(userId: string): Promise<{
    total: number;
    pending: number;
    sent: number;
    read: number;
    dismissed: number;
  }> {
    try {
      const stats = await prisma.reminder.groupBy({
        by: ['status'],
        where: { userId },
        _count: true,
      });

      const result = {
        total: 0,
        pending: 0,
        sent: 0,
        read: 0,
        dismissed: 0,
      };

      for (const stat of stats) {
        result.total += stat._count;
        result[stat.status.toLowerCase() as keyof typeof result] =
          stat._count as never;
      }

      return result;
    } catch (error) {
      logger.error('获取用户提醒统计失败', error as Error as never);
      throw error;
    }
  }

  /**
   * 清理已发送且过期超过30天的提醒
   */
  async cleanupOldReminders(): Promise<number> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.reminder.deleteMany({
        where: {
          status: { in: [ReminderStatus.SENT, ReminderStatus.READ] },
          reminderTime: { lt: thirtyDaysAgo },
        },
      });

      logger.info(`清理过期提醒完成: ${result.count}条`);
      return result.count;
    } catch (error) {
      logger.error('清理过期提醒失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 将Prisma模型转换为Reminder接口
   */
  private toReminder(
    reminder: Awaited<ReturnType<typeof prisma.reminder.findUnique>>
  ): Reminder {
    if (!reminder) {
      throw new Error('Reminder not found');
    }
    return {
      id: reminder.id,
      userId: reminder.userId,
      type: reminder.type as ReminderType,
      title: reminder.title,
      content: reminder.message || reminder.title,
      message: reminder.message ?? undefined,
      scheduledAt: reminder.reminderTime,
      reminderTime: reminder.reminderTime,
      channel: (reminder.channels[0] || 'IN_APP') as NotificationChannel,
      channels: reminder.channels as NotificationChannel[],
      status: reminder.status as ReminderStatus,
      sentAt: null,
      relatedType: reminder.relatedType ?? undefined,
      relatedId: reminder.relatedId ?? undefined,
      metadata: reminder.metadata as Record<string, unknown> | null,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    };
  }
}

// =============================================================================
// 导出
// =============================================================================

export const reminderService = new ReminderService();
export default reminderService;
