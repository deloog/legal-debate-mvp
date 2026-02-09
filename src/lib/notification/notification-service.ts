/**
 * 通知服务模块
 *
 * 统一的通知服务，协调邮件和短信发送，与案件提醒系统集成。
 */

import { FollowUpTask } from '@/types/client';
import {
  NotificationChannel,
  NotificationSendResult,
} from '@/types/notification';
import { getEmailService } from './email-service';
import { getSMSService } from './sms-service';
import { logger } from '@/lib/agent/security/logger';

// =============================================================================
// 通知服务
// =============================================================================

class NotificationService {
  private emailService = getEmailService();
  private smsService = getSMSService();

  /**
   * 发送跟进任务提醒
   */
  async sendFollowUpTaskReminder(
    task: FollowUpTask,
    channels: NotificationChannel[]
  ): Promise<NotificationSendResult> {
    const results: NotificationSendResult = {
      success: true,
      channel: channels[0] || NotificationChannel.IN_APP,
      errors: [],
    };

    // 检查是否包含邮件渠道
    if (channels.includes(NotificationChannel.EMAIL)) {
      try {
        const emailResult = await this.emailService.sendFollowUpTaskEmail(
          task,
          task.clientEmail
        );

        if (!emailResult.success) {
          results.success = false;
          if (!results.errors) results.errors = [];
          results.errors.push(emailResult.error || '邮件发送失败');
          logger.warn(`跟进任务邮件发送失败: ${task.id}`, {
            emailResult,
          } as never);
        } else {
          logger.info(`跟进任务邮件发送成功: ${task.id}`, {
            devMessage: emailResult.devMessage,
          } as never);
        }
      } catch (error) {
        results.success = false;
        if (!results.errors) results.errors = [];
        results.errors.push(
          error instanceof Error ? error.message : '邮件发送异常'
        );
        logger.error(
          `跟进任务邮件发送异常: ${task.id}`,
          error as Error as never
        );
      }
    }

    // 检查是否包含短信渠道
    if (channels.includes(NotificationChannel.SMS)) {
      try {
        const smsResult = await this.smsService.sendFollowUpTaskSMS(
          task,
          task.clientPhone
        );

        if (!smsResult.success) {
          results.success = false;
          if (!results.errors) results.errors = [];
          results.errors.push(smsResult.error || '短信发送失败');
          logger.warn(`跟进任务短信发送失败: ${task.id}`, {
            smsResult,
          } as never);
        } else {
          logger.info(`跟进任务短信发送成功: ${task.id}`, {
            devMessage: smsResult.devMessage,
          } as never);
        }
      } catch (error) {
        results.success = false;
        if (!results.errors) results.errors = [];
        results.errors.push(
          error instanceof Error ? error.message : '短信发送异常'
        );
        logger.error(
          `跟进任务短信发送异常: ${task.id}`,
          error as Error as never
        );
      }
    }

    // 如果所有渠道都失败，返回失败
    if (
      !results.success &&
      (results.errors?.length || 0) === channels.length
    ) {
      return results;
    }

    // 如果没有错误，删除errors属性
    if ((results.errors?.length || 0) === 0) {
      delete results.errors;
    }

    return results;
  }

  /**
   * 根据任务优先级决定通知渠道
   */
  getNotificationChannelsForTask(task: FollowUpTask): NotificationChannel[] {
    const channels: NotificationChannel[] = [NotificationChannel.IN_APP];

    // 高优先级任务使用全部渠道
    if (task.priority === 'HIGH') {
      channels.push(NotificationChannel.EMAIL);
      channels.push(NotificationChannel.SMS);
    }
    // 中优先级任务使用邮件
    else if (task.priority === 'MEDIUM') {
      channels.push(NotificationChannel.EMAIL);
    }
    // 低优先级任务仅使用站内通知
    else {
      // 仅IN_APP
    }

    return channels;
  }

  /**
   * 检查任务是否应该发送提醒
   */
  shouldSendReminder(task: FollowUpTask, hoursBeforeDue: number): boolean {
    const now = new Date();
    const timeUntilDue = task.dueDate.getTime() - now.getTime();
    const hoursUntilDue = timeUntilDue / (1000 * 60 * 60);

    // 检查是否在提醒时间窗口内（±1小时）
    return (
      hoursUntilDue >= hoursBeforeDue - 1 && hoursUntilDue <= hoursBeforeDue + 1
    );
  }

  /**
   * 获取提醒提前时间（小时）
   */
  getReminderHoursBeforeDue(task: FollowUpTask): number {
    switch (task.priority) {
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
}

// =============================================================================
// 导出
// =============================================================================

export const notificationService = new NotificationService();
export default notificationService;
