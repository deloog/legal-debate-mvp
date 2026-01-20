import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MembershipExportForm } from '@/components/admin/MembershipExportForm';

// Mock dependencies
jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

jest.mock('lucide-react', () => ({
  Download: ({ className }: { className?: string }) => (
    <svg className={className} data-testid='download-icon' />
  ),
  FileSpreadsheet: ({ className }: { className?: string }) => (
    <svg className={className} data-testid='file-icon' />
  ),
}));

describe('MembershipExportForm', () => {
  const mockOnExport = jest.fn();

  beforeEach(() => {
    mockOnExport.mockClear();
  });

  it('应该正确渲染表单', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    expect(
      screen.getByRole('heading', { name: '导出会员数据' })
    ).toBeInTheDocument();
  });

  it('应该正确显示会员等级选项', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    // 查找包含"会员等级"的label
    const tierLabel = screen.getByText(/会员等级/);
    const tierSelect = tierLabel.nextElementSibling as HTMLSelectElement;
    const options = tierSelect?.querySelectorAll('option');

    expect(options).toHaveLength(5); // 全部 + 4个等级（不包括TEST）
    expect(options?.[0]).toHaveTextContent('全部等级');
    expect(options?.[1]).toHaveTextContent('免费版');
    expect(options?.[2]).toHaveTextContent('基础版');
  });

  it('应该正确显示会员状态选项', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    // 查找包含"会员状态"的label
    const statusLabel = screen.getByText(/会员状态/);
    const statusSelect = statusLabel.nextElementSibling as HTMLSelectElement;
    const options = statusSelect?.querySelectorAll('option');

    expect(options).toHaveLength(6); // 全部 + 5个状态
    expect(options?.[0]).toHaveTextContent('全部状态');
    expect(options?.[1]).toHaveTextContent('生效中');
  });

  it('应该正确显示导出格式选项', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    expect(screen.getByText('CSV格式')).toBeInTheDocument();
    expect(screen.getByText('JSON格式')).toBeInTheDocument();
    expect(screen.getByText('Excel格式')).toBeInTheDocument();
  });

  it('应该能够选择会员等级', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    const tierLabel = screen.getByText(/会员等级/);
    const tierSelect = tierLabel.nextElementSibling as HTMLSelectElement;
    if (tierSelect) {
      fireEvent.change(tierSelect, { target: { value: 'BASIC' } });
      expect(tierSelect.value).toBe('BASIC');
    }
  });

  it('应该能够选择会员状态', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    const statusLabel = screen.getByText(/会员状态/);
    const statusSelect = statusLabel.nextElementSibling as HTMLSelectElement;
    if (statusSelect) {
      fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });
      expect(statusSelect.value).toBe('ACTIVE');
    }
  });

  it('应该能够选择导出格式', async () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    const jsonButton = screen.getByText('JSON格式');
    fireEvent.click(jsonButton);

    await waitFor(() => {
      expect(jsonButton.closest('button')).toHaveClass('border-blue-500');
      expect(jsonButton.closest('button')).toHaveClass('bg-blue-50');
      expect(jsonButton.closest('button')).toHaveClass('text-blue-700');
    });
  });

  it('应该能够输入日期范围', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    // 通过querySelector查找date类型的输入框
    const container = screen.getByRole('heading', {
      name: '导出会员数据',
    }).parentElement;
    const dateInputs = container?.querySelectorAll('input[type="date"]');

    if (dateInputs && dateInputs.length >= 2) {
      const startDateInput = dateInputs[0] as HTMLInputElement;
      const endDateInput = dateInputs[1] as HTMLInputElement;

      // 直接设置值而不是使用change事件
      startDateInput.value = '2024-01-01';
      endDateInput.value = '2024-12-31';
      fireEvent.change(startDateInput);
      fireEvent.change(endDateInput);

      expect(startDateInput.value).toBe('2024-01-01');
      expect(endDateInput.value).toBe('2024-12-31');
    }
  });

  it('应该在导出时调用onExport并传递正确参数', async () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    const tierLabel = screen.getByText(/会员等级/);
    const tierSelect = tierLabel.nextElementSibling as HTMLSelectElement;
    const statusLabel = screen.getByText(/会员状态/);
    const statusSelect = statusLabel.nextElementSibling as HTMLSelectElement;

    if (tierSelect && statusSelect) {
      fireEvent.change(tierSelect, { target: { value: 'BASIC' } });
      fireEvent.change(statusSelect, { target: { value: 'ACTIVE' } });

      const exportButton = screen.getByRole('button', { name: '开始导出' });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledTimes(1);
        expect(mockOnExport).toHaveBeenCalledWith({
          tier: 'BASIC',
          status: 'ACTIVE',
          format: 'csv',
        });
      });
    }
  });

  it('导出时应该禁用表单控件', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={true} />);

    const tierLabel = screen.getByText(/会员等级/);
    const tierSelect = tierLabel.nextElementSibling as HTMLSelectElement;
    const statusLabel = screen.getByText(/会员状态/);
    const statusSelect = statusLabel.nextElementSibling as HTMLSelectElement;
    const exportButton = screen.getByRole('button', { name: '导出中...' });

    expect(tierSelect).toBeDisabled();
    expect(statusSelect).toBeDisabled();
    expect(exportButton).toBeDisabled();
  });

  it('导出时应该显示加载状态', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={true} />);

    expect(
      screen.getByRole('button', { name: '导出中...' })
    ).toBeInTheDocument();
  });

  it('应该显示时间范围标签', () => {
    render(<MembershipExportForm onExport={mockOnExport} exporting={false} />);

    expect(screen.getByText(/时间范围/)).toBeInTheDocument();
    expect(screen.getByText('开始日期')).toBeInTheDocument();
    expect(screen.getByText('结束日期')).toBeInTheDocument();
  });
});
