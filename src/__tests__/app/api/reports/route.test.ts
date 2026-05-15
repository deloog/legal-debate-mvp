/**
 * 法务报表API测试
 * 测试覆盖率目标：90%+
 */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/reports/route';
import { POST as ExportPOST } from '@/app/api/reports/export/route';
import type { ReportFilter } from '@/types/report';
import { ReportType, ReportPeriod } from '@/types/report';
import { getAuthUser } from '@/lib/middleware/auth';

// Mock报表服务
jest.mock('@/lib/reports/report-service', () => ({
  ReportService: {
    generateReport: jest.fn(),
    exportReport: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('法务报表API测试', () => {
  const mockFilter: ReportFilter = {
    reportType: ReportType.CASE_STATISTICS,
    period: ReportPeriod.LAST_YEAR,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      email: 'lawyer@example.com',
      role: 'LAWYER',
    });
  });

  describe('POST /api/reports', () => {
    it('应该成功生成案件统计报表', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      // Mock报表结果
      const mockResult = {
        id: 'report-001',
        reportType: ReportType.CASE_STATISTICS,
        title: '案件统计报表',
        generatedAt: new Date(),
        period: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        },
        filter: mockFilter,
        data: {
          totalCases: 100,
          activeCases: 30,
          closedCases: 70,
          wonCases: 50,
          lostCases: 15,
          pendingCases: 5,
          byCaseType: [
            { caseType: '民事', count: 50, percentage: 50 },
            { caseType: '刑事', count: 30, percentage: 30 },
            { caseType: '行政', count: 20, percentage: 20 },
          ],
          byStatus: [
            { status: '进行中', count: 30, percentage: 30 },
            { status: '已结案', count: 70, percentage: 70 },
          ],
          byMonth: [],
          averageDuration: 180,
          successRate: 71.4,
        },
        summary: '本年度共处理案件100件，胜诉率71.4%',
        recommendations: ['建议加强证据收集', '建议优化案件管理流程'],
      };

      (ReportService.generateReport as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: mockFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.reportType).toBe(ReportType.CASE_STATISTICS);
      expect(data.data.data.totalCases).toBe(100);
    });

    it('应该成功生成费用分析报表', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const costFilter: ReportFilter = {
        reportType: ReportType.COST_ANALYSIS,
        period: ReportPeriod.LAST_30_DAYS,
      };

      const mockResult = {
        id: 'report-002',
        reportType: ReportType.COST_ANALYSIS,
        title: '费用分析报表',
        generatedAt: new Date(),
        period: {
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-31'),
        },
        filter: costFilter,
        data: {
          totalCost: 500000,
          averageCostPerCase: 5000,
          costByCategory: [
            { category: '律师费', amount: 300000, percentage: 60 },
            { category: '诉讼费', amount: 100000, percentage: 20 },
            { category: '其他', amount: 100000, percentage: 20 },
          ],
          costByCaseType: [],
          costByMonth: [],
          topExpensiveCases: [],
          budgetUtilization: 75,
        },
        summary: '本月总费用50万元，预算使用率75%',
        recommendations: ['建议控制律师费支出'],
      };

      (ReportService.generateReport as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: costFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.reportType).toBe(ReportType.COST_ANALYSIS);
    });

    it('应该成功生成风险报告', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const riskFilter: ReportFilter = {
        reportType: ReportType.RISK_REPORT,
        period: ReportPeriod.LAST_90_DAYS,
      };

      const mockResult = {
        id: 'report-003',
        reportType: ReportType.RISK_REPORT,
        title: '风险报告',
        generatedAt: new Date(),
        period: {
          startDate: new Date('2024-10-01'),
          endDate: new Date('2024-12-31'),
        },
        filter: riskFilter,
        data: {
          totalRisks: 50,
          criticalRisks: 5,
          highRisks: 15,
          mediumRisks: 20,
          lowRisks: 10,
          risksByCategory: [],
          risksByCaseType: [],
          riskTrend: [],
          topRiskyCases: [],
          mitigationRate: 80,
        },
        summary: '本季度识别风险50个，缓解率80%',
        recommendations: ['建议加强高风险案件监控'],
      };

      (ReportService.generateReport as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: riskFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.reportType).toBe(ReportType.RISK_REPORT);
    });

    it('应该成功生成合规报告', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const complianceFilter: ReportFilter = {
        reportType: ReportType.COMPLIANCE_REPORT,
        period: ReportPeriod.LAST_7_DAYS,
      };

      const mockResult = {
        id: 'report-004',
        reportType: ReportType.COMPLIANCE_REPORT,
        title: '合规报告',
        generatedAt: new Date(),
        period: {
          startDate: new Date('2024-12-24'),
          endDate: new Date('2024-12-31'),
        },
        filter: complianceFilter,
        data: {
          overallScore: 85,
          totalChecks: 50,
          passedChecks: 40,
          failedChecks: 5,
          warningChecks: 5,
          complianceByCategory: [],
          complianceTrend: [],
          topIssues: [],
          improvementRate: 90,
        },
        summary: '本周合规评分85分，改进率90%',
        recommendations: ['建议关注数据隐私合规'],
      };

      (ReportService.generateReport as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: complianceFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.reportType).toBe(ReportType.COMPLIANCE_REPORT);
    });

    it('应该支持自定义时间范围', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const customFilter: ReportFilter = {
        reportType: ReportType.CASE_STATISTICS,
        period: ReportPeriod.CUSTOM,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-08-31'),
      };

      const mockResult = {
        id: 'report-005',
        reportType: ReportType.CASE_STATISTICS,
        title: '案件统计报表',
        generatedAt: new Date(),
        period: {
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-08-31'),
        },
        filter: customFilter,
        data: {
          totalCases: 30,
          activeCases: 10,
          closedCases: 20,
          wonCases: 15,
          lostCases: 5,
          pendingCases: 0,
          byCaseType: [],
          byStatus: [],
          byMonth: [],
          averageDuration: 90,
          successRate: 75,
        },
        summary: '自定义时间段共处理案件30件',
        recommendations: [],
      };

      (ReportService.generateReport as jest.Mock).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: customFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('应该验证必填字段', async () => {
      const invalidFilter = {
        period: ReportPeriod.LAST_YEAR,
        // 缺少reportType
      };

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: invalidFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理服务错误', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      (ReportService.generateReport as jest.Mock).mockRejectedValue(
        new Error('生成报表失败')
      );

      const request = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ filter: mockFilter }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  describe('POST /api/reports/export', () => {
    it('应该成功导出PDF格式', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const mockExportResult = {
        downloadUrl: '/downloads/report_001.pdf',
        fileName: 'report_001.pdf',
      };

      (ReportService.exportReport as jest.Mock).mockResolvedValue(
        mockExportResult
      );

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export',
        {
          method: 'POST',
          body: JSON.stringify({
            reportId: 'report_001',
            format: 'pdf',
          }),
        }
      );

      const response = await ExportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.downloadUrl).toBe('/downloads/report_001.pdf');
      expect(data.data.fileName).toBe('report_001.pdf');
    });

    it('应该成功导出Excel格式', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const mockExportResult = {
        downloadUrl: '/downloads/report_001.xlsx',
        fileName: 'report_001.xlsx',
      };

      (ReportService.exportReport as jest.Mock).mockResolvedValue(
        mockExportResult
      );

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export',
        {
          method: 'POST',
          body: JSON.stringify({
            reportId: 'report_001',
            format: 'excel',
          }),
        }
      );

      const response = await ExportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.fileName).toContain('.xlsx');
    });

    it('应该成功导出CSV格式', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      const mockExportResult = {
        downloadUrl: '/downloads/report_001.csv',
        fileName: 'report_001.csv',
      };

      (ReportService.exportReport as jest.Mock).mockResolvedValue(
        mockExportResult
      );

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export',
        {
          method: 'POST',
          body: JSON.stringify({
            reportId: 'report_001',
            format: 'csv',
          }),
        }
      );

      const response = await ExportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.fileName).toContain('.csv');
    });

    it('应该验证导出参数', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/reports/export',
        {
          method: 'POST',
          body: JSON.stringify({
            // 缺少reportId和format
          }),
        }
      );

      const response = await ExportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('应该处理导出错误', async () => {
      const { ReportService } = await import('@/lib/reports/report-service');

      (ReportService.exportReport as jest.Mock).mockRejectedValue(
        new Error('导出失败')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/reports/export',
        {
          method: 'POST',
          body: JSON.stringify({
            reportId: 'report_001',
            format: 'pdf',
          }),
        }
      );

      const response = await ExportPOST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });
});
