/**
 * 知识图谱通知服务
 * 用于检测待审核关系数量并发送通知
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  VerificationStatus,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
} from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 通知阈值配置
 */
export interface NotificationThresholdConfig {
  threshold: number; // 待审核关系数量阈值
  checkIntervalMinutes: number; // 检查间隔（分钟）
}

/**
 * 阈值检查结果
 */
export interface ThresholdCheckResult {
  shouldNotify: boolean; // 是否应该发送通知
  pendingCount: number; // 当前待审核数量
  threshold: number; // 阈值
}

// =============================================================================
// 阈值检查函数
// =============================================================================

/**
 * 检查待审核关系是否超过阈值
 * @param config 通知配置
 * @returns 检查结果
 */
export async function checkPendingRelationsThreshold(
  config: NotificationThresholdConfig
): Promise<ThresholdCheckResult> {
  try {
    // 验证配置
    if (config.threshold < 0) {
      return {
        shouldNotify: false,
        pendingCount: 0,
        threshold: config.threshold,
      };
    }

    // 查询待审核关系数量
    const pendingCount = await prisma.lawArticleRelation.count({
      where: {
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    // 判断是否超过阈值
    const shouldNotify = pendingCount >= config.threshold;

    return {
      shouldNotify,
      pendingCount,
      threshold: config.threshold,
    };
  } catch (error) {
    logger.error('检查待审核关系阈值失败', { error });
    return {
      shouldNotify: false,
      pendingCount: 0,
      threshold: config.threshold,
    };
  }
}

// =============================================================================
// 通知发送函数
// =============================================================================

/**
 * 发送待审核关系通知
 * @param userId 用户ID
 * @param pendingCount 待审核数量
 * @param threshold 阈值
 */
export async function sendPendingRelationsNotification(
  userId: string,
  pendingCount: number,
  threshold: number
): Promise<void> {
  try {
    // 检查是否存在相同的未读通知（避免重复发送）
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId,
        type: NotificationType.ALERT,
        status: NotificationStatus.UNREAD,
        title: {
          contains: '待审核关系数量提醒',
        },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // 1小时内
        },
      },
    });

    // 如果已存在未读通知，则不重复发送
    if (existingNotification) {
      logger.info(`用户 ${userId} 已有未读的待审核通知，跳过发送`);
      return;
    }

    // 创建通知
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.ALERT,
        priority: NotificationPriority.HIGH,
        status: NotificationStatus.UNREAD,
        title: '待审核关系数量提醒',
        content: `当前有 ${pendingCount} 个法条关系待审核，已超过阈值 ${threshold}。请及时处理。`,
        link: '/admin/knowledge-graph?tab=review',
        metadata: {
          pendingCount,
          threshold,
          source: 'knowledge_graph',
          notificationType: 'pending_relations_threshold',
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天后过期
      },
    });

    logger.info(`已向用户 ${userId} 发送待审核关系通知`);
  } catch (error) {
    logger.error('发送待审核关系通知失败', { error, userId });
    throw new Error('发送通知失败');
  }
}

/**
 * 向所有管理员发送待审核关系通知
 * @param pendingCount 待审核数量
 * @param threshold 阈值
 */
export async function notifyAllAdmins(
  pendingCount: number,
  threshold: number
): Promise<void> {
  try {
    // 获取所有管理员
    const admins = await prisma.user.findMany({
      where: {
        role: {
          in: ['ADMIN', 'SUPER_ADMIN'],
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    const adminCount = admins.length;

    // 向所有管理员发送通知
    await Promise.all(
      admins.map(admin =>
        sendPendingRelationsNotification(admin.id, pendingCount, threshold)
      )
    );

    logger.info(`已向 ${adminCount} 位管理员发送待审核关系通知`);
  } catch (error) {
    logger.error('向管理员发送通知失败', { error });
    throw new Error('向管理员发送通知失败');
  }
}

// =============================================================================
// 审核完成通知函数
// =============================================================================

/**
 * 发送审核完成通知
 * @param userId 用户ID（审核人）
 * @param relationId 关系ID
 * @param approved 是否通过
 */
export async function sendVerificationCompletedNotification(
  userId: string,
  relationId: string,
  approved: boolean
): Promise<void> {
  try {
    // 获取关系详情
    const relation = await prisma.lawArticleRelation.findUnique({
      where: { id: relationId },
      include: {
        source: {
          select: {
            lawName: true,
            articleNumber: true,
          },
        },
        target: {
          select: {
            lawName: true,
            articleNumber: true,
          },
        },
      },
    });

    if (!relation) {
      logger.warn(`关系 ${relationId} 不存在`, { relationId });
      return;
    }

    // 创建通知
    await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.SYSTEM,
        priority: NotificationPriority.NORMAL,
        status: NotificationStatus.UNREAD,
        title: `关系审核${approved ? '通过' : '拒绝'}`,
        content: `您审核的法条关系「${relation.source.lawName} 第${relation.source.articleNumber}条 → ${relation.target.lawName} 第${relation.target.articleNumber}条」已${approved ? '通过' : '被拒绝'}。`,
        link: `/admin/knowledge-graph?relationId=${relationId}`,
        metadata: {
          relationId,
          approved,
          source: 'knowledge_graph',
          notificationType: 'verification_completed',
        },
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后过期
      },
    });

    logger.info(`已向用户 ${userId} 发送审核完成通知`);
  } catch (error) {
    logger.error('发送审核完成通知失败', { error, userId, relationId });
    // 审核完成通知失败不应影响主流程，只记录日志
  }
}

// =============================================================================
// 定时任务函数
// =============================================================================

/**
 * 定时检查待审核关系并发送通知
 * 此函数应该由定时任务调用（如cron job）
 * @param config 通知配置
 */
export async function scheduledPendingRelationsCheck(
  config: NotificationThresholdConfig
): Promise<void> {
  try {
    logger.info('开始检查待审核关系数量...');

    // 检查阈值
    const result = await checkPendingRelationsThreshold(config);

    if (result.shouldNotify) {
      logger.info(
        `待审核关系数量 ${result.pendingCount} 超过阈值 ${result.threshold}，发送通知...`
      );

      // 向所有管理员发送通知
      await notifyAllAdmins(result.pendingCount, result.threshold);

      logger.info('通知发送完成');
    } else {
      logger.info(
        `待审核关系数量 ${result.pendingCount} 未超过阈值 ${result.threshold}，无需发送通知`
      );
    }
  } catch (error) {
    logger.error('定时检查待审核关系失败', { error });
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取用户未读的知识图谱通知数量
 * @param userId 用户ID
 * @returns 未读通知数量
 */
export async function getUnreadKnowledgeGraphNotificationCount(
  userId: string
): Promise<number> {
  try {
    const count = await prisma.notification.count({
      where: {
        userId,
        status: NotificationStatus.UNREAD,
        metadata: {
          path: ['source'],
          equals: 'knowledge_graph',
        },
      },
    });

    return count;
  } catch (error) {
    logger.error('获取未读通知数量失败', { error, userId });
    return 0;
  }
}

/**
 * 标记知识图谱通知为已读
 * @param userId 用户ID
 * @param notificationId 通知ID
 */
export async function markKnowledgeGraphNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<void> {
  try {
    await prisma.notification.update({
      where: {
        id: notificationId,
        userId, // 确保只能标记自己的通知
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });

    logger.info(`通知 ${notificationId} 已标记为已读`);
  } catch (error) {
    logger.error('标记通知为已读失败', { error, userId, notificationId });
    throw new Error('标记通知为已读失败');
  }
}
