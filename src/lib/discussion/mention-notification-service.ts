/**
 * 提及通知服务模块
 *
 * 为被提及的用户发送站内消息通知。
 */

import { inAppMessageService } from '@/lib/notification/in-app-message-service';
import { logger } from '@/lib/agent/security/logger';
import type { ReminderType } from '@/types/notification';
import type {
  MentionNotificationInput,
  MentionNotificationResult,
} from '@/types/discussion';

// =============================================================================
// 提及通知服务类
// =============================================================================

class MentionNotificationService {
  /**
   * 发送提及通知
   *
   * @param input - 提及通知输入
   * @returns 发送结果
   */
  async sendMentionNotifications(
    input: MentionNotificationInput
  ): Promise<MentionNotificationResult> {
    if (input.mentionedUserIds.length === 0) {
      logger.info('没有需要发送提及通知的用户');
      return {
        success: true,
        sentCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    const results: {
      userId: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (const userId of input.mentionedUserIds) {
      const result = await this.sendMentionToUser(input, userId);
      results.push(result);
    }

    const successCount = results.filter(
      (r: { success: boolean }) => r.success
    ).length;
    const failedCount = results.filter(
      (r: { success: boolean }) => !r.success
    ).length;
    const errors = results
      .filter((r: { success: boolean; error?: string }) => !r.success)
      .map((r: { error?: string }) => r.error || 'Unknown error');

    const overallSuccess = failedCount === 0;

    if (overallSuccess) {
      logger.info('提及通知发送成功', {
        discussionId: input.discussionId,
        mentionerId: input.mentionerId,
        sentCount: successCount,
      } as never);
    } else {
      logger.warn('部分提及通知发送失败', {
        discussionId: input.discussionId,
        mentionerId: input.mentionerId,
        successCount,
        failedCount,
        errors,
      } as never);
    }

    return {
      success: overallSuccess,
      sentCount: successCount,
      failedCount,
      errors,
    };
  }

  /**
   * 发送提及通知给单个用户
   */
  private async sendMentionToUser(
    input: MentionNotificationInput,
    userId: string
  ): Promise<{ userId: string; success: boolean; error?: string }> {
    try {
      const title = this.buildNotificationTitle(input);
      const content = this.buildNotificationContent(input);

      const message = await inAppMessageService.createMessage({
        userId,
        type: 'CUSTOM' as ReminderType,
        title,
        content,
        relatedType: 'discussion',
        relatedId: input.discussionId,
        metadata: {
          caseId: input.caseId,
          discussionId: input.discussionId,
          mentionerId: input.mentionerId,
          mentionerName: input.mentionerName,
        },
      });

      if (message) {
        logger.debug('提及通知发送成功', {
          userId,
          discussionId: input.discussionId,
        } as never);
        return { userId, success: true };
      } else {
        const error = 'Failed to create in-app message';
        logger.error(error, {
          userId,
          discussionId: input.discussionId,
        } as never);
        return { userId, success: false, error };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('发送提及通知时发生异常', {
        userId,
        discussionId: input.discussionId,
        error: errorMessage,
      } as never);
      return {
        userId,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 构建通知标题
   */
  private buildNotificationTitle(input: MentionNotificationInput): string {
    const name = input.mentionerName || '用户';
    return `${name}在讨论中提及了你`;
  }

  /**
   * 构建通知内容
   */
  private buildNotificationContent(input: MentionNotificationInput): string {
    const maxLength = 200;
    let content = input.discussionContent;

    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + '...';
    }

    return content;
  }

  /**
   * 批量发送提及通知
   *
   * @param inputs - 提及通知输入数组
   * @returns 批量发送结果
   */
  async sendBulkMentionNotifications(
    inputs: MentionNotificationInput[]
  ): Promise<MentionNotificationResult> {
    if (inputs.length === 0) {
      return {
        success: true,
        sentCount: 0,
        failedCount: 0,
        errors: [],
      };
    }

    const results: Array<{
      input: MentionNotificationInput;
      result: MentionNotificationResult;
    }> = [];

    for (const input of inputs) {
      const result = await this.sendMentionNotifications(input);
      results.push({ input, result });
    }

    const totalSentCount = results.reduce(
      (sum: number, r: { result: MentionNotificationResult }) =>
        sum + r.result.sentCount,
      0
    );
    const totalFailedCount = results.reduce(
      (sum: number, r: { result: MentionNotificationResult }) =>
        sum + r.result.failedCount,
      0
    );
    const allErrors = results.flatMap(r => r.result.errors);
    const overallSuccess = totalFailedCount === 0;

    return {
      success: overallSuccess,
      sentCount: totalSentCount,
      failedCount: totalFailedCount,
      errors: allErrors,
    };
  }

  /**
   * 验证提及通知输入
   */
  validateMentionNotificationInput(
    input: unknown
  ): input is MentionNotificationInput {
    if (typeof input !== 'object' || input === null) {
      return false;
    }

    const {
      caseId,
      discussionId,
      discussionContent,
      mentionedUserIds,
      mentionerId,
      mentionerName,
    } = input as Partial<MentionNotificationInput>;

    return (
      typeof caseId === 'string' &&
      caseId.length > 0 &&
      typeof discussionId === 'string' &&
      discussionId.length > 0 &&
      typeof discussionContent === 'string' &&
      Array.isArray(mentionedUserIds) &&
      typeof mentionerId === 'string' &&
      mentionerId.length > 0 &&
      typeof mentionerName === 'string'
    );
  }

  /**
   * 获取用户的未读提及通知数量
   */
  async getUnreadMentionCount(userId: string): Promise<number> {
    try {
      const { messages } = await inAppMessageService.getMessages({
        userId,
        type: 'CUSTOM',
        isRead: false,
      });

      // 筛选提及类型的通知
      const mentionMessages = messages.filter(
        (msg: { metadata?: Record<string, unknown> | null }) =>
          msg.metadata?.relatedType === 'discussion' &&
          typeof msg.metadata?.mentionerId === 'string'
      );

      return mentionMessages.length;
    } catch (error) {
      logger.error(
        '获取未读提及通知数量时发生错误',
        error instanceof Error ? error : new Error(String(error))
      );
      return 0;
    }
  }
}

export const mentionNotificationService = new MentionNotificationService();
export default mentionNotificationService;
