/**
 * 案件状态监听器
 *
 * 监听案件状态变化，自动生成截止日期提醒。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/agent/security/logger';
import { reminderService } from '@/lib/notification/reminder-service';
import { CaseStatusDeadlineConfig } from '@/types/case';
import {
  CreateReminderInput,
  NotificationChannel,
  ReminderType,
} from '@/types/notification';

// =============================================================================
// 默认案件状态截止日期配置
// =============================================================================

const DEFAULT_CASE_STATUS_DEADLINE_CONFIGS: CaseStatusDeadlineConfig[] = [
  {
    caseType: 'CIVIL',
    fromStatus: 'DRAFT',
    toStatus: 'ACTIVE',
    deadlineDays: 7,
    reminderDaysBefore: [3, 1],
    description: '从草稿转为活动状态后7天内需要提交正式材料',
  },
  {
    caseType: 'CRIMINAL',
    fromStatus: 'DRAFT',
    toStatus: 'ACTIVE',
    deadlineDays: 5,
    reminderDaysBefore: [2, 1],
    description: '从草稿转为活动状态后5天内需要提交正式材料',
  },
  {
    caseType: 'ADMINISTRATIVE',
    fromStatus: 'ACTIVE',
    toStatus: 'COMPLETED',
    deadlineDays: 3,
    reminderDaysBefore: [1],
    description: '案件结案后3天内需要整理档案',
  },
  {
    caseType: 'CIVIL',
    fromStatus: 'ACTIVE',
    toStatus: 'COMPLETED',
    deadlineDays: 3,
    reminderDaysBefore: [1],
    description: '案件结案后3天内需要整理档案',
  },
];

// =============================================================================
// 案件状态监听器
// =============================================================================

class CaseStatusMonitor {
  /**
   * 根据案件类型、原状态、目标状态查找截止日期配置
   */
  findDeadlineConfig(
    caseType: string,
    fromStatus: string,
    toStatus: string
  ): CaseStatusDeadlineConfig | null {
    return (
      DEFAULT_CASE_STATUS_DEADLINE_CONFIGS.find(
        config =>
          config.caseType === caseType &&
          config.fromStatus === fromStatus &&
          config.toStatus === toStatus
      ) ?? null
    );
  }

  /**
   * 监听案件状态变更并自动生成提醒
   */
  async onCaseStatusChange(
    caseId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      // 获取案件详情
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          userId: true,
          title: true,
          type: true,
          status: true,
        },
      });

      if (!caseData) {
        logger.warn(`案件不存在: ${caseId}`);
        return;
      }

      // 如果状态没有变化，直接返回
      if (oldStatus === newStatus) {
        return;
      }

      // 查找匹配的截止日期配置
      const config = this.findDeadlineConfig(
        caseData.type,
        oldStatus,
        newStatus
      );

      if (!config) {
        logger.debug(
          `无匹配的截止日期配置: ${caseData.type} ${oldStatus} -> ${newStatus}`
        );
        return;
      }

      // 计算截止日期
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + config.deadlineDays);

      // 生成案件状态提醒
      await this.generateCaseStatusReminders(caseData, deadline, config);

      logger.info(`案件状态变更提醒生成成功: ${caseId}`, {
        oldStatus,
        newStatus,
        deadline: deadline.toISOString(),
      } as never);
    } catch (error) {
      logger.error(
        `案件状态变更提醒生成失败: ${caseId}`,
        error as Error as never
      );
    }
  }

  /**
   * 为案件状态变更生成提醒
   */
  private async generateCaseStatusReminders(
    caseData: { id: string; userId: string; title: string },
    deadline: Date,
    config: CaseStatusDeadlineConfig
  ): Promise<void> {
    const inputs: CreateReminderInput[] = [];

    // 为每个提前提醒时间生成一个提醒
    for (const daysBefore of config.reminderDaysBefore) {
      const reminderTime = new Date(deadline.getTime());
      reminderTime.setDate(reminderTime.getDate() - daysBefore);

      const input: CreateReminderInput = {
        userId: caseData.userId,
        type: ReminderType.DEADLINE,
        title: `案件截止提醒: ${caseData.title}`,
        message: `${config.description}\n\n案件：${caseData.title}\n截止时间：${deadline.toLocaleString('zh-CN')}`,
        reminderTime,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        relatedType: 'CaseStatus',
        relatedId: caseData.id,
        metadata: {
          caseId: caseData.id,
          caseTitle: caseData.title,
          deadline: deadline.toISOString(),
          configDescription: config.description,
        },
      };

      inputs.push(input);
    }

    // 批量创建提醒
    await reminderService.createReminders(inputs);
  }

  /**
   * 批量检查并处理所有案件的状态变化
   */
  async processAllPendingCases(): Promise<number> {
    try {
      const now = new Date();
      const activeCases = await prisma.case.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          title: true,
          type: true,
          status: true,
          updatedAt: true,
        },
      });

      let count = 0;

      for (const caseData of activeCases) {
        // 检查是否需要生成提醒（基于状态更新时间）
        const daysSinceUpdate = Math.floor(
          (now.getTime() - caseData.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        // 如果案件在最近7天内有更新，检查是否需要生成提醒
        if (daysSinceUpdate <= 7) {
          // 这里可以添加更复杂的逻辑，比如检查是否有未生成的提醒
          count++;
        }
      }

      logger.info(`处理待处理案件完成: ${count}条`);
      return count;
    } catch (error) {
      logger.error('处理待处理案件失败', error as Error as never);
      return 0;
    }
  }

  /**
   * 获取所有默认的截止日期配置
   */
  getAllDeadlineConfigs(): CaseStatusDeadlineConfig[] {
    return DEFAULT_CASE_STATUS_DEADLINE_CONFIGS;
  }
}

// =============================================================================
// 导出单例
// =============================================================================

export const caseStatusMonitor = new CaseStatusMonitor();
export default caseStatusMonitor;
