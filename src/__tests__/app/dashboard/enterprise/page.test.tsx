/**
 * 企业法务工作台页面测试
 * 测试覆盖：
 * 1. 页面渲染
 * 2. 统计卡片显示
 * 3. 风险告警列表
 * 4. 最近审查的合同列表
 * 5. 合规状态卡片
 * 6. 即将到期的任务列表
 * 7. 数据加载状态
 * 8. 错误处理
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnterpriseDashboardPage from '@/app/dashboard/enterprise/page';

// Mock fetch
global.fetch = jest.fn();

describe('企业法务工作台页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('页面渲染', () => {
    it('应该正确渲染页面标题', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('企业法务工作台')).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<EnterpriseDashboardPage />);

      expect(screen.getByText(/加载中/i)).toBeInTheDocument();
    });
  });

  describe('统计卡片', () => {
    it('应该正确显示待审查合同数量', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 5,
              highRiskContracts: 2,
              complianceScore: 85,
              pendingTasks: 3,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 10,
              passedChecks: 8,
              failedChecks: 2,
              score: 80,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('待审查合同')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('应该正确显示高风险合同数量', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 5,
              highRiskContracts: 2,
              complianceScore: 85,
              pendingTasks: 3,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 10,
              passedChecks: 8,
              failedChecks: 2,
              score: 80,
            },
            upcomingTasks: [],
          },
        }),
      });

      const { container } = render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('高风险合同')).toBeInTheDocument();
        // 使用更具体的选择器查找高风险合同数量
        const highRiskCard = container.querySelector(
          '.rounded-lg.bg-white.p-6.shadow:nth-child(2)'
        );
        expect(highRiskCard?.textContent).toContain('2');
      });
    });

    it('应该正确显示合规评分', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 5,
              highRiskContracts: 2,
              complianceScore: 85,
              pendingTasks: 3,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 10,
              passedChecks: 8,
              failedChecks: 2,
              score: 80,
            },
            upcomingTasks: [],
          },
        }),
      });

      const { container } = render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('合规评分')).toBeInTheDocument();
        // 使用更具体的选择器查找合规评分
        const complianceCard = container.querySelector(
          '.rounded-lg.bg-white.p-6.shadow:nth-child(3)'
        );
        expect(complianceCard?.textContent).toContain('85');
      });
    });

    it('应该正确显示待处理任务数量', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 5,
              highRiskContracts: 2,
              complianceScore: 85,
              pendingTasks: 3,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 10,
              passedChecks: 8,
              failedChecks: 2,
              score: 80,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('待处理任务')).toBeInTheDocument();
        expect(screen.getByText('3')).toBeInTheDocument();
      });
    });
  });

  describe('风险告警列表', () => {
    it('应该显示风险告警列表标题', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('风险告警')).toBeInTheDocument();
      });
    });

    it('应该正确显示风险告警项', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [
              {
                id: '1',
                type: 'HIGH_RISK',
                title: '高风险合同待审查',
                description: '合同HT20260130001存在高风险条款',
                severity: 'HIGH',
                createdAt: new Date('2026-01-30T10:00:00Z'),
              },
              {
                id: '2',
                type: 'COMPLIANCE',
                title: '合规检查未通过',
                description: '合同HT20260130002未通过合规检查',
                severity: 'MEDIUM',
                createdAt: new Date('2026-01-30T09:00:00Z'),
              },
            ],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('高风险合同待审查')).toBeInTheDocument();
        expect(screen.getByText('合规检查未通过')).toBeInTheDocument();
      });
    });

    it('应该在没有告警时显示空状态', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无风险告警')).toBeInTheDocument();
      });
    });
  });

  describe('最近审查的合同列表', () => {
    it('应该显示最近审查的合同列表标题', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('最近审查的合同')).toBeInTheDocument();
      });
    });

    it('应该正确显示合同信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [
              {
                id: '1',
                contractNumber: 'HT20260130001',
                clientName: '测试客户A',
                caseType: '劳动争议',
                status: 'SIGNED',
                totalFee: 50000,
                reviewedAt: new Date('2026-01-30T10:00:00Z'),
              },
              {
                id: '2',
                contractNumber: 'HT20260130002',
                clientName: '测试客户B',
                caseType: '合同纠纷',
                status: 'PENDING',
                totalFee: 80000,
                reviewedAt: new Date('2026-01-30T09:00:00Z'),
              },
            ],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('HT20260130001')).toBeInTheDocument();
        expect(screen.getByText(/测试客户A/)).toBeInTheDocument();
        expect(screen.getByText('HT20260130002')).toBeInTheDocument();
        expect(screen.getByText(/测试客户B/)).toBeInTheDocument();
      });
    });

    it('应该在没有合同时显示空状态', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无审查记录')).toBeInTheDocument();
      });
    });
  });

  describe('合规状态卡片', () => {
    it('应该显示合规状态标题', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 10,
              passedChecks: 8,
              failedChecks: 2,
              score: 80,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('合规状态')).toBeInTheDocument();
      });
    });

    it('应该正确显示合规检查统计', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 10,
              passedChecks: 8,
              failedChecks: 2,
              score: 80,
            },
            upcomingTasks: [],
          },
        }),
      });

      const { container } = render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        const complianceSection = container.querySelector(
          '.rounded-lg.bg-white.p-6.shadow:has(h2:contains("合规状态"))'
        );
        expect(screen.getByText('合规状态')).toBeInTheDocument();
        expect(screen.getByText('10')).toBeInTheDocument();
        expect(screen.getByText('8')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });
  });

  describe('即将到期的任务列表', () => {
    it('应该显示即将到期的任务列表标题', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('即将到期的任务')).toBeInTheDocument();
      });
    });

    it('应该正确显示任务信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [
              {
                id: '1',
                title: '合同审查任务',
                description: '审查HT20260130001合同',
                dueDate: new Date('2026-01-31T10:00:00Z'),
                priority: 'HIGH',
                status: 'PENDING',
              },
              {
                id: '2',
                title: '合规检查任务',
                description: '进行月度合规检查',
                dueDate: new Date('2026-02-01T10:00:00Z'),
                priority: 'MEDIUM',
                status: 'PENDING',
              },
            ],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('合同审查任务')).toBeInTheDocument();
        expect(screen.getByText('合规检查任务')).toBeInTheDocument();
      });
    });

    it('应该在没有任务时显示空状态', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('暂无即将到期的任务')).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    it('应该在API请求失败时显示错误信息', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(
          screen.getByText(/加载数据失败，请刷新页面重试/)
        ).toBeInTheDocument();
      });
    });

    it('应该在API返回错误时显示错误信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: '服务器内部错误',
          },
        }),
      });

      render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/加载数据失败/)).toBeInTheDocument();
      });
    });
  });

  describe('响应式设计', () => {
    it('应该在移动端正确显示', async () => {
      // 模拟移动端视口
      global.innerWidth = 375;
      global.innerHeight = 667;

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            stats: {
              pendingReviewContracts: 0,
              highRiskContracts: 0,
              complianceScore: 0,
              pendingTasks: 0,
            },
            riskAlerts: [],
            recentContracts: [],
            complianceStatus: {
              totalChecks: 0,
              passedChecks: 0,
              failedChecks: 0,
              score: 0,
            },
            upcomingTasks: [],
          },
        }),
      });

      const { container } = render(<EnterpriseDashboardPage />);

      await waitFor(() => {
        expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
      });
    });
  });
});
