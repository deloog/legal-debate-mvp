import { FollowUpTask } from '@/types/client';
import { logger } from '@/lib/agent/security/logger';

/**
 * 提醒渠道枚举
 */
export enum ReminderChannel {
  IN_APP = 'IN_APP', // 站内提醒
  EMAIL = 'EMAIL', // 邮件提醒（预留）
  SMS = 'SMS', // 短信提醒（预留）
}

/**
 * 提醒配置接口
 */
export interface ReminderConfig {
  enabled: boolean;
  channels: ReminderChannel[];
  remindBeforeDays: number[]; // 提前多少天提醒
  remindOnDueDate: boolean; // 是否在截止当天提醒
}

/**
 * 跟进任务提醒器类
 * 负责发送跟进任务的提醒
 */
export class FollowUpReminder {
  private static readonly defaultConfig: ReminderConfig = {
    enabled: true,
    channels: [ReminderChannel.IN_APP],
    remindBeforeDays: [7, 3, 1], // 提前7天、3天、1天提醒
    remindOnDueDate: true, // 截止当天也提醒
  };

  /**
   * 检查任务是否需要提醒
   * @param task 跟进任务
   * @param config 提醒配置
   * @returns 是否需要提醒
   */
  static shouldRemind(task: FollowUpTask, config?: ReminderConfig): boolean {
    const reminderConfig = config || this.defaultConfig;

    if (!reminderConfig.enabled) {
      return false;
    }

    if (task.status !== 'PENDING') {
      return false;
    }

    const now = new Date();
    const dueDate = new Date(task.dueDate);
    const daysUntilDue = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 检查提前提醒
    if (reminderConfig.remindBeforeDays.includes(daysUntilDue)) {
      return true;
    }

    // 检查截止当天提醒
    if (reminderConfig.remindOnDueDate && daysUntilDue === 0) {
      return true;
    }

    return false;
  }

  /**
   * 发送提醒
   * @param task 跟进任务
   * @param config 提醒配置
   * @returns 发送结果
   */
  static async sendReminder(
    task: FollowUpTask,
    config?: ReminderConfig
  ): Promise<{ success: boolean; channels: ReminderChannel[] }> {
    const reminderConfig = config || this.defaultConfig;

    if (!this.shouldRemind(task, reminderConfig)) {
      logger.debug(`任务 ${task.id} 不需要提醒`);
      return { success: false, channels: [] };
    }

    const successChannels: ReminderChannel[] = [];

    for (const channel of reminderConfig.channels) {
      try {
        const success = await this.sendToChannel(task, channel);
        if (success) {
          successChannels.push(channel);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`发送提醒失败 (${channel}): ${errorMessage}`, error);
      }
    }

    logger.info(`任务 ${task.id} 提醒发送完成: ${successChannels.join(', ')}`);

    return {
      success: successChannels.length > 0,
      channels: successChannels,
    };
  }

  /**
   * 发送到指定渠道
   * @param task 跟进任务
   * @param channel 提醒渠道
   * @returns 是否成功
   */
  private static async sendToChannel(
    task: FollowUpTask,
    channel: ReminderChannel
  ): Promise<boolean> {
    switch (channel) {
      case ReminderChannel.IN_APP:
        return this.sendInAppReminder(task);
      case ReminderChannel.EMAIL:
        return this.sendEmailReminder(task);
      case ReminderChannel.SMS:
        return this.sendSMSReminder(task);
      default:
        logger.warn(`不支持的提醒渠道: ${channel}`);
        return false;
    }
  }

  /**
   * 发送站内提醒
   * @param task 跟进任务
   * @returns 是否成功
   */
  private static async sendInAppReminder(task: FollowUpTask): Promise<boolean> {
    try {
      // TODO: 实现站内提醒功能
      // 可以创建通知表或在现有通知系统中添加记录
      logger.info(`站内提醒: 用户 ${task.userId} 有跟进任务 ${task.id}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`发送站内提醒失败: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * 发送邮件提醒
   * @param task 跟进任务
   * @returns 是否成功
   */
  private static async sendEmailReminder(task: FollowUpTask): Promise<boolean> {
    try {
      // TODO: 实现邮件提醒功能
      // 需要配置邮件服务器
      logger.info(`邮件提醒: 发送邮件提醒给用户 ${task.userId}`);
      logger.warn('邮件提醒功能暂未实现');
      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`发送邮件提醒失败: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * 发送短信提醒
   * @param task 跟进任务
   * @returns 是否成功
   */
  private static async sendSMSReminder(task: FollowUpTask): Promise<boolean> {
    try {
      // TODO: 实现短信提醒功能
      // 需要配置短信服务商
      logger.info(`短信提醒: 发送短信提醒给用户 ${task.userId}`);
      logger.warn('短信提醒功能暂未实现');
      return false;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`发送短信提醒失败: ${errorMessage}`, error);
      return false;
    }
  }

  /**
   * 批量检查并发送提醒
   * @param tasks 跟进任务列表
   * @param config 提醒配置
   * @returns 发送结果
   */
  static async batchSendReminders(
    tasks: FollowUpTask[],
    config?: ReminderConfig
  ): Promise<{ total: number; success: number; failed: number }> {
    let successCount = 0;
    let failedCount = 0;

    for (const task of tasks) {
      try {
        const result = await this.sendReminder(task, config);
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(`批量发送提醒失败 (${task.id}): ${errorMessage}`, error);
        failedCount++;
      }
    }

    logger.info(
      `批量发送提醒完成: 成功 ${successCount}/${tasks.length}，失败 ${failedCount}`
    );

    return {
      total: tasks.length,
      success: successCount,
      failed: failedCount,
    };
  }

  /**
   * 生成提醒消息
   * @param task 跟进任务
   * @returns 提醒消息
   */
  static generateReminderMessage(task: FollowUpTask): string {
    const dueDate = new Date(task.dueDate);
    const formattedDate = dueDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    const priorityText =
      task.priority === 'HIGH'
        ? '高优先级'
        : task.priority === 'MEDIUM'
          ? '中优先级'
          : '低优先级';

    return `您有一个${priorityText}的客户跟进任务即将到期：
客户：${task.clientName}
任务：${task.summary}
截止日期：${formattedDate}

请及时跟进。`;
  }

  /**
   * 获取即将到期的任务（需要提醒的任务）
   * @param tasks 任务列表
   * @param config 提醒配置
   * @returns 需要提醒的任务列表
   */
  static getTasksNeedingReminder(
    tasks: FollowUpTask[],
    config?: ReminderConfig
  ): FollowUpTask[] {
    return tasks.filter(task => this.shouldRemind(task, config));
  }
}

export default FollowUpReminder;
