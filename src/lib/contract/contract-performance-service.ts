/**
 * 合同履约服务模块
 *
 * 负责合同关键节点的创建、更新、查询和自动提醒功能。
 * 包含增强的异常检测功能。
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  CreateContractPerformanceInput,
  UpdateContractPerformanceInput,
  ContractPerformanceQueryParams,
  ContractPerformanceResponse,
  CreateReminderConfigInput,
  UpdateReminderConfigInput,
  ReminderConfigResponse,
  AnomalyType,
} from '@/types/contract';
import { NotificationType as PrismaNotificationType } from '@prisma/client';
import { getUserNotificationService } from '@/lib/notification/user-notification-service';

// =============================================================================
// 异常类型定义和推荐处理措施
// =============================================================================

interface AnomalyRecommendation {
  action: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
}

const ANOMALY_RECOMMENDATIONS: Record<string, AnomalyRecommendation[]> = {
  LATE_PAYMENT: [
    { action: '联系客户确认付款计划', priority: 'HIGH', description: '逾期未付款，需立即跟进' },
    { action: '发送催款通知', priority: 'HIGH', description: '通过邮件或短信发送正式催款通知' },
    { action: '评估是否需要终止合同', priority: 'MEDIUM', description: '根据逾期时长评估合同是否继续执行' },
  ],
  EARLY_PAYMENT: [
    { action: '核实付款金额与合同约定', priority: 'HIGH', description: '确认是否为多付款项' },
    { action: '联系对方确认付款意图', priority: 'HIGH', description: '确认是否为预付款项或有特殊安排' },
    { action: '如为多付，安排退款或调整', priority: 'MEDIUM', description: '处理多付款项的退款或抵扣' },
  ],
  LATE_DELIVERY: [
    { action: '联系责任方确认延迟原因', priority: 'HIGH', description: '了解延迟交付的具体原因' },
    { action: '评估对项目进度的影响', priority: 'HIGH', description: '评估延迟对整体项目的影响' },
    { action: '协商新的交付时间', priority: 'MEDIUM', description: '与对方协商新的交付时间并记录' },
    { action: '如影响重大，考虑合同条款', priority: 'MEDIUM', description: '评估是否触发合同中的违约条款' },
  ],
  EARLY_DELIVERY: [
    { action: '确认提前交付是否可接收', priority: 'MEDIUM', description: '确认提前交付是否符合项目需求' },
    { action: '如不可接收，协商调整', priority: 'MEDIUM', description: '与对方协商调整交付时间' },
  ],
  UNVERIFIED_PAYMENT: [
    { action: '核实付款是否已完成', priority: 'HIGH', description: '确认付款是否实际到账' },
    { action: '联系财务核对账目', priority: 'HIGH', description: '与财务部门确认付款记录' },
    { action: '如未付款，发送催款通知', priority: 'HIGH', description: '确认付款状态并跟进' },
  ],
  QUALITY_ISSUE: [
    { action: '记录具体质量问题', priority: 'HIGH', description: '详细记录发现的质量问题' },
    { action: '要求责任方提供解决方案', priority: 'HIGH', description: '要求对方提供质量问题的解决方案' },
    { action: '安排质量复检', priority: 'MEDIUM', description: '安排时间进行质量复检' },
    { action: '根据合同条款处理', priority: 'MEDIUM', description: '根据合同中的质量条款进行处理' },
  ],
  OTHER: [
    { action: '记录异常详情', priority: 'MEDIUM', description: '详细记录异常情况' },
    { action: '分析异常原因', priority: 'MEDIUM', description: '分析异常产生的根本原因' },
    { action: '制定处理计划', priority: 'MEDIUM', description: '制定异常处理计划' },
  ],
};

// =============================================================================
// 合同履约节点服务
// =============================================================================

class ContractPerformanceService {
  /**
   * 创建合同履约节点
   */
  async createPerformance(
    input: CreateContractPerformanceInput
  ): Promise<ContractPerformanceResponse> {
    try {
      const performance = await prisma.contractPerformance.create({
        data: {
          contractId: input.contractId,
          milestone: input.milestone,
          milestoneDate: input.milestoneDate,
          description: input.description || null,
          milestoneType: input.milestoneType || null,
          responsibleParty: input.responsibleParty || null,
          responsibleRole: input.responsibleRole || null,
          caseId: input.caseId || null,
          notes: input.notes || null,
          reminderEnabled: input.reminderEnabled ?? true,
          reminderDays: input.reminderDays || [7, 3, 1],
          milestoneStatus: 'PENDING',
          isAnomalous: false,
          reminderSent: false,
          reminderCount: 0,
        },
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
              lawyerName: true,
            },
          },
        },
      });

      logger.info('创建合同履约节点成功', {
        id: performance.id,
        contractId: performance.contractId,
        milestone: performance.milestone,
      });

      return this.toPerformanceResponse(performance);
    } catch (error) {
      logger.error('创建合同履约节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 批量创建合同履约节点
   */
  async createPerformances(
    inputs: CreateContractPerformanceInput[]
  ): Promise<ContractPerformanceResponse[]> {
    const results: ContractPerformanceResponse[] = [];

    for (const input of inputs) {
      try {
        const result = await this.createPerformance(input);
        results.push(result);
      } catch (error) {
        logger.error('批量创建履约节点失败', {
          input,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * 更新合同履约节点
   */
  async updatePerformance(
    id: string,
    userId: string,
    input: UpdateContractPerformanceInput
  ): Promise<ContractPerformanceResponse> {
    try {
      // 先验证权限
      const existing = await prisma.contractPerformance.findFirst({
        where: {
          id,
          contract: {
            lawyerId: userId,
          },
        },
      });

      if (!existing) {
        throw new Error('无权更新此履约节点');
      }

      const updateData: Prisma.ContractPerformanceUpdateInput = {};

      if (input.milestone !== undefined) updateData.milestone = input.milestone;
      if (input.milestoneDate !== undefined)
        updateData.milestoneDate = input.milestoneDate;
      if (input.description !== undefined)
        updateData.description = input.description;
      if (input.milestoneType !== undefined)
        updateData.milestoneType = input.milestoneType;
      if (input.actualDate !== undefined)
        updateData.actualDate = input.actualDate;
      if (input.actualAmount !== undefined)
        updateData.actualAmount = new Prisma.Decimal(input.actualAmount);
      if (input.variance !== undefined)
        updateData.variance = new Prisma.Decimal(input.variance);
      if (input.varianceReason !== undefined)
        updateData.varianceReason = input.varianceReason;
      if (input.milestoneStatus !== undefined)
        updateData.milestoneStatus = input.milestoneStatus as never;
      if (input.isAnomalous !== undefined)
        updateData.isAnomalous = input.isAnomalous;
      if (input.anomalyType !== undefined)
        updateData.anomalyType = input.anomalyType as never;
      if (input.anomalyDescription !== undefined)
        updateData.anomalyDescription = input.anomalyDescription;
      if (input.recommendedAction !== undefined)
        updateData.recommendedAction = input.recommendedAction;
      if (input.responsibleParty !== undefined)
        updateData.responsibleParty = input.responsibleParty;
      if (input.responsibleRole !== undefined)
        updateData.responsibleRole = input.responsibleRole;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.reminderEnabled !== undefined)
        updateData.reminderEnabled = input.reminderEnabled;
      if (input.reminderDays !== undefined)
        updateData.reminderDays = input.reminderDays;

      const performance = await prisma.contractPerformance.update({
        where: { id },
        data: updateData,
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
              lawyerName: true,
            },
          },
        },
      });

      logger.info('更新合同履约节点成功', { id });

      return this.toPerformanceResponse(performance);
    } catch (error) {
      logger.error('更新合同履约节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 删除合同履约节点
   */
  async deletePerformance(id: string, userId: string): Promise<void> {
    try {
      const existing = await prisma.contractPerformance.findFirst({
        where: {
          id,
          contract: {
            lawyerId: userId,
          },
        },
      });

      if (!existing) {
        throw new Error('无权删除此履约节点');
      }

      await prisma.contractPerformance.delete({
        where: { id },
      });

      logger.info('删除合同履约节点成功', { id });
    } catch (error) {
      logger.error('删除合同履约节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取单个合同履约节点
   */
  async getPerformance(id: string): Promise<ContractPerformanceResponse | null> {
    try {
      const performance = await prisma.contractPerformance.findUnique({
        where: { id },
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
              lawyerName: true,
            },
          },
        },
      });

      if (!performance) {
        return null;
      }

      return this.toPerformanceResponse(performance);
    } catch (error) {
      logger.error('获取合同履约节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 查询合同履约节点列表
   */
  async queryPerformances(
    params: ContractPerformanceQueryParams
  ): Promise<{
    data: ContractPerformanceResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const { contractId, milestoneStatus, isAnomalous, caseId, startDate, endDate, page = 1, limit = 20 } = params;

      const where: Prisma.ContractPerformanceWhereInput = {};

      if (contractId) where.contractId = contractId;
      if (milestoneStatus) where.milestoneStatus = milestoneStatus as never;
      if (isAnomalous !== undefined) where.isAnomalous = isAnomalous;
      if (caseId) where.caseId = caseId;

      if (startDate || endDate) {
        where.milestoneDate = {};
        if (startDate) (where.milestoneDate as Record<string, Date>).gte = startDate;
        if (endDate) (where.milestoneDate as Record<string, Date>).lte = endDate;
      }

      const [data, total] = await Promise.all([
        prisma.contractPerformance.findMany({
          where,
          include: {
            contract: {
              select: {
                id: true,
                contractNumber: true,
                clientName: true,
                lawyerName: true,
              },
            },
          },
          orderBy: { milestoneDate: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.contractPerformance.count({ where }),
      ]);

      return {
        data: data.map((item) => this.toPerformanceResponse(item)),
        total,
        page,
        limit,
      };
    } catch (error) {
      logger.error('查询合同履约节点列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取需要提醒的履约节点
   */
  async getNodesForReminder(): Promise<ContractPerformanceResponse[]> {
    try {
      const now = new Date();
      const performances = await prisma.contractPerformance.findMany({
        where: {
          reminderEnabled: true,
          reminderSent: false,
          milestoneStatus: 'PENDING',
          milestoneDate: {
            gte: now,
          },
        },
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
              lawyerName: true,
            },
          },
        },
        orderBy: { milestoneDate: 'asc' },
      });

      return performances.map((item) => this.toPerformanceResponse(item));
    } catch (error) {
      logger.error('获取待提醒节点失败', error as Error);
      throw error;
    }
  }

  /**
   * 标记已发送提醒
   */
  async markReminderSent(id: string): Promise<void> {
    try {
      const performance = await prisma.contractPerformance.update({
        where: { id },
        data: {
          reminderSent: true,
          reminderCount: { increment: 1 },
          lastReminderAt: new Date(),
        },
      });

      logger.info('标记提醒已发送', { id, reminderCount: performance.reminderCount });
    } catch (error) {
      logger.error('标记提醒发送状态失败', error as Error);
      throw error;
    }
  }

  /**
   * 检测履约异常
   */
  async detectAnomalies(performanceId: string): Promise<void> {
    try {
      const performance = await prisma.contractPerformance.findUnique({
        where: { id: performanceId },
        include: {
          contract: {
            include: {
              payments: true,
            },
          },
        },
      });

      if (!performance || !performance.actualDate) {
        return;
      }

      const isOverdue =
        performance.milestoneStatus === 'PENDING' &&
        new Date() > performance.milestoneDate;

      if (isOverdue) {
        await prisma.contractPerformance.update({
          where: { id: performanceId },
          data: {
            milestoneStatus: 'OVERDUE',
            isAnomalous: true,
            anomalyType: 'LATE_PAYMENT',
            anomalyDescription: '节点已逾期未完成',
          },
        });
        return;
      }

      // 检测超进度付款（针对付款节点）
      if (performance.milestoneType === 'payment' && performance.actualAmount) {
        const expectedAmount = performance.contract.totalFee;
        const actualAmount = performance.actualAmount;

        if (actualAmount.greaterThan(expectedAmount)) {
          await prisma.contractPerformance.update({
            where: { id: performanceId },
            data: {
              isAnomalous: true,
              anomalyType: 'EARLY_PAYMENT',
              anomalyDescription: '实际付款金额超出合同约定金额',
              variance: actualAmount.minus(expectedAmount),
            },
          });
        }
      }

      logger.info('履约异常检测完成', { performanceId });
    } catch (error) {
      logger.error('检测履约异常失败', error as Error);
      throw error;
    }
  }

  /**
   * 转换为响应格式
   */
  private toPerformanceResponse(
    performance: Prisma.ContractPerformanceGetPayload<{
      include: {
        contract: {
          select: {
            id: true;
            contractNumber: true;
            clientName: true;
            lawyerName: true;
          };
        };
      };
    }>
  ): ContractPerformanceResponse {
    return {
      id: performance.id,
      contractId: performance.contractId,
      milestone: performance.milestone,
      milestoneDate: performance.milestoneDate,
      milestoneStatus: performance.milestoneStatus as ContractPerformanceResponse['milestoneStatus'],
      description: performance.description || undefined,
      milestoneType: performance.milestoneType || undefined,
      actualDate: performance.actualDate || undefined,
      actualAmount: performance.actualAmount?.toNumber() || undefined,
      variance: performance.variance?.toNumber() || undefined,
      varianceReason: performance.varianceReason || undefined,
      isAnomalous: performance.isAnomalous,
      anomalyType: performance.anomalyType as ContractPerformanceResponse['anomalyType'] || undefined,
      anomalyDescription: performance.anomalyDescription || undefined,
      recommendedAction: performance.recommendedAction || undefined,
      reminderEnabled: performance.reminderEnabled,
      reminderDays: performance.reminderDays,
      reminderSent: performance.reminderSent,
      reminderCount: performance.reminderCount,
      lastReminderAt: performance.lastReminderAt || undefined,
      responsibleParty: performance.responsibleParty || undefined,
      responsibleRole: performance.responsibleRole || undefined,
      caseId: performance.caseId || undefined,
      notes: performance.notes || undefined,
      createdAt: performance.createdAt,
      updatedAt: performance.updatedAt,
    };
  }
}

// =============================================================================
// 提醒配置服务
// =============================================================================

class ReminderConfigService {
  /**
   * 创建提醒配置
   */
  async createConfig(
    input: CreateReminderConfigInput
  ): Promise<ReminderConfigResponse> {
    try {
      const config = await prisma.reminderConfig.create({
        data: {
          enterpriseId: input.enterpriseId || null,
          userId: input.userId || null,
          reminderType: input.reminderType,
          enabled: input.enabled ?? true,
          channels: input.channels || ['IN_APP'],
          advanceDays: input.advanceDays || [7, 3, 1],
          timeOfDay: input.timeOfDay || null,
          isRecurring: input.isRecurring ?? false,
          recurringPattern: input.recurringPattern || null,
          isActive: true,
        },
      });

      logger.info('创建提醒配置成功', { id: config.id, reminderType: config.reminderType });

      return this.toConfigResponse(config);
    } catch (error) {
      logger.error('创建提醒配置失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新提醒配置
   */
  async updateConfig(
    id: string,
    input: UpdateReminderConfigInput
  ): Promise<ReminderConfigResponse> {
    try {
      const updateData: Prisma.ReminderConfigUpdateInput = {};

      if (input.enabled !== undefined) updateData.enabled = input.enabled;
      if (input.channels !== undefined) updateData.channels = input.channels;
      if (input.advanceDays !== undefined) updateData.advanceDays = input.advanceDays;
      if (input.timeOfDay !== undefined) updateData.timeOfDay = input.timeOfDay;
      if (input.isRecurring !== undefined) updateData.isRecurring = input.isRecurring;
      if (input.recurringPattern !== undefined)
        updateData.recurringPattern = input.recurringPattern;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const config = await prisma.reminderConfig.update({
        where: { id },
        data: updateData,
      });

      logger.info('更新提醒配置成功', { id });

      return this.toConfigResponse(config);
    } catch (error) {
      logger.error('更新提醒配置失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取提醒配置
   */
  async getConfig(id: string): Promise<ReminderConfigResponse | null> {
    try {
      const config = await prisma.reminderConfig.findUnique({
        where: { id },
      });

      if (!config) {
        return null;
      }

      return this.toConfigResponse(config);
    } catch (error) {
      logger.error('获取提醒配置失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取企业/用户的提醒配置
   */
  async getConfigsByEntity(
    enterpriseId?: string,
    userId?: string
  ): Promise<ReminderConfigResponse[]> {
    try {
      const where: Prisma.ReminderConfigWhereInput = {};

      if (enterpriseId) {
        where.enterpriseId = enterpriseId;
      } else if (userId) {
        where.userId = userId;
      }

      const configs = await prisma.reminderConfig.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return configs.map((config) => this.toConfigResponse(config));
    } catch (error) {
      logger.error('获取提醒配置列表失败', error as Error);
      throw error;
    }
  }

  /**
   * 删除提醒配置
   */
  async deleteConfig(id: string): Promise<void> {
    try {
      await prisma.reminderConfig.delete({
        where: { id },
      });

      logger.info('删除提醒配置成功', { id });
    } catch (error) {
      logger.error('删除提醒配置失败', error as Error);
      throw error;
    }
  }

  /**
   * 更新提醒发送统计
   */
  async incrementSentCount(id: string): Promise<void> {
    try {
      await prisma.reminderConfig.update({
        where: { id },
        data: {
          totalRemindersSent: { increment: 1 },
          lastSentAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('更新提醒发送统计失败', error as Error);
      throw error;
    }
  }

  /**
   * 转换为响应格式
   */
  private toConfigResponse(
    config: Prisma.ReminderConfigGetPayload<Record<string, never>>
  ): ReminderConfigResponse {
    return {
      id: config.id,
      enterpriseId: config.enterpriseId || undefined,
      userId: config.userId || undefined,
      reminderType: config.reminderType,
      enabled: config.enabled,
      channels: config.channels,
      advanceDays: config.advanceDays,
      timeOfDay: config.timeOfDay || undefined,
      isRecurring: config.isRecurring,
      recurringPattern: config.recurringPattern || undefined,
      isActive: config.isActive,
      totalRemindersSent: config.totalRemindersSent,
      lastSentAt: config.lastSentAt || undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}

// =============================================================================
// 异常检测服务
// =============================================================================

interface AnomalyDetectionResult {
  totalChecked: number;
  anomaliesFound: number;
  details: Array<{
    performanceId: string;
    anomalyType: string;
    description: string;
  }>;
}

interface AnomalySummary {
  totalContracts: number;
  contractsWithAnomalies: number;
  anomalyTypes: Record<string, number>;
}

/**
 * 增强的异常检测服务
 * 提供多种异常类型的智能检测、批量检测和主动预警功能
 */
class AnomalyDetectionService {
  /**
   * 增强的异常检测 - 支持多种异常类型
   */
  async detectAnomalies(performanceId: string): Promise<void> {
    try {
      const performance = await prisma.contractPerformance.findUnique({
        where: { id: performanceId },
        include: {
          contract: {
            include: {
              payments: true,
            },
          },
        },
      });

      if (!performance) {
        logger.warn('未找到履约节点', { performanceId });
        return;
      }

      // 1. 检测逾期未完成
      const isOverdue =
        (performance.milestoneStatus === 'PENDING' || performance.milestoneStatus === 'IN_PROGRESS') &&
        new Date() > performance.milestoneDate;

      if (isOverdue) {
        const anomalyType = performance.milestoneType === 'payment' ? 'LATE_PAYMENT' : 'LATE_DELIVERY';
        const description =
          performance.milestoneType === 'payment' ? '付款节点已逾期未完成' : '交付节点已逾期未完成';

        await prisma.contractPerformance.update({
          where: { id: performanceId },
          data: {
            milestoneStatus: 'OVERDUE',
            isAnomalous: true,
            anomalyType,
            anomalyDescription: description,
            recommendedAction: this.getAnomalyRecommendations(anomalyType)[0]?.action || '联系责任方确认情况',
          },
        });
        logger.info('检测到逾期异常', { performanceId, anomalyType });
        return;
      }

      // 2. 检测超进度付款
      if (performance.milestoneType === 'payment' && performance.actualAmount && performance.actualDate) {
        const expectedAmountNum = performance.contract.totalFee.toNumber();
        const actualAmountNum = performance.actualAmount.toNumber();

        if (actualAmountNum > expectedAmountNum) {
          const variance = actualAmountNum - expectedAmountNum;
          await prisma.contractPerformance.update({
            where: { id: performanceId },
            data: {
              isAnomalous: true,
              anomalyType: 'EARLY_PAYMENT',
              anomalyDescription: `实际付款金额${actualAmountNum}元超出合同约定金额${expectedAmountNum}元`,
              variance,
              recommendedAction: this.getAnomalyRecommendations('EARLY_PAYMENT')[0]?.action || '核实付款意图',
            },
          });
          logger.info('检测到超进度付款异常', { performanceId, variance });
          return;
        }

        // 3. 检测延迟付款
        if (performance.milestoneStatus === 'COMPLETED' && performance.actualDate > performance.milestoneDate) {
          const delayDays = Math.floor(
            (performance.actualDate.getTime() - performance.milestoneDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (delayDays > 7) {
            // 延迟超过7天视为异常
            await prisma.contractPerformance.update({
              where: { id: performanceId },
              data: {
                isAnomalous: true,
                anomalyType: 'LATE_PAYMENT',
                anomalyDescription: `付款延迟${delayDays}天`,
                variance: performance.actualAmount || undefined,
                recommendedAction: this.getAnomalyRecommendations('LATE_PAYMENT')[0]?.action || '联系客户确认',
              },
            });
            logger.info('检测到延迟付款异常', { performanceId, delayDays });
          }
        }
      }

      // 4. 检测交付延迟
      if (performance.milestoneType === 'delivery' && performance.actualDate) {
        if (performance.actualDate > performance.milestoneDate) {
          const delayDays = Math.floor(
            (performance.actualDate.getTime() - performance.milestoneDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          await prisma.contractPerformance.update({
            where: { id: performanceId },
            data: {
              isAnomalous: true,
              anomalyType: 'LATE_DELIVERY',
              anomalyDescription: `交付延迟${delayDays}天`,
              recommendedAction: this.getAnomalyRecommendations('LATE_DELIVERY')[0]?.action || '联系责任方确认',
            },
          });
          logger.info('检测到交付延迟异常', { performanceId, delayDays });
          return;
        }
      }

      // 5. 检测未验收结算异常（交付完成但无付款记录）
      if (
        performance.milestoneType === 'milestone' &&
        performance.milestoneStatus === 'COMPLETED' &&
        performance.actualDate
      ) {
        // 检查是否有相关的付款节点未完成
        const paymentNodes = await prisma.contractPerformance.findMany({
          where: {
            contractId: performance.contractId,
            milestoneType: 'payment',
            milestoneStatus: { in: ['PENDING', 'IN_PROGRESS'] },
          },
        });

        if (paymentNodes.length > 0) {
          await prisma.contractPerformance.update({
            where: { id: performanceId },
            data: {
              isAnomalous: true,
              anomalyType: 'UNVERIFIED_PAYMENT',
              anomalyDescription: '已完成交付但相关付款节点未完成',
              recommendedAction: this.getAnomalyRecommendations('UNVERIFIED_PAYMENT')[0]?.action || '核实付款状态',
            },
          });
          logger.info('检测到未验收结算异常', { performanceId });
        }
      }

      logger.info('履约异常检测完成', { performanceId });
    } catch (error) {
      logger.error('检测履约异常失败', error as Error);
      throw error;
    }
  }

  /**
   * 批量检测所有待检测的履约节点
   */
  async detectAllAnomalies(): Promise<AnomalyDetectionResult> {
    try {
      const performances = await prisma.contractPerformance.findMany({
        where: {
          milestoneStatus: {
            in: ['PENDING', 'IN_PROGRESS'],
          },
        },
        include: {
          contract: {
            include: {
              payments: true,
            },
          },
        },
      });

      let anomaliesFound = 0;
      const details: Array<{ performanceId: string; anomalyType: string; description: string }> = [];

      for (const performance of performances) {
        await this.detectAnomalies(performance.id);

        // 检查是否被标记为异常
        const updated = await prisma.contractPerformance.findUnique({
          where: { id: performance.id },
          select: { isAnomalous: true, anomalyType: true, anomalyDescription: true },
        });

        if (updated?.isAnomalous && updated.anomalyType) {
          anomaliesFound++;
          details.push({
            performanceId: performance.id,
            anomalyType: updated.anomalyType,
            description: updated.anomalyDescription || '',
          });
        }
      }

      logger.info('批量异常检测完成', { total: performances.length, anomalies: anomaliesFound });

      return {
        totalChecked: performances.length,
        anomaliesFound,
        details,
      };
    } catch (error) {
      logger.error('批量检测履约异常失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取异常统计信息
   */
  async getAnomalySummary(): Promise<AnomalySummary> {
    try {
      // 获取所有有异常的履约节点
      const anomalousPerformances = await prisma.contractPerformance.findMany({
        where: { isAnomalous: true },
        select: {
          contractId: true,
          anomalyType: true,
        },
      });

      // 获取唯一的合同ID
      const uniqueContractIds = [...new Set(anomalousPerformances.map((p) => p.contractId))];
      const totalContracts = await prisma.contract.count();

      const anomalyTypes: Record<string, number> = {};
      for (const perf of anomalousPerformances) {
        const type = perf.anomalyType || 'OTHER';
        anomalyTypes[type] = (anomalyTypes[type] || 0) + 1;
      }

      return {
        totalContracts,
        contractsWithAnomalies: uniqueContractIds.length,
        anomalyTypes,
      };
    } catch (error) {
      logger.error('获取异常统计失败', error as Error);
      throw error;
    }
  }

  /**
   * 获取异常处理建议
   */
  getAnomalyRecommendations(anomalyType: string): AnomalyRecommendation[] {
    return ANOMALY_RECOMMENDATIONS[anomalyType] || ANOMALY_RECOMMENDATIONS.OTHER;
  }

  /**
   * 自动检测异常并通知相关人员
   */
  async autoDetectAndNotify(userId: string): Promise<number> {
    try {
      // 查找该用户负责的异常节点
      const anomalousNodes = await prisma.contractPerformance.findMany({
        where: {
          isAnomalous: true,
          contract: {
            lawyerId: userId,
          },
        },
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
            },
          },
        },
      });

      if (anomalousNodes.length === 0) {
        return 0;
      }

      const notificationService = getUserNotificationService();

      for (const node of anomalousNodes) {
        await notificationService.createNotification({
          userId,
          type: PrismaNotificationType.ALERT,
          title: `合同履约异常提醒：${node.milestone}`,
          content: `合同【${node.contract.contractNumber}】的【${node.milestone}】节点存在异常：${node.anomalyDescription}`,
          priority: 'HIGH',
          link: `/contracts/${node.contractId}/performance`,
        });
      }

      logger.info('异常通知发送完成', { userId, count: anomalousNodes.length });

      return anomalousNodes.length;
    } catch (error) {
      logger.error('自动检测并通知失败', error as Error);
      throw error;
    }
  }

  /**
   * 解决异常
   */
  async resolveAnomaly(performanceId: string, resolutionNote: string): Promise<void> {
    try {
      const performance = await prisma.contractPerformance.findUnique({
        where: { id: performanceId },
      });

      if (!performance) {
        throw new Error('未找到履约节点');
      }

      await prisma.contractPerformance.update({
        where: { id: performanceId },
        data: {
          isAnomalous: false,
          anomalyType: null,
          anomalyDescription: null,
          recommendedAction: null,
          notes: resolutionNote,
        },
      });

      logger.info('异常已解决', { performanceId, resolutionNote });
    } catch (error) {
      logger.error('解决异常失败', error as Error);
      throw error;
    }
  }
}

// 导出服务实例
export const contractPerformanceService = new ContractPerformanceService();
export const reminderConfigService = new ReminderConfigService();
export const anomalyDetectionService = new AnomalyDetectionService();
