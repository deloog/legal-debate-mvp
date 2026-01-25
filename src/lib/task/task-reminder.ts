/**
 * 任务提醒模块
 *
 * 负责为任务管理功能生成提醒。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/agent/security/logger';
import { reminderService } from '@/lib/notification/reminder-service';
import {
  CreateReminderInput,
  NotificationChannel,
  ReminderPreferences,
  ReminderType,
} from '@/types/notification';
import { TaskPriority } from '@/types/task';

// =============================================================================
// 默认任务提醒配置
// =============================================================================

const DEFAULT_TASK_REMINDER_CONFIG: {
  enabled: boolean;
  hoursBefore: number[];
  channels: NotificationChannel[];
  priorities?: TaskPriority[];
} = {
  enabled: true,
  hoursBefore: [24, 1], // 提前24小时和1小时提醒
  channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  priorities: [TaskPriority.HIGH, TaskPriority.URGENT],
};

// =============================================================================
// 任务提醒生成器
// =============================================================================

class TaskReminderGenerator {
  /**
   * 为任务生成提醒
   */
  async generateTaskReminders(
    taskId: string,
    preferences?: Partial<ReminderPreferences>
  ): Promise<void> {
    try {
      const config = preferences?.task ?? DEFAULT_TASK_REMINDER_CONFIG;

      if (!config.enabled) {
        return;
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null },
        include: { assignedUser: true, case: true },
      });

      if (!task) {
        logger.warn(`任务不存在: ${taskId}`);
        return;
      }

      // 只为待办和进行中的任务生成提醒
      if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
        return;
      }

      // 检查优先级是否匹配配置
      if (
        config.priorities &&
        config.priorities.length > 0 &&
        !config.priorities.includes(task.priority as TaskPriority)
      ) {
        return;
      }

      // 只为有截止日期的任务生成提醒
      if (!task.dueDate) {
        return;
      }

      const now = new Date();
      const inputs: CreateReminderInput[] = [];

      for (const hoursBefore of config.hoursBefore) {
        const reminderTime = new Date(task.dueDate.getTime());
        reminderTime.setHours(reminderTime.getHours() - hoursBefore);

        // 只为未来的截止日期生成提醒
        if (reminderTime < now) {
          continue;
        }

        const caseInfo = task.case ? `\n关联案件: ${task.case.title}` : '';
        const assignedUser = task.assignedUser
          ? task.assignedUser.name || task.assignedUser.email
          : '未分配';

        const input: CreateReminderInput = {
          userId: task.assignedTo || task.createdBy,
          type: ReminderType.TASK,
          title: `任务提醒: ${task.title}`,
          message: `您有一个任务将于${hoursBefore}小时后到期。\n\n任务: ${task.title}\n优先级: ${task.priority}\n负责人: ${assignedUser}${caseInfo}\n截止时间: ${task.dueDate.toLocaleString('zh-CN')}`,
          reminderTime,
          channels: config.channels,
          relatedType: 'Task',
          relatedId: taskId,
          metadata: {
            taskId,
            taskTitle: task.title,
            taskPriority: task.priority,
            caseId: task.caseId,
            caseTitle: task.case?.title,
            assignedTo: task.assignedTo,
          },
        };

        inputs.push(input);
      }

      if (inputs.length > 0) {
        await reminderService.createReminders(inputs);
        logger.info(`为任务生成提醒成功: ${taskId}`, {
          reminderCount: inputs.length,
        } as never);
      }
    } catch (error) {
      logger.error(`为任务生成提醒失败: ${taskId}`, error as Error);
    }
  }

  /**
   * 批量为所有即将到期的任务生成提醒
   */
  async generateAllPendingTaskReminders(): Promise<number> {
    try {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后的日期

      const tasks = await prisma.task.findMany({
        where: {
          dueDate: { gte: now, lte: futureLimit },
          status: { in: ['TODO', 'IN_PROGRESS'] },
          deletedAt: null,
        },
        include: { assignedUser: true, case: true },
      });

      let count = 0;

      for (const task of tasks) {
        // 检查是否已经生成过提醒
        const existingReminders = await prisma.reminder.count({
          where: {
            relatedType: 'Task',
            relatedId: task.id,
            status: { not: 'DISMISSED' },
          },
        });

        // 如果没有提醒或提醒数少于配置的提前提醒数，则生成新提醒
        if (
          existingReminders < DEFAULT_TASK_REMINDER_CONFIG.hoursBefore.length
        ) {
          await this.generateTaskReminders(task.id);
          count++;
        }
      }

      logger.info(`批量生成任务提醒完成: ${count}条`);
      return count;
    } catch (error) {
      logger.error('批量生成任务提醒失败', error as Error);
      return 0;
    }
  }

  /**
   * 清理孤立的任务提醒
   */
  async cleanupOrphanTaskReminders(): Promise<number> {
    try {
      const orphanReminders = await prisma.reminder.findMany({
        where: {
          relatedType: 'Task',
        },
      });

      let count = 0;

      for (const reminder of orphanReminders) {
        if (!reminder.relatedId) {
          await prisma.reminder.delete({ where: { id: reminder.id } });
          count++;
          continue;
        }

        const taskExists = await prisma.task.findUnique({
          where: { id: reminder.relatedId },
        });

        if (!taskExists) {
          await prisma.reminder.delete({ where: { id: reminder.id } });
          count++;
        }
      }

      logger.info(`清理孤立任务提醒完成: ${count}条`);
      return count;
    } catch (error) {
      logger.error('清理孤立任务提醒失败', error as Error);
      return 0;
    }
  }

  /**
   * 清理已完成任务的相关提醒
   */
  async cleanupCompletedTaskReminders(taskId: string): Promise<number> {
    try {
      const result = await prisma.reminder.deleteMany({
        where: {
          relatedType: 'Task',
          relatedId: taskId,
          status: { in: ['PENDING', 'SENT'] },
        },
      });

      logger.info(`清理已完成任务的提醒: ${taskId}, 删除${result.count}条`);
      return result.count;
    } catch (error) {
      logger.error(`清理已完成任务的提醒失败: ${taskId}`, error as Error);
      return 0;
    }
  }

  /**
   * 获取默认任务提醒配置
   */
  getDefaultConfig(): {
    enabled: boolean;
    hoursBefore: number[];
    channels: NotificationChannel[];
    priorities?: TaskPriority[];
  } {
    return DEFAULT_TASK_REMINDER_CONFIG;
  }
}

// =============================================================================
// 导出
// =============================================================================

export const taskReminderGenerator = new TaskReminderGenerator();
export default taskReminderGenerator;
