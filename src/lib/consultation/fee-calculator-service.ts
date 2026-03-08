/**
 * 律师费计算服务
 *
 * 提供多种收费模式的计算功能：
 * - 固定收费
 * - 风险代理
 * - 计时收费
 * - 分阶段收费
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * 收费模式类型
 */
export type FeeMode = 'FIXED' | 'RISK' | 'HOURLY' | 'STAGED';

/**
 * 费用计算输入参数
 */
export interface FeeCalculationInput {
  caseType?: string;
  caseAmount?: number; // 标的额
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  feeMode: FeeMode;
  // 风险代理参数
  riskRate?: number; // 风险比例 0-1
  // 计时收费参数
  estimatedHours?: number;
  hourlyRate?: number;
  // 分阶段收费参数
  stages?: Array<{
    name: string;
    percentage: number;
  }>;
}

/**
 * 费用计算结果
 */
export interface FeeCalculationResult {
  feeMode: FeeMode;
  feeModeLabel: string;
  // 费用明细
  baseFee: number; // 基础费用
  adjustedFee: number; // 调整后费用（考虑难度等因素）
  totalFee: number; // 总费用
  // 明细说明
  breakdown: Array<{
    item: string;
    amount: number;
    description?: string;
  }>;
  // 风险代理专用
  riskFee?: {
    baseAmount: number;
    riskRate: number;
    potentialFee: number;
  };
  // 计时收费专用
  hourlyFee?: {
    hours: number;
    rate: number;
    total: number;
  };
  // 分阶段收费专用
  stagedFees?: Array<{
    stage: string;
    amount: number;
    percentage: number;
  }>;
  // 计算说明
  notes: string[];
}

/**
 * 律师费计算服务类
 */
export class FeeCalculatorService {
  /**
   * 费用模式标签
   */
  private static readonly FEE_MODE_LABELS: Record<FeeMode, string> = {
    FIXED: '固定收费',
    RISK: '风险代理',
    HOURLY: '计时收费',
    STAGED: '分阶段收费',
  };

  /**
   * 默认小时费率
   */
  private static readonly DEFAULT_HOURLY_RATE = 500;

  /**
   * 默认风险代理比例
   */
  private static readonly DEFAULT_RISK_RATE = 0.15;

  /**
   * 计算律师费
   */
  public async calculate(
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult> {
    switch (input.feeMode) {
      case 'FIXED':
        return this.calculateFixedFee(input);
      case 'RISK':
        return this.calculateRiskFee(input);
      case 'HOURLY':
        return this.calculateHourlyFee(input);
      case 'STAGED':
        return this.calculateStagedFee(input);
      default:
        return this.calculateFixedFee(input);
    }
  }

  /**
   * 计算固定收费
   */
  private async calculateFixedFee(
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult> {
    const breakdown: Array<{
      item: string;
      amount: number;
      description?: string;
    }> = [];
    const notes: string[] = [];

    // 获取基础费用
    let baseFee = 5000;
    if (input.caseType) {
      const caseTypeConfig = await this.getCaseTypeConfig(input.caseType);
      if (caseTypeConfig) {
        baseFee = Number(caseTypeConfig.baseFee);
        notes.push(`基于"${caseTypeConfig.name}"案件类型的收费标准`);
      }
    }

    breakdown.push({
      item: '基础律师费',
      amount: baseFee,
      description: '案件基础代理费用',
    });

    // 难度调整
    let difficultyMultiplier = 1;
    if (input.difficulty) {
      switch (input.difficulty) {
        case 'EASY':
          difficultyMultiplier = 0.9;
          notes.push('案件难度较低，费用下调10%');
          break;
        case 'MEDIUM':
          difficultyMultiplier = 1;
          break;
        case 'HARD':
          difficultyMultiplier = 1.5;
          notes.push('案件较为复杂，费用上调50%');
          break;
      }
    }

    const adjustedFee = Math.round(baseFee * difficultyMultiplier);

    if (difficultyMultiplier !== 1) {
      breakdown.push({
        item: '难度调整',
        amount: adjustedFee - baseFee,
        description: `难度系数：${difficultyMultiplier}`,
      });
    }

    // 标的额调整（针对财产类案件）
    let amountAdjustment = 0;
    if (input.caseAmount && input.caseAmount > 100000) {
      // 超过10万的部分按一定比例收取
      const excessAmount = input.caseAmount - 100000;
      let rate = 0.03; // 默认3%
      if (excessAmount > 1000000) {
        rate = 0.02; // 超过100万降为2%
      }
      if (excessAmount > 10000000) {
        rate = 0.01; // 超过1000万降为1%
      }
      amountAdjustment = Math.round(excessAmount * rate);
      breakdown.push({
        item: '标的额附加费',
        amount: amountAdjustment,
        description: `标的额${(input.caseAmount / 10000).toFixed(2)}万元`,
      });
      notes.push(
        `根据标的额计算附加费用（超过10万部分的${(rate * 100).toFixed(1)}%）`
      );
    }

    const totalFee = adjustedFee + amountAdjustment;

    return {
      feeMode: 'FIXED',
      feeModeLabel: FeeCalculatorService.FEE_MODE_LABELS.FIXED,
      baseFee,
      adjustedFee,
      totalFee,
      breakdown,
      notes,
    };
  }

  /**
   * 计算风险代理费
   */
  private async calculateRiskFee(
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult> {
    const breakdown: Array<{
      item: string;
      amount: number;
      description?: string;
    }> = [];
    const notes: string[] = [];

    // 获取基础费用（前期费用）
    let baseFee = 3000;
    if (input.caseType) {
      const caseTypeConfig = await this.getCaseTypeConfig(input.caseType);
      if (caseTypeConfig) {
        // 风险代理的前期费用通常较低
        baseFee = Math.round(Number(caseTypeConfig.baseFee) * 0.3);
        notes.push(`基于"${caseTypeConfig.name}"案件类型的风险代理标准`);
      }
    }

    breakdown.push({
      item: '前期代理费',
      amount: baseFee,
      description: '案件启动及代理基础费用',
    });

    // 风险比例
    const riskRate = input.riskRate || FeeCalculatorService.DEFAULT_RISK_RATE;
    const caseAmount = input.caseAmount || 0;

    // 计算风险代理费
    const potentialRiskFee = Math.round(caseAmount * riskRate);

    notes.push(`风险代理比例：${(riskRate * 100).toFixed(0)}%`);
    notes.push('风险代理费在案件胜诉并实际获得执行款后收取');

    if (caseAmount > 0) {
      notes.push(
        `预估胜诉后可获风险代理费：¥${potentialRiskFee.toLocaleString()}`
      );
    }

    return {
      feeMode: 'RISK',
      feeModeLabel: FeeCalculatorService.FEE_MODE_LABELS.RISK,
      baseFee,
      adjustedFee: baseFee,
      totalFee: baseFee, // 前期实际收取费用
      breakdown,
      riskFee: {
        baseAmount: caseAmount,
        riskRate,
        potentialFee: potentialRiskFee,
      },
      notes,
    };
  }

  /**
   * 计算计时收费
   */
  private async calculateHourlyFee(
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult> {
    const breakdown: Array<{
      item: string;
      amount: number;
      description?: string;
    }> = [];
    const notes: string[] = [];

    // 获取小时费率
    let hourlyRate =
      input.hourlyRate || FeeCalculatorService.DEFAULT_HOURLY_RATE;
    if (input.caseType) {
      const caseTypeConfig = await this.getCaseTypeConfig(input.caseType);
      if (caseTypeConfig && caseTypeConfig.hourlyRate) {
        hourlyRate = Number(caseTypeConfig.hourlyRate);
        notes.push(`基于"${caseTypeConfig.name}"案件类型的计时收费标准`);
      }
    }

    // 估算工时
    let estimatedHours = input.estimatedHours || 10;
    if (!input.estimatedHours && input.difficulty) {
      switch (input.difficulty) {
        case 'EASY':
          estimatedHours = 8;
          break;
        case 'MEDIUM':
          estimatedHours = 15;
          break;
        case 'HARD':
          estimatedHours = 30;
          break;
      }
    }

    const totalFee = Math.round(hourlyRate * estimatedHours);

    breakdown.push({
      item: '律师工时费',
      amount: totalFee,
      description: `${estimatedHours}小时 × ¥${hourlyRate}/小时`,
    });

    notes.push(`计时费率：¥${hourlyRate}/小时`);
    notes.push(`预估工时：${estimatedHours}小时`);
    notes.push('实际费用按实际工时结算');

    return {
      feeMode: 'HOURLY',
      feeModeLabel: FeeCalculatorService.FEE_MODE_LABELS.HOURLY,
      baseFee: hourlyRate,
      adjustedFee: totalFee,
      totalFee,
      breakdown,
      hourlyFee: {
        hours: estimatedHours,
        rate: hourlyRate,
        total: totalFee,
      },
      notes,
    };
  }

  /**
   * 计算分阶段收费
   */
  private async calculateStagedFee(
    input: FeeCalculationInput
  ): Promise<FeeCalculationResult> {
    const breakdown: Array<{
      item: string;
      amount: number;
      description?: string;
    }> = [];
    const notes: string[] = [];

    // 获取基础费用
    let baseFee = 5000;
    if (input.caseType) {
      const caseTypeConfig = await this.getCaseTypeConfig(input.caseType);
      if (caseTypeConfig) {
        baseFee = Number(caseTypeConfig.baseFee);
        notes.push(`基于"${caseTypeConfig.name}"案件类型的收费标准`);
      }
    }

    // 难度调整
    let difficultyMultiplier = 1;
    if (input.difficulty) {
      switch (input.difficulty) {
        case 'EASY':
          difficultyMultiplier = 0.9;
          break;
        case 'MEDIUM':
          difficultyMultiplier = 1;
          break;
        case 'HARD':
          difficultyMultiplier = 1.5;
          break;
      }
    }

    const totalFee = Math.round(baseFee * difficultyMultiplier);

    // 默认阶段划分
    const stages = input.stages || [
      { name: '签约立案', percentage: 0.4 },
      { name: '一审结案', percentage: 0.4 },
      { name: '执行完毕', percentage: 0.2 },
    ];

    const stagedFees: Array<{
      stage: string;
      amount: number;
      percentage: number;
    }> = [];

    for (const stage of stages) {
      const stageAmount = Math.round(totalFee * stage.percentage);
      stagedFees.push({
        stage: stage.name,
        amount: stageAmount,
        percentage: stage.percentage,
      });
      breakdown.push({
        item: stage.name,
        amount: stageAmount,
        description: `${(stage.percentage * 100).toFixed(0)}%`,
      });
    }

    notes.push('分阶段收费，按案件进展节点收取');

    return {
      feeMode: 'STAGED',
      feeModeLabel: FeeCalculatorService.FEE_MODE_LABELS.STAGED,
      baseFee,
      adjustedFee: totalFee,
      totalFee,
      breakdown,
      stagedFees,
      notes,
    };
  }

  /**
   * 获取案件类型配置
   */
  private async getCaseTypeConfig(caseType: string) {
    try {
      return await prisma.caseTypeConfig.findFirst({
        where: {
          OR: [{ code: caseType }, { name: { contains: caseType } }],
          isActive: true,
        },
      });
    } catch (error) {
      logger.error('获取案件类型配置失败:', error);
      return null;
    }
  }

  /**
   * 获取所有收费模式
   */
  public static getFeeModes(): Array<{ value: FeeMode; label: string }> {
    return Object.entries(FeeCalculatorService.FEE_MODE_LABELS).map(
      ([value, label]) => ({
        value: value as FeeMode,
        label,
      })
    );
  }
}

/**
 * 创建费用计算服务实例
 */
export function createFeeCalculatorService(): FeeCalculatorService {
  return new FeeCalculatorService();
}
