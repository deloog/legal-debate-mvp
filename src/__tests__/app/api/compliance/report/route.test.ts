/**
 * 合规报告API测试
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/compliance/report/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { ComplianceCategory, CompliancePriority } from '@/types/compliance';

// Mock合规服务
jest.mock('@/lib/compliance/compliance-service', () => ({
  ComplianceAccessError: class ComplianceAccessError extends Error {
    code: string;
    status: number;

    constructor(code: string, message: string, status: number) {
      super(message);
      this.name = 'ComplianceAccessError';
      this.code = code;
      this.status = status;
    }
  },
  ComplianceService: {
    generateReport: jest.fn(),
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

describe('合规报告API测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthUser as jest.Mock).mockResolvedValue({
      userId: 'enterprise-user-1',
    });
  });

  describe('GET /api/compliance/report', () => {
    it('应该成功生成合规报告', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      const mockReport = {
        id: 'report-001',
        title: '2024年度合规报告',
        reportDate: new Date(),
        period: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
        },
        overallScore: 85,
        summary: '整体合规情况良好',
        statistics: {
          totalChecks: 50,
          passedChecks: 40,
          failedChecks: 5,
          warningChecks: 3,
          pendingChecks: 2,
          byCategory: {
            [ComplianceCategory.LEGAL]: { total: 10, passed: 8, failed: 2 },
            [ComplianceCategory.FINANCIAL]: { total: 10, passed: 9, failed: 1 },
            [ComplianceCategory.OPERATIONAL]: {
              total: 10,
              passed: 8,
              failed: 2,
            },
            [ComplianceCategory.DATA_PRIVACY]: {
              total: 10,
              passed: 8,
              failed: 2,
            },
            [ComplianceCategory.LABOR]: { total: 5, passed: 4, failed: 1 },
            [ComplianceCategory.ENVIRONMENTAL]: {
              total: 5,
              passed: 3,
              failed: 2,
            },
          },
        },
        issues: [
          {
            id: 'issue-001',
            category: ComplianceCategory.LEGAL,
            title: '合同条款不完整',
            description: '部分合同缺少必要条款',
            severity: CompliancePriority.HIGH,
            status: 'open' as const,
            identifiedDate: new Date(),
            recommendations: ['补充合同条款'],
          },
        ],
        recommendations: ['加强合同审查', '定期培训'],
      };

      (ComplianceService.generateReport as jest.Mock).mockResolvedValue(
        mockReport
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/report'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.overallScore).toBe(85);
      expect(ComplianceService.generateReport).toHaveBeenCalledWith(
        'enterprise-user-1',
        {
          startDate: undefined,
          endDate: undefined,
          category: undefined,
        }
      );
    });

    it('应该支持日期范围筛选', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      (ComplianceService.generateReport as jest.Mock).mockResolvedValue({
        id: 'report-001',
        title: '合规报告',
        reportDate: new Date(),
        period: {
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-06-30'),
        },
        overallScore: 85,
        summary: '报告摘要',
        statistics: {
          totalChecks: 0,
          passedChecks: 0,
          failedChecks: 0,
          warningChecks: 0,
          pendingChecks: 0,
          byCategory: {
            [ComplianceCategory.LEGAL]: { total: 0, passed: 0, failed: 0 },
            [ComplianceCategory.FINANCIAL]: { total: 0, passed: 0, failed: 0 },
            [ComplianceCategory.OPERATIONAL]: {
              total: 0,
              passed: 0,
              failed: 0,
            },
            [ComplianceCategory.DATA_PRIVACY]: {
              total: 0,
              passed: 0,
              failed: 0,
            },
            [ComplianceCategory.LABOR]: { total: 0, passed: 0, failed: 0 },
            [ComplianceCategory.ENVIRONMENTAL]: {
              total: 0,
              passed: 0,
              failed: 0,
            },
          },
        },
        issues: [],
        recommendations: [],
      });

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/report?startDate=2024-01-01&endDate=2024-06-30'
      );

      const response = await GET(request);
      const __data = await response.json();

      expect(response.status).toBe(200);
      expect(ComplianceService.generateReport).toHaveBeenCalledWith(
        'enterprise-user-1',
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        })
      );
    });

    it('应该处理服务错误', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      (ComplianceService.generateReport as jest.Mock).mockRejectedValue(
        new Error('服务错误')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/report'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('SERVICE_ERROR');
    });

    it('企业认证未通过时应返回403', async () => {
      const { ComplianceAccessError, ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      (ComplianceService.generateReport as jest.Mock).mockRejectedValue(
        new ComplianceAccessError(
          'ENTERPRISE_NOT_APPROVED',
          '企业认证尚未通过，暂不可使用合规管理功能',
          403
        )
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/report'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('ENTERPRISE_NOT_APPROVED');
    });
  });
});
