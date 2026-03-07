/**
 * 管理层报表服务单元测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
}));

// Mock Prisma - 使用 any 类型避免类型推断问题
const mockPrisma: any = {
  executiveReport: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  enterpriseAccount: {
    findUnique: jest.fn(),
  },
  enterpriseRiskProfile: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  enterpriseComplianceCheck: {
    count: jest.fn(),
  },
  contract: {
    count: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

import { executiveReportService } from '@/lib/enterprise/executive-report-service';

describe('ExecutiveReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRiskOverviewReport', () => {
    it('应该成功创建风险概览报表', async () => {
      const mockEnterprise = {
        id: 'ent-1',
        enterpriseName: '测试企业',
      };

      const mockRiskProfile = {
        id: 'profile-1',
        overallRiskScore: 45,
        riskLevel: 'MEDIUM',
        legalRiskScore: 30,
        contractRiskScore: 50,
        complianceRiskScore: 55,
      };

      const mockReport = {
        id: 'report-1',
        enterpriseId: 'ent-1',
        reportType: 'RISK_OVERVIEW',
        title: '风险概览报告',
        summary: '企业当前风险水平中等',
        metrics: { overallScore: 45 },
        charts: [],
        insights: ['建议加强合同管理'],
        generatedBy: 'ai',
        generatedAt: new Date(),
        periodStart: new Date('2026-01-01'),
        periodEnd: new Date('2026-02-25'),
        recipients: [],
        viewedCount: 0,
        downloadedCount: 0,
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.enterpriseRiskProfile.findFirst.mockResolvedValue(
        mockRiskProfile
      );
      mockPrisma.executiveReport.create.mockResolvedValue(mockReport);

      const result = await executiveReportService.createRiskOverviewReport(
        'ent-1',
        {
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-25'),
        }
      );

      expect(result.reportType).toBe('RISK_OVERVIEW');
    });

    it('应该抛出错误当企业不存在时', async () => {
      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(null);

      await expect(
        executiveReportService.createRiskOverviewReport('non-existent', {
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-25'),
        })
      ).rejects.toThrow('企业不存在');
    });
  });

  describe('createComplianceStatusReport', () => {
    it('应该成功创建合规状态报表', async () => {
      const mockEnterprise = {
        id: 'ent-1',
        enterpriseName: '测试企业',
      };

      mockPrisma.enterpriseAccount.findUnique.mockResolvedValue(mockEnterprise);
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValue(10);
      mockPrisma.enterpriseComplianceCheck.count.mockResolvedValue(7); // compliant

      const mockReport = {
        id: 'report-1',
        enterpriseId: 'ent-1',
        reportType: 'COMPLIANCE_STATUS',
        title: '合规状态报告',
      };

      mockPrisma.executiveReport.create.mockResolvedValue(mockReport);

      const result = await executiveReportService.createComplianceStatusReport(
        'ent-1',
        {
          periodStart: new Date('2026-01-01'),
          periodEnd: new Date('2026-02-25'),
        }
      );

      expect(result.reportType).toBe('COMPLIANCE_STATUS');
    });
  });

  describe('getEnterpriseReports', () => {
    it('应该成功获取企业报表列表', async () => {
      const mockReports = [
        { id: 'report-1', reportType: 'RISK_OVERVIEW' },
        { id: 'report-2', reportType: 'COMPLIANCE_STATUS' },
      ];

      mockPrisma.executiveReport.findMany.mockResolvedValue(mockReports);

      const result = await executiveReportService.getEnterpriseReports('ent-1');

      expect(result.length).toBe(2);
    });
  });

  describe('getReport', () => {
    it('应该成功获取报表详情', async () => {
      const mockReport = {
        id: 'report-1',
        title: '风险概览报告',
      };

      mockPrisma.executiveReport.findUnique.mockResolvedValue(mockReport);

      const result = await executiveReportService.getReport('report-1');

      expect(result?.title).toBe('风险概览报告');
    });
  });
});
