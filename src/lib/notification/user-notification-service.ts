/**
 * 用户通知服务模块
 *
 * 基于 Notification 模型的用户通知服务
 * 提供通知的创建、查询、标记已读、归档等功能
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/agent/security/logger';
import {
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  Prisma,
} from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  priority?: NotificationPriority;
  link?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface NotificationFilters {
  userId: string;
  status?: NotificationStatus;
  type?: NotificationType;
  priority?: NotificationPriority;
}

export interface NotificationListOptions {
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface NotificationListResult {
  notifications: NotificationItem[];
  total: number;
  unreadCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  content: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  expiresAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

// =============================================================================
// 用户通知服务类
// =============================================================================

class UserNotificationService {
  private static instance: UserNotificationService;

  private constructor() {}

  static getInstance(): UserNotificationService {
    if (!UserNotificationService.instance) {
      UserNotificationService.instance = new UserNotificationService();
    }
    return UserNotificationService.instance;
  }

  /**
   * 创建通知
   */
  async createNotification(
    input: CreateNotificationInput
  ): Promise<NotificationItem> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          content: input.content,
          priority: input.priority || NotificationPriority.NORMAL,
          link: input.link,
          metadata: input.metadata as Prisma.JsonObject,
          expiresAt: input.expiresAt,
        },
      });

      logger.info(`通知创建成功: ${notification.id}`, {
        userId: input.userId,
        type: input.type,
      } as Record<string, unknown>);

      return this.mapToNotificationItem(notification);
    } catch (error) {
      logger.error(
        '创建通知失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 批量创建通知（发送给多个用户）
   */
  async createBulkNotifications(
    userIds: string[],
    input: Omit<CreateNotificationInput, 'userId'>
  ): Promise<number> {
    try {
      const result = await prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: input.type,
          title: input.title,
          content: input.content,
          priority: input.priority || NotificationPriority.NORMAL,
          link: input.link,
          metadata: input.metadata as Prisma.JsonObject,
          expiresAt: input.expiresAt,
        })),
      });

      logger.info(`批量创建通知成功: ${result.count}条`, {
        userCount: userIds.length,
        type: input.type,
      } as Record<string, unknown>);

      return result.count;
    } catch (error) {
      logger.error(
        '批量创建通知失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 获取通知列表
   */
  async getNotifications(
    filters: NotificationFilters,
    options: NotificationListOptions = {}
  ): Promise<NotificationListResult> {
    const {
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: Prisma.NotificationWhereInput = {
      userId: filters.userId,
      ...(filters.status && { status: filters.status }),
      ...(filters.type && { type: filters.type }),
      ...(filters.priority && { priority: filters.priority }),
      // 排除已过期的通知
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    try {
      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: {
            userId: filters.userId,
            status: NotificationStatus.UNREAD,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        }),
      ]);

      return {
        notifications: notifications.map(n => this.mapToNotificationItem(n)),
        total,
        unreadCount,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      logger.error(
        '获取通知列表失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 获取单个通知
   */
  async getNotificationById(
    id: string,
    userId: string
  ): Promise<NotificationItem | null> {
    try {
      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      return notification ? this.mapToNotificationItem(notification) : null;
    } catch (error) {
      logger.error(
        '获取通知详情失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 标记为已读
   */
  async markAsRead(id: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.updateMany({
        where: { id, userId, status: NotificationStatus.UNREAD },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      });

      if (result.count > 0) {
        logger.info(`通知已标记为已读: ${id}`);
      }

      return result.count > 0;
    } catch (error) {
      logger.error(
        '标记通知已读失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 批量标记已读
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: { userId, status: NotificationStatus.UNREAD },
        data: {
          status: NotificationStatus.READ,
          readAt: new Date(),
        },
      });

      logger.info(`批量标记通知已读: ${result.count}条`, {
        userId,
      } as Record<string, unknown>);

      return result.count;
    } catch (error) {
      logger.error(
        '批量标记通知已读失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 归档通知
   */
  async archiveNotification(id: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.updateMany({
        where: { id, userId },
        data: { status: NotificationStatus.ARCHIVED },
      });

      if (result.count > 0) {
        logger.info(`通知已归档: ${id}`);
      }

      return result.count > 0;
    } catch (error) {
      logger.error(
        '归档通知失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 删除通知
   */
  async deleteNotification(id: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.notification.deleteMany({
        where: { id, userId },
      });

      if (result.count > 0) {
        logger.info(`通知已删除: ${id}`);
      }

      return result.count > 0;
    } catch (error) {
      logger.error(
        '删除通知失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 清理过期通知
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const result = await prisma.notification.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info(`清理过期通知: ${result.count}条`);

      return result.count;
    } catch (error) {
      logger.error(
        '清理过期通知失败',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      return prisma.notification.count({
        where: {
          userId,
          status: NotificationStatus.UNREAD,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
    } catch (error) {
      logger.error(
        '获取未读通知数量失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return 0;
    }
  }

  /**
   * 映射数据库记录到通知项
   */
  private mapToNotificationItem(notification: {
    id: string;
    type: NotificationType;
    priority: NotificationPriority;
    status: NotificationStatus;
    title: string;
    content: string;
    link: string | null;
    metadata: Prisma.JsonValue;
    expiresAt: Date | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationItem {
    return {
      id: notification.id,
      type: notification.type,
      priority: notification.priority,
      status: notification.status,
      title: notification.title,
      content: notification.content,
      link: notification.link,
      metadata: notification.metadata as Record<string, unknown> | null,
      expiresAt: notification.expiresAt,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    };
  }
}

// =============================================================================
// 便捷函数
// =============================================================================

/**
 * 获取用户通知服务实例
 */
export function getUserNotificationService(): UserNotificationService {
  return UserNotificationService.getInstance();
}

/**
 * 发送系统通知
 */
export async function sendSystemNotification(
  userId: string,
  title: string,
  content: string,
  options?: {
    priority?: NotificationPriority;
    link?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<NotificationItem> {
  const service = getUserNotificationService();
  return service.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title,
    content,
    ...options,
  });
}

/**
 * 发送案件通知
 */
export async function sendCaseNotification(
  userId: string,
  title: string,
  content: string,
  caseId: string,
  options?: {
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
  }
): Promise<NotificationItem> {
  const service = getUserNotificationService();
  return service.createNotification({
    userId,
    type: NotificationType.CASE,
    title,
    content,
    link: `/cases/${caseId}`,
    metadata: { caseId, ...options?.metadata },
    priority: options?.priority,
  });
}

/**
 * 发送会员通知
 */
export async function sendMembershipNotification(
  userId: string,
  title: string,
  content: string,
  options?: {
    priority?: NotificationPriority;
    link?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<NotificationItem> {
  const service = getUserNotificationService();
  return service.createNotification({
    userId,
    type: NotificationType.MEMBERSHIP,
    title,
    content,
    link: options?.link || '/membership',
    ...options,
  });
}

/**
 * 发送支付通知
 */
export async function sendPaymentNotification(
  userId: string,
  title: string,
  content: string,
  orderId?: string,
  options?: {
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
  }
): Promise<NotificationItem> {
  const service = getUserNotificationService();
  return service.createNotification({
    userId,
    type: NotificationType.PAYMENT,
    title,
    content,
    link: orderId ? `/orders/${orderId}` : '/orders',
    metadata: { orderId, ...options?.metadata },
    priority: options?.priority,
  });
}

/**
 * 发送告警通知
 */
export async function sendAlertNotification(
  userId: string,
  title: string,
  content: string,
  alertId?: string,
  options?: {
    priority?: NotificationPriority;
    metadata?: Record<string, unknown>;
  }
): Promise<NotificationItem> {
  const service = getUserNotificationService();
  return service.createNotification({
    userId,
    type: NotificationType.ALERT,
    title,
    content,
    link: alertId ? `/admin/alerts/${alertId}` : '/admin/alerts',
    metadata: { alertId, ...options?.metadata },
    priority: options?.priority || NotificationPriority.HIGH,
  });
}

// =============================================================================
// 导出
// =============================================================================

export { UserNotificationService };
export default getUserNotificationService;
