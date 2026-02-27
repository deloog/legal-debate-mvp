/**
 * 合同履约提醒调度服务
 *
 * 负责定时检查需要提醒的履约节点，并触发提醒通知。
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  UserNotificationService,
  CreateNotificationInput,
} from '@/lib/notification/user-notification-service';
import { contractPerformanceService } from './contract-performance-service';

// =============================================================================
// 合同履约提醒调度服务
// =============================================================================

class ContractMilestoneReminderService {
  private notificationService = UserNotificationService.getInstance();

  /**
   * 处理所有待提醒的履约节点
   */
  async processReminders(): Promise<{
    processed: number;
    sent: number;
    failed: number;
  }> {
    const result = { processed: 0, sent: 0, failed: 0 };

    try {
      // 获取需要提醒的节点
      const nodes = await contractPerformanceService.getNodesForReminder();

      for (const node of nodes) {
        try {
          const shouldRemind = this.shouldRemind(node);
          if (!shouldRemind) {
            result.processed++;
            continue;
          }

          // 发送提醒
          await this.sendReminder(node);

          // 标记已发送
          await contractPerformanceService.markReminderSent(node.id);

          result.sent++;
          result.processed++;
        } catch (error) {
          logger.error('处理履约提醒失败', {
            nodeId: node.id,
            error: error instanceof Error ? error.message : String(error),
          });
          result.failed++;
          result.processed++;
        }
      }

      logger.info('履约提醒处理完成', result);
      return result;
    } catch (error) {
      logger.error('处理履约提醒时发生错误', error as Error);
      throw error;
    }
  }

  /**
   * 检查是否应该发送提醒
   */
  private shouldRemind(node: {
    milestoneDate: Date;
    reminderDays: number[];
    reminderSent: boolean;
  }): boolean {
    if (node.reminderSent) {
      return false;
    }

    const now = new Date();
    const milestoneDate = new Date(node.milestoneDate);
    const daysUntilMilestone = Math.ceil(
      (milestoneDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 如果已逾期，也发送提醒
    if (daysUntilMilestone < 0) {
      return true;
    }

    // 检查是否在提醒天数列表中
    return node.reminderDays.some((day) => daysUntilMilestone <= day);
  }

  /**
   * 发送提醒
   */
  private async sendReminder(node: {
    id: string;
    contractId: string;
    milestone: string;
    milestoneDate: Date;
    milestoneStatus: string;
    description?: string;
    responsibleParty?: string;
  }): Promise<void> {
    const now = new Date();
    const milestoneDate = new Date(node.milestoneDate);
    const daysUntilMilestone = Math.ceil(
      (milestoneDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isOverdue = daysUntilMilestone < 0;
    const urgencyLevel = isOverdue ? '紧急' : this.getUrgencyLevel(daysUntilMilestone);

    const title = isOverdue
      ? `【逾期提醒】合同履约节点已逾期：${node.milestone}`
      : `【${urgencyLevel}】合同履约提醒：${node.milestone}`;

    // 获取合同信息
    const contract = await prisma.contract.findUnique({
      where: { id: node.contractId },
    });

    if (!contract) {
      throw new Error('合同不存在');
    }

    const content = this.buildReminderContent(
      {
        ...node,
        contractNumber: contract.contractNumber,
        clientName: contract.clientName,
        lawyerName: contract.lawyerName,
      },
      daysUntilMilestone,
      isOverdue
    );

    // 创建通知输入
    const notificationInput: CreateNotificationInput = {
      userId: contract.lawyerId,
      type: 'CASE',
      title,
      content,
      priority: isOverdue ? 'HIGH' : 'NORMAL',
      link: `/contracts/${node.contractId}/performance`,
      metadata: {
        nodeId: node.id,
        milestone: node.milestone,
        milestoneDate: node.milestoneDate,
        contractNumber: contract.contractNumber,
        isOverdue,
      },
    };

    // 发送站内通知
    await this.notificationService.createNotification(notificationInput);

    // 如果有责任人，也发送给责任人
    if (node.responsibleParty) {
      const responsibleUser = await prisma.user.findFirst({
        where: {
          OR: [{ name: node.responsibleParty }, { email: node.responsibleParty }],
        },
      });

      if (responsibleUser && responsibleUser.id !== contract.lawyerId) {
        await this.notificationService.createNotification({
          ...notificationInput,
          userId: responsibleUser.id,
        });
      }
    }

    logger.info('发送合同履约提醒成功', {
      nodeId: node.id,
      contractId: node.contractId,
      isOverdue,
      daysUntilMilestone,
    });
  }

  /**
   * 获取紧急程度
   */
  private getUrgencyLevel(daysUntilMilestone: number): string {
    if (daysUntilMilestone <= 1) {
      return '紧急';
    }
    if (daysUntilMilestone <= 3) {
      return '重要';
    }
    if (daysUntilMilestone <= 7) {
      return '一般';
    }
    return '常规';
  }

  /**
   * 构建提醒内容
   */
  private buildReminderContent(
    node: {
      milestone: string;
      milestoneDate: Date;
      description?: string;
      contractNumber: string;
      clientName: string;
      lawyerName: string;
    },
    daysUntilMilestone: number,
    isOverdue: boolean
  ): string {
    const milestoneDateStr = new Date(node.milestoneDate).toLocaleDateString('zh-CN');
    let content = `合同编号：${node.contractNumber}\n`;
    content += `客户名称：${node.clientName}\n`;
    content += `负责律师：${node.lawyerName}\n`;
    content += `节点名称：${node.milestone}\n`;
    content += `计划日期：${milestoneDateStr}\n`;

    if (node.description) {
      content += `节点描述：${node.description}\n`;
    }

    if (isOverdue) {
      content += '\n⚠️ 该节点已逾期，请尽快处理！';
    } else if (daysUntilMilestone === 0) {
      content += '\n⏰ 该节点今天到期，请及时处理！';
    } else if (daysUntilMilestone === 1) {
      content += '\n⏰ 该节点明天到期，请做好准备！';
    } else {
      content += `\n还剩 ${daysUntilMilestone} 天到期，请提前做好准备。`;
    }

    return content;
  }

  /**
   * 检查并更新逾期节点状态
   */
  async checkOverdueNodes(): Promise<number> {
    let updatedCount = 0;

    try {
      const now = new Date();

      // 查找已逾期但状态仍为PENDING的节点
      const overdueNodes = await prisma.contractPerformance.findMany({
        where: {
          milestoneStatus: 'PENDING',
          milestoneDate: {
            lt: now,
          },
        },
      });

      for (const node of overdueNodes) {
        await prisma.contractPerformance.update({
          where: { id: node.id },
          data: {
            milestoneStatus: 'OVERDUE',
            isAnomalous: true,
            anomalyType: 'LATE_PAYMENT',
            anomalyDescription: '节点已逾期未完成',
          },
        });
        updatedCount++;
      }

      if (updatedCount > 0) {
        logger.info('更新逾期节点状态完成', { count: updatedCount });
      }

      return updatedCount;
    } catch (error) {
      logger.error('检查逾期节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 从合同条款自动提取履约节点
   */
  async extractMilestonesFromContract(contractId: string): Promise<{
    extracted: number;
    created: number;
  }> {
    const result = { extracted: 0, created: 0 };

    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          payments: true,
        },
      });

      if (!contract) {
        throw new Error('合同不存在');
      }

      // 从合同条款中提取关键日期信息
      // 1. 从terms中提取
      const terms = contract.terms as Record<string, unknown> | null;
      if (terms) {
        const milestones = this.extractFromTerms(terms);
        result.extracted += milestones.length;

        for (const milestone of milestones) {
          try {
            await contractPerformanceService.createPerformance({
              contractId,
              ...milestone,
            });
            result.created++;
          } catch (error) {
            logger.warn('创建提取的节点失败', {
              contractId,
              milestone,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // 2. 从付款记录中创建付款节点
      for (const payment of contract.payments) {
        const existingNode = await prisma.contractPerformance.findFirst({
          where: {
            contractId,
            milestoneType: 'payment',
            milestoneDate: payment.createdAt,
          },
        });

        if (!existingNode) {
          await contractPerformanceService.createPerformance({
            contractId,
            milestone: `付款节点 - ${payment.paymentType}`,
            milestoneDate: payment.createdAt,
            milestoneType: 'payment',
            description: `金额：${payment.amount}`,
          });
          result.created++;
        }
      }

      logger.info('从合同提取履约节点完成', {
        contractId,
        ...result,
      });

      return result;
    } catch (error) {
      logger.error('从合同提取履约节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 从合同条款中提取节点
   */
  private extractFromTerms(terms: Record<string, unknown>): Array<{
    milestone: string;
    milestoneDate: Date;
    milestoneType: 'payment' | 'delivery' | 'milestone' | 'deadline';
    description?: string;
  }> {
    const milestones: Array<{
      milestone: string;
      milestoneDate: Date;
      milestoneType: 'payment' | 'delivery' | 'milestone' | 'deadline';
      description?: string;
    }> = [];

    // 提取开始和结束日期
    if (terms.startDate) {
      milestones.push({
        milestone: '合同开始',
        milestoneDate: new Date(terms.startDate as string),
        milestoneType: 'milestone',
        description: '合同约定的开始日期',
      });
    }

    if (terms.endDate) {
      milestones.push({
        milestone: '合同结束',
        milestoneDate: new Date(terms.endDate as string),
        milestoneType: 'deadline',
        description: '合同约定的结束日期',
      });
    }

    // 提取付款计划
    const paymentPlan = terms.paymentPlan as Array<{
      stage: string;
      date: string;
      amount?: number;
    }> | null;

    if (paymentPlan && Array.isArray(paymentPlan)) {
      for (const payment of paymentPlan) {
        if (payment.date) {
          milestones.push({
            milestone: `付款节点 - ${payment.stage}`,
            milestoneDate: new Date(payment.date),
            milestoneType: 'payment',
            description: payment.amount ? `计划金额：${payment.amount}` : undefined,
          });
        }
      }
    }

    // 提取交付节点
    const deliveryPlan = terms.deliveryPlan as Array<{
      stage: string;
      date: string;
    }> | null;

    if (deliveryPlan && Array.isArray(deliveryPlan)) {
      for (const delivery of deliveryPlan) {
        if (delivery.date) {
          milestones.push({
            milestone: `交付节点 - ${delivery.stage}`,
            milestoneDate: new Date(delivery.date),
            milestoneType: 'delivery',
          });
        }
      }
    }

    return milestones;
  }
}

// 导出服务实例
export const contractMilestoneReminderService = new ContractMilestoneReminderService();
