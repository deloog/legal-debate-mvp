/**
 * 时效提醒生成器
 *
 * 根据时效计算结果生成提醒消息和提醒记录
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';
import type {
  StatuteCalculationResult,
  StatuteReminderConfig,
  StatuteReminderInput,
} from '@/types/statute';
import {
  getStatuteTypeLabel,
  getRiskLevel,
  getRiskLevelLabel,
} from '@/types/statute';

/**
 * 时效提醒生成器
 */
export class StatuteReminderGenerator {
  /**
   * 根据计算结果生成提醒
   */
  async generateReminder(input: StatuteReminderInput): Promise<void> {
    const { userId, calculationResult, config } = input;

    if (!config.enabled) {
      return;
    }

    // 检查是否需要生成提醒
    if (!this.shouldGenerateReminder(calculationResult, config)) {
      return;
    }

    // 生成提醒内容
    const reminderContent = this.generateReminderContent(
      calculationResult,
      config
    );

    // 创建提醒记录
    await this.createReminder(
      userId,
      calculationResult,
      config,
      reminderContent
    );
  }

  /**
   * 批量生成提醒
   */
  async batchGenerateReminders(inputs: StatuteReminderInput[]): Promise<void> {
    for (const input of inputs) {
      await this.generateReminder(input);
    }
  }

  /**
   * 检查是否需要生成提醒
   */
  private shouldGenerateReminder(
    result: StatuteCalculationResult,
    config: StatuteReminderConfig
  ): boolean {
    // 如果已过期，不生成提醒
    if (result.isExpired) {
      return false;
    }

    // 检查剩余天数是否在提醒时间列表中
    return config.reminderDays.includes(result.remainingDays);
  }

  /**
   * 生成提醒内容
   */
  private generateReminderContent(
    result: StatuteCalculationResult,
    config: StatuteReminderConfig
  ): {
    title: string;
    message: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    categories: string[];
  } {
    const statuteTypeLabel = getStatuteTypeLabel(result.statuteType);
    const riskLevel = getRiskLevel(result.remainingDays);
    const riskLabel = getRiskLevelLabel(riskLevel);

    // 使用自定义消息（如果有）
    const customMessageKey = `${result.statuteType}_${result.remainingDays}`;
    const customMessage = config.customMessages?.[customMessageKey];

    // 生成标题
    const title = customMessage
      ? `时效提醒: ${customMessage.substring(0, 20)}...`
      : `【${riskLabel}】${statuteTypeLabel}即将到期`;

    // 生成消息内容
    let message = '';
    if (customMessage) {
      message = customMessage;
    } else {
      message = `案件 ${result.caseId} 的 ${statuteTypeLabel} 将于 ${
        result.remainingDays
      } 天后到期。

截止日期：${result.deadlineDate.toLocaleDateString('zh-CN')}
风险等级：${riskLabel}

建议：${result.calculationMetadata.recommendations.join('，')}`;
    }

    // 确定优先级
    const priority =
      result.remainingDays <= 7
        ? 'HIGH'
        : result.remainingDays <= 30
          ? 'MEDIUM'
          : 'LOW';

    // 生成分类标签
    const categories = [
      '时效提醒',
      statuteTypeLabel,
      riskLabel,
      `剩余${result.remainingDays}天`,
    ];

    return { title, message, priority, categories };
  }

  /**
   * 创建提醒记录
   */
  private async createReminder(
    userId: string,
    result: StatuteCalculationResult,
    config: StatuteReminderConfig,
    content: {
      title: string;
      message: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      categories: string[];
    }
  ): Promise<void> {
    try {
      // 检查是否已存在相同的提醒
      const existingReminder = await prisma.reminder.findFirst({
        where: {
          userId,
          relatedId: result.caseId,
          type: 'DEADLINE',
          reminderTime: result.deadlineDate,
        },
      });

      if (existingReminder) {
        // 更新现有提醒
        await prisma.reminder.update({
          where: { id: existingReminder.id },
          data: {
            title: content.title,
            message: content.message,
            status: result.isExpired ? 'SENT' : 'PENDING',
            channels: config.channels,
          },
        });
      } else {
        // 创建新提醒
        await prisma.reminder.create({
          data: {
            userId,
            type: 'DEADLINE',
            title: content.title,
            message: content.message,
            reminderTime: result.deadlineDate,
            status: result.isExpired ? 'SENT' : 'PENDING',
            channels: config.channels,
            relatedType: 'Case',
            relatedId: result.caseId,
            metadata: {
              caseId: result.caseId,
              statuteType: result.statuteType,
              startDate: result.startDate,
              remainingDays: result.remainingDays,
              isApproaching: result.isApproaching,
              priority: content.priority,
              categories: content.categories,
              riskLevel: getRiskLevel(result.remainingDays),
              warnings: result.calculationMetadata.warnings,
              recommendations: result.calculationMetadata.recommendations,
            },
          },
        });
      }
    } catch (error) {
      logger.error('创建时效提醒失败:', error);
      throw new Error(
        `创建时效提醒失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 发送提醒通知
   */
  async sendReminder(userId: string, reminderId: string): Promise<boolean> {
    try {
      // 这里可以集成通知服务，发送邮件、短信等
      // 目前只更新提醒状态为已发送
      const result = await prisma.reminder.updateMany({
        where: {
          id: reminderId,
          userId,
          type: 'DEADLINE',
        },
        data: {
          status: 'SENT',
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error('发送提醒通知失败:', error);
      return false;
    }
  }

  /**
   * 批量发送到期提醒
   */
  async sendExpiredReminders(): Promise<{ sent: number; failed: number }> {
    try {
      // 获取所有到期的提醒
      const expiredReminders = await prisma.reminder.findMany({
        where: {
          type: 'DEADLINE',
          reminderTime: {
            lte: new Date(),
          },
          status: 'PENDING',
        },
      });

      let sent = 0;
      let failed = 0;

      for (const reminder of expiredReminders) {
        const success = await this.sendReminder(reminder.userId, reminder.id);
        if (success) {
          sent++;
        } else {
          failed++;
        }
      }

      return { sent, failed };
    } catch (error) {
      logger.error('批量发送到期提醒失败:', error);
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * 获取待发送的提醒列表
   */
  async getPendingReminders(userId: string): Promise<
    Array<{
      id: string;
      title: string;
      message: string;
      reminderTime: Date;
      remainingDays: number;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
    }>
  > {
    try {
      const reminders = await prisma.reminder.findMany({
        where: {
          userId,
          type: 'DEADLINE',
          status: 'PENDING',
          reminderTime: {
            gte: new Date(),
          },
        },
        orderBy: {
          reminderTime: 'asc',
        },
      });

      return reminders.map(reminder => {
        const metadata = reminder.metadata as Record<string, unknown>;
        return {
          id: reminder.id,
          title: reminder.title,
          message: reminder.message ?? '',
          reminderTime: reminder.reminderTime,
          remainingDays:
            (metadata.remainingDays as number) ||
            Math.ceil(
              (reminder.reminderTime.getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            ),
          priority: (metadata.priority as 'LOW' | 'MEDIUM' | 'HIGH') || 'LOW',
        };
      });
    } catch (error) {
      logger.error('获取待发送提醒失败:', error);
      return [];
    }
  }

  /**
   * 删除提醒
   */
  async deleteReminder(reminderId: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.reminder.deleteMany({
        where: {
          id: reminderId,
          userId,
          type: 'DEADLINE',
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error('删除提醒失败:', error);
      return false;
    }
  }
}

/**
 * 导出单例实例
 */
export const statuteReminderGenerator = new StatuteReminderGenerator();
