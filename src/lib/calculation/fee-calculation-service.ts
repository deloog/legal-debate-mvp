/**
 * 费用计算服务
 * 封装所有计算逻辑，对外提供统一接口
 */

import { FeeConfigType, PrismaClient } from '@prisma/client';
import {
  FeeCalculationResult,
  ExpenseCategory,
  FeeType,
  LawyerFeeCalculationParams,
  LitigationFeeCalculationParams,
  TravelExpenseCalculationParams,
  LawyerFeeConfig,
  LitigationFeeConfig,
  TravelExpenseConfig,
  LawyerFeeRateData,
  LitigationFeeRateData,
  TravelExpenseRateData,
} from '../../types/calculation';
import { LawyerFeeCalculator } from './lawyer-fee-calculator';
import { LitigationFeeCalculator } from './litigation-fee-calculator';
import { TravelExpenseCalculator } from './travel-expense-calculator';
import { FeeConfigManager } from './fee-config-manager';

export class FeeCalculationService {
  private prisma: PrismaClient;
  private configManager: FeeConfigManager;
  private lawyerCalculator: LawyerFeeCalculator;
  private litigationCalculator: LitigationFeeCalculator;
  private travelCalculator: TravelExpenseCalculator;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.configManager = new FeeConfigManager(prisma);
    this.lawyerCalculator = new LawyerFeeCalculator();
    this.litigationCalculator = new LitigationFeeCalculator();
    this.travelCalculator = new TravelExpenseCalculator();
  }

  /**
   * 计算律师费
   */
  async calculateLawyerFee(
    userId: string | null,
    params: Omit<LawyerFeeCalculationParams, 'config'> & {
      config?: LawyerFeeConfig;
    }
  ): Promise<FeeCalculationResult> {
    let config = params.config;

    // 如果未提供配置，尝试加载用户默认配置
    if (!config && userId) {
      const dbConfig = await this.configManager.getDefaultConfig(
        userId,
        FeeConfigType.LAWYER_FEE
      );
      if (dbConfig) {
        const rateData = dbConfig.rateData as unknown as LawyerFeeRateData;
        config = {
          mode: rateData.defaultMode,
          hourlyRate: rateData.hourlyRate,
          percentageRate: rateData.percentageRules?.[0]?.rate, // 简化处理，实际应根据金额匹配
          contingencyRate: rateData.contingencyRate,
          currency: 'CNY',
        } as LawyerFeeConfig;
      }
    }

    if (!config) {
      throw new Error('Missing lawyer fee configuration');
    }

    return this.lawyerCalculator.calculate({ ...params, config });
  }

  /**
   * 计算诉讼费
   */
  async calculateLitigationFee(
    userId: string | null,
    params: Omit<LitigationFeeCalculationParams, 'config'> & {
      config?: LitigationFeeConfig;
    }
  ): Promise<FeeCalculationResult> {
    let config = params.config;

    // 如果未提供配置，尝试加载用户默认配置
    if (!config && userId) {
      const dbConfig = await this.configManager.getDefaultConfig(
        userId,
        FeeConfigType.LITIGATION_FEE
      );
      if (dbConfig) {
        const rateData = dbConfig.rateData as unknown as LitigationFeeRateData;
        config = {
          caseType: params.caseType,
          isReduced: params.isReduced,
          currency: 'CNY',
          customRules: rateData.rules[params.caseType],
        };
      }
    }

    return this.litigationCalculator.calculate({ ...params, config });
  }

  /**
   * 计算差旅费
   */
  async calculateTravelExpense(
    userId: string | null,
    params: Omit<TravelExpenseCalculationParams, 'config'> & {
      config?: TravelExpenseConfig;
    }
  ): Promise<FeeCalculationResult> {
    let config = params.config;

    // 如果未提供配置，尝试加载用户默认配置
    if (!config && userId) {
      const dbConfig = await this.configManager.getDefaultConfig(
        userId,
        FeeConfigType.TRAVEL_EXPENSE
      );
      if (dbConfig) {
        const rateData = dbConfig.rateData as unknown as TravelExpenseRateData;
        config = {
          dailyAllowance: rateData.dailyAllowance,
          accommodationLimit: rateData.accommodationLimit,
          currency: 'CNY',
        };
      }
    }

    return this.travelCalculator.calculate({ ...params, config });
  }

  /**
   * 计算综合费用（包含多种费用类型）
   */
  async calculateTotalFee(
    userId: string | null,
    params: {
      lawyer?: Omit<LawyerFeeCalculationParams, 'config'> & {
        config?: LawyerFeeConfig;
      };
      litigation?: Omit<LitigationFeeCalculationParams, 'config'> & {
        config?: LitigationFeeConfig;
      };
      travel?: Omit<TravelExpenseCalculationParams, 'config'> & {
        config?: TravelExpenseConfig;
      };
    }
  ): Promise<FeeCalculationResult> {
    const results: FeeCalculationResult[] = [];

    if (params.lawyer) {
      results.push(await this.calculateLawyerFee(userId, params.lawyer));
    }

    if (params.litigation) {
      results.push(
        await this.calculateLitigationFee(userId, params.litigation)
      );
    }

    if (params.travel) {
      results.push(await this.calculateTravelExpense(userId, params.travel));
    }

    // 合并结果
    const totalResult: FeeCalculationResult = {
      totalAmount: 0,
      currency: 'CNY', // 假设统一货币
      items: [],
      breakdown: {
        [FeeType.LAWYER_FEE]: 0,
        [FeeType.LITIGATION_FEE]: 0,
        [FeeType.TRAVEL_EXPENSE]: 0,
        [FeeType.OTHER_EXPENSE]: 0,
      },
    };

    results.forEach(result => {
      totalResult.totalAmount += result.totalAmount;
      totalResult.items.push(...result.items);

      Object.keys(result.breakdown).forEach(key => {
        const type = key as keyof typeof FeeType;
        totalResult.breakdown[FeeType[type]] += result.breakdown[FeeType[type]];
      });
    });

    return totalResult;
  }
}
