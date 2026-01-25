/**
 * 提醒生成器模块
 *
 * 负责根据法庭日程、截止日期等自动生成提醒。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/agent/security/logger';
import { reminderService } from './reminder-service';
import {
  CreateReminderInput,
  NotificationChannel,
  ReminderPreferences,
  ReminderType,
  TaskPriority,
} from '@/types/notification';
import { taskReminderGenerator } from '@/lib/task/task-reminder';

// =============================================================================
// 默认提醒配置
// =============================================================================

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  courtSchedule: {
    enabled: true,
    hoursBefore: [24, 1], // 提前24小时和1小时
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  },
  deadline: {
    enabled: true,
    daysBefore: [7, 3, 1], // 提前7天、3天、1天
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  },
  followUp: {
    enabled: true,
    hoursBefore: [24, 1],
    channels: [NotificationChannel.IN_APP],
  },
  task: {
    enabled: true,
    hoursBefore: [24, 1], // 提前24小时和1小时
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    priorities: [TaskPriority.HIGH, TaskPriority.URGENT], // 只为高优先级和紧急任务生成提醒
  },
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
        preferences?.courtSchedule ??
        DEFAULT_REMINDER_PREFERENCES.courtSchedule;

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

      for (const hoursBefore of config.hoursBefore) {
        const reminderTime = new Date(courtSchedule.startTime.getTime());
        reminderTime.setHours(reminderTime.getHours() - hoursBefore);

        const input: CreateReminderInput = {
          userId: courtSchedule.case.userId,
          type: ReminderType.COURT_SCHEDULE,
          title: `法庭提醒: ${courtSchedule.title}`,
          message: `您的案件"${courtSchedule.case.title}"将于${hoursBefore}小时后开庭，请提前做好准备。\n\n开庭时间：${courtSchedule.startTime.toLocaleString('zh-CN')}\n地点：${courtSchedule.location || '待定'}`,
          reminderTime,
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
      const config =
        preferences?.followUp ?? DEFAULT_REMINDER_PREFERENCES.followUp;

      if (!config.enabled) {
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

      for (const hoursBefore of config.hoursBefore) {
        const reminderTime = new Date(task.dueDate.getTime());
        reminderTime.setHours(reminderTime.getHours() - hoursBefore);

        const input: CreateReminderInput = {
          userId: task.userId,
          type: ReminderType.FOLLOW_UP,
          title: `跟进提醒: ${task.summary}`,
          message: `客户"${task.client.name}"的跟进任务将于${hoursBefore}小时后到期。\n\n任务：${task.summary}\n截止时间：${task.dueDate.toLocaleString('zh-CN')}`,
          reminderTime,
          channels: config.channels,
          relatedType: 'FollowUpTask',
          relatedId: taskId,
          metadata: {
            taskId,
            clientId: task.clientId,
            clientName: task.client.name,
            summary: task.summary,
          },
        };

        inputs.push(input);
      }

      await reminderService.createReminders(inputs);
      logger.info(`为跟进任务生成提醒成功: ${taskId}`, {
        reminderCount: inputs.length,
      } as never);
    } catch (error) {
      logger.error(
        `为跟进任务生成提醒失败: ${taskId}`,
        error as Error as never
      );
    }
  }

  /**
   * 为截止日期生成提醒（自定义截止日期）
   */
  async generateDeadlineReminders(
    userId: string,
    deadline: Date,
    title: string,
    description?: string,
    preferences?: ReminderPreferences
  ): Promise<void> {
    try {
      const config =
        preferences?.deadline ?? DEFAULT_REMINDER_PREFERENCES.deadline;

      if (!config.enabled) {
        return;
      }

      const inputs: CreateReminderInput[] = [];

      for (const daysBefore of config.daysBefore) {
        const reminderTime = new Date(deadline.getTime());
        reminderTime.setDate(reminderTime.getDate() - daysBefore);

        const input: CreateReminderInput = {
          userId,
          type: ReminderType.DEADLINE,
          title: `截止日期提醒: ${title}`,
          message: description
            ? `${description}\n\n截止时间：${deadline.toLocaleString('zh-CN')}`
            : `您有一个截止日期将于${daysBefore}天后到期。\n\n事项：${title}\n截止时间：${deadline.toLocaleString('zh-CN')}`,
          reminderTime,
          channels: config.channels,
          relatedType: 'CustomDeadline',
          metadata: {
            deadline: deadline.toISOString(),
            title,
            description,
          },
        };

        inputs.push(input);
      }

      await reminderService.createReminders(inputs);
      logger.info(`为截止日期生成提醒成功: ${title}`, {
        reminderCount: inputs.length,
      } as never);
    } catch (error) {
      logger.error(`为截止日期生成提醒失败: ${title}`, error as Error as never);
    }
  }

  /**
   * 为案件状态变更生成截止日期提醒
   */
  async generateCaseStatusDeadlineReminders(
    userId: string,
    caseId: string,
    caseTitle: string,
    deadline: Date,
    description: string
  ): Promise<void> {
    try {
      const inputs: CreateReminderInput[] = [];
      const reminderDaysBefore = [3, 1];

      for (const daysBefore of reminderDaysBefore) {
        const reminderTime = new Date(deadline.getTime());
        reminderTime.setDate(reminderTime.getDate() - daysBefore);

        const input: CreateReminderInput = {
          userId,
          type: ReminderType.DEADLINE,
          title: `案件截止提醒: ${caseTitle}`,
          message: `${description}\n\n案件：${caseTitle}\n截止时间：${deadline.toLocaleString('zh-CN')}`,
          reminderTime,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          relatedType: 'CaseStatus',
          relatedId: caseId,
          metadata: {
            caseId,
            caseTitle,
            deadline: deadline.toISOString(),
            description,
          },
        };

        inputs.push(input);
      }

      await reminderService.createReminders(inputs);
      logger.info(`为案件状态截止日期生成提醒成功: ${caseTitle}`, {
        reminderCount: inputs.length,
      } as never);
    } catch (error) {
      logger.error(
        `为案件状态截止日期生成提醒失败: ${caseTitle}`,
        error as Error as never
      );
    }
  }

  /**
   * 批量为所有即将到来的法庭日程生成提醒
   */
  async generateAllPendingCourtScheduleReminders(): Promise<number> {
    try {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后的日期

      const courtSchedules = await prisma.courtSchedule.findMany({
        where: {
          startTime: { gte: now, lte: futureLimit },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: { case: true },
      });

      let count = 0;

      for (const schedule of courtSchedules) {
        // 检查是否已经生成过提醒
        const existingReminders = await prisma.reminder.count({
          where: {
            relatedType: 'CourtSchedule',
            relatedId: schedule.id,
            status: { not: 'DISMISSED' },
          },
        });

        // 如果没有提醒或提醒数少于配置的提前提醒数，则生成新提醒
        if (
          existingReminders <
          DEFAULT_REMINDER_PREFERENCES.courtSchedule.hoursBefore.length
        ) {
          await this.generateCourtScheduleReminders(schedule.id);
          count++;
        }
      }

      logger.info(`批量生成法庭日程提醒完成: ${count}条`);
      return count;
    } catch (error) {
      logger.error('批量生成法庭日程提醒失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 批量为所有即将到期的跟进任务生成提醒
   */
  async generateAllPendingFollowUpTaskReminders(): Promise<number> {
    try {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天后的日期

      const tasks = await prisma.followUpTask.findMany({
        where: {
          dueDate: { gte: now, lte: futureLimit },
          status: 'PENDING',
        },
        include: { client: true },
      });

      let count = 0;

      for (const task of tasks) {
        // 检查是否已经生成过提醒
        const existingReminders = await prisma.reminder.count({
          where: {
            relatedType: 'FollowUpTask',
            relatedId: task.id,
            status: { not: 'DISMISSED' },
          },
        });

        // 如果没有提醒或提醒数少于配置的提前提醒数，则生成新提醒
        if (
          existingReminders <
          DEFAULT_REMINDER_PREFERENCES.followUp.hoursBefore.length
        ) {
          await this.generateFollowUpTaskReminders(task.id);
          count++;
        }
      }

      logger.info(`批量生成跟进任务提醒完成: ${count}条`);
      return count;
    } catch (error) {
      logger.error('批量生成跟进任务提醒失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 清理已关联已删除实体的提醒
   */
  async cleanupOrphanReminders(): Promise<number> {
    try {
      let count = 0;

      // 清理关联到已删除法庭日程的提醒
      const orphanCourtScheduleReminders = await prisma.reminder.findMany({
        where: {
          relatedType: 'CourtSchedule',
        },
      });

      for (const reminder of orphanCourtScheduleReminders) {
        const courtScheduleExists = await prisma.courtSchedule.findUnique({
          where: { id: reminder.relatedId || '' },
        });

        if (!courtScheduleExists) {
          await prisma.reminder.delete({ where: { id: reminder.id } });
          count++;
        }
      }

      // 清理关联到已删除跟进任务的提醒
      const orphanFollowUpTaskReminders = await prisma.reminder.findMany({
        where: {
          relatedType: 'FollowUpTask',
        },
      });

      for (const reminder of orphanFollowUpTaskReminders) {
        const taskExists = await prisma.followUpTask.findUnique({
          where: { id: reminder.relatedId || '' },
        });

        if (!taskExists) {
          await prisma.reminder.delete({ where: { id: reminder.id } });
          count++;
        }
      }

      logger.info(`清理孤立提醒完成: ${count}条`);
      return count;
    } catch (error) {
      logger.error('清理孤立提醒失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 获取默认提醒配置
   */
  getDefaultPreferences(): ReminderPreferences {
    return DEFAULT_REMINDER_PREFERENCES;
  }

  /**
   * 为任务生成提醒
   */
  async generateTaskReminders(
    taskId: string,
    preferences?: Partial<ReminderPreferences>
  ): Promise<void> {
    return taskReminderGenerator.generateTaskReminders(taskId, preferences);
  }

  /**
   * 批量为所有即将到期的任务生成提醒
   */
  async generateAllPendingTaskReminders(): Promise<number> {
    return taskReminderGenerator.generateAllPendingTaskReminders();
  }

  /**
   * 清理已完成任务的相关提醒
   */
  async cleanupCompletedTaskReminders(taskId: string): Promise<number> {
    return taskReminderGenerator.cleanupCompletedTaskReminders(taskId);
  }

  /**
   * 合并用户自定义配置和默认配置
   */
  mergePreferences(
    userPreferences?: Partial<ReminderPreferences>
  ): ReminderPreferences {
    return {
      courtSchedule: {
        ...DEFAULT_REMINDER_PREFERENCES.courtSchedule,
        ...(userPreferences?.courtSchedule ?? {}),
      },
      deadline: {
        ...DEFAULT_REMINDER_PREFERENCES.deadline,
        ...(userPreferences?.deadline ?? {}),
      },
      followUp: {
        ...DEFAULT_REMINDER_PREFERENCES.followUp,
        ...(userPreferences?.followUp ?? {}),
      },
      task: {
        ...DEFAULT_REMINDER_PREFERENCES.task,
        ...(userPreferences?.task ?? {}),
      },
    };
  }
}

// =============================================================================
// 导出
// =============================================================================

export const reminderGenerator = new ReminderGenerator();
export default reminderGenerator;
