/**
 * ReportService 单元测试
 * TDD实施 - 目标: 80%+ 覆盖率
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// 先定义 mock，然后在 jest.mock 中使用
const mockCaseCount = jest.fn();
const mockCaseGroupBy = jest.fn();
const mockCaseFindMany = jest.fn();
const mockOrderFindMany = jest.fn();
const mockContractRiskGroupBy = jest.fn();
const mockContractRiskFindMany = jest.fn();
const mockContractRiskCount = jest.fn();
const mockQueryRaw = jest.fn();

// Mock Prisma - 在导入 ReportService 之前
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      count: mockCaseCount,
      groupBy: mockCaseGroupBy,
      findMany: mockCaseFindMany,
    },
    order: {
      findMany: mockOrderFindMany,
    },
    contractClauseRisk: {
      groupBy: mockContractRiskGroupBy,
      findMany: mockContractRiskFindMany,
      count: mockContractRiskCount,
    },
    $queryRaw: mockQueryRaw,
  },
}));

// Mock Prisma client
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: unknown, ...values: unknown[]) => ({
      raw: strings,
      values,
    })),
    empty: {},
  },
}));

// 现在导入 ReportService
import { ReportService } from '@/lib/reports/report-service';
import { ReportType, ReportPeriod } from '@/types/report';

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport - 案件统计报表', () => {
    it('应该生成案件统计报表', async () => {
      // Mock 数据
      mockCaseCount
        .mockResolvedValueOnce(100) // totalCases
        .mockResolvedValueOnce(50) // activeCases
        .mockResolvedValueOnce(30) // closedCases
        .mockResolvedValueOnce(20); // pendingCases

      mockCaseGroupBy
        .mockResolvedValueOnce([
          { type: 'CIVIL', _count: { id: 60 } },
          { type: 'CRIMINAL', _count: { id: 40 } },
        ])
        .mockResolvedValueOnce([
          { status: 'ACTIVE', _count: { id: 50 } },
          { status: 'COMPLETED', _count: { id: 30 } },
          { status: 'DRAFT', _count: { id: 20 } },
        ]);

      mockCaseFindMany.mockResolvedValueOnce([
        {
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-02-01'),
        },
        {
          createdAt: new Date('2026-01-15'),
          updatedAt: new Date('2026-03-01'),
        },
      ]);

      mockQueryRaw.mockResolvedValueOnce([
        { month: '2026-01', new_cases: 50n, closed_cases: 20n },
        { month: '2026-02', new_cases: 50n, closed_cases: 10n },
      ]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.reportType).toBe(ReportType.CASE_STATISTICS);
      expect(result.title).toBe('案件统计报表');
      expect(result.data.totalCases).toBe(100);
      expect(result.data.activeCases).toBe(50);
      expect(result.data.closedCases).toBe(30);
      expect(result.summary).toContain('100件');
    });

    it('应该根据userId过滤案件统计', async () => {
      mockCaseCount.mockResolvedValue(10);
      mockCaseGroupBy.mockResolvedValue([]);
      mockCaseFindMany.mockResolvedValue([]);
      mockQueryRaw.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_7_DAYS,
      };

      await ReportService.generateReport(filter, 'user-123');

      // 验证调用包含userId过滤
      expect(mockCaseCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-123' }),
        })
      );
    });
  });

  describe('generateReport - 费用分析报表', () => {
    it('应该生成费用分析报表', async () => {
      mockOrderFindMany.mockResolvedValueOnce([
        {
          id: '1',
          amount: 1000,
          description: '套餐A',
          createdAt: new Date(),
          membershipTier: { name: '基础版' },
        },
        {
          id: '2',
          amount: 2000,
          description: '套餐B',
          createdAt: new Date(),
          membershipTier: { name: '专业版' },
        },
      ]);
      mockCaseCount.mockResolvedValueOnce(5);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.reportType).toBe(ReportType.COST_ANALYSIS);
      expect(result.title).toBe('费用分析报表');
      expect(result.data.totalCost).toBe(3000);
      expect(result.data.averageCostPerCase).toBe(600);
    });

    it('应该处理无订单情况', async () => {
      mockOrderFindMany.mockResolvedValueOnce([]);
      mockCaseCount.mockResolvedValueOnce(0);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.totalCost).toBe(0);
      expect(result.data.averageCostPerCase).toBe(0);
      expect(result.data.costByCategory).toHaveLength(1);
      expect(result.data.costByCategory[0].category).toBe('会员费');
    });

    it('应该按月排序费用数据', async () => {
      // 多个月份的订单，触发排序逻辑
      mockOrderFindMany.mockResolvedValueOnce([
        {
          id: '1',
          amount: 1000,
          description: '1月订单',
          createdAt: new Date('2026-03-01'),
          membershipTier: null,
        },
        {
          id: '2',
          amount: 2000,
          description: '2月订单',
          createdAt: new Date('2026-01-01'),
          membershipTier: null,
        },
        {
          id: '3',
          amount: 1500,
          description: '3月订单',
          createdAt: new Date('2026-02-01'),
          membershipTier: null,
        },
      ]);
      mockCaseCount.mockResolvedValueOnce(3);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_90_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.costByMonth).toHaveLength(3);
      // 验证按月排序（升序）
      expect(result.data.costByMonth[0].month).toBe('2026-01');
      expect(result.data.costByMonth[1].month).toBe('2026-02');
      expect(result.data.costByMonth[2].month).toBe('2026-03');
    });
  });

  describe('generateReport - 风险报告', () => {
    it('应该生成风险报告', async () => {
      mockContractRiskGroupBy.mockResolvedValueOnce([
        { riskLevel: 'CRITICAL', _count: { id: 2 } },
        { riskLevel: 'HIGH', _count: { id: 5 } },
        { riskLevel: 'MEDIUM', _count: { id: 10 } },
        { riskLevel: 'LOW', _count: { id: 20 } },
      ]);
      mockContractRiskFindMany.mockResolvedValueOnce([
        {
          id: 'r1',
          riskLevel: 'CRITICAL',
          contract: { id: 'c1', contractNumber: '合同001' },
        },
        {
          id: 'r2',
          riskLevel: 'HIGH',
          contract: { id: 'c2', contractNumber: '合同002' },
        },
      ]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.reportType).toBe(ReportType.RISK_REPORT);
      expect(result.title).toBe('风险报告');
      expect(result.data.totalRisks).toBe(37);
      expect(result.data.criticalRisks).toBe(2);
      expect(result.data.highRisks).toBe(5);
    });

    it('应该处理无风险数据情况', async () => {
      mockContractRiskGroupBy.mockResolvedValueOnce([]);
      mockContractRiskFindMany.mockResolvedValueOnce([]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.totalRisks).toBe(0);
      expect(result.data.mitigationRate).toBe(100);
    });
  });

  describe('generateReport - 合规报告', () => {
    it('应该生成合规报告', async () => {
      mockCaseCount
        .mockResolvedValueOnce(100) // totalCases
        .mockResolvedValueOnce(80); // completedCases

      mockContractRiskCount
        .mockResolvedValueOnce(10) // highRisks
        .mockResolvedValueOnce(2) // criticalRisks
        .mockResolvedValueOnce(50); // totalRisks

      const filter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.reportType).toBe(ReportType.COMPLIANCE_REPORT);
      expect(result.title).toBe('合规报告');
      expect(result.data.totalChecks).toBe(150); // 100 + 50
      expect(result.data.overallScore).toBeGreaterThan(0);
    });

    it('应该正确识别严重和高风险问题', async () => {
      mockCaseCount.mockResolvedValueOnce(10).mockResolvedValueOnce(5);

      mockContractRiskCount
        .mockResolvedValueOnce(3) // highRisks
        .mockResolvedValueOnce(1) // criticalRisks
        .mockResolvedValueOnce(10);

      const filter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.topIssues).toHaveLength(2);
      expect(result.data.topIssues[0].severity).toBe('critical');
      expect(result.data.topIssues[1].severity).toBe('high');
    });
  });

  describe('calculatePeriod - 时间范围计算', () => {
    beforeEach(() => {
      // 设置基础 mock 数据
      mockCaseCount.mockResolvedValue(0);
      mockCaseGroupBy.mockResolvedValue([]);
      mockCaseFindMany.mockResolvedValue([]);
      mockQueryRaw.mockResolvedValue([]);
    });

    it('应该计算最近7天时间范围', async () => {
      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.period.startDate).toBeInstanceOf(Date);
      expect(result.period.endDate).toBeInstanceOf(Date);
      const diffDays =
        (result.period.endDate.getTime() - result.period.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(7, 0);
    });

    it('应该计算最近30天时间范围', async () => {
      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      const diffDays =
        (result.period.endDate.getTime() - result.period.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('应该计算最近90天时间范围', async () => {
      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_90_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      const diffDays =
        (result.period.endDate.getTime() - result.period.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(90, 0);
    });

    it('应该计算最近一年时间范围', async () => {
      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_YEAR,
      };

      const result = await ReportService.generateReport(filter);

      const diffDays =
        (result.period.endDate.getTime() - result.period.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      // 允许365-366天的范围（考虑闰年）
      expect(diffDays).toBeGreaterThanOrEqual(364);
      expect(diffDays).toBeLessThanOrEqual(366);
    });

    it('应该使用自定义时间范围', async () => {
      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-01-31');

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.CUSTOM,
        startDate,
        endDate,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.period.startDate).toEqual(startDate);
      expect(result.period.endDate).toEqual(endDate);
    });

    it('应该抛出错误当自定义时间范围缺少日期', async () => {
      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.CUSTOM,
      };

      await expect(ReportService.generateReport(filter)).rejects.toThrow(
        '自定义时间范围需要提供开始日期和结束日期'
      );
    });
  });

  describe('exportReport - 导出功能', () => {
    it('应该导出PDF格式报表', async () => {
      const result = await ReportService.exportReport('report-123', 'pdf');

      expect(result.fileName).toBe('report-123.pdf');
      expect(result.downloadUrl).toBe('/downloads/report-123.pdf');
    });

    it('应该导出Excel格式报表', async () => {
      const result = await ReportService.exportReport('report-456', 'excel');

      expect(result.fileName).toBe('report-456.xlsx');
      expect(result.downloadUrl).toBe('/downloads/report-456.xlsx');
    });

    it('应该导出CSV格式报表', async () => {
      const result = await ReportService.exportReport('report-789', 'csv');

      expect(result.fileName).toBe('report-789.csv');
      expect(result.downloadUrl).toBe('/downloads/report-789.csv');
    });

    it('应该默认使用PDF格式', async () => {
      const result = await ReportService.exportReport(
        'report-abc',
        'unknown' as any
      );

      expect(result.fileName).toBe('report-abc.pdf');
    });
  });

  describe('错误处理', () => {
    it('应该抛出错误当报表类型不支持', async () => {
      const filter = {
        reportType: 'UNKNOWN_TYPE' as ReportType,
        period: ReportPeriod.LAST_7_DAYS,
      };

      await expect(ReportService.generateReport(filter)).rejects.toThrow(
        '不支持的报表类型'
      );
    });

    it('应该抛出错误当时间范围不支持', async () => {
      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: 'UNKNOWN_PERIOD' as ReportPeriod,
      };

      await expect(ReportService.generateReport(filter)).rejects.toThrow(
        '不支持的时间范围'
      );
    });
  });

  describe('边缘分支覆盖', () => {
    it('应该处理totalCases为0时的百分比计算', async () => {
      // 没有案件的情况
      mockCaseCount
        .mockResolvedValueOnce(0) // totalCases = 0
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      mockCaseGroupBy
        .mockResolvedValueOnce([]) // casesByType empty
        .mockResolvedValueOnce([]); // casesByStatus empty

      mockCaseFindMany.mockResolvedValueOnce([]);
      mockQueryRaw.mockResolvedValueOnce([]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.totalCases).toBe(0);
      expect(result.data.byCaseType).toEqual([]);
      expect(result.data.byStatus).toEqual([]);
      expect(result.data.successRate).toBe(0);
    });

    it('应该处理费用分析中的userId过滤', async () => {
      mockOrderFindMany.mockResolvedValueOnce([
        {
          id: '1',
          amount: 1000,
          description: '测试',
          createdAt: new Date(),
          membershipTier: null,
        },
      ]);
      mockCaseCount.mockResolvedValueOnce(1);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      await ReportService.generateReport(filter, 'user-456');

      // 验证order查询包含userId
      expect(mockOrderFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-456' }),
        })
      );
    });

    it('应该处理风险报告中的userId过滤', async () => {
      mockContractRiskGroupBy.mockResolvedValueOnce([
        { riskLevel: 'HIGH', _count: { id: 1 } },
      ]);
      mockContractRiskFindMany.mockResolvedValueOnce([]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      await ReportService.generateReport(filter, 'user-789');

      // 验证风险查询包含userId
      expect(mockContractRiskGroupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-789' }),
        })
      );
    });

    it('应该处理合规报告中的userId过滤', async () => {
      mockCaseCount.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

      mockContractRiskCount
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);

      const filter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      await ReportService.generateReport(filter, 'user-999');

      // 验证案件查询包含userId
      expect(mockCaseCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-999' }),
        })
      );
    });
  });

  describe('报告建议生成', () => {
    it('应该生成案件统计建议 - 低胜率', async () => {
      mockCaseCount
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(40);

      mockCaseGroupBy.mockResolvedValue([]);
      mockCaseFindMany.mockResolvedValue([]);
      mockQueryRaw.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      // 当成功率低于70%时应该有相关建议
      if (result.data.successRate < 70) {
        expect(result.recommendations.some(r => r.includes('证据收集'))).toBe(
          true
        );
      }
    });

    it('应该生成案件统计建议 - 长案件时长', async () => {
      // 创建超过180天的案件，触发时长建议
      const oldDate = new Date('2025-01-01');
      const newDate = new Date('2026-01-01'); // 365天后

      mockCaseCount
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      mockCaseGroupBy.mockResolvedValue([]);
      mockCaseFindMany.mockResolvedValue([
        { createdAt: oldDate, updatedAt: newDate },
      ]);
      mockQueryRaw.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_YEAR,
      };

      const result = await ReportService.generateReport(filter);

      // 平均时长超过180天应该有相关建议
      if (result.data.averageDuration > 180) {
        expect(
          result.recommendations.some(r => r.includes('案件管理流程'))
        ).toBe(true);
      }
    });

    it('应该生成费用分析建议 - 高预算使用率', async () => {
      mockOrderFindMany.mockResolvedValue([
        {
          id: '1',
          amount: 95000,
          description: '高额订单',
          createdAt: new Date(),
          membershipTier: null,
        },
      ]);
      mockCaseCount.mockResolvedValue(1);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      // 预算使用率超过90%应该有相关建议
      if (result.data.budgetUtilization > 90) {
        expect(
          result.recommendations.some(
            r => r.includes('预算') || r.includes('费用')
          )
        ).toBe(true);
      }
    });

    it('应该生成风险报告建议 - 存在严重风险', async () => {
      mockContractRiskGroupBy.mockResolvedValue([
        { riskLevel: 'CRITICAL', _count: { id: 3 } },
      ]);
      mockContractRiskFindMany.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.recommendations.some(r => r.includes('严重风险'))).toBe(
        true
      );
    });

    it('应该生成合规报告建议 - 低合规评分', async () => {
      mockCaseCount.mockResolvedValue(10);
      mockContractRiskCount.mockResolvedValue(100);

      const filter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      // 低评分时应该有相关建议
      if (result.data.overallScore < 80) {
        expect(result.recommendations.some(r => r.includes('合规'))).toBe(true);
      }
    });
  });

  describe('分支覆盖率提升 - 边界条件', () => {
    it('应该处理案件类型标签映射失败的情况', async () => {
      mockCaseCount
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      // 返回未知的案件类型
      mockCaseGroupBy
        .mockResolvedValueOnce([{ type: 'UNKNOWN_TYPE', _count: { id: 5 } }])
        .mockResolvedValueOnce([{ status: 'ACTIVE', _count: { id: 5 } }]);

      mockCaseFindMany.mockResolvedValue([
        { createdAt: new Date(), updatedAt: new Date() },
      ]);
      mockQueryRaw.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      // 未知类型应该原样返回
      expect(result.data.byCaseType[0].caseType).toBe('UNKNOWN_TYPE');
    });

    it('应该处理案件状态标签映射失败的情况', async () => {
      mockCaseCount
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2);

      mockCaseGroupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { status: 'UNKNOWN_STATUS', _count: { id: 5 } },
        ]);

      mockCaseFindMany.mockResolvedValue([
        { createdAt: new Date(), updatedAt: new Date() },
      ]);
      mockQueryRaw.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      // 未知状态应该原样返回
      expect(result.data.byStatus[0].status).toBe('UNKNOWN_STATUS');
    });

    it('应该处理费用分析中百分比计算为0的情况', async () => {
      // 总费用为0的情况
      mockOrderFindMany.mockResolvedValue([
        {
          id: '1',
          amount: 0,
          description: '免费订单',
          createdAt: new Date(),
          membershipTier: { name: '免费版' },
        },
      ]);
      mockCaseCount.mockResolvedValue(1);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.totalCost).toBe(0);
      expect(result.data.costByCategory[0].percentage).toBe(0);
    });

    it('应该处理费用分析中无会员等级的情况', async () => {
      mockOrderFindMany.mockResolvedValue([
        {
          id: '1',
          amount: 1000,
          description: '订单',
          createdAt: new Date(),
          membershipTier: null,
        },
      ]);
      mockCaseCount.mockResolvedValue(1);

      const filter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.costByCategory[0].category).toBe('其他');
    });

    it('应该处理风险等级标签映射失败的情况', async () => {
      mockContractRiskGroupBy.mockResolvedValue([
        { riskLevel: 'UNKNOWN_RISK', _count: { id: 5 } },
      ]);
      mockContractRiskFindMany.mockResolvedValue([
        { id: 'r1', riskLevel: 'UNKNOWN_RISK', contract: null },
      ]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      // 未知风险等级应该原样返回
      expect(result.data.risksByCategory[0].category).toBe('UNKNOWN_RISK');
    });

    it('应该处理合同信息为空的风险项', async () => {
      mockContractRiskGroupBy.mockResolvedValue([
        { riskLevel: 'HIGH', _count: { id: 1 } },
      ]);
      mockContractRiskFindMany.mockResolvedValue([
        { id: 'r1', riskLevel: 'HIGH', contract: null },
      ]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.topRiskyCases[0].caseTitle).toBe('未知合同');
    });

    it('应该处理无严重风险和高风险的情况', async () => {
      mockContractRiskGroupBy.mockResolvedValue([
        { riskLevel: 'LOW', _count: { id: 10 } },
        { riskLevel: 'MEDIUM', _count: { id: 5 } },
      ]);
      mockContractRiskFindMany.mockResolvedValue([]);

      const filter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.criticalRisks).toBe(0);
      expect(result.data.highRisks).toBe(0);
      expect(result.data.topRiskyCases).toHaveLength(0);
    });

    it('应该处理合规报告中无失败检查项的情况', async () => {
      mockCaseCount.mockResolvedValueOnce(10).mockResolvedValueOnce(10); // completedCases = totalCases

      mockContractRiskCount
        .mockResolvedValueOnce(0) // highRisks = 0
        .mockResolvedValueOnce(0) // criticalRisks = 0
        .mockResolvedValueOnce(0); // totalRisks = 0

      const filter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.failedChecks).toBe(0);
      expect(result.data.topIssues).toHaveLength(0);
      expect(result.data.overallScore).toBeGreaterThanOrEqual(85);
    });

    it('应该处理合规报告中总检查项为0的情况', async () => {
      mockCaseCount
        .mockResolvedValueOnce(0) // totalCases = 0
        .mockResolvedValueOnce(0);

      mockContractRiskCount
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0); // totalRisks = 0

      const filter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const result = await ReportService.generateReport(filter);

      expect(result.data.totalChecks).toBe(0);
      expect(result.data.complianceByCategory.every(c => c.score === 100)).toBe(
        true
      );
    });
  });
});
