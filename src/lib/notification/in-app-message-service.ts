/**
 * 站内消息服务模块
 *
 * 提供站内消息的创建、查询、标记已读等功能。
 * 站内消息存储在Reminder表中，通过Reminder模型实现。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/agent/security/logger';
import {
  ReminderType,
  ReminderStatus,
  NotificationChannel,
} from '@/types/notification';
import type { Reminder as PrismaReminder } from '@prisma/client';

// =============================================================================
// 站内消息接口
// =============================================================================

interface InAppMessage {
  id: string;
  userId: string;
  title: string;
  content: string | null;
  type: string;
  isRead: boolean;
  relatedType: string | null;
  relatedId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  readAt: Date | null;
}

interface CreateInAppMessageInput {
  userId: string;
  type: ReminderType;
  title: string;
  content?: string;
  relatedType?: string;
  relatedId?: string;
  metadata?: Record<string, unknown>;
  reminderTime?: Date;
}

interface InAppMessageQueryParams {
  userId: string;
  type?: string;
  isRead?: boolean;
  startTime?: Date;
  endTime?: Date;
  page?: number;
  limit?: number;
}

// =============================================================================
// 站内消息服务
// =============================================================================

class InAppMessageService {
  /**
   * 创建站内消息
   */
  async createMessage(
    input: CreateInAppMessageInput
  ): Promise<InAppMessage | null> {
    try {
      const message = await prisma.reminder.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.content || null,
          reminderTime: input.reminderTime || new Date(),
          channels: [NotificationChannel.IN_APP],
          status: ReminderStatus.SENT,
          relatedType: input.relatedType || null,
          relatedId: input.relatedId || null,
          metadata: input.metadata as never,
        },
      });

      logger.info(`站内消息创建成功: ${message.id}`, {
        userId: input.userId,
        type: input.type,
      } as Record<string, unknown>);

      return this.toInAppMessage(message);
    } catch (error) {
      logger.error(
        '创建站内消息失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * 批量创建站内消息
   */
  async createMessages(
    inputs: CreateInAppMessageInput[]
  ): Promise<InAppMessage[]> {
    try {
      const messages = await prisma.reminder.createMany({
        data: inputs.map(input => ({
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.content || null,
          reminderTime: input.reminderTime || new Date(),
          channels: [NotificationChannel.IN_APP],
          status: ReminderStatus.SENT,
          relatedType: input.relatedType || null,
          relatedId: input.relatedId || null,
          metadata: input.metadata as never,
        })),
      });

      logger.info(`批量创建站内消息成功: ${messages.count}条`, {
        count: messages.count,
      } as Record<string, unknown>);

      return [];
    } catch (error) {
      logger.error(
        '批量创建站内消息失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  /**
   * 获取站内消息列表
   */
  async getMessages(
    params: InAppMessageQueryParams
  ): Promise<{ messages: InAppMessage[]; total: number }> {
    try {
      const where: Record<string, unknown> = {
        userId: params.userId,
      };

      if (params.type) {
        where.type = params.type;
      }

      if (params.isRead !== undefined) {
        where.status = params.isRead
          ? ReminderStatus.READ
          : ReminderStatus.SENT;
      }

      if (params.startTime || params.endTime) {
        where.createdAt = {};
        if (params.startTime) {
          (where.createdAt as Record<string, Date>).gte = params.startTime;
        }
        if (params.endTime) {
          (where.createdAt as Record<string, Date>).lte = params.endTime;
        }
      }

      const total = await prisma.reminder.count({ where });

      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      const reminders = await prisma.reminder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });

      return {
        messages: reminders.map(r => this.toInAppMessage(r)),
        total,
      };
    } catch (error) {
      logger.error(
        '获取站内消息列表失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return { messages: [], total: 0 };
    }
  }

  /**
   * 获取未读消息数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const count = await prisma.reminder.count({
        where: {
          userId,
          status: ReminderStatus.SENT,
          channels: { has: NotificationChannel.IN_APP },
        },
      });

      return count;
    } catch (error) {
      logger.error(
        '获取未读消息数量失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return 0;
    }
  }

  /**
   * 标记消息为已读
   */
  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    try {
      const message = await prisma.reminder.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        logger.warn(`消息不存在: ${messageId}`);
        return false;
      }

      if (message.userId !== userId) {
        logger.warn(`用户无权操作此消息: ${messageId}`);
        return false;
      }

      await prisma.reminder.update({
        where: { id: messageId },
        data: {
          status: ReminderStatus.READ,
          metadata: this.createMetadataWithReadAt(
            message.metadata as Record<string, unknown> | null
          ) as never,
        },
      });

      logger.info(`消息已标记为已读: ${messageId}`);
      return true;
    } catch (error) {
      logger.error(
        '标记消息为已读失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * 批量标记消息为已读
   */
  async markMultipleAsRead(
    messageIds: string[],
    userId: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const messageId of messageIds) {
      const result = await this.markAsRead(messageId, userId);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 标记所有消息为已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.reminder.updateMany({
        where: {
          userId,
          status: ReminderStatus.SENT,
          channels: { has: NotificationChannel.IN_APP },
        },
        data: {
          status: ReminderStatus.READ,
        },
      });

      logger.info(`批量标记消息为已读: ${result.count}条`, {
        userId,
        count: result.count,
      } as Record<string, unknown>);

      return result.count;
    } catch (error) {
      logger.error(
        '批量标记消息为已读失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return 0;
    }
  }

  /**
   * 删除消息
   */
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    try {
      const message = await prisma.reminder.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        logger.warn(`消息不存在: ${messageId}`);
        return false;
      }

      if (message.userId !== userId) {
        logger.warn(`用户无权操作此消息: ${messageId}`);
        return false;
      }

      await prisma.reminder.delete({
        where: { id: messageId },
      });

      logger.info(`消息已删除: ${messageId}`);
      return true;
    } catch (error) {
      logger.error(
        '删除消息失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * 获取消息详情
   */
  async getMessageById(
    messageId: string,
    userId: string
  ): Promise<InAppMessage | null> {
    try {
      const message = await prisma.reminder.findUnique({
        where: { id: messageId },
      });

      if (!message || message.userId !== userId) {
        return null;
      }

      return this.toInAppMessage(message);
    } catch (error) {
      logger.error(
        '获取消息详情失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * 清理过期消息（保留最近30天）
   */
  async cleanupExpiredMessages(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.reminder.deleteMany({
        where: {
          status: ReminderStatus.READ,
          createdAt: { lt: cutoffDate },
        },
      });

      logger.info(`清理过期消息完成: ${result.count}条`, {
        cutoffDate,
        count: result.count,
      } as Record<string, unknown>);

      return result.count;
    } catch (error) {
      logger.error(
        '清理过期消息失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return 0;
    }
  }

  /**
   * 将Prisma Reminder模型转换为站内消息接口
   */
  private toInAppMessage(reminder: PrismaReminder): InAppMessage {
    const isRead = reminder.status === ReminderStatus.READ;
    const metadata = reminder.metadata as Record<string, unknown> | null;
    const readAt = metadata?.readAt as Date | undefined;

    return {
      id: reminder.id,
      userId: reminder.userId,
      title: reminder.title,
      content: reminder.message,
      type: reminder.type,
      isRead,
      relatedType: reminder.relatedType,
      relatedId: reminder.relatedId,
      metadata,
      createdAt: reminder.createdAt,
      readAt: readAt || null,
    };
  }

  /**
   * 创建包含读取时间的metadata
   */
  private createMetadataWithReadAt(
    existingMetadata: Record<string, unknown> | null
  ): Record<string, unknown> {
    return {
      ...(existingMetadata || {}),
      readAt: new Date(),
    };
  }
}

// =============================================================================
// 导出
// =============================================================================

export const inAppMessageService = new InAppMessageService();
export default inAppMessageService;
