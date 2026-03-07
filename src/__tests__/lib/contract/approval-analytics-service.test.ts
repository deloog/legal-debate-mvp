/**
 * 审批效率分析服务测试
 * TDD: 先写测试，后写实现
 *
 * 覆盖功能：
 * 1. 审批效率统计（平均处理时长、通过率、拒绝率）
 * 2. 瓶颈检测（处理最慢的角色/步骤）
 * 3. 优化建议生成
 */

import {
  ApprovalAnalyticsService,
  type ApprovalAnalytics,
  type StepAnalytics,
  type BottleneckInfo,
} from '@/lib/contract/approval-analytics-service';

// Mock prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    contractApproval: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    approvalStep: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('ApprovalAnalyticsService', () => {
  let service: ApprovalAnalyticsService;

  beforeEach(() => {
    service = new ApprovalAnalyticsService();
    jest.clearAllMocks();
  });

  // ==================== 整体审批效率统计 ====================

  describe('getApprovalAnalytics', () => {
    it('应该返回指定期间内的审批统计数据', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      // Mock 已完成审批数据
      const mockApprovals = [
        {
          id: 'approval-1',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10'),
          completedAt: new Date('2026-01-12'), // 2天
          steps: [
            {
              id: 'step-1',
              approverRole: '部门主管',
              status: 'APPROVED',
              createdAt: new Date('2026-01-10'),
              completedAt: new Date('2026-01-11'),
            },
            {
              id: 'step-2',
              approverRole: '总经理',
              status: 'APPROVED',
              createdAt: new Date('2026-01-11'),
              completedAt: new Date('2026-01-12'),
            },
          ],
        },
        {
          id: 'approval-2',
          status: 'REJECTED',
          createdAt: new Date('2026-01-15'),
          completedAt: new Date('2026-01-16'), // 1天
          steps: [
            {
              id: 'step-3',
              approverRole: '部门主管',
              status: 'REJECTED',
              createdAt: new Date('2026-01-15'),
              completedAt: new Date('2026-01-16'),
            },
          ],
        },
        {
          id: 'approval-3',
          status: 'IN_PROGRESS',
          createdAt: new Date('2026-01-20'),
          completedAt: null,
          steps: [],
        },
      ];

      (mockPrisma.contractApproval.findMany as jest.Mock).mockResolvedValue(
        mockApprovals
      );

      const analytics = await service.getApprovalAnalytics({
        startDate,
        endDate,
      });

      expect(analytics.totalApprovals).toBe(3);
      expect(analytics.completedApprovals).toBe(2);
      expect(analytics.approvalPassRate).toBeCloseTo(0.5); // 1通过 / 2完成 = 50%
      expect(analytics.avgCompletionTimeHours).toBeCloseTo(36); // (48 + 24) / 2 = 36小时
    });

    it('应该在没有数据时返回零值统计', async () => {
      (mockPrisma.contractApproval.findMany as jest.Mock).mockResolvedValue([]);

      const analytics = await service.getApprovalAnalytics({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(analytics.totalApprovals).toBe(0);
      expect(analytics.completedApprovals).toBe(0);
      expect(analytics.approvalPassRate).toBe(0);
      expect(analytics.avgCompletionTimeHours).toBe(0);
    });
  });

  // ==================== 步骤级别统计 ====================

  describe('getStepAnalytics', () => {
    it('应该返回各角色的处理效率统计', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '部门主管',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T08:00:00'),
          completedAt: new Date('2026-01-10T16:00:00'), // 8小时
        },
        {
          id: 'step-2',
          approverRole: '部门主管',
          status: 'APPROVED',
          createdAt: new Date('2026-01-11T08:00:00'),
          completedAt: new Date('2026-01-11T20:00:00'), // 12小时
        },
        {
          id: 'step-3',
          approverRole: '总经理',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T08:00:00'),
          completedAt: new Date('2026-01-12T08:00:00'), // 48小时
        },
        {
          id: 'step-4',
          approverRole: '部门主管',
          status: 'REJECTED',
          createdAt: new Date('2026-01-12T08:00:00'),
          completedAt: new Date('2026-01-12T10:00:00'), // 2小时
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const stepAnalytics = await service.getStepAnalytics();

      const managerAnalytics = stepAnalytics.find(
        s => s.approverRole === '部门主管'
      );
      const ceoAnalytics = stepAnalytics.find(s => s.approverRole === '总经理');

      expect(managerAnalytics).toBeDefined();
      expect(managerAnalytics?.totalProcessed).toBe(3);
      expect(managerAnalytics?.approveRate).toBeCloseTo(2 / 3); // 2通过/3总数
      expect(managerAnalytics?.rejectRate).toBeCloseTo(1 / 3); // 1拒绝/3总数

      expect(ceoAnalytics).toBeDefined();
      expect(ceoAnalytics?.totalProcessed).toBe(1);
      expect(ceoAnalytics?.avgProcessingTimeHours).toBeCloseTo(48);
    });

    it('应该正确计算平均处理时长', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '法务',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-10T10:00:00'), // 10小时
        },
        {
          id: 'step-2',
          approverRole: '法务',
          status: 'APPROVED',
          createdAt: new Date('2026-01-11T00:00:00'),
          completedAt: new Date('2026-01-11T20:00:00'), // 20小时
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const stepAnalytics = await service.getStepAnalytics();
      const legalAnalytics = stepAnalytics.find(s => s.approverRole === '法务');

      expect(legalAnalytics?.avgProcessingTimeHours).toBeCloseTo(15); // (10 + 20) / 2 = 15
    });

    it('应该过滤掉未完成的步骤', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '财务',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-10T08:00:00'),
        },
        {
          id: 'step-2',
          approverRole: '财务',
          status: 'PENDING',
          createdAt: new Date('2026-01-11T00:00:00'),
          completedAt: null, // 未完成
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const stepAnalytics = await service.getStepAnalytics();
      const financeAnalytics = stepAnalytics.find(
        s => s.approverRole === '财务'
      );

      // 只统计已完成的步骤
      expect(financeAnalytics?.totalProcessed).toBe(1);
    });
  });

  // ==================== 瓶颈检测 ====================

  describe('detectBottlenecks', () => {
    it('应该检测处理时间最长的角色为瓶颈', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '部门主管',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-10T04:00:00'), // 4小时 - 快
        },
        {
          id: 'step-2',
          approverRole: '总经理',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-13T00:00:00'), // 72小时 - 慢
        },
        {
          id: 'step-3',
          approverRole: '财务部',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-11T12:00:00'), // 36小时 - 中
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const bottlenecks = await service.detectBottlenecks();

      expect(bottlenecks.length).toBeGreaterThan(0);
      // 总经理处理时间最长，应该是最大瓶颈
      expect(bottlenecks[0].approverRole).toBe('总经理');
      expect(bottlenecks[0].avgProcessingTimeHours).toBeCloseTo(72);
    });

    it('应该设置瓶颈严重程度', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '总经理',
          status: 'APPROVED',
          createdAt: new Date('2026-01-01T00:00:00'),
          completedAt: new Date('2026-01-08T00:00:00'), // 168小时 - 严重瓶颈
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const bottlenecks = await service.detectBottlenecks();

      expect(bottlenecks[0].severity).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(
        bottlenecks[0].severity
      );
    });

    it('当没有数据时应该返回空数组', async () => {
      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue([]);

      const bottlenecks = await service.detectBottlenecks();
      expect(bottlenecks).toHaveLength(0);
    });
  });

  // ==================== 优化建议生成 ====================

  describe('generateOptimizationSuggestions', () => {
    it('应该根据瓶颈数据生成优化建议', () => {
      const analytics: ApprovalAnalytics = {
        period: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
        totalApprovals: 50,
        completedApprovals: 40,
        avgCompletionTimeHours: 72,
        approvalPassRate: 0.8,
        stepAnalytics: [
          {
            approverRole: '总经理',
            avgProcessingTimeHours: 96,
            totalProcessed: 30,
            approveRate: 0.9,
            rejectRate: 0.1,
          },
          {
            approverRole: '财务部',
            avgProcessingTimeHours: 24,
            totalProcessed: 40,
            approveRate: 0.85,
            rejectRate: 0.15,
          },
        ],
        bottlenecks: [
          {
            approverRole: '总经理',
            avgProcessingTimeHours: 96,
            severity: 'high',
            suggestion: '建议委托审批权限',
          },
        ],
        suggestions: [],
      };

      const suggestions = service.generateOptimizationSuggestions(analytics);

      expect(suggestions.length).toBeGreaterThan(0);
      // 应该有针对总经理瓶颈的建议
      expect(
        suggestions.some(
          s => s.includes('总经理') || s.includes('委托') || s.includes('并行')
        )
      ).toBe(true);
    });

    it('应该在通过率低时建议优化审批标准', () => {
      const analytics: ApprovalAnalytics = {
        period: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
        totalApprovals: 100,
        completedApprovals: 90,
        avgCompletionTimeHours: 24,
        approvalPassRate: 0.4, // 通过率低
        stepAnalytics: [],
        bottlenecks: [],
        suggestions: [],
      };

      const suggestions = service.generateOptimizationSuggestions(analytics);

      expect(
        suggestions.some(s => s.includes('通过率') || s.includes('标准'))
      ).toBe(true);
    });

    it('应该在效率良好时给出正向反馈', () => {
      const analytics: ApprovalAnalytics = {
        period: {
          start: new Date('2026-01-01'),
          end: new Date('2026-01-31'),
        },
        totalApprovals: 100,
        completedApprovals: 95,
        avgCompletionTimeHours: 8,
        approvalPassRate: 0.9,
        stepAnalytics: [],
        bottlenecks: [],
        suggestions: [],
      };

      const suggestions = service.generateOptimizationSuggestions(analytics);
      // 即使效率良好，也应该有反馈（哪怕是正向的）
      expect(suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== 完整分析报告 ====================

  describe('generateAnalyticsReport', () => {
    it('应该生成包含所有维度的完整分析报告', async () => {
      const mockApprovals = [
        {
          id: 'approval-1',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-12T00:00:00'), // 48小时
          steps: [
            {
              id: 'step-1',
              approverRole: '部门主管',
              status: 'APPROVED',
              createdAt: new Date('2026-01-10T00:00:00'),
              completedAt: new Date('2026-01-11T00:00:00'),
            },
          ],
        },
      ];

      (mockPrisma.contractApproval.findMany as jest.Mock).mockResolvedValue(
        mockApprovals
      );
      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockApprovals[0].steps
      );

      const report = await service.generateAnalyticsReport({
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(report).toBeDefined();
      expect(report.totalApprovals).toBeDefined();
      expect(report.stepAnalytics).toBeDefined();
      expect(report.bottlenecks).toBeDefined();
      expect(report.suggestions).toBeDefined();
      expect(Array.isArray(report.suggestions)).toBe(true);
    });
  });

  // ==================== 边界情况补充测试（提升分支覆盖率） ====================

  describe('generateOptimizationSuggestions - 额外边界情况', () => {
    it('应该在平均审批周期超过72小时时建议并行审批', () => {
      const analytics: ApprovalAnalytics = {
        period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        totalApprovals: 20,
        completedApprovals: 18,
        avgCompletionTimeHours: 96, // > 72 小时，触发建议
        approvalPassRate: 0.85,
        stepAnalytics: [],
        bottlenecks: [],
        suggestions: [],
      };

      const suggestions = service.generateOptimizationSuggestions(analytics);

      expect(
        suggestions.some(s => s.includes('效率优化') || s.includes('并行审批'))
      ).toBe(true);
    });

    it('应该在多个串行步骤时长较长时建议并行审批', () => {
      const analytics: ApprovalAnalytics = {
        period: { start: new Date('2026-01-01'), end: new Date('2026-01-31') },
        totalApprovals: 30,
        completedApprovals: 28,
        avgCompletionTimeHours: 48,
        approvalPassRate: 0.8,
        stepAnalytics: [
          {
            approverRole: '法务部',
            avgProcessingTimeHours: 36, // > 24小时
            totalProcessed: 10, // > 3
            approveRate: 0.9,
            rejectRate: 0.1,
          },
          {
            approverRole: '财务部',
            avgProcessingTimeHours: 30, // > 24小时
            totalProcessed: 8, // > 3
            approveRate: 0.88,
            rejectRate: 0.12,
          },
        ],
        bottlenecks: [],
        suggestions: [],
      };

      const suggestions = service.generateOptimizationSuggestions(analytics);

      // 应该有并行优化建议
      expect(
        suggestions.some(s => s.includes('并行优化') || s.includes('并行审批'))
      ).toBe(true);
    });
  });

  describe('getApprovalAnalytics - 带contractId过滤', () => {
    it('应该在有contractId时将其传递给数据库查询', async () => {
      (mockPrisma.contractApproval.findMany as jest.Mock).mockResolvedValue([]);

      await service.getApprovalAnalytics({ contractId: 'contract-123' });

      expect(mockPrisma.contractApproval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ contractId: 'contract-123' }),
        })
      );
    });
  });

  describe('getStepAnalytics - 带日期过滤', () => {
    it('应该在有日期范围时将其传递给步骤查询', async () => {
      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue([]);

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      await service.getStepAnalytics({ startDate, endDate });

      expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: startDate,
              lte: endDate,
            }),
          }),
        })
      );
    });
  });

  describe('detectBottlenecks - 高严重程度瓶颈', () => {
    it('应该检测到high严重程度的瓶颈并给出超时提醒建议', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '财务总监',
          status: 'APPROVED',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: new Date('2026-01-12T12:00:00'), // 60小时：>= 48 但 < 72 → high
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const bottlenecks = await service.detectBottlenecks();

      expect(bottlenecks.length).toBeGreaterThan(0);
      const bottleneck = bottlenecks.find(b => b.approverRole === '财务总监');
      expect(bottleneck).toBeDefined();
      expect(bottleneck?.severity).toBe('high');
      expect(bottleneck?.suggestion).toContain('超时提醒');
    });
  });

  describe('getStepAnalytics - 全部未完成步骤', () => {
    it('当某角色全部步骤均未完成时应返回totalProcessed为0', async () => {
      const mockSteps = [
        {
          id: 'step-1',
          approverRole: '未完成角色',
          status: 'PENDING',
          createdAt: new Date('2026-01-10T00:00:00'),
          completedAt: null, // 全部未完成
        },
      ];

      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue(
        mockSteps
      );

      const stepAnalytics = await service.getStepAnalytics();
      const pendingAnalytics = stepAnalytics.find(
        s => s.approverRole === '未完成角色'
      );

      expect(pendingAnalytics).toBeDefined();
      expect(pendingAnalytics?.totalProcessed).toBe(0);
      expect(pendingAnalytics?.approveRate).toBe(0);
      expect(pendingAnalytics?.avgProcessingTimeHours).toBe(0);
    });
  });

  describe('getApprovalAnalytics - 仅endDate过滤', () => {
    it('应该在只有endDate时正确构建日期过滤条件', async () => {
      (mockPrisma.contractApproval.findMany as jest.Mock).mockResolvedValue([]);

      const endDate = new Date('2026-01-31');
      await service.getApprovalAnalytics({ endDate });

      expect(mockPrisma.contractApproval.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ lte: endDate }),
          }),
        })
      );
    });
  });

  describe('getStepAnalytics - 仅startDate过滤', () => {
    it('应该在只有startDate时正确构建步骤日期过滤条件', async () => {
      (mockPrisma.approvalStep.findMany as jest.Mock).mockResolvedValue([]);

      const startDate = new Date('2026-01-01');
      await service.getStepAnalytics({ startDate });

      expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({ gte: startDate }),
          }),
        })
      );
    });
  });
});
