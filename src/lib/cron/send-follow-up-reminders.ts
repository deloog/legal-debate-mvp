/**
 * 跟进提醒定时任务
 *
 * 定期检查即将到期的跟进任务，并发送多渠道提醒
 * 支持手动触发和定时自动执行
 */

import { prisma } from '@/lib/db/prisma';
import {
  FollowUpTaskPriority,
  FollowUpTaskStatus,
  CommunicationType as PrismaCommunicationType,
} from '@prisma/client';
import {
  FollowUpTask,
  CommunicationType,
  FollowUpTaskPriority as AppFollowUpTaskPriority,
  FollowUpTaskStatus as AppFollowUpTaskStatus,
} from '@/types/client';
import { notificationService } from '@/lib/notification/notification-service';
import { NotificationChannel } from '@/types/notification';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

interface ReminderResult {
  taskId: string;
  clientId: string;
  clientName: string;
  summary: string;
  dueDate: Date;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  sent: boolean;
  channels: NotificationChannel[];
  error?: string;
}

interface SendRemindersResult {
  totalTasksChecked: number;
  tasksWithRemindersSent: number;
  tasksFailedToSend: number;
  results: ReminderResult[];
  errors: Array<{ taskId: string; error: string }>;
}

interface RemindersStats {
  pendingTasksCount: number;
  urgentTasksCount: number; // 24小时内到期
  highPriorityTasksCount: number;
  mediumPriorityTasksCount: number;
  lowPriorityTasksCount: number;
  tasksExpiringNext24h: Array<{
    id: string;
    clientId: string;
    clientName: string;
    summary: string;
    dueDate: Date;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }>;
}

// =============================================================================
// 跟进提醒定时任务
// =============================================================================

/**
 * 获取提醒提前时间（小时）
 * 根据任务优先级返回不同的提前时间
 */
function getReminderHoursBeforeDue(priority: FollowUpTaskPriority): number {
  switch (priority) {
    case 'HIGH':
      return 24; // 高优先级提前24小时
    case 'MEDIUM':
      return 48; // 中优先级提前48小时
    case 'LOW':
      return 72; // 低优先级提前72小时
    default:
      return 48;
  }
}

/**
 * 检查任务是否应该发送提醒
 * @param task 跟进任务
 * @param hoursBeforeDue 提前多少小时
 * @returns 是否应该发送提醒
 */
function shouldSendReminder(
  task: { dueDate: Date },
  hoursBeforeDue: number
): boolean {
  const now = new Date();
  const timeUntilDue = task.dueDate.getTime() - now.getTime();
  const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);

  // 检查是否在提醒时间窗口内（±1小时）
  return (
    hoursUntilDue >= hoursBeforeDue - 1 && hoursUntilDue <= hoursBeforeDue + 1
  );
}

/**
 * 查询需要发送提醒的跟进任务
 * @returns 需要发送提醒的任务列表
 */
async function getTasksNeedingReminders(): Promise<
  Array<{
    id: string;
    clientId: string;
    communicationId: string;
    userId: string;
    type: PrismaCommunicationType;
    summary: string;
    dueDate: Date;
    priority: FollowUpTaskPriority;
    status: FollowUpTaskStatus;
    completedAt: Date | null;
    notes: string | null;
    metadata: unknown | null;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: string;
      userId: string;
      name: string;
      email: string | null;
      phone: string | null;
    };
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  }>
> {
  const now = new Date();

  // 查询所有待处理的跟进任务
  const tasks = await prisma.followUpTask.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: now, // 尚未到期
      },
    },
    include: {
      client: {
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      dueDate: 'asc',
    },
  });

  return tasks as Array<{
    id: string;
    clientId: string;
    communicationId: string;
    userId: string;
    type: CommunicationType;
    summary: string;
    dueDate: Date;
    priority: FollowUpTaskPriority;
    status: FollowUpTaskStatus;
    completedAt: Date | null;
    notes: string | null;
    metadata: unknown | null;
    createdAt: Date;
    updatedAt: Date;
    client: {
      id: string;
      userId: string;
      name: string;
      email: string | null;
      phone: string | null;
    };
    user: {
      id: string;
      email: string;
      name: string | null;
    };
  }>;
}

/**
 * 检查任务是否已发送过提醒（幂等性检查）
 * 通过查询通知记录表判断
 */
async function hasReminderBeenSent(taskId: string): Promise<boolean> {
  try {
    // 查询近期是否已发送过提醒（24小时内）
    const recentNotification = await prisma.notification.findFirst({
      where: {
        metadata: {
          path: ['relatedId'],
          equals: taskId,
        },
        type: 'REMINDER',
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时内
        },
      },
    });
    return !!recentNotification;
  } catch (error) {
    logger.error(`检查提醒状态失败: ${taskId}`, error as Error);
    return false; // 出错时默认允许发送（避免阻塞）
  }
}

/**
 * 记录提醒发送日志
 */
async function logReminderSent(
  taskId: string,
  userId: string,
  channels: NotificationChannel[],
  success: boolean
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: 'SYSTEM',
        priority: 'NORMAL',
        status: 'UNREAD',
        title: '跟进任务提醒',
        content: `跟进任务提醒已${success ? '发送' : '失败'}`,
        metadata: {
          channels: channels as string[],
          relatedType: 'FOLLOW_UP_TASK',
          relatedId: taskId,
          status: success ? 'SENT' : 'FAILED',
        },
      },
    });
  } catch (error) {
    logger.error(`记录提醒日志失败: ${taskId}`, error as Error);
  }
}

/**
 * 为单个任务发送提醒
 * @param task 跟进任务
 * @returns 提醒结果
 */
async function sendReminderForTask(task: {
  id: string;
  clientId: string;
  communicationId: string;
  userId: string;
  type: PrismaCommunicationType;
  summary: string;
  dueDate: Date;
  priority: FollowUpTaskPriority;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}): Promise<ReminderResult> {
  const hoursBeforeDue = getReminderHoursBeforeDue(task.priority);
  const shouldSend = shouldSendReminder(task, hoursBeforeDue);

  if (!shouldSend) {
    return {
      taskId: task.id,
      clientId: task.clientId,
      clientName: task.client.name,
      summary: task.summary,
      dueDate: task.dueDate,
      priority: task.priority,
      sent: false,
      channels: [],
      error: '不在提醒时间窗口内',
    };
  }

  // 幂等性检查：检查是否已发送过提醒
  const alreadySent = await hasReminderBeenSent(task.id);
  if (alreadySent) {
    logger.info(`提醒已发送过，跳过: ${task.id}`);
    return {
      taskId: task.id,
      clientId: task.clientId,
      clientName: task.client.name,
      summary: task.summary,
      dueDate: task.dueDate,
      priority: task.priority,
      sent: false,
      channels: [],
      error: '提醒已发送过',
    };
  }

  // 获取应该使用的通知渠道
  const channels = notificationService.getNotificationChannelsForTask(
    task as unknown as never
  );

  try {
    const followUpTask: FollowUpTask = {
      id: task.id,
      clientId: task.clientId,
      communicationId: task.communicationId,
      userId: task.userId,
      type: task.type as CommunicationType,
      summary: task.summary,
      dueDate: task.dueDate,
      priority: task.priority as AppFollowUpTaskPriority,
      status: 'PENDING' as AppFollowUpTaskStatus,
      completedAt: null,
      notes: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      clientName: task.client.name,
      clientEmail: task.client.email || '',
      clientPhone: task.client.phone || '',
    };

    const result = await notificationService.sendFollowUpTaskReminder(
      followUpTask,
      channels
    );

    if (result.success) {
      // 记录发送日志（幂等性保证）
      await logReminderSent(task.id, task.userId, channels, true);

      logger.info(`跟进任务提醒发送成功: ${task.id}`, {
        clientId: task.clientId,
        clientName: task.client.name,
        channels,
        dueDate: task.dueDate,
      });

      return {
        taskId: task.id,
        clientId: task.clientId,
        clientName: task.client.name,
        summary: task.summary,
        dueDate: task.dueDate,
        priority: task.priority,
        sent: true,
        channels,
      };
    } else {
      // 记录发送失败日志
      await logReminderSent(task.id, task.userId, channels, false);

      logger.warn(`跟进任务提醒发送失败: ${task.id}`, {
        clientId: task.clientId,
        clientName: task.client.name,
        channels,
        errors: result.errors,
      });

      return {
        taskId: task.id,
        clientId: task.clientId,
        clientName: task.client.name,
        summary: task.summary,
        dueDate: task.dueDate,
        priority: task.priority,
        sent: false,
        channels,
        error: result.errors
          ? Object.values(result.errors).join('; ')
          : '未知错误',
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`跟进任务提醒发送异常: ${task.id}`, {
      clientId: task.clientId,
      clientName: task.client.name,
      error: errorMessage,
    } as never);

    return {
      taskId: task.id,
      clientId: task.clientId,
      clientName: task.client.name,
      summary: task.summary,
      dueDate: task.dueDate,
      priority: task.priority,
      sent: false,
      channels,
      error: errorMessage,
    };
  }
}

/**
 * 发送跟进提醒
 * 检查所有待处理的跟进任务，为需要提醒的任务发送通知
 * @returns 发送结果
 */
export async function sendFollowUpReminders(): Promise<SendRemindersResult> {
  logger.info('[SendFollowUpReminders] 开始检查跟进任务提醒...');

  try {
    // 查询需要检查的跟进任务
    const tasks = await getTasksNeedingReminders();

    if (tasks.length === 0) {
      logger.info('[SendFollowUpReminders] 没有待处理的跟进任务');
      return {
        totalTasksChecked: 0,
        tasksWithRemindersSent: 0,
        tasksFailedToSend: 0,
        results: [],
        errors: [],
      };
    }

    logger.info(
      `[SendFollowUpReminders] 找到 ${tasks.length} 个待处理的跟进任务`
    );

    // 为每个任务发送提醒
    const results: ReminderResult[] = [];
    const errors: Array<{ taskId: string; error: string }> = [];

    for (const task of tasks) {
      const result = await sendReminderForTask(task);
      results.push(result);

      if (
        !result.sent &&
        result.error &&
        result.error !== '不在提醒时间窗口内'
      ) {
        errors.push({
          taskId: result.taskId,
          error: result.error,
        });
      }
    }

    // 统计结果
    const tasksWithRemindersSent = results.filter(r => r.sent).length;
    const tasksFailedToSend = errors.length;

    logger.info('[SendFollowUpReminders] 跟进提醒发送完成:', {
      totalTasksChecked: tasks.length,
      tasksWithRemindersSent,
      tasksFailedToSend,
    } as never);

    return {
      totalTasksChecked: tasks.length,
      tasksWithRemindersSent,
      tasksFailedToSend,
      results,
      errors,
    };
  } catch (error) {
    logger.error(
      '[SendFollowUpReminders] 发送跟进提醒时发生错误:',
      error instanceof Error ? error : undefined
    );
    throw error;
  }
}

/**
 * 手动触发跟进提醒（用于测试或立即执行）
 * @returns 执行结果
 */
export async function manuallySendFollowUpReminders(): Promise<{
  success: boolean;
  message: string;
  result: SendRemindersResult;
}> {
  try {
    logger.info('[SendFollowUpReminders] 手动触发跟进提醒...');
    const result = await sendFollowUpReminders();

    return {
      success: true,
      message: `检查了 ${result.totalTasksChecked} 个跟进任务，发送 ${result.tasksWithRemindersSent} 个提醒，失败 ${result.tasksFailedToSend} 个`,
      result,
    };
  } catch (error) {
    logger.error(
      '[SendFollowUpReminders] 手动发送跟进提醒失败:',
      error instanceof Error ? error : undefined
    );

    return {
      success: false,
      message: '发送跟进提醒失败',
      result: {
        totalTasksChecked: 0,
        tasksWithRemindersSent: 0,
        tasksFailedToSend: 0,
        results: [],
        errors: [],
      },
    };
  }
}

/**
 * 获取跟进提醒统计信息
 * @returns 统计信息
 */
export async function getFollowUpRemindersStats(): Promise<RemindersStats> {
  try {
    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 统计待处理任务数
    const pendingTasksCount = await prisma.followUpTask.count({
      where: {
        status: 'PENDING',
      },
    });

    // 统计24小时内到期任务数
    const urgentTasksCount = await prisma.followUpTask.count({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: next24h,
        },
      },
    });

    // 统计各优先级任务数
    const highPriorityTasksCount = await prisma.followUpTask.count({
      where: {
        status: 'PENDING',
        priority: 'HIGH',
      },
    });

    const mediumPriorityTasksCount = await prisma.followUpTask.count({
      where: {
        status: 'PENDING',
        priority: 'MEDIUM',
      },
    });

    const lowPriorityTasksCount = await prisma.followUpTask.count({
      where: {
        status: 'PENDING',
        priority: 'LOW',
      },
    });

    // 获取24小时内到期的任务列表
    const tasksExpiringNext24h = await prisma.followUpTask.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: next24h,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            userId: true,
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 20,
    });

    return {
      pendingTasksCount,
      urgentTasksCount,
      highPriorityTasksCount,
      mediumPriorityTasksCount,
      lowPriorityTasksCount,
      tasksExpiringNext24h: tasksExpiringNext24h.map(task => ({
        id: task.id,
        clientId: task.clientId,
        clientName: task.client.name,
        summary: task.summary,
        dueDate: task.dueDate,
        priority: task.priority,
      })),
    };
  } catch (error) {
    logger.error(
      '[SendFollowUpReminders] 获取跟进提醒统计失败:',
      error instanceof Error ? error : undefined
    );
    throw error;
  }
}

/**
 * 获取即将到期的跟进任务列表
 * @param hours 未来多少小时内到期的任务，默认为24小时
 * @param limit 返回数量限制，默认为50
 * @returns 即将到期的任务列表
 */
export async function getTasksExpiringSoon(
  hours = 24,
  limit = 50
): Promise<
  Array<{
    id: string;
    clientId: string;
    clientName: string;
    summary: string;
    dueDate: Date;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    hoursUntilDue: number;
  }>
> {
  try {
    const now = new Date();
    const timeLater = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const tasks = await prisma.followUpTask.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: timeLater,
        },
      },
      include: {
        client: {
          select: {
            id: true,
            userId: true,
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: limit,
    });

    return tasks.map(task => ({
      id: task.id,
      clientId: task.clientId,
      clientName: task.client.name,
      summary: task.summary,
      dueDate: task.dueDate,
      priority: task.priority,
      hoursUntilDue: Math.round(
        (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60)
      ),
    }));
  } catch (error) {
    logger.error(
      '[SendFollowUpReminders] 获取即将到期任务失败:',
      error instanceof Error ? error : undefined
    );
    throw error;
  }
}

/**
 * 标记已过期的跟进任务
 * 将已过期的跟进任务状态更新为已取消
 * @returns 标记结果
 */
export async function markExpiredFollowUpTasks(): Promise<{
  cancelledCount: number;
}> {
  try {
    const now = new Date();

    // 查询已过期但状态仍为PENDING的任务
    const expiredTasks = await prisma.followUpTask.updateMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: now,
        },
      },
      data: {
        status: 'CANCELLED',
        notes: '任务已过期，自动取消',
      },
    });

    logger.info('[SendFollowUpReminders] 标记过期任务完成:', {
      cancelledCount: expiredTasks.count,
    } as never);

    return {
      cancelledCount: expiredTasks.count,
    };
  } catch (error) {
    logger.error(
      '[SendFollowUpReminders] 标记过期任务失败:',
      error instanceof Error ? error : undefined
    );
    throw error;
  }
}
