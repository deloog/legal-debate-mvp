/**
 * 法务报表页面组件测试
 * 测试覆盖率目标：90%+
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportsPage from '@/app/reports/page';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock window.open
global.window.open = jest.fn();

describe('法务报表页面测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'report-001',
          reportType: 'case_statistics',
          title: '案件统计报表',
          generatedAt: new Date().toISOString(),
          period: {
            startDate: new Date('2024-01-01').toISOString(),
            endDate: new Date('2024-12-31').toISOString(),
          },
          filter: {
            reportType: 'case_statistics',
            period: 'last_year',
          },
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
        },
      }),
    });
  });

  it('应该正确渲染页面标题', () => {
    render(<ReportsPage />);
    expect(screen.getByText('法务报表系统')).toBeInTheDocument();
  });

  it('应该显示报表类型选择器', () => {
    render(<ReportsPage />);
    expect(screen.getByLabelText(/报表类型/)).toBeInTheDocument();
  });

  it('应该显示时间范围选择器', () => {
    render(<ReportsPage />);
    expect(screen.getByLabelText(/时间范围/)).toBeInTheDocument();
  });

  it('应该显示生成报表按钮', () => {
    render(<ReportsPage />);
    expect(screen.getByText('生成报表')).toBeInTheDocument();
  });

  it('应该允许选择案件统计报表', async () => {
    render(<ReportsPage />);
    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, {
      target: { value: 'case_statistics' },
    });
    expect(reportTypeSelect).toHaveValue('case_statistics');
  });

  it('应该允许选择费用分析报表', async () => {
    render(<ReportsPage />);
    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, { target: { value: 'cost_analysis' } });
    expect(reportTypeSelect).toHaveValue('cost_analysis');
  });

  it('应该允许选择风险报告', async () => {
    render(<ReportsPage />);
    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, { target: { value: 'risk_report' } });
    expect(reportTypeSelect).toHaveValue('risk_report');
  });

  it('应该允许选择合规报告', async () => {
    render(<ReportsPage />);
    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, {
      target: { value: 'compliance_report' },
    });
    expect(reportTypeSelect).toHaveValue('compliance_report');
  });

  it('应该允许选择时间范围', async () => {
    render(<ReportsPage />);
    const periodSelect = screen.getByLabelText(/时间范围/);
    fireEvent.change(periodSelect, { target: { value: 'last_30_days' } });
    expect(periodSelect).toHaveValue('last_30_days');
  });

  it('应该在选择自定义时间范围时显示日期选择器', async () => {
    render(<ReportsPage />);
    const periodSelect = screen.getByLabelText(/时间范围/);
    fireEvent.change(periodSelect, { target: { value: 'custom' } });

    await waitFor(() => {
      expect(screen.getByLabelText(/开始日期/)).toBeInTheDocument();
      expect(screen.getByLabelText(/结束日期/)).toBeInTheDocument();
    });
  });

  it('应该能够生成报表', async () => {
    render(<ReportsPage />);

    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, {
      target: { value: 'case_statistics' },
    });

    const periodSelect = screen.getByLabelText(/时间范围/);
    fireEvent.change(periodSelect, { target: { value: 'last_year' } });

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('应该显示生成的报表数据', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText('案件统计报表')).toBeInTheDocument();
    });
  });

  it('应该显示案件统计数据', async () => {
    render(<ReportsPage />);

    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, {
      target: { value: 'case_statistics' },
    });

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/总案件数/)).toBeInTheDocument();
      const elements = screen.getAllByText(/100/);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('应该显示导出按钮', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/导出为PDF/)).toBeInTheDocument();
      expect(screen.getByText(/导出为Excel/)).toBeInTheDocument();
      expect(screen.getByText(/导出为CSV/)).toBeInTheDocument();
    });
  });

  it('应该能够导出PDF格式', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/导出为PDF/)).toBeInTheDocument();
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          downloadUrl: '/downloads/report.pdf',
          fileName: 'report.pdf',
        },
      }),
    });

    const exportPdfButton = screen.getByText(/导出为PDF/);
    fireEvent.click(exportPdfButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/export'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('应该能够导出Excel格式', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/导出为Excel/)).toBeInTheDocument();
    });

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          downloadUrl: '/downloads/report.xlsx',
          fileName: 'report.xlsx',
        },
      }),
    });

    const exportExcelButton = screen.getByText(/导出为Excel/);
    fireEvent.click(exportExcelButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/reports/export'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  it('应该显示图表', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/案件类型分布/)).toBeInTheDocument();
    });
  });

  it('应该处理API错误', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: {
          code: 'GENERATE_REPORT_ERROR',
          message: '生成报表失败',
        },
      }),
    });

    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/生成报表失败/)).toBeInTheDocument();
    });
  });

  it('应该处理网络错误', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(
      () => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('应该显示加载状态', async () => {
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

    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    expect(screen.getByText(/生成中/)).toBeInTheDocument();
  });

  it('应该显示报表摘要', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/本年度共处理案件100件/)).toBeInTheDocument();
    });
  });

  it('应该显示建议列表', async () => {
    render(<ReportsPage />);

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/建议加强证据收集/)).toBeInTheDocument();
      expect(screen.getByText(/建议优化案件管理流程/)).toBeInTheDocument();
    });
  });

  it('应该验证必填字段', async () => {
    render(<ReportsPage />);

    // 清空报表类型
    const reportTypeSelect = screen.getByLabelText(/报表类型/);
    fireEvent.change(reportTypeSelect, { target: { value: '' } });

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(
      () => {
        expect(screen.getByText(/请选择报表类型/)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('应该在自定义时间范围时验证日期', async () => {
    render(<ReportsPage />);

    const periodSelect = screen.getByLabelText(/时间范围/);
    fireEvent.change(periodSelect, { target: { value: 'custom' } });

    const generateButton = screen.getByText('生成报表');
    fireEvent.click(generateButton);

    await waitFor(() => {
      expect(screen.getByText(/请选择开始日期和结束日期/)).toBeInTheDocument();
    });
  });
});
