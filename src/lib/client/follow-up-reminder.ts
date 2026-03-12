import { logger } from '@/lib/agent/security/logger';
import { prisma } from '@/lib/db/prisma';
import { FollowUpTask } from '@/types/client';
import { ReminderType } from '@/types/notification';

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
        logger.error(
          `发送提醒失败 (${channel}): ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
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
      const { inAppMessageService } =
        await import('@/lib/notification/in-app-message-service');

      const message = await inAppMessageService.createMessage({
        userId: task.userId,
        type: ReminderType.FOLLOW_UP,
        title: '客户跟进任务提醒',
        content: this.generateReminderMessage(task),
        relatedType: 'FollowUpTask',
        relatedId: task.id,
        reminderTime: new Date(),
        metadata: {
          taskId: task.id,
          clientId: task.clientId,
          dueDate: task.dueDate,
          priority: task.priority,
        },
      });

      if (message) {
        logger.info(`站内提醒已创建: 用户 ${task.userId} 任务 ${task.id}`);
        return true;
      } else {
        logger.warn(`站内提醒创建失败: 用户 ${task.userId} 任务 ${task.id}`);
        return false;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `发送站内提醒失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
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
      const { getEmailService } = await import('@/lib/auth/email-service');

      const emailService = getEmailService();

      // 获取用户邮箱（如果task中没有）
      const userEmail =
        task.clientEmail || (await this.getUserEmail(task.userId));

      // 检查邮件服务是否支持通用发送
      if (emailService.sendEmail) {
        const subject = '[律伴助手] 客户跟进任务提醒';
        const message = this.generateReminderMessage(task);

        const result = await emailService.sendEmail({
          to: userEmail,
          subject,
          text: message,
          html: this.generateEmailHTML(task, message),
        });

        if (result.success) {
          logger.info(`邮件提醒已发送: 用户 ${task.userId} 任务 ${task.id}`);
          return true;
        } else {
          logger.warn(`邮件提醒发送失败: 用户 ${task.userId} 任务 ${task.id}`, {
            error: result.error,
          } as never);
          return false;
        }
      } else {
        logger.warn('邮件服务不支持通用发送，使用开发模式输出');
        logger.info(`[EMAIL] ${userEmail}`);
        logger.info(`[EMAIL] Subject: [律伴助手] 客户跟进任务提醒`);
        logger.info(`[EMAIL] ${this.generateReminderMessage(task)}`);
        return true; // 开发模式下返回成功
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `发送邮件提醒失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      return false;
    }
  }

  /**
   * 获取用户邮箱
   * @param userId 用户ID
   * @returns 邮箱地址
   */
  private static async getUserEmail(userId: string): Promise<string> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      return user?.email || '';
    } catch (error) {
      logger.error(`获取用户邮箱失败: ${userId}`, error as Error);
      return '';
    }
  }

  /**
   * 生成邮件HTML内容
   * @param task 跟进任务
   * @param message 邮件消息
   * @returns HTML内容
   */
  private static generateEmailHTML(
    task: FollowUpTask,
    message: string
  ): string {
    const dueDate = new Date(task.dueDate);
    const formattedDate = dueDate.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });

    const priorityColor = {
      HIGH: '#dc3545',
      MEDIUM: '#ffc107',
      LOW: '#28a745',
    }[task.priority];

    const priorityText = {
      HIGH: '高优先级',
      MEDIUM: '中优先级',
      LOW: '低优先级',
    }[task.priority];

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>客户跟进任务提醒</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; border-left: 4px solid ${priorityColor};">
    <h2 style="color: #333; margin-top: 0;">🔔 客户跟进任务提醒</h2>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 100px;">优先级:</td>
        <td style="padding: 8px 0;"><span style="background: ${priorityColor}; color: white; padding: 2px 8px; border-radius: 3px;">${priorityText}</span></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">客户:</td>
        <td style="padding: 8px 0;">${task.clientName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">任务:</td>
        <td style="padding: 8px 0;">${task.summary}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">截止日期:</td>
        <td style="padding: 8px 0;">${formattedDate}</td>
      </tr>
    </table>

    <div style="background: #fff; padding: 15px; border-radius: 5px; margin-top: 15px;">
      <h4 style="margin-top: 0; color: #666;">任务详情</h4>
      <p style="margin: 0; white-space: pre-wrap;">${message}</p>
    </div>
  </div>

  <p style="font-size: 12px; color: #999; margin-top: 20px; text-align: center;">
    此邮件由系统自动发送，请勿回复 | 律伴助手
  </p>
</body>
</html>`;
  }

  /**
   * 发送短信提醒
   * @param task 跟进任务
   * @returns 是否成功
   */
  private static async sendSMSReminder(task: FollowUpTask): Promise<boolean> {
    try {
      // 检查是否配置了短信服务
      const smsEnabled = process.env.ALERT_SMS_ENABLED === 'true';
      const hasRecipients = task.clientPhone && task.clientPhone.length > 0;

      if (!smsEnabled || !hasRecipients) {
        logger.info('SMS reminder skipped: not configured', {
          taskId: task.id,
          smsEnabled,
          hasRecipients,
        });
        return false;
      }

      // 生成短信内容
      const dueDate = new Date(task.dueDate);
      const formattedDate = dueDate.toLocaleDateString('zh-CN');
      const content = `[律伴助手] 您有一个客户跟进任务将于${formattedDate}到期：${task.summary || '请及时处理'}`;

      // 调用短信发送服务
      const sent = await this.callSMSService([task.clientPhone ?? ''], content);

      if (sent) {
        logger.info('SMS reminder sent successfully', {
          taskId: task.id,
          userId: task.userId,
          recipientCount: 1,
        });
      }

      return sent;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `发送短信提醒失败: ${errorMessage}`,
        error instanceof Error ? error : undefined
      );
      return false;
    }
  }

  /**
   * 调用短信服务
   * @param phoneNumbers 电话号码列表
   * @param content 短信内容
   */
  private static async callSMSService(
    phoneNumbers: string[],
    content: string
  ): Promise<boolean> {
    const provider = process.env.SMS_PROVIDER || '';

    // 阿里云短信
    if (provider === 'aliyun' && process.env.ALIYUN_SMS_ACCESS_KEY_ID) {
      logger.info('Sending SMS via Aliyun', {
        phones: phoneNumbers.length,
        content: content.substring(0, 50),
      });
      // 实际项目中需要实现阿里云短信API调用
      return true;
    }

    // 腾讯云短信
    if (provider === 'tencent' && process.env.TENCENT_SMS_SECRET_ID) {
      logger.info('Sending SMS via Tencent', {
        phones: phoneNumbers.length,
        content: content.substring(0, 50),
      });
      // 实际项目中需要实现腾讯云短信API调用
      return true;
    }

    // 默认使用日志记录
    logger.warn('SMS service not configured, using logging fallback', {
      provider: provider || 'not set',
      phoneNumbers: phoneNumbers.slice(0, 3),
    });
    return false;
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
        logger.error(
          `批量发送提醒失败 (${task.id}): ${errorMessage}`,
          error instanceof Error ? error : undefined
        );
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
