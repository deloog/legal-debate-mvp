/**
 * 时效计算服务
 *
 * 提供统一的API接口，集成到现有服务架构中
 */

import { prisma } from '@/lib/db/prisma';
import { statuteCalculator } from './statute-calculator';
import type {
  StatuteCalculationParams,
  StatuteCalculationResult,
  StatuteStatistics,
  StatuteCalculationQueryParams,
  StatuteCalculationListResponse,
} from '@/types/statute';
import { StatuteType, getRiskLevel } from '@/types/statute';
import { logger } from '@/lib/logger';

/**
 * 时效计算服务
 */
export class StatuteCalculationService {
  /**
   * 计算时效并保存结果
   */
  async calculateAndSave(
    userId: string,
    params: StatuteCalculationParams
  ): Promise<StatuteCalculationResult> {
    try {
      // 执行计算
      const result = statuteCalculator.calculate(params);

      // 保存计算结果到数据库（使用现有的Reminder模型）
      // 这里可以扩展或使用专门的表，目前使用metadata存储
      await this.saveCalculationResult(userId, result);

      return result;
    } catch (error) {
      logger.error('时效计算失败:', error);
      throw new Error(
        `时效计算失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 批量计算
   */
  async batchCalculate(
    userId: string,
    paramsList: StatuteCalculationParams[]
  ): Promise<StatuteCalculationResult[]> {
    try {
      const results = statuteCalculator.batchCalculate(paramsList);

      // 批量保存结果
      for (const result of results) {
        await this.saveCalculationResult(userId, result);
      }

      return results;
    } catch (error) {
      logger.error('批量时效计算失败:', error);
      throw new Error(
        `批量时效计算失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`
      );
    }
  }

  /**
   * 获取计算结果列表
   */
  async getCalculationList(
    userId: string,
    params: StatuteCalculationQueryParams
  ): Promise<StatuteCalculationListResponse> {
    try {
      const page = params.page || 1;
      const limit = params.limit || 20;
      const skip = (page - 1) * limit;

      // 从Reminder表中获取时效相关的提醒
      const where: Record<string, unknown> = {
        userId,
        type: 'DEADLINE', // 使用DEADLINE类型表示时效提醒
      };

      if (params.caseId) {
        where.relatedId = params.caseId;
      }

      const [reminders, total] = await Promise.all([
        prisma.reminder.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            reminderTime: params.sortOrder === 'asc' ? 'asc' : 'desc',
          },
        }),
        prisma.reminder.count({ where }),
      ]);

      // 转换为计算结果格式
      const calculations: StatuteCalculationResult[] = reminders
        .filter(r => r.metadata && typeof r.metadata === 'object')
        .map(reminder => {
          const metadata = reminder.metadata as Record<string, unknown>;
          return {
            id: reminder.id,
            caseId: (metadata.caseId as string) || '',
            statuteType:
              (metadata.statuteType as StatuteType) || StatuteType.LITIGATION,
            startDate: new Date(metadata.startDate as string),
            deadlineDate: reminder.reminderTime,
            remainingDays:
              (metadata.remainingDays as number) ||
              this.calculateRemainingDays(new Date(), reminder.reminderTime),
            isExpired: reminder.reminderTime < new Date(),
            isApproaching:
              (metadata.isApproaching as boolean) ||
              this.isApproaching(reminder.reminderTime),
            applicableRules: [],
            specialCircumstances: [],
            calculationMetadata: {
              calculationMethod: 'STANDARD',
              appliedRules: [],
              adjustments: {},
              warnings: [],
              recommendations: [],
              confidence: 1.0,
            },
            createdAt: reminder.createdAt,
            updatedAt: reminder.updatedAt,
          };
        });

      // 计算统计数据
      const statistics = await this.calculateStatistics(calculations);

      return {
        calculations,
        total,
        page,
        limit,
        statistics,
      };
    } catch (error) {
      logger.error('获取计算结果列表失败:', error);
      throw new Error(
        `获取计算结果列表失败: ${
          error instanceof Error ? error.message : '未知错误'
        }`
      );
    }
  }

  /**
   * 获取单个计算结果
   */
  async getCalculationResult(
    id: string,
    userId: string
  ): Promise<StatuteCalculationResult | null> {
    try {
      const reminder = await prisma.reminder.findFirst({
        where: {
          id,
          userId,
          type: 'DEADLINE',
        },
      });

      if (!reminder) {
        return null;
      }

      const metadata = reminder.metadata as Record<string, unknown>;
      return {
        id: reminder.id,
        caseId: (metadata.caseId as string) || '',
        statuteType:
          (metadata.statuteType as StatuteType) || StatuteType.LITIGATION,
        startDate: new Date(metadata.startDate as string),
        deadlineDate: reminder.reminderTime,
        remainingDays:
          (metadata.remainingDays as number) ||
          this.calculateRemainingDays(new Date(), reminder.reminderTime),
        isExpired: reminder.reminderTime < new Date(),
        isApproaching:
          (metadata.isApproaching as boolean) ||
          this.isApproaching(reminder.reminderTime),
        applicableRules: [],
        specialCircumstances: [],
        calculationMetadata: {
          calculationMethod: 'STANDARD',
          appliedRules: [],
          adjustments: {},
          warnings: [],
          recommendations: [],
          confidence: 1.0,
        },
        createdAt: reminder.createdAt,
        updatedAt: reminder.updatedAt,
      };
    } catch (error) {
      logger.error('获取计算结果失败:', error);
      throw new Error(
        `获取计算结果失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 删除计算结果
   */
  async deleteCalculationResult(id: string, userId: string): Promise<boolean> {
    try {
      const result = await prisma.reminder.deleteMany({
        where: {
          id,
          userId,
          type: 'DEADLINE',
        },
      });

      return result.count > 0;
    } catch (error) {
      logger.error('删除计算结果失败:', error);
      throw new Error(
        `删除计算结果失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 获取统计数据
   */
  async getStatistics(userId: string): Promise<StatuteStatistics> {
    try {
      const reminders = await prisma.reminder.findMany({
        where: {
          userId,
          type: 'DEADLINE',
        },
      });

      const calculations = reminders
        .filter(r => r.metadata && typeof r.metadata === 'object')
        .map(reminder => {
          const metadata = reminder.metadata as Record<string, unknown>;
          const remainingDays =
            (metadata.remainingDays as number) ||
            this.calculateRemainingDays(new Date(), reminder.reminderTime);
          return {
            isExpired: reminder.reminderTime < new Date(),
            isApproaching:
              (metadata.isApproaching as boolean) ||
              this.isApproaching(reminder.reminderTime),
            remainingDays,
            statuteType: (metadata.statuteType as string) || 'LITIGATION',
          };
        });

      return this.calculateStatistics(
        calculations as Array<{
          isExpired: boolean;
          isApproaching: boolean;
          remainingDays: number;
          statuteType: string;
        }>
      );
    } catch (error) {
      logger.error('获取统计数据失败:', error);
      throw new Error(
        `获取统计数据失败: ${error instanceof Error ? error.message : '未知错误'}`
      );
    }
  }

  /**
   * 保存计算结果
   */
  private async saveCalculationResult(
    userId: string,
    result: StatuteCalculationResult
  ): Promise<void> {
    // 检查是否已存在
    const existing = await prisma.reminder.findFirst({
      where: {
        userId,
        relatedId: result.caseId,
        type: 'DEADLINE',
      },
    });

    const metadata = {
      caseId: result.caseId,
      statuteType: result.statuteType,
      startDate: result.startDate,
      remainingDays: result.remainingDays,
      isApproaching: result.isApproaching,
    };

    if (existing) {
      // 更新现有记录
      await prisma.reminder.update({
        where: { id: existing.id },
        data: {
          reminderTime: result.deadlineDate,
          status: result.isExpired ? 'SENT' : 'PENDING',
          metadata,
        },
      });
    } else {
      // 创建新记录
      await prisma.reminder.create({
        data: {
          userId,
          type: 'DEADLINE',
          title: `${this.getStatuteTypeLabel(result.statuteType)}到期提醒`,
          message: `案件${result.caseId}的${this.getStatuteTypeLabel(
            result.statuteType
          )}将于${result.deadlineDate.toLocaleDateString('zh-CN')}到期`,
          reminderTime: result.deadlineDate,
          status: result.isExpired ? 'SENT' : 'PENDING',
          channels: ['IN_APP', 'EMAIL'],
          relatedType: 'Case',
          relatedId: result.caseId,
          metadata,
        },
      });
    }
  }

  /**
   * 计算统计数据
   */
  private calculateStatistics(
    calculations: Array<{
      isExpired: boolean;
      isApproaching: boolean;
      remainingDays: number;
      statuteType: string;
    }>
  ): StatuteStatistics {
    const totalCalculations = calculations.length;
    const expiredCount = calculations.filter(c => c.isExpired).length;
    const approachingCount = calculations.filter(c => c.isApproaching).length;
    const validCount = calculations.filter(c => !c.isExpired).length;

    const averageRemainingDays =
      totalCalculations > 0
        ? calculations.reduce((sum, c) => sum + c.remainingDays, 0) /
          totalCalculations
        : 0;

    // 按类型统计
    const byType: StatuteStatistics['byType'] = {
      LITIGATION: { total: 0, expired: 0, approaching: 0, valid: 0 },
      APPEAL: { total: 0, expired: 0, approaching: 0, valid: 0 },
      ENFORCEMENT: { total: 0, expired: 0, approaching: 0, valid: 0 },
    };

    for (const calc of calculations) {
      const type = calc.statuteType as 'LITIGATION' | 'APPEAL' | 'ENFORCEMENT';
      if (byType[type]) {
        byType[type].total++;
        if (calc.isExpired) byType[type].expired++;
        if (calc.isApproaching) byType[type].approaching++;
        if (!calc.isExpired) byType[type].valid++;
      }
    }

    // 风险分布
    const riskDistribution = {
      high: calculations.filter(c => getRiskLevel(c.remainingDays) === 'HIGH')
        .length,
      medium: calculations.filter(
        c => getRiskLevel(c.remainingDays) === 'MEDIUM'
      ).length,
      low: calculations.filter(c => getRiskLevel(c.remainingDays) === 'LOW')
        .length,
    };

    return {
      totalCalculations,
      expiredCount,
      approachingCount,
      validCount,
      averageRemainingDays,
      byType,
      riskDistribution,
    };
  }

  /**
   * 计算剩余天数
   */
  private calculateRemainingDays(
    currentDate: Date,
    deadlineDate: Date
  ): number {
    const diff = deadlineDate.getTime() - currentDate.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * 判断是否接近到期
   */
  private isApproaching(deadlineDate: Date): boolean {
    const remainingDays = this.calculateRemainingDays(new Date(), deadlineDate);
    return remainingDays > 0 && remainingDays <= 30;
  }

  /**
   * 获取时效类型标签
   */
  private getStatuteTypeLabel(statuteType: string): string {
    switch (statuteType) {
      case 'LITIGATION':
        return '诉讼时效';
      case 'APPEAL':
        return '上诉时效';
      case 'ENFORCEMENT':
        return '执行时效';
      default:
        return '时效';
    }
  }
}

/**
 * 导出单例实例
 */
export const statuteCalculationService = new StatuteCalculationService();
