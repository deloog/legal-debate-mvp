/**
 * 报告生成器单元测试
 */

import {
  generateReport,
  generateWeeklyReport,
  generateMonthlyReport,
} from '@/lib/report/report-generator';
import { ReportType, ReportFormat, _ReportStatus } from '@/types/stats';
import { prisma } from '@/lib/db/prisma';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    report: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

// 类型断言以解决 TypeScript 类型问题
const mockedPrisma = prisma as unknown as {
  report: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
};

// Mock report-data-collector
jest.mock('@/lib/report/report-data-collector', () => ({
  collectReportData: jest.fn().mockResolvedValue({
    userStats: {
      summary: {
        totalUsers: 100,
        newUsers: 10,
        activeUsers: 50,
        growthRate: 10.5,
      },
      trends: {
        registrationTrend: [],
        activityTrend: [],
      },
      distribution: {
        veryActive: 0,
        active: 50,
        inactive: 30,
        dormant: 20,
      },
    },
    caseStats: {
      summary: {
        totalCases: 20,
        completedCases: 15,
        activeCases: 5,
        averageCompletionTime: 12.5,
      },
      distribution: [],
      trends: [],
    },
    debateStats: {
      summary: {
        totalDebates: 30,
        totalArguments: 120,
        averageArgumentsPerDebate: 4,
        averageQualityScore: 0.85,
      },
      trends: {
        generationCount: [],
        qualityScore: [],
      },
      distribution: {
        excellent: 10,
        good: 15,
        average: 5,
        poor: 0,
        totalCount: 30,
      },
    },
    performanceStats: {
      summary: {
        totalRequests: 1000,
        averageResponseTime: 500,
        p95ResponseTime: 1500,
        errorRate: 2.5,
      },
      trends: {
        responseTime: [],
        errorRate: [],
      },
    },
    summary: {
      keyMetrics: [
        { label: '新增用户', value: 10, change: 10.5, unit: '人' },
        { label: '新增案件', value: 20, change: 0, unit: '件' },
        { label: '生成辩论', value: 30, change: 0, unit: '次' },
        { label: '系统错误率', value: 2.5, change: 0, unit: '%' },
      ],
      highlights: ['报告生成成功，数据收集完整'],
      issues: [],
      recommendations: [],
    },
  }),
}));

// Mock report-content-builder
jest.mock('@/lib/report/report-content-builder', () => ({
  buildReportContent: jest.fn().mockReturnValue({
    title: 'Test Report',
    sections: [],
  }),
}));

// Mock report-formatter
jest.mock('@/lib/report/report-formatter', () => ({
  formatReport: jest.fn().mockResolvedValue('/public/reports/test-report.html'),
}));

// Mock fs
jest.mock('fs/promises', () => ({
  stat: jest.fn().mockResolvedValue({
    size: 1024,
  }),
}));

describe('ReportGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 重置 collectReportData mock 为默认成功状态
    const { collectReportData } = jest.requireMock(
      '@/lib/report/report-data-collector'
    );
    collectReportData.mockResolvedValue({
      userStats: {
        summary: {
          totalUsers: 100,
          newUsers: 10,
          activeUsers: 50,
          growthRate: 10.5,
        },
        trends: {
          registrationTrend: [],
          activityTrend: [],
        },
        distribution: {
          veryActive: 0,
          active: 50,
          inactive: 30,
          dormant: 20,
        },
      },
      caseStats: {
        summary: {
          totalCases: 20,
          completedCases: 15,
          activeCases: 5,
          averageCompletionTime: 12.5,
        },
        distribution: [],
        trends: [],
      },
      debateStats: {
        summary: {
          totalDebates: 30,
          totalArguments: 120,
          averageArgumentsPerDebate: 4,
          averageQualityScore: 0.85,
        },
        trends: {
          generationCount: [],
          qualityScore: [],
        },
        distribution: {
          excellent: 10,
          good: 15,
          average: 5,
          poor: 0,
          totalCount: 30,
        },
      },
      performanceStats: {
        summary: {
          totalRequests: 1000,
          averageResponseTime: 500,
          p95ResponseTime: 1500,
          errorRate: 2.5,
        },
        trends: {
          responseTime: [],
          errorRate: [],
        },
      },
      summary: {
        keyMetrics: [
          { label: '新增用户', value: 10, change: 10.5, unit: '人' },
          { label: '新增案件', value: 20, change: 0, unit: '件' },
          { label: '生成辩论', value: 30, change: 0, unit: '次' },
          { label: '系统错误率', value: 2.5, change: 0, unit: '%' },
        ],
        highlights: ['报告生成成功，数据收集完整'],
        issues: [],
        recommendations: [],
      },
    });
  });

  describe('generateReport', () => {
    it('应该成功生成报告', async () => {
      const mockReport = {
        id: 'report-1',
        type: 'WEEKLY',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-07'),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);
      mockedPrisma.report.update.mockResolvedValue({
        ...mockReport,
        status: 'COMPLETED',
        filePath: '/public/reports/test-report.html',
        fileSize: 1024,
      });

      const config = {
        type: ReportType.WEEKLY,
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-01-07T23:59:59Z',
        format: ReportFormat.HTML,
      };

      const result = await generateReport(config);

      expect(result.success).toBe(true);
      expect(result.reportId).toBe('report-1');
      expect(result.filePath).toBe('/public/reports/test-report.html');
      expect(result.fileSize).toBe(1024);
      expect(mockedPrisma.report.create).toHaveBeenCalledTimes(1);
      expect(mockedPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WEEKLY',
          format: 'HTML',
        }),
      });
      expect(mockedPrisma.report.update).toHaveBeenCalledTimes(1);
    });

    it('应该在报告生成失败时更新状态', async () => {
      const mockReport = {
        id: 'report-1',
        type: 'WEEKLY',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-07'),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);
      mockedPrisma.report.update.mockResolvedValue({});

      const { collectReportData } = jest.requireMock(
        '@/lib/report/report-data-collector'
      );
      collectReportData.mockRejectedValue(new Error('数据收集失败'));

      const config = {
        type: ReportType.WEEKLY,
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-01-07T23:59:59Z',
        format: ReportFormat.HTML,
      };

      const result = await generateReport(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('数据收集失败');
    });
  });

  describe('generateWeeklyReport', () => {
    it('应该成功生成周报', async () => {
      const mockReport = {
        id: 'weekly-report-1',
        type: 'WEEKLY',
        periodStart: new Date(),
        periodEnd: new Date(),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);
      mockedPrisma.report.update.mockResolvedValue({
        ...mockReport,
        status: 'COMPLETED',
        filePath: '/public/reports/test-report.html',
        fileSize: 1024,
      });

      const result = await generateWeeklyReport();

      expect(result.success).toBe(true);
      expect(mockedPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WEEKLY',
          format: 'HTML',
        }),
      });
    });

    it('应该使用正确的日期范围生成周报', async () => {
      const mockReport = {
        id: 'weekly-report-2',
        type: 'WEEKLY',
        periodStart: new Date(),
        periodEnd: new Date(),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);
      mockedPrisma.report.update.mockResolvedValue({
        ...mockReport,
        status: 'COMPLETED',
      });

      const endDate = new Date('2024-01-07');
      await generateWeeklyReport(endDate);

      expect(mockedPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'WEEKLY',
          format: 'HTML',
        }),
      });
    });
  });

  describe('generateMonthlyReport', () => {
    it('应该成功生成月报', async () => {
      const mockReport = {
        id: 'monthly-report-1',
        type: 'MONTHLY',
        periodStart: new Date(),
        periodEnd: new Date(),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);
      mockedPrisma.report.update.mockResolvedValue({
        ...mockReport,
        status: 'COMPLETED',
        filePath: '/public/reports/test-report.html',
        fileSize: 1024,
      });

      const result = await generateMonthlyReport();

      expect(result.success).toBe(true);
      expect(mockedPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'MONTHLY',
          format: 'HTML',
        }),
      });
    });

    it('应该使用正确的日期范围生成月报', async () => {
      const mockReport = {
        id: 'monthly-report-2',
        type: 'MONTHLY',
        periodStart: new Date(),
        periodEnd: new Date(),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);
      mockedPrisma.report.update.mockResolvedValue({
        ...mockReport,
        status: 'COMPLETED',
      });

      const endDate = new Date('2024-01-31');
      await generateMonthlyReport(endDate);

      expect(mockedPrisma.report.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'MONTHLY',
          format: 'HTML',
        }),
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理Prisma错误', async () => {
      mockedPrisma.report.create.mockRejectedValue(new Error('数据库连接失败'));

      const config = {
        type: ReportType.WEEKLY,
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-01-07T23:59:59Z',
        format: ReportFormat.HTML,
      };

      const result = await generateReport(config);

      expect(result.success).toBe(false);
      expect(result.error).toBe('数据库连接失败');
    });

    it('应该处理文件系统错误', async () => {
      const mockReport = {
        id: 'report-1',
        type: 'WEEKLY',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-01-07'),
        format: 'HTML',
        status: 'GENERATING',
        generatedBy: 'SYSTEM',
      };

      mockedPrisma.report.create.mockResolvedValue(mockReport);

      const { stat } = jest.requireMock('fs/promises');
      stat.mockRejectedValue(new Error('文件访问失败'));

      const config = {
        type: ReportType.WEEKLY,
        periodStart: '2024-01-01T00:00:00Z',
        periodEnd: '2024-01-07T23:59:59Z',
        format: ReportFormat.HTML,
      };

      const result = await generateReport(config);

      expect(result.success).toBe(false);
    });
  });
});
