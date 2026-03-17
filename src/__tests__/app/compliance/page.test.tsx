/**
 * 合规管理页面组件测试
 * 测试覆盖率目标：90%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CompliancePage from '@/app/compliance/page';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('合规管理页面测试', () => {
  const mockDashboardData = {
    overallScore: 85,
    trend: 'up',
    statistics: {
      totalChecks: 50,
      passedChecks: 40,
      failedChecks: 5,
      warningChecks: 3,
      pendingChecks: 2,
      byCategory: {},
    },
    recentIssues: [],
    upcomingDeadlines: [],
    categoryScores: {
      legal: 80,
      financial: 90,
      operational: 85,
      data_privacy: 88,
      labor: 82,
      environmental: 75,
    },
  };

  const mockChecklistData = [
    {
      id: 'checklist-001',
      name: '法律合规检查',
      description: '年度法律合规检查清单',
      category: 'legal',
      items: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completionRate: 50,
    },
  ];

  const mockReportData = {
    id: 'report-001',
    title: '合规报告',
    reportDate: new Date().toISOString(),
    period: {
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
    },
    overallScore: 85,
    summary: '整体合规情况良好',
    statistics: {
      totalChecks: 50,
      passedChecks: 40,
      failedChecks: 5,
      warningChecks: 3,
      pendingChecks: 2,
      byCategory: {},
    },
    issues: [],
    recommendations: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/checklist')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockChecklistData }),
        };
      }
      if (typeof url === 'string' && url.includes('/report')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: mockReportData }),
        };
      }
      // Default: dashboard
      return {
        ok: true,
        json: async () => ({ success: true, data: mockDashboardData }),
      };
    });
  });

  it('应该正确渲染页面标题', () => {
    render(<CompliancePage />);
    expect(screen.getByText('合规管理')).toBeInTheDocument();
  });

  it('应该显示标签页切换', () => {
    render(<CompliancePage />);
    expect(screen.getByText('合规仪表盘')).toBeInTheDocument();
    expect(screen.getByText('检查清单')).toBeInTheDocument();
    expect(screen.getByText('合规报告')).toBeInTheDocument();
  });

  it('应该默认显示合规仪表盘', async () => {
    render(<CompliancePage />);
    await waitFor(() => {
      expect(screen.getByText('总体合规评分')).toBeInTheDocument();
    });
  });

  it('应该能够切换到检查清单标签', async () => {
    render(<CompliancePage />);

    const checklistTab = screen.getByText('检查清单');
    fireEvent.click(checklistTab);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/checklist')
      );
    });
  });

  it('应该能够切换到合规报告标签', async () => {
    render(<CompliancePage />);

    const reportTab = screen.getByText('合规报告');
    fireEvent.click(reportTab);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/report')
      );
    });
  });

  it('应该显示合规评分', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getAllByText('85').length).toBeGreaterThan(0);
    });
  });

  it('应该显示统计信息', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('总检查项')).toBeInTheDocument();
      expect(screen.getByText('通过')).toBeInTheDocument();
      expect(screen.getByText('未通过')).toBeInTheDocument();
    });
  });

  it('应该处理API错误', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: {
          code: 'SERVICE_ERROR',
          message: '服务错误',
        },
      }),
    });

    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText(/请求失败/)).toBeInTheDocument();
    });
  });

  it('应该显示加载状态', () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ success: true, data: {} }),
              }),
            100
          )
        )
    );

    render(<CompliancePage />);
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('应该能够更新检查项状态', async () => {
    const checklistWithItem = [
      {
        id: 'checklist-001',
        name: '法律合规检查',
        description: '年度法律合规检查清单',
        category: 'legal',
        items: [
          {
            id: 'item-001',
            category: 'legal',
            title: '合同审查',
            description: '审查所有合同',
            status: 'pending',
            priority: 'high',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completionRate: 0,
      },
    ];

    (global.fetch as jest.Mock).mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (typeof url === 'string' && url.includes('/checklist')) {
          if (options?.method === 'PUT') {
            return {
              ok: true,
              json: async () => ({
                success: true,
                data: { id: 'item-001', status: 'passed' },
              }),
            };
          }
          return {
            ok: true,
            json: async () => ({ success: true, data: checklistWithItem }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: mockDashboardData }),
        };
      }
    );

    render(<CompliancePage />);

    // 切换到检查清单
    const checklistTab = screen.getByText('检查清单');
    fireEvent.click(checklistTab);

    await waitFor(() => {
      expect(screen.getByText('合同审查')).toBeInTheDocument();
    });

    // 更新状态
    const statusButton = screen.getByText('标记为通过');
    fireEvent.click(statusButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/compliance/checklist'),
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });
  });

  it('应该显示趋势指示器', async () => {
    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText(/趋势/)).toBeInTheDocument();
    });
  });

  it('应该显示类别评分', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          overallScore: 85,
          trend: 'up',
          statistics: {
            totalChecks: 50,
            passedChecks: 40,
            failedChecks: 5,
            warningChecks: 3,
            pendingChecks: 2,
            byCategory: {},
          },
          recentIssues: [],
          upcomingDeadlines: [],
          categoryScores: {
            legal: 80,
            financial: 90,
            operational: 85,
          },
        },
      }),
    });

    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText(/法律合规/)).toBeInTheDocument();
    });
  });

  it('应该显示即将到期的任务', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          overallScore: 85,
          trend: 'up',
          statistics: {
            totalChecks: 50,
            passedChecks: 40,
            failedChecks: 5,
            warningChecks: 3,
            pendingChecks: 2,
            byCategory: {},
          },
          recentIssues: [],
          upcomingDeadlines: [
            {
              id: 'deadline-001',
              title: '年度合规报告提交',
              dueDate: new Date('2024-12-31').toISOString(),
              priority: 'high',
            },
          ],
          categoryScores: {},
        },
      }),
    });

    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('年度合规报告提交')).toBeInTheDocument();
    });
  });

  it('应该显示最近的合规问题', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          overallScore: 85,
          trend: 'up',
          statistics: {
            totalChecks: 50,
            passedChecks: 40,
            failedChecks: 5,
            warningChecks: 3,
            pendingChecks: 2,
            byCategory: {},
          },
          recentIssues: [
            {
              id: 'issue-001',
              category: 'legal',
              title: '合同条款不完整',
              description: '部分合同缺少必要条款',
              severity: 'high',
              status: 'open',
              identifiedDate: new Date().toISOString(),
              recommendations: ['补充合同条款'],
            },
          ],
          upcomingDeadlines: [],
          categoryScores: {},
        },
      }),
    });

    render(<CompliancePage />);

    await waitFor(() => {
      expect(screen.getByText('合同条款不完整')).toBeInTheDocument();
    });
  });
});
