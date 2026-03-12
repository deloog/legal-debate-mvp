/**
 * 时效计算器核心
 *
 * 实现诉讼时效、上诉时效、执行时效的计算逻辑
 */

import {
  StatuteCalculationParams,
  StatuteCalculationResult,
  StatuteMetadata,
  SpecialCircumstances,
} from '@/types/statute';
import { getApplicableRules, isRuleValid } from './statute-rules';
import { logger } from '@/lib/logger';

/**
 * 时效计算器类
 */
export class StatuteCalculator {
  /**
   * 计算时效
   */
  calculate(params: StatuteCalculationParams): StatuteCalculationResult {
    // 验证参数
    this.validateParams(params);

    // 获取适用的规则
    const applicableRules = getApplicableRules(
      params.statuteType,
      params.caseType,
      params.customRules
    );

    if (applicableRules.length === 0) {
      throw new Error('未找到适用的时效规则');
    }

    // 使用第一个有效规则进行计算
    const primaryRule = applicableRules.find(r => isRuleValid(r));
    if (!primaryRule) {
      throw new Error('未找到有效的时效规则');
    }

    // 计算截止日期
    const deadlineDate = this.calculateDeadline(
      params.startDate,
      primaryRule.statutePeriod,
      params.specialCircumstances
    );

    // 计算剩余天数
    const currentDate = params.endDate || new Date();
    const remainingDays = this.calculateRemainingDays(
      currentDate,
      deadlineDate
    );

    // 构建计算结果
    const result: StatuteCalculationResult = {
      id: `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      caseId: params.caseId,
      statuteType: params.statuteType,
      startDate: params.startDate,
      deadlineDate,
      remainingDays,
      isExpired: remainingDays <= 0,
      isApproaching: this.isApproachingDeadline(remainingDays),
      applicableRules,
      specialCircumstances: params.specialCircumstances || [],
      calculationMetadata: this.buildMetadata(
        params,
        primaryRule,
        applicableRules,
        remainingDays
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return result;
  }

  /**
   * 验证计算参数
   */
  private validateParams(params: StatuteCalculationParams): void {
    if (!params.caseId) {
      throw new Error('案件ID不能为空');
    }
    if (!params.startDate) {
      throw new Error('起始日期不能为空');
    }
    if (isNaN(params.startDate.getTime())) {
      throw new Error('起始日期格式无效');
    }
    if (params.endDate && isNaN(params.endDate.getTime())) {
      throw new Error('结束日期格式无效');
    }
    if (params.endDate && params.endDate < params.startDate) {
      throw new Error('结束日期不能早于起始日期');
    }
  }

  /**
   * 计算截止日期
   */
  private calculateDeadline(
    startDate: Date,
    statutePeriod: number,
    specialCircumstances?: SpecialCircumstances[]
  ): Date {
    const deadline = new Date(startDate);
    deadline.setDate(deadline.getDate() + statutePeriod);

    // 处理特殊情况
    if (specialCircumstances && specialCircumstances.length > 0) {
      this.applySpecialCircumstances(deadline, specialCircumstances);
    }

    return deadline;
  }

  /**
   * 应用特殊情况调整
   */
  private applySpecialCircumstances(
    deadline: Date,
    circumstances: SpecialCircumstances[]
  ): void {
    for (const circumstance of circumstances) {
      switch (circumstance) {
        case SpecialCircumstances.INTERRUPTION:
          // 时效中断：重新计算时效
          deadline.setDate(deadline.getDate() + 0);
          break;
        case SpecialCircumstances.SUSPENSION:
          // 时效中止：暂停计算
          deadline.setDate(deadline.getDate() + 30);
          break;
        case SpecialCircumstances.MINOR:
          // 限制民事行为能力人保护
          deadline.setDate(deadline.getDate() + 90);
          break;
        case SpecialCircumstances.DISABILITY:
          // 无民事行为能力人保护
          deadline.setDate(deadline.getDate() + 180);
          break;
        case SpecialCircumstances.FORCE_MAJEURE:
          // 不可抗力
          deadline.setDate(deadline.getDate() + 60);
          break;
        case SpecialCircumstances.CLAIM_DENIAL:
          // 对方承认债务
          deadline.setDate(deadline.getDate() + 365);
          break;
        case SpecialCircumstances.ASSETS_REPOSSESSION:
          // 占有动产
          deadline.setDate(deadline.getDate() + 180);
          break;
        default:
          break;
      }
    }
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
   * 判断是否接近到期（30天内）
   */
  private isApproachingDeadline(remainingDays: number): boolean {
    return remainingDays > 0 && remainingDays <= 30;
  }

  /**
   * 构建计算元数据
   */
  private buildMetadata(
    params: StatuteCalculationParams,
    _primaryRule: { id: string; statutePeriod: number },
    applicableRules: { id: string }[],
    remainingDays: number
  ): StatuteMetadata {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    const adjustments: StatuteMetadata['adjustments'] = {};

    // 处理特殊情况调整
    if (params.specialCircumstances && params.specialCircumstances.length > 0) {
      for (const circumstance of params.specialCircumstances) {
        switch (circumstance) {
          case SpecialCircumstances.INTERRUPTION:
            adjustments.interruptionDays = 0;
            warnings.push('时效中断，可能需要重新计算');
            break;
          case SpecialCircumstances.SUSPENSION:
            adjustments.suspensionDays = 30;
            warnings.push('时效中止，已延长30天');
            break;
          case SpecialCircumstances.MINOR:
            adjustments.minorProtectionDays = 90;
            warnings.push('限制民事行为能力人，保护期90天');
            break;
          case SpecialCircumstances.DISABILITY:
            adjustments.minorProtectionDays = 180;
            warnings.push('无民事行为能力人，保护期180天');
            break;
          default:
            break;
        }
      }
    }

    // 生成警告和建议
    if (remainingDays <= 0) {
      warnings.push('时效已过期');
      recommendations.push('请立即采取法律行动');
    } else if (remainingDays <= 7) {
      warnings.push('即将在7天内到期');
      recommendations.push('建议立即采取行动');
    } else if (remainingDays <= 30) {
      warnings.push('即将在30天内到期');
      recommendations.push('建议尽快采取行动');
    }

    if (params.customRules && params.customRules.length > 0) {
      adjustments.customAdjustments = 0;
    }

    // 计算置信度
    const confidence = this.calculateConfidence(params, remainingDays);

    return {
      calculationMethod: params.customRules ? 'MIXED' : 'STANDARD',
      appliedRules: applicableRules.map(r => r.id),
      adjustments,
      warnings,
      recommendations,
      confidence,
    };
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(
    params: StatuteCalculationParams,
    remainingDays: number
  ): number {
    let confidence = 1.0;

    // 特殊情况会降低置信度
    if (params.specialCircumstances && params.specialCircumstances.length > 0) {
      confidence *= 0.8;
    }

    // 自定义规则会降低置信度
    if (params.customRules && params.customRules.length > 0) {
      confidence *= 0.9;
    }

    // 过期会降低置信度
    if (remainingDays <= 0) {
      confidence *= 0.95;
    }

    return Math.max(0.5, confidence); // 最低置信度0.5
  }

  /**
   * 批量计算
   */
  batchCalculate(
    paramsList: StatuteCalculationParams[]
  ): StatuteCalculationResult[] {
    const results: StatuteCalculationResult[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < paramsList.length; i++) {
      try {
        const result = this.calculate(paramsList[i]);
        results.push(result);
      } catch (error) {
        errors.push({
          index: i,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    if (errors.length > 0) {
      logger.warn('批量计算部分失败:', errors);
    }

    return results;
  }
}

/**
 * 导出单例实例
 */
export const statuteCalculator = new StatuteCalculator();
