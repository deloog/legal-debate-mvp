/**
 * 提醒生成器模块
 *
 * 负责根据法庭日程、截止日期等自动生成提醒。
 */

import { logger } from '@/lib/agent/security/logger';
import { prisma } from '@/lib/db/prisma';
import {
  CreateReminderInput,
  NotificationChannelValues,
  ReminderPreferences,
  ReminderTypeValues,
} from '@/types/notification';
import { reminderService } from './reminder-service';

// =============================================================================
// 默认提醒配置
// =============================================================================

const DEFAULT_COURT_SCHEDULE_CONFIG: NonNullable<
  ReminderPreferences['courtSchedule']
> = {
  enabled: true,
  advanceDays: 1,
  channels: [NotificationChannelValues.IN_APP, NotificationChannelValues.EMAIL],
};

const DEFAULT_DEADLINE_CONFIG: NonNullable<ReminderPreferences['deadline']> = {
  enabled: true,
  advanceDays: [7, 3, 1],
  channels: [NotificationChannelValues.IN_APP, NotificationChannelValues.EMAIL],
};

const DEFAULT_FOLLOW_UP_CONFIG: NonNullable<ReminderPreferences['followUp']> = {
  enabled: true,
  channels: [NotificationChannelValues.IN_APP],
  autoRemind: true,
};

const DEFAULT_TASK_CONFIG: NonNullable<ReminderPreferences['task']> = {
  enabled: true,
  channels: [NotificationChannelValues.IN_APP, NotificationChannelValues.EMAIL],
  priorities: ['HIGH', 'URGENT'],
};

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  channels: [NotificationChannelValues.IN_APP, NotificationChannelValues.EMAIL],
  quietHours: null,
  disabledTypes: [],
  courtSchedule: DEFAULT_COURT_SCHEDULE_CONFIG,
  deadline: DEFAULT_DEADLINE_CONFIG,
  followUp: DEFAULT_FOLLOW_UP_CONFIG,
  task: DEFAULT_TASK_CONFIG,
};

// =============================================================================
// 提醒生成器
// =============================================================================

class ReminderGenerator {
  /**
   * 为法庭日程生成提醒
   */
  async generateCourtScheduleReminders(
    courtScheduleId: string,
    preferences?: ReminderPreferences
  ): Promise<void> {
    try {
      const config =
        preferences?.courtSchedule ?? DEFAULT_COURT_SCHEDULE_CONFIG;

      if (!config.enabled) {
        return;
      }

      const courtSchedule = await prisma.courtSchedule.findUnique({
        where: { id: courtScheduleId },
        include: { case: true },
      });

      if (!courtSchedule) {
        logger.warn(`法庭日程不存在: ${courtScheduleId}`);
        return;
      }

      const inputs: CreateReminderInput[] = [];

      // 支持 advanceDays 为数组或单个值
      const daysArray = Array.isArray(config.advanceDays)
        ? config.advanceDays
        : [config.advanceDays];

      for (const days of daysArray) {
        const reminderTime = new Date(courtSchedule.startTime.getTime());
        reminderTime.setDate(reminderTime.getDate() - days);

        const input: CreateReminderInput = {
          userId: courtSchedule.case.userId,
          type: ReminderTypeValues.COURT_SCHEDULE,
          title: `法庭提醒: ${courtSchedule.title}`,
          content: `您的案件"${courtSchedule.case.title}"将于${days}天后开庭，请提前做好准备。\n\n开庭时间：${courtSchedule.startTime.toLocaleString('zh-CN')}\n地点：${courtSchedule.location || '待定'}`,
          scheduledAt: reminderTime,
          channels: config.channels,
          relatedType: 'CourtSchedule',
          relatedId: courtScheduleId,
          metadata: {
            courtScheduleId,
            caseId: courtSchedule.caseId,
            caseTitle: courtSchedule.case.title,
            location: courtSchedule.location,
            judge: courtSchedule.judge,
          },
        };

        inputs.push(input);
      }

      await reminderService.createReminders(inputs);
      logger.info(`为法庭日程生成提醒成功: ${courtScheduleId}`, {
        reminderCount: inputs.length,
      } as never);
    } catch (error) {
      logger.error(
        `为法庭日程生成提醒失败: ${courtScheduleId}`,
        error as Error as never
      );
    }
  }

  /**
   * 为跟进任务生成提醒
   */
  async generateFollowUpTaskReminders(
    taskId: string,
    preferences?: ReminderPreferences
  ): Promise<void> {
    try {
      const config = preferences?.task ?? DEFAULT_REMINDER_PREFERENCES.task;

      if (!config || !config.enabled) {
        return;
      }

      const task = await prisma.followUpTask.findUnique({
        where: { id: taskId },
        include: { client: true },
      });

      if (!task) {
        logger.warn(`跟进任务不存在: ${taskId}`);
        return;
      }

      const inputs: CreateReminderInput[] = [];

      // 只为指定优先级的任务生成提醒
      if (task.priority && config.priorities.includes(task.priority)) {
        if (task.dueDate) {
          const hoursBefore = 24;
          const reminderTime = new Date(task.dueDate.getTime());
          reminderTime.setHours(reminderTime.getHours() - hoursBefore);

          const input: CreateReminderInput = {
            userId: task.userId,
            type: ReminderTypeValues.FOLLOW_UP,
            title: `跟进任务提醒: ${task.summary}`,
            content: `客户"${task.client.name}"的跟进任务将于${hoursBefore}小时后到期。\n\n任务：${task.summary}\n截止时间：${task.dueDate.toLocaleString('zh-CN')}`,
            scheduledAt: reminderTime,
            channels: config.channels,
            relatedType: 'FollowUpTask',
            relatedId: taskId,
            metadata: {
              taskId,
              clientId: task.clientId,
              clientName: task.client.name,
              priority: task.priority,
            },
          };

          inputs.push(input);
        }
      }

      if (inputs.length > 0) {
        await reminderService.createReminders(inputs);
        logger.info(`为跟进任务生成提醒成功: ${taskId}`, {
          reminderCount: inputs.length,
        } as never);
      }
    } catch (error) {
      logger.error(
        `为跟进任务生成提醒失败: ${taskId}`,
        error as Error as never
      );
    }
  }

  /**
   * 为截止日期生成提醒
   */
  async generateDeadlineReminders(
    deadline: Date,
    title: string,
    description: string,
    caseId: string,
    caseTitle: string,
    preferences?: ReminderPreferences
  ): Promise<void> {
    try {
      const config = preferences?.deadline ?? DEFAULT_DEADLINE_CONFIG;

      if (!config.enabled) {
        return;
      }

      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { userId: true },
      });

      if (!caseRecord) {
        logger.warn(`案件不存在，跳过截止日期提醒: ${caseId}`);
        return;
      }

      const inputs: CreateReminderInput[] = [];

      for (const days of config.advanceDays) {
        const reminderTime = new Date(deadline.getTime());
        reminderTime.setDate(reminderTime.getDate() - days);

        const input: CreateReminderInput = {
          userId: caseRecord.userId,
          type: ReminderTypeValues.DEADLINE,
          title: `截止日期提醒: ${title}`,
          content: `${description}\n\n案件：${caseTitle}\n截止时间：${deadline.toLocaleString('zh-CN')}`,
          scheduledAt: reminderTime,
          channels: config.channels,
          relatedType: 'CaseDeadline',
          relatedId: caseId,
          metadata: {
            caseId,
            caseTitle,
            deadline: deadline.toISOString(),
            daysBeforeDeadline: days,
          },
        };

        inputs.push(input);
      }

      await reminderService.createReminders(inputs);
      logger.info(`为截止日期生成提醒成功: ${caseId}`, {
        reminderCount: inputs.length,
      } as never);
    } catch (error) {
      logger.error(
        `为截止日期生成提醒失败: ${caseId}`,
        error as Error as never
      );
    }
  }

  /**
   * 为案件状态截止日期生成提醒
   */
  async generateCaseStatusDeadlineReminders(
    caseId: string,
    deadline: Date,
    statusTitle: string,
    preferences?: ReminderPreferences
  ): Promise<void> {
    try {
      const config = preferences?.deadline ?? DEFAULT_DEADLINE_CONFIG;

      if (!config.enabled) {
        return;
      }

      const caseRecord = await prisma.case.findUnique({
        where: { id: caseId },
        select: { userId: true },
      });

      if (!caseRecord) {
        logger.warn(`案件不存在，跳过案件状态截止提醒: ${caseId}`);
        return;
      }

      const advanceDays = config.advanceDays;

      for (const daysBefore of Array.isArray(advanceDays)
        ? advanceDays
        : [advanceDays]) {
        const reminderTime = new Date(deadline.getTime());
        reminderTime.setDate(reminderTime.getDate() - daysBefore);

        try {
          const input: CreateReminderInput = {
            userId: caseRecord.userId,
            type: ReminderTypeValues.DEADLINE,
            title: `案件截止提醒: ${statusTitle}`,
            content: `您的案件截止日期即将到来，请及时处理。\n\n截止时间：${deadline.toLocaleString('zh-CN')}`,
            scheduledAt: reminderTime,
            channels: config.channels,
            relatedType: 'CaseStatusDeadline',
            relatedId: caseId,
            metadata: {
              caseId,
              statusTitle,
              deadline: deadline.toISOString(),
            },
          };

          await reminderService.createReminder(input);
          logger.info(`为案件状态截止日期生成提醒成功: ${caseId}`, {
            reminderDaysBefore: daysBefore,
          } as never);
        } catch (innerError) {
          logger.error(
            `为案件状态截止日期创建提醒失败: ${caseId}`,
            innerError as Error as never
          );
        }
      }
    } catch (error) {
      logger.error(
        `为案件状态截止日期生成提醒失败: ${caseId}`,
        error as Error as never
      );
    }
  }

  /**
   * 生成所有待处理的法庭日程提醒
   */
  async generateAllPendingCourtScheduleReminders(): Promise<number> {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(
        now.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      const pendingSchedules = await prisma.courtSchedule.findMany({
        where: {
          startTime: {
            gte: now,
            lte: thirtyDaysFromNow,
          },
          status: 'SCHEDULED',
        },
        include: {
          case: {
            select: {
              id: true,
              title: true,
              userId: true,
            },
          },
        },
      });

      let totalReminders = 0;

      for (const schedule of pendingSchedules) {
        await this.generateCourtScheduleReminders(schedule.id);
        totalReminders++;
      }

      logger.info(
        `生成待处理法庭日程提醒完成，共处理 ${totalReminders} 个日程`,
        { totalReminders } as never
      );

      return totalReminders;
    } catch (error) {
      logger.error('生成待处理法庭日程提醒失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 生成所有待处理的跟进任务提醒
   */
  async generateAllPendingFollowUpTaskReminders(): Promise<number> {
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      );

      const pendingTasks = await prisma.followUpTask.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      let totalReminders = 0;

      for (const task of pendingTasks) {
        await this.generateFollowUpTaskReminders(task.id);
        totalReminders++;
      }

      logger.info(
        `生成待处理跟进任务提醒完成，共处理 ${totalReminders} 个任务`,
        { totalReminders } as never
      );

      return totalReminders;
    } catch (error) {
      logger.error('生成待处理跟进任务提醒失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 清理孤立的提醒（关联的源数据已被删除）
   */
  async cleanupOrphanReminders(): Promise<number> {
    try {
      const now = new Date();

      // 查找状态为 PENDING 但已过期的提醒
      const orphanReminders = await prisma.reminder.findMany({
        where: {
          status: 'PENDING',
          reminderTime: {
            lt: now,
          },
        },
      });

      let cleanedCount = 0;

      for (const reminder of orphanReminders) {
        let isOrphan = false;

        // 根据类型检查关联数据是否存在
        const reminderType = reminder.type as string;
        switch (reminderType) {
          case 'COURT_SCHEDULE':
            if (
              reminder.metadata &&
              typeof reminder.metadata === 'object' &&
              'courtScheduleId' in reminder.metadata
            ) {
              const schedule = await prisma.courtSchedule.findUnique({
                where: {
                  id: reminder.metadata.courtScheduleId as string,
                },
              });
              isOrphan = !schedule;
            }
            break;
          case 'FOLLOW_UP':
            if (
              reminder.metadata &&
              typeof reminder.metadata === 'object' &&
              'taskId' in reminder.metadata
            ) {
              const task = await prisma.followUpTask.findUnique({
                where: {
                  id: reminder.metadata.taskId as string,
                },
              });
              isOrphan = !task;
            }
            break;
          case 'DEADLINE':
            if (
              reminder.metadata &&
              typeof reminder.metadata === 'object' &&
              'caseId' in reminder.metadata
            ) {
              const caseItem = await prisma.case.findUnique({
                where: {
                  id: reminder.metadata.caseId as string,
                },
              });
              isOrphan = !caseItem;
            }
            break;
        }

        if (isOrphan) {
          await prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: 'DISMISSED' },
          });
          cleanedCount++;
        }
      }

      logger.info(`清理孤立提醒完成，共清理 ${cleanedCount} 个提醒`, {
        cleanedCount,
      } as never);

      return cleanedCount;
    } catch (error) {
      logger.error('清理孤立提醒失败', error as Error as never);
      return 0;
    }
  }
  /**
   * 为 Task 模型生成提醒（区别于 FollowUpTask）
   */
  async generateTaskItemReminders(
    taskId: string,
    preferences?: ReminderPreferences
  ): Promise<void> {
    try {
      const config = preferences?.task ?? DEFAULT_REMINDER_PREFERENCES.task;

      if (!config || !config.enabled) {
        return;
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          assignedUser: { select: { id: true, name: true, email: true } },
          case: { select: { id: true, title: true, caseNumber: true } },
        },
      });

      if (!task || !task.dueDate) {
        return;
      }

      // 只为指定优先级的任务生成提醒
      if (!config.priorities.includes(task.priority)) {
        return;
      }

      const hoursBefore = 24;
      const reminderTime = new Date(task.dueDate.getTime());
      reminderTime.setHours(reminderTime.getHours() - hoursBefore);

      // 提醒时间已过则不生成
      if (reminderTime <= new Date()) {
        return;
      }

      const caseInfo = task.case ? `案件「${task.case.title}」` : '';

      const input: CreateReminderInput = {
        userId: task.assignedTo ?? task.createdBy,
        type: ReminderTypeValues.FOLLOW_UP,
        title: `任务提醒: ${task.title}`,
        content: `${caseInfo}的任务将于${hoursBefore}小时后截止。\n\n任务：${task.title}\n截止时间：${task.dueDate.toLocaleString('zh-CN')}`,
        scheduledAt: reminderTime,
        channels: config.channels,
        relatedType: 'Task',
        relatedId: taskId,
        metadata: {
          taskId,
          taskType: 'Task',
          priority: task.priority,
          caseId: task.caseId ?? undefined,
          assignedTo: task.assignedTo ?? undefined,
        },
      };

      await reminderService.createReminders([input]);
      logger.info(`为任务生成提醒成功: ${taskId}`, { taskId } as never);
    } catch (error) {
      logger.error(`为任务生成提醒失败: ${taskId}`, error as Error as never);
    }
  }
}

// 导出提醒生成器实例
export const reminderGenerator = new ReminderGenerator();
export const reminderGeneratorInstance = reminderGenerator;

// 任务提醒生成器包装函数（FollowUpTask 版本）
export async function generateTaskReminders(
  taskId: string,
  preferences?: ReminderPreferences
): Promise<void> {
  return reminderGenerator.generateFollowUpTaskReminders(taskId, preferences);
}

// Task 模型提醒生成器包装函数
export async function generateTaskItemReminders(
  taskId: string,
  preferences?: ReminderPreferences
): Promise<void> {
  return reminderGenerator.generateTaskItemReminders(taskId, preferences);
}
