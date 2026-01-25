import { prisma } from '@/lib/db/prisma';
import { FeeConfigManager } from '@/lib/calculation/fee-config-manager';
import { FeeConfigType } from '@prisma/client';
import { BillingMode } from '@/types/calculation';

// Mock dependencies
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
  let configManager: FeeConfigManager;

  beforeEach(() => {
    jest.clearAllMocks();
    configManager = new FeeConfigManager(prisma);
  });

  describe('FeeConfigManager', () => {
    describe('upsertConfig', () => {
      test('should create new config', async () => {
        const userId = 'user-123';
        const type = FeeConfigType.LAWYER_FEE;
        const name = 'Standard Rate';
        const data = {
          defaultMode: BillingMode.HOURLY,
          hourlyRate: 1500,
          contingencyRate: 0,
        };

        // Mock DB response
        const mockConfig = {
          id: 'config-1',
          userId,
          configType: type,
          name,
          rateData: data,
          isActive: true,
        };
        (prisma.feeRateConfig.upsert as jest.Mock).mockResolvedValue(
          mockConfig
        );

        const result = await configManager.upsertConfig(
          userId,
          type,
          name,
          data
        );
        expect(result).toEqual(mockConfig);
        expect(prisma.feeRateConfig.upsert).toHaveBeenCalled();
      });

      test('should handle default config update', async () => {
        const userId = 'user-123';
        const type = FeeConfigType.LAWYER_FEE;
        const name = 'Standard Rate';
        const data = {
          defaultMode: BillingMode.HOURLY,
          hourlyRate: 1500,
          contingencyRate: 0,
        };

        // Mock DB response
        const mockConfig = {
          id: 'config-1',
          userId,
          configType: type,
          name,
          rateData: data,
          isActive: true,
          isDefault: true,
        };
        (prisma.feeRateConfig.upsert as jest.Mock).mockResolvedValue(
          mockConfig
        );

        await configManager.upsertConfig(
          userId,
          type,
          name,
          data,
          undefined,
          true // Set as default
        );

        expect(prisma.feeRateConfig.updateMany).toHaveBeenCalledWith({
          where: {
            userId,
            configType: type,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      });
    });

    describe('getUserConfigs', () => {
      test('should return all active configs', async () => {
        const userId = 'user-123';
        const mockConfigs = [
          { id: '1', name: 'Config 1', isActive: true },
          { id: '2', name: 'Config 2', isActive: true },
        ];

        (prisma.feeRateConfig.findMany as jest.Mock).mockResolvedValue(
          mockConfigs
        );

        const results = await configManager.getUserConfigs(userId);
        expect(results).toHaveLength(2);
        expect(prisma.feeRateConfig.findMany).toHaveBeenCalledWith({
          where: {
            userId,
            isActive: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        });
      });
    });

    describe('deleteConfig', () => {
      test('should soft delete config', async () => {
        const userId = 'user-123';
        const configId = 'config-1';

        await configManager.deleteConfig(userId, configId);

        expect(prisma.feeRateConfig.update).toHaveBeenCalledWith({
          where: {
            id: configId,
            userId,
          },
          data: {
            isActive: false,
          },
        });
      });
    });
  });
});
