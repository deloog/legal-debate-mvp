/**
 * CaseAnalytics组件测试
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CaseAnalytics } from '@/components/analytics/case/CaseAnalytics';
import type { CaseAnalyticsData } from '@/types/stats';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('CaseAnalytics组件', () => {
  const mockData: CaseAnalyticsData = {
    typeDistribution: {
      distribution: [
        { type: '民事', count: 10, percentage: 50 },
        { type: '刑事', count: 10, percentage: 50 },
      ],
      summary: {
        totalCases: 20,
        completedCases: 10,
        activeCases: 10,
      },
      metadata: {
        timeRange: 'LAST_30_DAYS' as any,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    },
    efficiency: {
      trend: [
        {
          date: '2024-01-01',
          completedCases: 1,
          averageCompletionTime: 15,
          medianCompletionTime: 14,
        },
      ],
      summary: {
        totalCompletedCases: 10,
        averageCompletionTime: 15,
        medianCompletionTime: 14,
        fastestCompletionTime: 5,
        slowestCompletionTime: 30,
      },
      metadata: {
        timeRange: 'LAST_30_DAYS' as any,
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      },
    },
    successRate: {
      totalCases: 20,
      successfulCases: 15,
      successRate: 75,
      byType: [
        { type: '民事', totalCases: 10, successfulCases: 8, successRate: 80 },
        { type: '刑事', totalCases: 10, successfulCases: 7, successRate: 70 },
      ],
      byCause: [],
      trend: [
        {
          date: '2024-01-01',
          totalCases: 1,
          successfulCases: 1,
          successRate: 100,
        },
      ],
    },
    revenueAnalysis: {
      totalRevenue: 100000,
      averageRevenue: 5000,
      maxRevenue: 10000,
      minRevenue: 1000,
      byType: [
        {
          type: '民事',
          totalRevenue: 50000,
          averageRevenue: 5000,
          caseCount: 10,
          percentage: 50,
        },
      ],
      trend: [
        {
          date: '2024-01-01',
          revenue: 10000,
          caseCount: 2,
          averageRevenue: 5000,
        },
      ],
    },
    activeCasesOverview: {
      totalActiveCases: 10,
      averageDuration: 15,
      expiringSoon: 5,
      newThisMonth: 10,
    },
    metadata: {
      timeRange: 'LAST_30_DAYS' as any,
      startDate: '2024-01-01',
      endDate: '2024-01-31',
      generatedAt: '2024-01-31T12:00:00Z',
      dataPoints: 10,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it('应该渲染加载状态', () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(() => resolve({ ok: true } as Response), 100);
        })
    );

    render(<CaseAnalytics />);
    expect(screen.getByText(/加载案件分析数据/i)).toBeInTheDocument();
  });

  it('应该渲染案件分析数据', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    render(<CaseAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('案件分析')).toBeInTheDocument();
    });
  });

  it('应该渲染日期范围', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    render(<CaseAnalytics startDate='2024-01-01' endDate='2024-01-31' />);

    await waitFor(() => {
      expect(screen.getByText(/2024\/1\/1/)).toBeInTheDocument();
    });
  });

  it('应该处理错误状态', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(
      new Error('网络错误')
    );

    render(<CaseAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });
  });

  it('应该使用正确的API端点', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    render(<CaseAnalytics />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/cases')
      );
    });
  });

  it('应该渲染案件效率趋势图表', async () => {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response);

    render(<CaseAnalytics />);

    await waitFor(() => {
      expect(screen.getByText('案件完成时间趋势（小时）')).toBeInTheDocument();
    });
  });
});
