/**
 * 合同履约服务单元测试
 *
 * 测试合同关键节点的创建、更新、查询和自动提醒功能。
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
    warn: mockLoggerWarn,
  },
}));

// Mock Prisma - 使用 any 类型避免类型推断问题
const mockPrisma = {
  contractPerformance: {
    create: jest.fn() as any,
    update: jest.fn() as any,
    delete: jest.fn() as any,
    findUnique: jest.fn() as any,
    findFirst: jest.fn() as any,
    findMany: jest.fn() as any,
    count: jest.fn() as any,
  },
  reminderConfig: {
    create: jest.fn() as any,
    update: jest.fn() as any,
    delete: jest.fn() as any,
    findUnique: jest.fn() as any,
    findMany: jest.fn() as any,
  },
  contract: {
    findUnique: jest.fn() as any,
  },
  user: {
    findFirst: jest.fn() as any,
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// 现在导入服务
import {
  contractPerformanceService,
  reminderConfigService,
} from '@/lib/contract/contract-performance-service';

describe('ContractPerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPerformance', () => {
    it('应该成功创建合同履约节点', async () => {
      const mockPerformance = {
        id: 'perf-1',
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
        milestoneStatus: 'PENDING',
        description: '首付款节点',
        milestoneType: 'payment',
        actualDate: null,
        actualAmount: null,
        variance: null,
        varianceReason: null,
        isAnomalous: false,
        anomalyType: null,
        anomalyDescription: null,
        recommendedAction: null,
        reminderEnabled: true,
        reminderDays: [7, 3, 1],
        reminderSent: false,
        reminderCount: 0,
        lastReminderAt: null,
        responsibleParty: null,
        responsibleRole: null,
        caseId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
        },
      };

      (mockPrisma.contractPerformance.create as any).mockResolvedValue(
        mockPerformance
      );

      const input = {
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
        description: '首付款节点',
        milestoneType: 'payment' as const,
      };

      const result = await contractPerformanceService.createPerformance(input);

      expect(mockPrisma.contractPerformance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: input.contractId,
          milestone: input.milestone,
          milestoneDate: input.milestoneDate,
          description: input.description,
          milestoneType: input.milestoneType,
          milestoneStatus: 'PENDING',
          isAnomalous: false,
          reminderEnabled: true,
          reminderDays: [7, 3, 1],
          reminderSent: false,
          reminderCount: 0,
        }),
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
              lawyerName: true,
            },
          },
        },
      });

      expect(result.id).toBe('perf-1');
      expect(result.milestone).toBe('首付款');
      expect(result.milestoneStatus).toBe('PENDING');
    });

    it('应该使用默认提醒设置', async () => {
      const mockPerformance = {
        id: 'perf-1',
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
        milestoneStatus: 'PENDING',
        description: null,
        milestoneType: null,
        actualDate: null,
        actualAmount: null,
        variance: null,
        varianceReason: null,
        isAnomalous: false,
        anomalyType: null,
        anomalyDescription: null,
        recommendedAction: null,
        reminderEnabled: true,
        reminderDays: [7, 3, 1],
        reminderSent: false,
        reminderCount: 0,
        lastReminderAt: null,
        responsibleParty: null,
        responsibleRole: null,
        caseId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
        },
      };

      (mockPrisma.contractPerformance.create as any).mockResolvedValue(
        mockPerformance
      );

      const input = {
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
      };

      const result = await contractPerformanceService.createPerformance(input);

      expect(result.reminderEnabled).toBe(true);
      expect(result.reminderDays).toEqual([7, 3, 1]);
    });

    it('应该允许自定义提醒天数', async () => {
      const mockPerformance = {
        id: 'perf-1',
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
        milestoneStatus: 'PENDING',
        description: null,
        milestoneType: null,
        actualDate: null,
        actualAmount: null,
        variance: null,
        varianceReason: null,
        isAnomalous: false,
        anomalyType: null,
        anomalyDescription: null,
        recommendedAction: null,
        reminderEnabled: true,
        reminderDays: [14, 7, 3],
        reminderSent: false,
        reminderCount: 0,
        lastReminderAt: null,
        responsibleParty: null,
        responsibleRole: null,
        caseId: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
        },
      };

      (mockPrisma.contractPerformance.create as any).mockResolvedValue(
        mockPerformance
      );

      const input = {
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
        reminderDays: [14, 7, 3],
      };

      const result = await contractPerformanceService.createPerformance(input);

      expect(mockPrisma.contractPerformance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reminderDays: [14, 7, 3],
          }),
        })
      );

      expect(result.reminderDays).toEqual([14, 7, 3]);
    });
  });

  describe('updatePerformance', () => {
    it('应该成功更新合同履约节点', async () => {
      const mockExisting = {
        id: 'perf-1',
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-03-01'),
        milestoneStatus: 'PENDING',
      };

      const mockUpdated = {
        ...mockExisting,
        milestoneStatus: 'COMPLETED',
        actualDate: new Date('2026-03-01'),
      };

      (mockPrisma.contractPerformance.findFirst as any).mockResolvedValue(
        mockExisting
      );
      (mockPrisma.contractPerformance.update as any).mockResolvedValue({
        ...mockUpdated,
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
        },
      });

      const result = await contractPerformanceService.updatePerformance(
        'perf-1',
        'user-1',
        {
          milestoneStatus: 'COMPLETED' as any,
          actualDate: new Date('2026-03-01'),
        }
      );

      expect(mockPrisma.contractPerformance.update).toHaveBeenCalledWith({
        where: { id: 'perf-1' },
        data: expect.objectContaining({
          milestoneStatus: 'COMPLETED',
        }),
        include: {
          contract: {
            select: {
              id: true,
              contractNumber: true,
              clientName: true,
              lawyerName: true,
            },
          },
        },
      });

      expect(result.milestoneStatus).toBe('COMPLETED');
    });

    it('应该拒绝未授权用户更新', async () => {
      (mockPrisma.contractPerformance.findFirst as any).mockResolvedValue(null);

      await expect(
        contractPerformanceService.updatePerformance(
          'perf-1',
          'unauthorized-user',
          {
            milestoneStatus: 'COMPLETED' as any,
          }
        )
      ).rejects.toThrow('无权更新此履约节点');
    });
  });

  describe('queryPerformances', () => {
    it('应该返回分页的履约节点列表', async () => {
      const mockPerformances = [
        {
          id: 'perf-1',
          contractId: 'contract-1',
          milestone: '首付款',
          milestoneDate: new Date('2026-03-01'),
          milestoneStatus: 'PENDING',
        },
        {
          id: 'perf-2',
          contractId: 'contract-1',
          milestone: '中期交付',
          milestoneDate: new Date('2026-06-01'),
          milestoneStatus: 'PENDING',
        },
      ];

      (mockPrisma.contractPerformance.findMany as any).mockResolvedValue(
        mockPerformances
      );
      (mockPrisma.contractPerformance.count as any).mockResolvedValue(2);

      const result = await contractPerformanceService.queryPerformances({
        contractId: 'contract-1',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('应该支持按状态筛选', async () => {
      const mockPerformances = [
        {
          id: 'perf-1',
          contractId: 'contract-1',
          milestone: '首付款',
          milestoneDate: new Date('2026-03-01'),
          milestoneStatus: 'COMPLETED',
        },
      ];

      (mockPrisma.contractPerformance.findMany as any).mockResolvedValue(
        mockPerformances
      );
      (mockPrisma.contractPerformance.count as any).mockResolvedValue(1);

      await contractPerformanceService.queryPerformances({
        milestoneStatus: 'COMPLETED' as any,
      });

      expect(mockPrisma.contractPerformance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            milestoneStatus: 'COMPLETED',
          }),
        })
      );
    });

    it('应该支持按日期范围筛选', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');

      (mockPrisma.contractPerformance.findMany as any).mockResolvedValue([]);
      (mockPrisma.contractPerformance.count as any).mockResolvedValue(0);

      await contractPerformanceService.queryPerformances({
        startDate,
        endDate,
      });

      expect(mockPrisma.contractPerformance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            milestoneDate: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });
  });

  describe('getNodesForReminder', () => {
    it('应该返回待提醒的履约节点', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const mockPerformances = [
        {
          id: 'perf-1',
          contractId: 'contract-1',
          milestone: '首付款',
          milestoneDate: futureDate,
          milestoneStatus: 'PENDING',
          reminderEnabled: true,
          reminderSent: false,
          reminderDays: [7, 3, 1],
        },
      ];

      (mockPrisma.contractPerformance.findMany as any).mockResolvedValue(
        mockPerformances
      );

      const result = await contractPerformanceService.getNodesForReminder();

      expect(result).toHaveLength(1);
      expect(result[0].reminderSent).toBe(false);
    });
  });

  describe('markReminderSent', () => {
    it('应该标记提醒已发送并更新计数', async () => {
      const mockUpdated = {
        id: 'perf-1',
        reminderSent: true,
        reminderCount: 1,
      };

      (mockPrisma.contractPerformance.update as any).mockResolvedValue(
        mockUpdated
      );

      await contractPerformanceService.markReminderSent('perf-1');

      expect(mockPrisma.contractPerformance.update).toHaveBeenCalledWith({
        where: { id: 'perf-1' },
        data: {
          reminderSent: true,
          reminderCount: { increment: 1 },
          lastReminderAt: expect.any(Date),
        },
      });
    });
  });
});

describe('ReminderConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createConfig', () => {
    it('应该成功创建提醒配置', async () => {
      const mockConfig = {
        id: 'config-1',
        enterpriseId: 'enterprise-1',
        userId: null,
        reminderType: 'CONTRACT_MILESTONE',
        enabled: true,
        channels: ['IN_APP', 'EMAIL'],
        advanceDays: [7, 3, 1],
        timeOfDay: '09:00',
        isRecurring: false,
        recurringPattern: null,
        isActive: true,
        totalRemindersSent: 0,
        lastSentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.reminderConfig.create as any).mockResolvedValue(mockConfig);

      const input = {
        enterpriseId: 'enterprise-1',
        reminderType: 'CONTRACT_MILESTONE',
        channels: ['IN_APP', 'EMAIL'],
        advanceDays: [7, 3, 1],
        timeOfDay: '09:00',
      };

      const result = await reminderConfigService.createConfig(input);

      expect(result.id).toBe('config-1');
      expect(result.reminderType).toBe('CONTRACT_MILESTONE');
      expect(result.channels).toEqual(['IN_APP', 'EMAIL']);
    });
  });

  describe('updateConfig', () => {
    it('应该成功更新提醒配置', async () => {
      const mockConfig = {
        id: 'config-1',
        enterpriseId: 'enterprise-1',
        userId: null,
        reminderType: 'CONTRACT_MILESTONE',
        enabled: false,
        channels: ['IN_APP'],
        advanceDays: [14, 7],
        timeOfDay: '09:00',
        isRecurring: false,
        recurringPattern: null,
        isActive: true,
        totalRemindersSent: 0,
        lastSentAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.reminderConfig.update as any).mockResolvedValue(mockConfig);

      const result = await reminderConfigService.updateConfig('config-1', {
        enabled: false,
        advanceDays: [14, 7],
      });

      expect(result.enabled).toBe(false);
      expect(result.advanceDays).toEqual([14, 7]);
    });
  });

  describe('getConfigsByEntity', () => {
    it('应该返回企业的提醒配置列表', async () => {
      const mockConfigs = [
        {
          id: 'config-1',
          reminderType: 'CONTRACT_MILESTONE',
        },
        {
          id: 'config-2',
          reminderType: 'PAYMENT_DUE',
        },
      ];

      (mockPrisma.reminderConfig.findMany as any).mockResolvedValue(
        mockConfigs
      );

      const result =
        await reminderConfigService.getConfigsByEntity('enterprise-1');

      expect(result).toHaveLength(2);
      expect(mockPrisma.reminderConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            enterpriseId: 'enterprise-1',
          }),
        })
      );
    });
  });

  describe('deleteConfig', () => {
    it('应该成功删除提醒配置', async () => {
      (mockPrisma.reminderConfig.delete as any).mockResolvedValue({});

      await reminderConfigService.deleteConfig('config-1');

      expect(mockPrisma.reminderConfig.delete).toHaveBeenCalledWith({
        where: { id: 'config-1' },
      });
    });
  });
});
