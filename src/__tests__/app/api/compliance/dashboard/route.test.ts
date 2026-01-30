/**
 * 合规管理API测试
 * 测试覆盖率目标：90%+
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/compliance/dashboard/route';
import {
  ComplianceCategory,
  ComplianceCheckStatus,
  CompliancePriority,
} from '@/types/compliance';

// Mock合规服务
jest.mock('@/lib/compliance/compliance-service', () => ({
  ComplianceService: {
    getDashboard: jest.fn(),
  },
}));

describe('合规管理仪表盘API测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/compliance/dashboard', () => {
    it('应该成功获取合规仪表盘数据', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      const mockDashboard = {
        overallScore: 85,
        trend: 'up' as const,
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
        recentIssues: [
          {
            id: 'issue-001',
            category: ComplianceCategory.LEGAL,
            title: '合同条款不完整',
            description: '部分合同缺少必要条款',
            severity: CompliancePriority.HIGH,
            status: 'open' as const,
            identifiedDate: new Date(),
            recommendations: ['补充合同条款', '法务审核'],
          },
        ],
        upcomingDeadlines: [
          {
            id: 'deadline-001',
            title: '年度合规报告提交',
            dueDate: new Date('2024-12-31'),
            priority: CompliancePriority.HIGH,
          },
        ],
        categoryScores: {
          [ComplianceCategory.LEGAL]: 80,
          [ComplianceCategory.FINANCIAL]: 90,
          [ComplianceCategory.OPERATIONAL]: 85,
          [ComplianceCategory.DATA_PRIVACY]: 88,
          [ComplianceCategory.LABOR]: 82,
          [ComplianceCategory.ENVIRONMENTAL]: 75,
        },
      };

      (ComplianceService.getDashboard as jest.Mock).mockResolvedValue(
        mockDashboard
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/dashboard'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.overallScore).toBe(85);
      expect(data.data.trend).toBe('up');
      expect(ComplianceService.getDashboard).toHaveBeenCalled();
    });

    it('应该处理服务错误', async () => {
      const { ComplianceService } =
        await import('@/lib/compliance/compliance-service');

      (ComplianceService.getDashboard as jest.Mock).mockRejectedValue(
        new Error('服务错误')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/compliance/dashboard'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error.code).toBe('SERVICE_ERROR');
    });
  });
});
