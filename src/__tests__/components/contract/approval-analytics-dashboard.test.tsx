/**
 * ApprovalAnalyticsDashboard 组件测试
 */

import { render, screen } from '@testing-library/react';
import { ApprovalAnalyticsDashboard } from '@/components/contract/ApprovalAnalyticsDashboard';
import type { ApprovalAnalytics } from '@/lib/contract/approval-analytics-service';

const mockAnalytics: ApprovalAnalytics = {
  period: {
    start: new Date('2026-01-01'),
    end: new Date('2026-01-31'),
  },
  totalApprovals: 100,
  completedApprovals: 85,
  avgCompletionTimeHours: 36,
  approvalPassRate: 0.82,
  stepAnalytics: [
    {
      approverRole: '总经理',
      avgProcessingTimeHours: 72,
      totalProcessed: 40,
      approveRate: 0.9,
      rejectRate: 0.1,
    },
    {
      approverRole: '部门主管',
      avgProcessingTimeHours: 12,
      totalProcessed: 80,
      approveRate: 0.85,
      rejectRate: 0.15,
    },
    {
      approverRole: '财务部',
      avgProcessingTimeHours: 24,
      totalProcessed: 60,
      approveRate: 0.88,
      rejectRate: 0.12,
    },
  ],
  bottlenecks: [
    {
      approverRole: '总经理',
      avgProcessingTimeHours: 72,
      severity: 'high',
      suggestion: '建议委托审批权限或增加审批人',
    },
  ],
  suggestions: [
    '【审批瓶颈】总经理 平均处理时间 72 小时，建议：委托审批权限',
    '【效率优化】平均审批周期 36 小时，建议引入并行审批',
  ],
};

describe('ApprovalAnalyticsDashboard', () => {
  // ==================== 基本渲染 ====================

  describe('基本渲染', () => {
    it('应该渲染分析仪表板', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('analytics-dashboard')).toBeInTheDocument();
    });

    it('应该显示统计概览卡片', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('stat-total-approvals')).toBeInTheDocument();
      expect(
        screen.getByTestId('stat-completed-approvals')
      ).toBeInTheDocument();
      expect(screen.getByTestId('stat-pass-rate')).toBeInTheDocument();
      expect(screen.getByTestId('stat-avg-time')).toBeInTheDocument();
    });

    it('应该显示正确的审批总数', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      const totalCard = screen.getByTestId('stat-total-approvals');
      expect(totalCard).toHaveTextContent('100');
    });

    it('应该显示正确的通过率（百分比格式）', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      const passRateCard = screen.getByTestId('stat-pass-rate');
      expect(passRateCard).toHaveTextContent('82%');
    });

    it('应该显示平均处理时间', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      const avgTimeCard = screen.getByTestId('stat-avg-time');
      expect(avgTimeCard).toHaveTextContent('36');
    });
  });

  // ==================== 步骤分析表格 ====================

  describe('步骤分析', () => {
    it('应该渲染步骤分析区域', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('step-analytics-section')).toBeInTheDocument();
    });

    it('应该显示所有角色的统计行', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      // 通过专属行的 data-testid 检查角色存在于步骤分析区域
      expect(screen.getByTestId('step-row-总经理')).toBeInTheDocument();
      expect(screen.getByTestId('step-row-部门主管')).toBeInTheDocument();
      expect(screen.getByTestId('step-row-财务部')).toBeInTheDocument();
    });

    it('应该显示各角色的平均处理时间', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      // 总经理 72小时
      expect(screen.getByTestId('step-row-总经理')).toHaveTextContent('72');
    });

    it('应该显示各角色的处理量', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      const ceoRow = screen.getByTestId('step-row-总经理');
      expect(ceoRow).toHaveTextContent('40');
    });
  });

  // ==================== 瓶颈警告 ====================

  describe('瓶颈警告', () => {
    it('应该渲染瓶颈警告区域', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('bottlenecks-section')).toBeInTheDocument();
    });

    it('应该显示瓶颈角色', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      const bottlenecksSection = screen.getByTestId('bottlenecks-section');
      expect(bottlenecksSection).toHaveTextContent('总经理');
    });

    it('应该标识高严重程度的瓶颈', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('bottleneck-severity-总经理')).toHaveAttribute(
        'data-severity',
        'high'
      );
    });

    it('当没有瓶颈时应该显示正向信息', () => {
      const noBottleneckAnalytics = {
        ...mockAnalytics,
        bottlenecks: [],
      };

      render(<ApprovalAnalyticsDashboard analytics={noBottleneckAnalytics} />);

      expect(screen.getByTestId('no-bottleneck-message')).toBeInTheDocument();
    });
  });

  // ==================== 优化建议 ====================

  describe('优化建议', () => {
    it('应该渲染优化建议区域', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('suggestions-section')).toBeInTheDocument();
    });

    it('应该显示所有优化建议', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByText(/【审批瓶颈】总经理/)).toBeInTheDocument();
      expect(screen.getByText(/【效率优化】/)).toBeInTheDocument();
    });

    it('当没有建议时应该显示提示信息', () => {
      const noSuggestionsAnalytics = {
        ...mockAnalytics,
        suggestions: [],
      };

      render(<ApprovalAnalyticsDashboard analytics={noSuggestionsAnalytics} />);

      expect(screen.getByTestId('no-suggestions-message')).toBeInTheDocument();
    });
  });

  // ==================== 期间显示 ====================

  describe('分析期间', () => {
    it('应该显示分析时间范围', () => {
      render(<ApprovalAnalyticsDashboard analytics={mockAnalytics} />);

      expect(screen.getByTestId('analytics-period')).toBeInTheDocument();
    });
  });

  // ==================== 加载状态 ====================

  describe('加载状态', () => {
    it('loading时应该显示骨架屏', () => {
      render(<ApprovalAnalyticsDashboard analytics={null} loading={true} />);

      expect(screen.getByTestId('analytics-loading')).toBeInTheDocument();
    });

    it('数据为null且非loading时应该显示空状态', () => {
      render(<ApprovalAnalyticsDashboard analytics={null} loading={false} />);

      expect(screen.getByTestId('analytics-empty')).toBeInTheDocument();
    });
  });
});
