/**
 * 提醒发送器模块
 *
 * 负责通过不同渠道发送提醒通知。
 */

import { logger } from '@/lib/agent/security/logger';
import { prisma } from '@/lib/db/prisma';
import {
  NotificationChannel,
  Reminder,
  ReminderType,
} from '@/types/notification';
import { getEmailService } from './email-service';
import { inAppMessageService } from './in-app-message-service';
import { reminderService } from './reminder-service';

// =============================================================================
// 提醒发送器
// =============================================================================

class ReminderSender {
  /**
   * 发送单个提醒
   */
  async sendReminder(reminder: Reminder): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: reminder.userId },
      });

      if (!user) {
        logger.error(`用户不存在: ${reminder.userId}`);
        return false;
      }

      const channels = (reminder.channels ?? []).map(
        ch => ch as NotificationChannel
      );

      let emailSent = false;
      let inAppSent = false;

      // 发送站内消息通知
      if (channels.includes(NotificationChannel.IN_APP)) {
        try {
          const result = await inAppMessageService.createMessage({
            userId: reminder.userId,
            type: reminder.type as ReminderType,
            title: reminder.title,
            content: reminder.message || reminder.title,
            relatedType: reminder.relatedType || undefined,
            relatedId: reminder.relatedId || undefined,
            metadata: reminder.metadata || undefined,
            reminderTime: reminder.reminderTime,
          });

          if (result) {
            inAppSent = true;
            logger.info(`站内消息发送成功: ${reminder.id}`);
          }
        } catch (error) {
          logger.error(
            `站内消息发送失败: ${reminder.id}`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      // 发送邮件通知
      if (channels.includes(NotificationChannel.EMAIL) && user.email) {
        try {
          const emailService = getEmailService();
          const result = await emailService.sendCustomEmail({
            to: user.email,
            subject: reminder.title,
            content: reminder.message || reminder.content || reminder.title,
            text: reminder.message || reminder.content || reminder.title,
            html: this.generateReminderEmailHTML(reminder, user),
          });

          if (result.success) {
            emailSent = true;
            logger.info(`提醒邮件发送成功: ${reminder.id}`);
          } else {
            logger.warn(`提醒邮件发送失败: ${reminder.id}`, {
              success: result.success,
              messageId: result.messageId,
              error: result.error,
            } as Record<string, unknown>);
          }
        } catch (error) {
          logger.error(
            `提醒邮件发送失败: ${reminder.id}`,
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }

      // 标记提醒为已发送（如果至少有一个渠道成功）
      if (emailSent || inAppSent) {
        await reminderService.markAsSent(reminder.id);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        `发送提醒失败: ${reminder.id}`,
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * 批量发送待发送的提醒
   */
  async sendPendingReminders(): Promise<{ success: number; failed: number }> {
    try {
      const pendingReminders = await reminderService.getPendingReminders();

      let success = 0;
      let failed = 0;

      for (const reminder of pendingReminders) {
        const result = await this.sendReminder(reminder);
        if (result) {
          success++;
        } else {
          failed++;
        }
      }

      logger.info(`批量发送提醒完成: 成功${success}条，失败${failed}条`);
      return { success, failed };
    } catch (error) {
      logger.error(
        '批量发送提醒失败',
        error instanceof Error ? error : new Error(String(error))
      );
      return { success: 0, failed: 0 };
    }
  }

  /**
   * 生成提醒邮件HTML
   */
  private generateReminderEmailHTML(
    reminder: Reminder,
    user: {
      name: string | null;
      username: string | null;
      email: string;
    }
  ): string {
    const displayName = user.name || user.username || user.email;
    const reminderTime = new Date(
      reminder.reminderTime ?? Date.now()
    ).toLocaleString('zh-CN');

    let content = '';

    const reminderType = reminder.type as string;
    switch (reminderType) {
      case 'COURT_SCHEDULE':
        content = this.generateCourtScheduleEmailContent(reminder);
        break;
      case 'DEADLINE':
        content = this.generateDeadlineEmailContent(reminder);
        break;
      case 'FOLLOW_UP':
        content = this.generateFollowUpEmailContent(reminder);
        break;
      default:
        content = reminder.message || reminder.title;
    }

    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${reminder.title}</title>
        <style>
          body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px; }
          .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          .info-box { background: white; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${reminder.title}</h1>
          </div>
          <div class="content">
            <p>尊敬的 ${displayName}：</p>
            ${content}
            <div class="info-box">
              <strong>提醒时间：</strong>${reminderTime}
            </div>
            <p>请及时处理相关事项，如有疑问请联系客服。</p>
          </div>
          <div class="footer">
            <p>此邮件由系统自动发送，请勿直接回复</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 生成法庭日程邮件内容
   */
  private generateCourtScheduleEmailContent(reminder: Reminder): string {
    const metadata = reminder.metadata as Record<string, unknown> | null;
    return `
      <div class="info-box">
        <p><strong>案件名称：</strong>${metadata?.caseTitle || '未指定'}</p>
        <p><strong>开庭地点：</strong>${metadata?.location || '待定'}</p>
        <p><strong>法官：</strong>${metadata?.judge || '待定'}</p>
      </div>
      <p>您的案件即将开庭，请提前做好相关准备，确保按时出庭。</p>
    `;
  }

  /**
   * 生成截止日期邮件内容
   */
  private generateDeadlineEmailContent(reminder: Reminder): string {
    const metadata = reminder.metadata as Record<string, unknown> | null;
    return `
      <div class="info-box">
        <p><strong>事项：</strong>${metadata?.title || reminder.title}</p>
        ${metadata?.description ? `<p><strong>说明：</strong>${metadata.description as string}</p>` : ''}
      </div>
      <p>您的截止日期即将到期，请确保在截止时间前完成相关任务。</p>
    `;
  }

  /**
   * 生成跟进任务邮件内容
   */
  private generateFollowUpEmailContent(reminder: Reminder): string {
    const metadata = reminder.metadata as Record<string, unknown> | null;
    return `
      <div class="info-box">
        <p><strong>客户姓名：</strong>${metadata?.clientName || '未指定'}</p>
        <p><strong>任务内容：</strong>${metadata?.summary || '未指定'}</p>
      </div>
      <p>请及时与客户联系，完成相关跟进任务。</p>
    `;
  }
}

// =============================================================================
// 导出
// =============================================================================

export const reminderSender = new ReminderSender();
export default reminderSender;
