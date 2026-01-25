import {
  FeeType,
  BillingMode,
  LawyerFeeCalculationParams,
  FeeCalculationResult,
  LitigationCaseType,
  LitigationFeeCalculationParams,
  TravelExpenseCalculationParams,
} from '../../../types/calculation';
import { LawyerFeeCalculator } from '../../../lib/calculation/lawyer-fee-calculator';
import { LitigationFeeCalculator } from '../../../lib/calculation/litigation-fee-calculator';
import { TravelExpenseCalculator } from '../../../lib/calculation/travel-expense-calculator';

describe('Fee Calculation Engine', () => {
  // 1. 律师费计算测试
  describe('LawyerFeeCalculator', () => {
    const calculator = new LawyerFeeCalculator();

    test('should calculate hourly fee correctly', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.HOURLY,
          hourlyRate: 1000,
          currency: 'CNY',
        },
        hours: 10,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(10000);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe(FeeType.LAWYER_FEE);
    });

    test('should calculate fixed fee correctly', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.FIXED,
          fixedAmount: 5000,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(5000);
    });

    test('should calculate percentage fee correctly', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 5, // 5%
          currency: 'CNY',
        },
        caseAmount: 100000,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(5000); // 100000 * 0.05
    });

    test('should calculate contingency fee correctly (win)', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.CONTINGENCY,
          contingencyRate: 20, // 20%
          currency: 'CNY',
        },
        isWin: true,
        winAmount: 50000,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(10000); // 50000 * 0.2
    });

    test('should return 0 for contingency fee (loss)', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.CONTINGENCY,
          contingencyRate: 20,
          currency: 'CNY',
        },
        isWin: false,
        winAmount: 0,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
    });

    test('should apply min/max limits', () => {
      // Test Min
      const minParams: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 1,
          minAmount: 2000,
          currency: 'CNY',
        },
        caseAmount: 10000, // 100 calculated
      };
      const minResult = calculator.calculate(minParams);
      expect(minResult.totalAmount).toBe(2000);

      // Test Max
      const maxParams: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 10,
          maxAmount: 5000,
          currency: 'CNY',
        },
        caseAmount: 100000, // 10000 calculated
      };
      const maxResult = calculator.calculate(maxParams);
      expect(maxResult.totalAmount).toBe(5000);
    });

    test('should handle hybrid mode correctly', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.HYBRID,
          baseAmount: 2000,
          contingencyRate: 30,
          currency: 'CNY',
        },
        isWin: true,
        winAmount: 50000,
      };

      const result = calculator.calculate(params);
      expect(result.items).toHaveLength(2);
      expect(result.totalAmount).toBe(17000); // 2000 + (50000 * 0.3)
      expect(result.items[0].name).toBe('基础代理费');
      expect(result.items[1].name).toBe('风险代理费');
    });

    test('should handle hybrid mode without win', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.HYBRID,
          baseAmount: 2000,
          contingencyRate: 30,
          currency: 'CNY',
        },
        isWin: false,
        winAmount: 0,
      };

      const result = calculator.calculate(params);
      expect(result.items).toHaveLength(1);
      expect(result.totalAmount).toBe(2000);
      expect(result.items[0].name).toBe('基础代理费');
    });

    test('should handle edge cases correctly', () => {
      // Test with zero values
      const zeroParams: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.HOURLY,
          hourlyRate: 1000,
          currency: 'CNY',
        },
        hours: 0,
      };

      const zeroResult = calculator.calculate(zeroParams);
      expect(zeroResult.totalAmount).toBe(0);

      // Test with negative values (should be handled by formatting)
      const negativeParams: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 5,
          currency: 'CNY',
        },
        caseAmount: -10000,
      };

      const negativeResult = calculator.calculate(negativeParams);
      expect(negativeResult.totalAmount).toBe(-500); // -10000 * 0.05
    });

    test('should handle missing parameters gracefully', () => {
      // Test hourly mode without hours
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.HOURLY,
          hourlyRate: 1000,
          currency: 'CNY',
        },
        // missing hours
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    test('should calculate contingency fee correctly with zero win amount', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.CONTINGENCY,
          contingencyRate: 20,
          currency: 'CNY',
        },
        isWin: true,
        winAmount: 0,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
    });

    test('should handle percentage mode without case amount', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 5,
          currency: 'CNY',
        },
        // missing caseAmount
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    test('should apply min limit with zero base calculation', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 1,
          minAmount: 2000,
          currency: 'CNY',
        },
        caseAmount: 0, // Zero base calculation
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(2000);
      expect(result.items).toHaveLength(1); // Only adjustment since original is 0
      expect(result.items[0].name).toBe('最低收费补差');
    });

    test('should handle currency formatting', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.FIXED,
          fixedAmount: 123.456,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(123.46);
      expect(result.items[0].amount).toBe(123.46);
    });

    test('should handle fixed mode without fixed amount', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.FIXED,
          currency: 'CNY',
          // missing fixedAmount
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    test('should handle percentage mode without percentage rate', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          currency: 'CNY',
          // missing percentageRate
        },
        caseAmount: 10000,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    test('should handle contingency mode without win', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.CONTINGENCY,
          contingencyRate: 20,
          currency: 'CNY',
        },
        // missing isWin and winAmount
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0);
      expect(result.items).toHaveLength(0);
    });

    test('should handle hybrid mode with only contingency part', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.HYBRID,
          contingencyRate: 30,
          currency: 'CNY',
          // missing baseAmount
        },
        isWin: true,
        winAmount: 50000,
      };

      const result = calculator.calculate(params);
      expect(result.items).toHaveLength(1);
      expect(result.totalAmount).toBe(15000);
      expect(result.items[0].name).toBe('风险代理费');
    });

    test('should apply max limit when amount is exactly at limit', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 5,
          maxAmount: 10000,
          currency: 'CNY',
        },
        caseAmount: 200000, // 10000 calculated - exactly at limit
      };

      const result = calculator.calculate(params);
      expect(result.items).toHaveLength(1); // No adjustment needed when exactly at limit
      expect(result.totalAmount).toBe(10000);
      expect(result.items[0].name).toBe('按比例收费');
    });

    test('should apply max limit with negative adjustment', () => {
      const params: LawyerFeeCalculationParams = {
        config: {
          mode: BillingMode.PERCENTAGE,
          percentageRate: 10,
          maxAmount: 5000,
          currency: 'CNY',
        },
        caseAmount: 60000, // 6000 calculated - exceeds limit
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(5000);
      expect(result.items[1].amount).toBe(-1000); // Adjustment amount
    });
  });

  // 2. 诉讼费计算测试
  describe('LitigationFeeCalculator', () => {
    const calculator = new LitigationFeeCalculator();

    test('should calculate property case fee correctly', () => {
      const params: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.PROPERTY,
        amount: 50000, // 10000以下免收+50，10000-50000按2.5%
      };
      // 0-10000: 50 (fixed)
      // 10000-50000: 40000 * 2.5% = 1000
      // Total: 1050

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(1050);
    });

    test('should apply reduced fee correctly', () => {
      const params: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.PROPERTY,
        amount: 50000,
        isReduced: true,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(525); // 1050 / 2
    });

    test('should calculate non-property case fee correctly', () => {
      const params: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.DIVORCE,
        amount: 0, // 无财产争议
      };
      // Divorce base: 300 (plusAmount) + 0 (rate)

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(300);
    });

    test('should handle different property case amounts', () => {
      // Test with amount below 10000 (should pay only 50)
      const below10000Params: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.PROPERTY,
        amount: 5000,
      };

      const below10000Result = calculator.calculate(below10000Params);
      expect(below10000Result.totalAmount).toBe(50);

      // Test with amount exactly at 10000 (should pay only 50)
      const exactly10000Params: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.PROPERTY,
        amount: 10000,
      };

      const exactly10000Result = calculator.calculate(exactly10000Params);
      expect(exactly10000Result.totalAmount).toBe(50);

      // Test with amount above 1000000 (should pay actual calculated fee)
      const largeAmountParams: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.PROPERTY,
        amount: 2000000,
      };

      const largeAmountResult = calculator.calculate(largeAmountParams);
      expect(largeAmountResult.totalAmount).toBe(22800); // Actual calculated fee for 2000000
    });

    test('should calculate other case types correctly', () => {
      // Test intellectual property case
      const ipParams: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.INTELLECTUAL_PROPERTY,
        amount: 100000,
      };

      const ipResult = calculator.calculate(ipParams);
      expect(ipResult.totalAmount).toBeGreaterThan(0);

      // Test labor dispute case
      const laborParams: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.LABOR_DISPUTE,
        amount: 50000,
      };

      const laborResult = calculator.calculate(laborParams);
      expect(laborResult.totalAmount).toBe(0); // Labor disputes have no fee
    });

    test('should handle reduced fee for different case types', () => {
      const params: LitigationFeeCalculationParams = {
        caseType: LitigationCaseType.DIVORCE,
        amount: 0,
        isReduced: true,
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(150); // 300 / 2
    });
  });

  // 3. 差旅费计算测试
  describe('TravelExpenseCalculator', () => {
    const calculator = new TravelExpenseCalculator();

    test('should calculate allowance correctly', () => {
      const params: TravelExpenseCalculationParams = {
        days: 5,
        peopleCount: 2,
        expenses: [],
        config: {
          dailyAllowance: 100,
          accommodationLimit: 500,
          currency: 'CNY',
        },
      };
      // 100 * 5 * 2 = 1000

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(1000);
    });

    test('should sum up actual expenses', () => {
      const params: TravelExpenseCalculationParams = {
        days: 1,
        peopleCount: 1,
        expenses: [
          { type: 'TRANSPORT', amount: 500 },
          { type: 'ACCOMMODATION', amount: 300 },
        ],
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(800);
    });

    test('should handle accommodation limit warning', () => {
      const params: TravelExpenseCalculationParams = {
        days: 1,
        peopleCount: 1,
        expenses: [{ type: 'ACCOMMODATION', amount: 600 }],
        config: {
          dailyAllowance: 0,
          accommodationLimit: 500, // Limit is 500
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(600); // Still returns actual amount
      expect(result.items[0].description).toContain('超出限额');
      expect(result.items[0].calculationDetails?.exceeded).toBe(100);
    });

    test('should handle different expense types correctly', () => {
      const params: TravelExpenseCalculationParams = {
        days: 2,
        peopleCount: 3,
        expenses: [
          { type: 'TRANSPORT', amount: 1000, description: 'Flight tickets' },
          { type: 'ACCOMMODATION', amount: 800, description: 'Hotel' },
          { type: 'ALLOWANCE', amount: 300, description: 'Meals' },
          { type: 'OTHER', amount: 200, description: 'Miscellaneous' },
          {
            type: 'UNKNOWN_TYPE' as any,
            amount: 100,
            description: 'Unknown type',
          },
        ],
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(2400); // No allowance configured, only expenses
      expect(result.items).toHaveLength(5);
    });

    test('should handle empty expenses array', () => {
      const params: TravelExpenseCalculationParams = {
        days: 3,
        peopleCount: 2,
        expenses: [],
        config: {
          dailyAllowance: 150,
          accommodationLimit: 800,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(900); // 150 * 3 * 2
      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('伙食补助');
    });

    test('should handle complex multi-day scenario', () => {
      const params: TravelExpenseCalculationParams = {
        days: 7,
        peopleCount: 2,
        expenses: [
          { type: 'TRANSPORT', amount: 2000 },
          { type: 'ACCOMMODATION', amount: 2100 }, // 7 days * 300/night
          { type: 'ALLOWANCE', amount: 1400 }, // 7 days * 100 * 2 people
        ],
        config: {
          dailyAllowance: 100,
          accommodationLimit: 400, // 400 * 7 * 2 = 5600 limit
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(6900); // 2000 + 2100 + 2800 (allowance calculation)
    });

    test('should handle accommodation limit with multiple days and people', () => {
      const params: TravelExpenseCalculationParams = {
        days: 3,
        peopleCount: 2,
        expenses: [
          { type: 'ACCOMMODATION', amount: 3000 }, // 3000 exceeds 1200 limit (400 * 3 * 2)
        ],
        config: {
          dailyAllowance: 0,
          accommodationLimit: 400,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(3000);
      expect(result.items[0].description).toContain('超出限额: 600');
      expect(result.items[0].calculationDetails?.exceeded).toBe(600);
    });

    test('should handle zero days scenario', () => {
      const params: TravelExpenseCalculationParams = {
        days: 0,
        peopleCount: 5,
        expenses: [{ type: 'TRANSPORT', amount: 500 }],
        config: {
          dailyAllowance: 100,
          accommodationLimit: 200,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(500); // Only transport, no allowance
    });

    test('should handle zero people scenario', () => {
      const params: TravelExpenseCalculationParams = {
        days: 3,
        peopleCount: 0,
        expenses: [],
        config: {
          dailyAllowance: 100,
          accommodationLimit: 200,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(0); // Zero people means zero allowance
    });

    test('should handle null/undefined config gracefully', () => {
      const params: TravelExpenseCalculationParams = {
        days: 2,
        peopleCount: 1,
        expenses: [{ type: 'TRANSPORT', amount: 300 }],
        // config is undefined
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(300);
      expect(result.items[0].currency).toBe('CNY'); // Default currency
    });

    test('should handle empty description properly', () => {
      const params: TravelExpenseCalculationParams = {
        days: 1,
        peopleCount: 1,
        expenses: [
          { type: 'TRANSPORT', amount: 200, description: '' },
          { type: 'ACCOMMODATION', amount: 300 }, // No description
        ],
      };

      const result = calculator.calculate(params);
      expect(result.items[0].description).toBe('交通费');
      expect(result.items[1].description).toBe('住宿费');
    });

    test('should calculate allowance with different currencies', () => {
      const usdParams: TravelExpenseCalculationParams = {
        days: 2,
        peopleCount: 1,
        expenses: [],
        config: {
          dailyAllowance: 50,
          accommodationLimit: 200,
          currency: 'USD',
        },
      };

      const result = calculator.calculate(usdParams);
      expect(result.totalAmount).toBe(100); // 50 * 2 * 1
      expect(result.currency).toBe('USD');
    });

    test('should handle accommodation limit exactly at threshold', () => {
      const params: TravelExpenseCalculationParams = {
        days: 2,
        peopleCount: 2,
        expenses: [{ type: 'ACCOMMODATION', amount: 1600 }], // Exactly at limit: 400 * 2 * 2
        config: {
          dailyAllowance: 0,
          accommodationLimit: 400,
          currency: 'CNY',
        },
      };

      const result = calculator.calculate(params);
      expect(result.totalAmount).toBe(1600);
      expect(result.items[0].description).not.toContain('超出限额');
      expect(result.items[0].calculationDetails?.exceeded).toBeUndefined();
    });
  });
});
