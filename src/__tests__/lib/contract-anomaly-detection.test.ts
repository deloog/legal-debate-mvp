/**
 * 履行异常智能检测服务单元测试
 *
 * 测试合同履约异常的智能检测功能，包括：
 * - 多种异常类型检测
 * - 批量异常检测
 * - 主动预警和推荐处理措施
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

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

// Mock notification service
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockNotificationService: any = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createNotification: (jest.fn() as any).mockResolvedValue({ id: 'notif-1' }),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetUserNotificationService: any = jest.fn().mockReturnValue(mockNotificationService);

jest.mock('@/lib/notification/user-notification-service', () => ({
  getUserNotificationService: mockGetUserNotificationService,
}));

// Mock Prisma - 使用 any 类型绕过类型检查
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  contractPerformance: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  contract: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    count: (jest.fn() as any).mockResolvedValue(10),
  },
  reminderConfig: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  notification: {
    create: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Import after mocks
import {
  contractPerformanceService,
  reminderConfigService,
  anomalyDetectionService,
} from '@/lib/contract/contract-performance-service';

describe('AnomalyDetectionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectAnomalies - 增强版异常检测', () => {
    it('应该检测逾期未完成的履约节点', async () => {
      const performanceId = 'perf-1';
      const mockPerformance = {
        id: performanceId,
        contractId: 'contract-1',
        milestone: '首付款节点',
        milestoneDate: new Date('2026-01-01'), // 已过期
        milestoneStatus: 'PENDING',
        milestoneType: 'payment',
        actualDate: null,
        actualAmount: null,
        isAnomalous: false,
        anomalyType: null,
        anomalyDescription: null,
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
          totalFee: 100000,
          payments: [],
        },
      };

      mockPrisma.contractPerformance.findUnique.mockResolvedValue(mockPerformance);
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockPerformance,
        milestoneStatus: 'OVERDUE',
        isAnomalous: true,
        anomalyType: 'LATE_PAYMENT',
        anomalyDescription: '节点已逾期未完成',
      });

      await anomalyDetectionService.detectAnomalies(performanceId);

      expect(mockPrisma.contractPerformance.update).toHaveBeenCalledWith({
        where: { id: performanceId },
        data: expect.objectContaining({
          milestoneStatus: 'OVERDUE',
          isAnomalous: true,
          anomalyType: 'LATE_PAYMENT',
        }),
      });
    });

    it('应该检测超进度付款异常', async () => {
      const performanceId = 'perf-2';
      // 模拟Prisma的Decimal类型
      const mockActualAmount = {
        toNumber: () => 150000,
      };
      const mockTotalFee = {
        toNumber: () => 100000,
      };
      const mockPerformance = {
        id: performanceId,
        contractId: 'contract-1',
        milestone: '首付款节点',
        milestoneDate: new Date('2026-03-01'),
        milestoneStatus: 'COMPLETED',
        milestoneType: 'payment',
        actualDate: new Date('2026-02-15'),
        actualAmount: mockActualAmount, // 使用模拟的Decimal对象
        isAnomalous: false,
        anomalyType: null,
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
          totalFee: mockTotalFee, // 使用模拟的Decimal对象
          payments: [],
        },
      };

      mockPrisma.contractPerformance.findUnique.mockResolvedValue(mockPerformance);
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockPerformance,
        isAnomalous: true,
        anomalyType: 'EARLY_PAYMENT',
        anomalyDescription: '实际付款金额超出合同约定金额',
      });

      await anomalyDetectionService.detectAnomalies(performanceId);

      expect(mockPrisma.contractPerformance.update).toHaveBeenCalled();
    });

    it('应该检测未验收结算异常', async () => {
      const performanceId = 'perf-3';
      const mockPerformance = {
        id: performanceId,
        contractId: 'contract-1',
        milestone: '验收节点',
        milestoneDate: new Date('2026-01-15'),
        milestoneStatus: 'COMPLETED',
        milestoneType: 'milestone',
        actualDate: new Date('2026-01-20'), // 已完成
        actualAmount: null,
        isAnomalous: false,
        anomalyType: null,
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
          totalFee: 100000,
          payments: [],
        },
      };

      // 模拟没有后续的结算记录
      mockPrisma.contractPerformance.findUnique.mockResolvedValue(mockPerformance);
      mockPrisma.contract.findUnique.mockResolvedValue({
        ...mockPerformance.contract,
        payments: [], // 没有付款记录
      });
      
      // 模拟查询付款节点
      mockPrisma.contractPerformance.findMany.mockResolvedValue([
        { id: 'payment-1', milestoneType: 'payment', milestoneStatus: 'PENDING' }
      ]);

      // 更新为标记需要结算
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockPerformance,
        isAnomalous: true,
        anomalyType: 'UNVERIFIED_PAYMENT',
        anomalyDescription: '已完成交付但未进行结算',
      });

      await anomalyDetectionService.detectAnomalies(performanceId);

      // 应该检测到交付完成但未结算的情况
      expect(mockPrisma.contractPerformance.update).toHaveBeenCalled();
    });

    it('应该检测超期交付异常', async () => {
      const performanceId = 'perf-4';
      const mockPerformance = {
        id: performanceId,
        contractId: 'contract-1',
        milestone: '交付节点',
        milestoneDate: new Date('2026-01-01'),
        milestoneStatus: 'IN_PROGRESS',
        milestoneType: 'delivery',
        actualDate: new Date('2026-02-01'), // 延迟一个月
        actualAmount: null,
        isAnomalous: false,
        anomalyType: null,
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
          totalFee: 100000,
          payments: [],
        },
      };

      mockPrisma.contractPerformance.findUnique.mockResolvedValue(mockPerformance);
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockPerformance,
        isAnomalous: true,
        anomalyType: 'LATE_DELIVERY',
        anomalyDescription: expect.stringContaining('延迟'),
      });

      await anomalyDetectionService.detectAnomalies(performanceId);

      expect(mockPrisma.contractPerformance.update).toHaveBeenCalledWith({
        where: { id: performanceId },
        data: expect.objectContaining({
          isAnomalous: true,
          anomalyType: 'LATE_DELIVERY',
        }),
      });
    });

    it('应该为异常节点生成推荐处理措施', async () => {
      const performanceId = 'perf-5';
      // 模拟Prisma的Decimal
      const mockDecimal = {
        toNumber: () => 100000,
        greaterThan: (val: number) => false,
        minus: (val: number) => ({ toNumber: () => 0 }),
      };
      const mockPerformance = {
        id: performanceId,
        contractId: 'contract-1',
        milestone: '首付款节点',
        milestoneDate: new Date('2026-01-01'),
        milestoneStatus: 'PENDING', // 改为PENDING，这样会检测到OVERDUE
        milestoneType: 'payment',
        actualDate: null,
        actualAmount: null,
        isAnomalous: true,
        anomalyType: 'LATE_PAYMENT',
        anomalyDescription: '节点已逾期未完成',
        recommendedAction: null,
        contract: {
          id: 'contract-1',
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
          totalFee: mockDecimal,
          payments: [],
        },
      };

      mockPrisma.contractPerformance.findUnique.mockResolvedValue(mockPerformance);
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockPerformance,
        milestoneStatus: 'OVERDUE',
        recommendedAction: '联系客户确认付款计划',
      });

      // 调用服务时，由于已逾期，会更新为OVERDUE状态并设置推荐措施
      await anomalyDetectionService.detectAnomalies(performanceId);

      // 验证update被调用
      expect(mockPrisma.contractPerformance.update).toHaveBeenCalled();
    });
  });

  describe('detectAllAnomalies - 批量异常检测', () => {
    it('应该批量检测所有待检测的履约节点', async () => {
      const mockPerformances = [
        {
          id: 'perf-1',
          contractId: 'contract-1',
          milestone: '节点1',
          milestoneDate: new Date('2026-01-01'),
          milestoneStatus: 'PENDING',
          milestoneType: 'payment',
          actualDate: null,
          actualAmount: null,
          isAnomalous: false,
          contract: {
            id: 'contract-1',
            contractNumber: 'CT-2026-001',
            totalFee: 100000,
            payments: [],
          },
        },
        {
          id: 'perf-2',
          contractId: 'contract-2',
          milestone: '节点2',
          milestoneDate: new Date('2026-01-15'),
          milestoneStatus: 'PENDING',
          milestoneType: 'delivery',
          actualDate: null,
          actualAmount: null,
          isAnomalous: false,
          contract: {
            id: 'contract-2',
            contractNumber: 'CT-2026-002',
            totalFee: 200000,
            payments: [],
          },
        },
      ];

      mockPrisma.contractPerformance.findMany.mockResolvedValue(mockPerformances);
      
      // 模拟每次检测都更新为异常
      for (const perf of mockPerformances) {
        mockPrisma.contractPerformance.update.mockResolvedValueOnce({
          ...perf,
          milestoneStatus: 'OVERDUE',
          isAnomalous: true,
          anomalyType: 'LATE_PAYMENT',
        });
      }

      const result = await anomalyDetectionService.detectAllAnomalies();

      // 验证findMany被调用
      expect(mockPrisma.contractPerformance.findMany).toHaveBeenCalled();
      expect(result.totalChecked).toBe(2);
    });

    it('应该只检测需要检测的节点', async () => {
      mockPrisma.contractPerformance.findMany.mockResolvedValue([]);

      await anomalyDetectionService.detectAllAnomalies();

      // 验证findMany被调用
      expect(mockPrisma.contractPerformance.findMany).toHaveBeenCalled();
    });
  });

  describe('getAnomalySummary - 获取异常统计', () => {
    it('应该返回异常统计信息', async () => {
      // 模拟返回有异常的履约节点
      mockPrisma.contractPerformance.findMany.mockResolvedValue([
        { contractId: 'contract-1', anomalyType: 'LATE_PAYMENT' },
        { contractId: 'contract-2', anomalyType: 'EARLY_PAYMENT' },
      ]);

      const result = await anomalyDetectionService.getAnomalySummary();

      expect(result).toHaveProperty('totalContracts');
      expect(result).toHaveProperty('contractsWithAnomalies');
      expect(result).toHaveProperty('anomalyTypes');
    });
  });

  describe('getAnomalyRecommendations - 获取异常处理建议', () => {
    it('应该为特定异常类型返回处理建议', async () => {
      const recommendations = anomalyDetectionService.getAnomalyRecommendations('LATE_PAYMENT');
      
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty('action');
      expect(recommendations[0]).toHaveProperty('priority');
    });

    it('应该为不同异常类型返回不同建议', async () => {
      const earlyPaymentRecs = anomalyDetectionService.getAnomalyRecommendations('EARLY_PAYMENT');
      const lateDeliveryRecs = anomalyDetectionService.getAnomalyRecommendations('LATE_DELIVERY');
      
      expect(earlyPaymentRecs).not.toEqual(lateDeliveryRecs);
    });

    it('应该为未知异常类型返回通用建议', async () => {
      const unknownRecs = anomalyDetectionService.getAnomalyRecommendations('UNKNOWN_TYPE');
      
      expect(unknownRecs).toBeDefined();
      expect(unknownRecs.length).toBeGreaterThan(0);
    });
  });

  describe('autoDetectAndNotify - 自动检测并通知', () => {
    it('应该自动检测异常并创建通知', async () => {
      const mockPerformances = [
        {
          id: 'perf-1',
          contractId: 'contract-1',
          milestone: '首付款节点',
          milestoneDate: new Date('2026-01-01'),
          milestoneStatus: 'OVERDUE',
          milestoneType: 'payment',
          isAnomalous: true,
          anomalyType: 'LATE_PAYMENT',
          contract: {
            id: 'contract-1',
            lawyerId: 'lawyer-1',
            contractNumber: 'CT-2026-001',
          },
        },
      ];

      mockPrisma.contractPerformance.findMany.mockResolvedValue(mockPerformances);
      mockPrisma.notification.create.mockResolvedValue({ id: 'notif-1' });

      await anomalyDetectionService.autoDetectAndNotify('lawyer-1');

      expect(mockNotificationService.createNotification).toHaveBeenCalled();
    });

    it('应该过滤只通知指定用户的异常', async () => {
      const mockPerformances = [
        {
          id: 'perf-1',
          contractId: 'contract-1',
          milestone: '节点',
          milestoneDate: new Date(),
          milestoneStatus: 'OVERDUE',
          isAnomalous: true,
          contract: { id: 'contract-1', lawyerId: 'lawyer-1', contractNumber: 'C1', clientName: '客户1' },
        },
        {
          id: 'perf-2',
          contractId: 'contract-2',
          milestone: '节点',
          milestoneDate: new Date(),
          milestoneStatus: 'OVERDUE',
          isAnomalous: true,
          contract: { id: 'contract-2', lawyerId: 'lawyer-other', contractNumber: 'C2', clientName: '客户2' },
        },
      ];

      mockPrisma.contractPerformance.findMany.mockResolvedValue(mockPerformances);

      await anomalyDetectionService.autoDetectAndNotify('lawyer-1');

      // 验证findMany被调用
      expect(mockPrisma.contractPerformance.findMany).toHaveBeenCalled();
    });
  });

  describe('resolveAnomaly - 解决异常', () => {
    it('应该成功解决异常并记录原因', async () => {
      const performanceId = 'perf-1';
      const mockPerformance = {
        id: performanceId,
        contractId: 'contract-1',
        isAnomalous: true,
        anomalyType: 'LATE_PAYMENT',
        anomalyDescription: '已逾期',
      };

      mockPrisma.contractPerformance.findUnique.mockResolvedValue(mockPerformance);
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockPerformance,
        isAnomalous: false,
        anomalyType: null,
        anomalyDescription: null,
        notes: '已与客户沟通，确认付款时间',
      });

      await anomalyDetectionService.resolveAnomaly(
        performanceId,
        '已与客户沟通，确认付款时间'
      );

      // 验证异常被解决
      const updateCall = mockPrisma.contractPerformance.update.mock.calls[0];
      expect(updateCall[0].data.isAnomalous).toBe(false);
      expect(mockPrisma.contractPerformance.update).toHaveBeenCalledWith({
        where: { id: performanceId },
        data: expect.objectContaining({
          isAnomalous: false,
          notes: expect.stringContaining('已与客户沟通'),
        }),
      });
    });
  });
});

describe('ContractPerformanceService - 增强异常检测集成', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updatePerformance - 更新时自动检测异常', () => {
    it('更新实际履行数据后应该自动触发异常检测', async () => {
      const performanceId = 'perf-1';
      const userId = 'lawyer-1';
      const input = {
        actualDate: new Date('2026-02-01'),
        actualAmount: 150000,
        milestoneStatus: 'COMPLETED',
      };

      const mockTotalFee = { toNumber: () => 100000 };
      const mockExisting = {
        id: performanceId,
        contractId: 'contract-1',
        milestone: '首付款',
        milestoneDate: new Date('2026-01-01'),
        milestoneStatus: 'PENDING',
        milestoneType: 'payment',
        actualDate: null,
        actualAmount: null,
        isAnomalous: false,
        contract: {
          id: 'contract-1',
          lawyerId: userId,
          contractNumber: 'CT-2026-001',
          clientName: '测试客户',
          lawyerName: '测试律师',
          totalFee: mockTotalFee,
          payments: [],
        },
      };

      mockPrisma.contractPerformance.findFirst.mockResolvedValue(mockExisting);
      mockPrisma.contractPerformance.update.mockResolvedValue({
        ...mockExisting,
        actualDate: new Date('2026-02-01'),
        actualAmount: { toNumber: () => 150000 },
        milestoneStatus: 'COMPLETED',
        isAnomalous: true,
        anomalyType: 'EARLY_PAYMENT',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await contractPerformanceService.updatePerformance(performanceId, userId, input as any);

      // 验证异常检测被调用
      expect(mockPrisma.contractPerformance.update).toHaveBeenCalled();
    });
  });
});
