/**
 * 费用计算引擎核心逻辑
 * 负责基础的计算功能和通用工具方法
 */

import {
  FeeItem,
  FeeCalculationResult,
  ExpenseCategory,
} from '../../types/calculation';

/**
 * 费用计算器基类
 */
export abstract class BaseFeeCalculator {
  /**
   * 计算总金额
   * @param items 费用项列表
   */
  protected calculateTotal(items: FeeItem[]): number {
    return items.reduce((sum, item) => sum + item.amount, 0);
  }

  /**
   * 按类型汇总费用
   * @param items 费用项列表
   */
  protected breakdownByType(items: FeeItem[]): Record<ExpenseCategory, number> {
    const breakdown = {
      [ExpenseCategory.LAWYER_FEE]: 0,
      [ExpenseCategory.LITIGATION_FEE]: 0,
      [ExpenseCategory.TRAVEL_EXPENSE]: 0,
      [ExpenseCategory.OTHER_EXPENSE]: 0,
    };

    items.forEach(item => {
      if (breakdown[item.type] !== undefined) {
        breakdown[item.type] += item.amount;
      }
    });

    return breakdown;
  }

  /**
   * 构建计算结果
   * @param items 费用项列表
   * @param currency 货币单位
   * @param metadata 元数据
   */
  protected buildResult(
    items: FeeItem[],
    currency: string = 'CNY',
    metadata?: Record<string, unknown>
  ): FeeCalculationResult {
    return {
      totalAmount: this.calculateTotal(items),
      currency,
      items,
      breakdown: this.breakdownByType(items),
      metadata,
    };
  }

  /**
   * 格式化金额（保留2位小数）
   * @param amount 金额
   */
  protected formatAmount(amount: number): number {
    return Math.round(amount * 100) / 100;
  }
}

/**
 * 分段累进计算工具类
 */
export class ProgressiveCalculator {
  /**
   * 计算分段累进费用
   * @param amount 标的金额
   * @param rules 计算规则
   */
  static calculate(
    amount: number,
    rules: Array<{
      minAmount: number;
      maxAmount: number | null;
      rate: number;
      plusAmount: number;
    }>
  ): { fee: number; details: Record<string, unknown> } {
    let fee = 0;
    const details: Record<string, number> = {};

    for (const rule of rules) {
      if (amount <= rule.minAmount) continue;

      const applicableAmount =
        rule.maxAmount === null
          ? amount - rule.minAmount
          : Math.min(amount, rule.maxAmount) - rule.minAmount;

      if (applicableAmount > 0) {
        const segmentFee = (applicableAmount * rule.rate) / 100;
        fee += segmentFee;

        const rangeLabel =
          rule.maxAmount === null
            ? `>${rule.minAmount}`
            : `${rule.minAmount}-${rule.maxAmount}`;

        details[rangeLabel] = segmentFee;
      }
    }

    // 加上最后一项的固定金额（通常是首段的固定费用）
    if (rules.length > 0) {
      fee += rules[0].plusAmount;
      details['base'] = rules[0].plusAmount;
    }

    return {
      fee: Math.round(fee * 100) / 100,
      details,
    };
  }
}
