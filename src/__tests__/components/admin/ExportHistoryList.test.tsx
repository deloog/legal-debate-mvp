import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExportHistoryList } from '@/components/admin/ExportHistoryList';

// Mock dependencies
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
    variant,
    size,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

jest.mock('lucide-react', () => ({
  Clock: ({ className }: { className?: string }) => (
    <svg className={className} data-testid='clock-icon' />
  ),
  Download: ({ className }: { className?: string }) => (
    <svg className={className} data-testid='download-icon' />
  ),
  FileText: ({ className }: { className?: string }) => (
    <svg className={className} data-testid='file-icon' />
  ),
}));

describe('ExportHistoryList', () => {
  const mockHistory = [
    {
      id: '1',
      fileName: 'memberships_2024_01_01.csv',
      format: 'csv',
      recordCount: 150,
      filters: {
        tier: 'BASIC',
        status: 'ACTIVE',
      },
      exportedAt: new Date('2024-01-01T10:00:00Z'),
      fileUrl: '/api/export/1',
    },
    {
      id: '2',
      fileName: 'memberships_2024_02_01.json',
      format: 'json',
      recordCount: 200,
      filters: {},
      exportedAt: new Date('2024-02-01T10:00:00Z'),
      fileUrl: '/api/export/2',
    },
  ];

  it('应该正确渲染加载状态', () => {
    render(<ExportHistoryList history={[]} loading={true} />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
    expect(screen.getByText('导出历史')).toBeInTheDocument();
  });

  it('应该正确渲染空状态', () => {
    render(<ExportHistoryList history={[]} loading={false} />);

    expect(screen.getByText('暂无导出历史')).toBeInTheDocument();
    expect(screen.getByText('导出历史')).toBeInTheDocument();
  });

  it('应该正确渲染导出历史列表', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    expect(screen.getByText('导出历史')).toBeInTheDocument();
    expect(screen.getByText('memberships_2024_01_01.csv')).toBeInTheDocument();
    expect(screen.getByText('memberships_2024_02_01.json')).toBeInTheDocument();
  });

  it('应该正确显示导出记录数量', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    expect(screen.getByText('150 条记录')).toBeInTheDocument();
    expect(screen.getByText('200 条记录')).toBeInTheDocument();
  });

  it('应该正确显示导出格式', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
  });

  it('应该正确显示筛选条件', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    expect(screen.getByText(/等级:/)).toBeInTheDocument();
    expect(screen.getByText(/状态:/)).toBeInTheDocument();
  });

  it('应该为每个记录显示下载按钮', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    const downloadButtons = screen.getAllByText('下载');
    expect(downloadButtons).toHaveLength(2);
  });

  it('当没有fileURL时应该隐藏下载按钮', () => {
    const historyWithoutUrl = mockHistory.map(item => ({
      ...item,
      fileUrl: undefined,
    }));

    render(<ExportHistoryList history={historyWithoutUrl} loading={false} />);

    expect(screen.queryByText('下载')).not.toBeInTheDocument();
  });

  it('应该正确格式化导出时间', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    // formatDate返回中文格式的日期时间，如 "2024/01/01 18:00"
    expect(screen.getByText('2024/01/01 18:00')).toBeInTheDocument();
    expect(screen.getByText('2024/02/01 18:00')).toBeInTheDocument();
  });

  it('应该处理没有筛选条件的记录', () => {
    const recordWithoutFilters = [
      {
        ...mockHistory[0],
        filters: {},
      },
    ];

    render(
      <ExportHistoryList history={recordWithoutFilters} loading={false} />
    );

    expect(screen.getByText('筛选: 全部数据')).toBeInTheDocument();
  });

  it('应该显示带筛选条件的记录', () => {
    render(<ExportHistoryList history={mockHistory} loading={false} />);

    // 第一个记录有tier和status筛选
    expect(screen.getByText(/等级:BASIC/)).toBeInTheDocument();
    expect(screen.getByText(/状态:ACTIVE/)).toBeInTheDocument();
  });
});
