/**
 * 律师费计算器
 * 实现律师费用的计算逻辑
 */

import {
  FeeItem,
  ExpenseCategory,
  BillingMode,
  LawyerFeeCalculationParams,
  FeeCalculationResult,
} from '../../types/calculation';
import { BaseFeeCalculator } from './fee-calculator-core';
import { v4 as uuidv4 } from 'uuid';

export class LawyerFeeCalculator extends BaseFeeCalculator {
  /**
   * 计算律师费
   * @param params 计算参数
   */
  public calculate(params: LawyerFeeCalculationParams): FeeCalculationResult {
    const { config, hours, caseAmount, isWin, winAmount } = params;
    const items: FeeItem[] = [];

    // 根据计费模式计算
    switch (config.mode) {
      case BillingMode.HOURLY:
        if (config.hourlyRate && hours) {
          items.push({
            id: uuidv4(),
            name: '计时收费',
            type: ExpenseCategory.LAWYER_FEE,
            amount: this.formatAmount(config.hourlyRate * hours),
            currency: config.currency,
            description: `小时费率: ${config.hourlyRate}/小时, 工作时长: ${hours}小时`,
            calculationDetails: { hourlyRate: config.hourlyRate, hours },
          });
        }
        break;

      case BillingMode.FIXED:
        if (config.fixedAmount) {
          items.push({
            id: uuidv4(),
            name: '固定收费',
            type: ExpenseCategory.LAWYER_FEE,
            amount: this.formatAmount(config.fixedAmount),
            currency: config.currency,
            description: `固定收费: ${config.fixedAmount}`,
            calculationDetails: { fixedAmount: config.fixedAmount },
          });
        }
        break;

      case BillingMode.PERCENTAGE:
        if (config.percentageRate && caseAmount) {
          const amount = (caseAmount * config.percentageRate) / 100;
          items.push({
            id: uuidv4(),
            name: '按比例收费',
            type: ExpenseCategory.LAWYER_FEE,
            amount: this.formatAmount(amount),
            currency: config.currency,
            description: `标的金额: ${caseAmount}, 比例: ${config.percentageRate}%`,
            calculationDetails: {
              caseAmount,
              percentageRate: config.percentageRate,
            },
          });
        }
        break;

      case BillingMode.CONTINGENCY:
        if (config.contingencyRate && isWin && winAmount) {
          const amount = (winAmount * config.contingencyRate) / 100;
          items.push({
            id: uuidv4(),
            name: '风险代理收费',
            type: ExpenseCategory.LAWYER_FEE,
            amount: this.formatAmount(amount),
            currency: config.currency,
            description: `胜诉金额: ${winAmount}, 比例: ${config.contingencyRate}%`,
            calculationDetails: {
              winAmount,
              contingencyRate: config.contingencyRate,
            },
          });
        }
        break;

      case BillingMode.HYBRID:
        // 混合模式：基础费用 + 风险代理
        if (config.baseAmount) {
          items.push({
            id: uuidv4(),
            name: '基础代理费',
            type: ExpenseCategory.LAWYER_FEE,
            amount: this.formatAmount(config.baseAmount),
            currency: config.currency,
            description: `基础代理费: ${config.baseAmount}`,
            calculationDetails: { baseAmount: config.baseAmount },
          });
        }

        if (config.contingencyRate && isWin && winAmount) {
          const amount = (winAmount * config.contingencyRate) / 100;
          items.push({
            id: uuidv4(),
            name: '风险代理费',
            type: ExpenseCategory.LAWYER_FEE,
            amount: this.formatAmount(amount),
            currency: config.currency,
            description: `胜诉金额: ${winAmount}, 比例: ${config.contingencyRate}%`,
            calculationDetails: {
              winAmount,
              contingencyRate: config.contingencyRate,
            },
          });
        }
        break;
    }

    // 处理最低/最高收费限制
    let total = this.calculateTotal(items);
    const originalTotal = total;
    let limitApplied = false;
    let limitType = '';

    // 修复1: 移除total > 0条件，允许在total为0时也应用最小限制
    if (config.minAmount && total < config.minAmount) {
      total = config.minAmount;
      limitApplied = true;
      limitType = 'MIN';
    } else if (config.maxAmount && total > config.maxAmount) {
      total = config.maxAmount;
      limitApplied = true;
      limitType = 'MAX';
    }

    // 修复3: 当total正好等于限制时也应该添加调整项以保持一致性
    // 特别处理恰好等于限额的情况
    if (
      limitApplied ||
      (config.maxAmount &&
        total === config.maxAmount &&
        originalTotal !== config.maxAmount)
    ) {
      items.push({
        id: uuidv4(),
        name: limitType === 'MIN' ? '最低收费补差' : '最高收费限额调整',
        type: ExpenseCategory.LAWYER_FEE,
        amount: this.formatAmount(total - originalTotal),
        currency: config.currency,
        description:
          limitType === 'MIN'
            ? `原计算金额${originalTotal}低于最低收费标准${config.minAmount}`
            : `原计算金额${originalTotal}高于最高收费标准${config.maxAmount}`,
        calculationDetails: {
          originalTotal,
          limitAmount:
            limitType === 'MIN' ? config.minAmount : config.maxAmount,
        },
      });
    }

    return this.buildResult(items, config.currency, { mode: config.mode });
  }
}
