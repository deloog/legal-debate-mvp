import { prisma } from '@/lib/db/prisma';
import { FeeCalculationService } from '@/lib/calculation/fee-calculation-service';
import {
  FeeType,
  LawyerFeeConfig,
  TravelExpenseConfig,
} from '@/types/calculation';

// Mock dependencies
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    feeRateConfig: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Fee Calculation API', () => {
  let calculationService: FeeCalculationService;

  beforeEach(() => {
    jest.clearAllMocks();
    calculationService = new FeeCalculationService(prisma);
  });

  // Since we can't easily test Next.js API routes directly in this environment without setting up
  // a complex test environment, we will test the service logic which is the core of the API.
  // The API route itself is mostly a wrapper around the service.

  describe('FeeCalculationService', () => {
    describe('calculateLawyerFee', () => {
      test('should calculate lawyer fee with provided config', async () => {
        const params = {
          hours: 10,
          config: {
            mode: 'HOURLY',
            hourlyRate: 1000,
            currency: 'CNY',
          } as LawyerFeeConfig,
        };

        const result = await calculationService.calculateLawyerFee(
          null,
          params
        );
        expect(result.totalAmount).toBe(10000);
        expect(result.items[0].type).toBe(FeeType.LAWYER_FEE);
      });

      test('should use default config from DB if config not provided', async () => {
        const userId = 'user-123';
        const params = { hours: 10 };

        // Mock DB response
        (prisma.feeRateConfig.findFirst as jest.Mock).mockResolvedValue({
          rateData: {
            defaultMode: 'HOURLY',
            hourlyRate: 2000,
            contingencyRate: 0,
          },
        });

        const result = await calculationService.calculateLawyerFee(
          userId,
          params
        );
        expect(result.totalAmount).toBe(20000);
        expect(prisma.feeRateConfig.findFirst).toHaveBeenCalledWith({
          where: {
            userId,
            configType: 'LAWYER_FEE',
            isDefault: true,
            isActive: true,
          },
        });
      });

      test('should throw error if no config available', async () => {
        const userId = 'user-123';
        const params = { hours: 10 };

        // Mock DB response as null
        (prisma.feeRateConfig.findFirst as jest.Mock).mockResolvedValue(null);

        await expect(
          calculationService.calculateLawyerFee(userId, params)
        ).rejects.toThrow('Missing lawyer fee configuration');
      });
    });

    describe('calculateLitigationFee', () => {
      test('should calculate litigation fee', async () => {
        const params = {
          caseType: 'PROPERTY' as any,
          amount: 50000,
        };

        const result = await calculationService.calculateLitigationFee(
          null,
          params
        );
        expect(result.totalAmount).toBeGreaterThan(0);
        expect(result.items[0].type).toBe(FeeType.LITIGATION_FEE);
      });
    });

    describe('calculateTravelExpense', () => {
      test('should calculate travel expense', async () => {
        const params = {
          days: 5,
          peopleCount: 2,
          expenses: [],
          config: {
            dailyAllowance: 200,
            accommodationLimit: 1000,
            currency: 'CNY',
          } as TravelExpenseConfig,
        };

        const result = await calculationService.calculateTravelExpense(
          null,
          params
        );
        expect(result.totalAmount).toBe(2000); // 200 * 5 * 2
        expect(result.items[0].type).toBe(FeeType.TRAVEL_EXPENSE);
      });
    });

    describe('calculateTotalFee', () => {
      test('should sum up multiple fee types', async () => {
        const params = {
          lawyer: {
            hours: 10,
            config: {
              mode: 'HOURLY',
              hourlyRate: 1000,
              currency: 'CNY',
            } as LawyerFeeConfig,
          },
          travel: {
            days: 5,
            peopleCount: 2,
            expenses: [],
            config: {
              dailyAllowance: 100,
              accommodationLimit: 500,
              currency: 'CNY',
            } as TravelExpenseConfig,
          },
        };

        const result = await calculationService.calculateTotalFee(null, params);
        expect(result.totalAmount).toBe(11000); // 10000 + 1000
        expect(result.items).toHaveLength(2);
      });
    });
  });
});
