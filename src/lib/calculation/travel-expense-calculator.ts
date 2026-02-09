/**
 * 差旅费计算器
 * 实现差旅费用的计算逻辑
 */

import {
  FeeItem,
  ExpenseCategory,
  TravelExpenseCalculationParams,
  FeeCalculationResult,
} from '../../types/calculation';
import { BaseFeeCalculator } from './fee-calculator-core';
import { v4 as uuidv4 } from 'uuid';

export class TravelExpenseCalculator extends BaseFeeCalculator {
  /**
   * 计算差旅费
   * @param params 计算参数
   */
  public calculate(
    params: TravelExpenseCalculationParams
  ): FeeCalculationResult {
    const { days, peopleCount, expenses, config } = params;
    const items: FeeItem[] = [];
    const currency = config?.currency || 'CNY';

    // 1. 计算伙食补助
    if (config?.dailyAllowance) {
      const allowanceAmount = config.dailyAllowance * days * peopleCount;
      items.push({
        id: uuidv4(),
        name: '伙食补助',
        type: ExpenseCategory.TRAVEL_EXPENSE,
        amount: this.formatAmount(allowanceAmount),
        currency,
        description: `标准: ${config.dailyAllowance}/天/人, 天数: ${days}, 人数: ${peopleCount}`,
        calculationDetails: {
          dailyAllowance: config.dailyAllowance,
          days,
          peopleCount,
        },
      });
    }

    // 2. 处理实际发生费用
    expenses.forEach((expense, index) => {
      let name = '';
      switch (expense.type) {
        case 'TRANSPORT':
          name = '交通费';
          break;
        case 'ACCOMMODATION':
          name = '住宿费';
          break;
        case 'ALLOWANCE':
          name = '其他补助';
          break;
        case 'OTHER':
          name = '其他差旅费';
          break;
        default:
          name = '差旅费';
      }

      // 检查住宿费是否超标
      const amount = expense.amount;
      let description = expense.description || name;
      const calculationDetails: Record<string, unknown> = {
        originalAmount: amount,
      };

      if (expense.type === 'ACCOMMODATION' && config?.accommodationLimit) {
        const limit = config.accommodationLimit * days * peopleCount;
        if (amount > limit) {
          // 修复6: 正确显示超出金额
          const exceeded = amount - limit;
          description += ` (原金额: ${amount}, 超出限额: ${exceeded})`;
          calculationDetails.limit = limit;
          calculationDetails.exceeded = exceeded;
          // 注意：这里我们通常记录实际发生费用，但在描述中标记超标
          // 如果需要严格限制，可以取消下面这行的注释
          // amount = limit;
        }
      }

      items.push({
        id: uuidv4(),
        name: `${name}-${index + 1}`,
        type: ExpenseCategory.TRAVEL_EXPENSE,
        amount: this.formatAmount(amount),
        currency,
        description,
        calculationDetails,
      });
    });

    return this.buildResult(items, currency, { days, peopleCount });
  }
}
