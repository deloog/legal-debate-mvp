/**
 * 诉讼费计算器
 * 实现诉讼费用的计算逻辑（基于《诉讼费用交纳办法》）
 */

import {
  FeeItem,
  FeeType,
  LitigationCaseType,
  LitigationFeeCalculationParams,
  FeeCalculationResult,
} from '../../types/calculation';
import {
  BaseFeeCalculator,
  ProgressiveCalculator,
} from './fee-calculator-core';
import { v4 as uuidv4 } from 'uuid';

export class LitigationFeeCalculator extends BaseFeeCalculator {
  /**
   * 默认诉讼费率（基于《诉讼费用交纳办法》）
   * 注意：这是一个简化的实现，实际规则可能更复杂
   */
  private static DEFAULT_RULES = {
    [LitigationCaseType.PROPERTY]: [
      { minAmount: 0, maxAmount: 10000, rate: 0, plusAmount: 50 },
      { minAmount: 10000, maxAmount: 100000, rate: 2.5, plusAmount: 0 },
      { minAmount: 100000, maxAmount: 200000, rate: 2, plusAmount: 0 },
      { minAmount: 200000, maxAmount: 500000, rate: 1.5, plusAmount: 0 },
      { minAmount: 500000, maxAmount: 1000000, rate: 1, plusAmount: 0 },
      { minAmount: 1000000, maxAmount: 2000000, rate: 0.9, plusAmount: 0 },
      { minAmount: 2000000, maxAmount: 5000000, rate: 0.8, plusAmount: 0 },
      { minAmount: 5000000, maxAmount: 10000000, rate: 0.7, plusAmount: 0 },
      { minAmount: 10000000, maxAmount: 20000000, rate: 0.6, plusAmount: 0 },
      { minAmount: 20000000, maxAmount: null, rate: 0.5, plusAmount: 0 },
    ],
    // 其他类型案件通常是按件收费
    [LitigationCaseType.DIVORCE]: [
      { minAmount: 0, maxAmount: 200000, rate: 0, plusAmount: 300 }, // 财产超过20万部分另算
      { minAmount: 200000, maxAmount: null, rate: 0.5, plusAmount: 0 },
    ],
    [LitigationCaseType.PERSONAL_RIGHTS]: [
      { minAmount: 0, maxAmount: null, rate: 0, plusAmount: 500 }, // 按件收费
    ],
    [LitigationCaseType.INTELLECTUAL_PROPERTY]: [
      { minAmount: 0, maxAmount: null, rate: 0, plusAmount: 1000 }, // 按件收费
    ],
    [LitigationCaseType.LABOR_DISPUTE]: [
      { minAmount: 0, maxAmount: null, rate: 0, plusAmount: 0 }, // 劳动争议免费
    ],
    [LitigationCaseType.OTHER]: [
      { minAmount: 0, maxAmount: null, rate: 0, plusAmount: 100 }, // 默认按件收费
    ],
  };

  /**
   * 计算诉讼费
   * @param params 计算参数
   */
  public calculate(
    params: LitigationFeeCalculationParams
  ): FeeCalculationResult {
    const { caseType, amount = 0, isReduced, config } = params;
    const items: FeeItem[] = [];

    // 获取计算规则（优先使用自定义配置）
    const rules =
      config?.customRules ||
      LitigationFeeCalculator.DEFAULT_RULES[caseType] ||
      LitigationFeeCalculator.DEFAULT_RULES[LitigationCaseType.OTHER];

    // 计算基础费用
    const calculation = ProgressiveCalculator.calculate(amount, rules);
    let fee = calculation.fee;

    // 如果适用减半收取（如简易程序、撤诉等）
    if (isReduced) {
      fee = fee / 2;
    }

    const currency = config?.currency || 'CNY';

    items.push({
      id: uuidv4(),
      name: '案件受理费',
      type: FeeType.LITIGATION_FEE,
      amount: this.formatAmount(fee),
      currency,
      description: `案件类型: ${caseType}, 争议金额: ${amount}${
        isReduced ? ', 适用减半收取' : ''
      }`,
      calculationDetails: {
        amount,
        rules,
        baseFee: calculation.fee,
        details: calculation.details,
        isReduced,
      },
    });

    return this.buildResult(items, currency, { caseType, isReduced });
  }
}
