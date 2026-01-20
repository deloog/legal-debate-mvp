import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommunicationRecordForm } from '../../../components/client/CommunicationRecordForm';
import { CommunicationType } from '../../../types/client';

describe('CommunicationRecordForm', () => {
  const mockClientId = 'client-123';
  const mockOnSuccess = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('基础渲染', () => {
    it('应该渲染表单元素', () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/沟通类型/)).toBeInTheDocument();
      expect(screen.getByLabelText(/摘要/)).toBeInTheDocument();
      expect(screen.getByLabelText(/详细内容/)).toBeInTheDocument();
      expect(screen.getByLabelText(/下次跟进时间/)).toBeInTheDocument();
      expect(screen.getByLabelText(/标记为重要/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    });

    it('应该显示正确的默认值', () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue('电话')).toBeInTheDocument();
      expect(screen.getByLabelText(/标记为重要/)).not.toBeChecked();
    });
  });

  describe('编辑模式', () => {
    const mockEditingRecord = {
      id: 'comm-123',
      type: CommunicationType.EMAIL,
      summary: '测试摘要',
      content: '测试内容',
      nextFollowUpDate: new Date('2026-01-25T10:00:00'),
      isImportant: true,
    };

    it('应该在编辑模式下显示现有值', () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
          editingRecord={mockEditingRecord}
        />
      );

      expect(screen.getByDisplayValue('邮件')).toBeInTheDocument();
      expect(screen.getByDisplayValue('测试摘要')).toBeInTheDocument();
      expect(screen.getByDisplayValue('测试内容')).toBeInTheDocument();
      expect(screen.getByLabelText(/下次跟进时间/)).toHaveValue(
        '2026-01-25T10:00'
      );
      expect(screen.getByLabelText(/标记为重要/)).toBeChecked();
      expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument();
    });
  });

  describe('表单验证', () => {
    it('应该在提交空摘要时显示错误', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('摘要不能为空')).toBeInTheDocument();
      });
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('应该在摘要超过1000字时显示错误', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByLabelText(/摘要/);
      const longSummary = 'a'.repeat(1001);
      await userEvent.clear(summaryInput);
      await userEvent.type(summaryInput, longSummary);

      await waitFor(() => {
        expect(screen.getByText('摘要不能超过1000字')).toBeInTheDocument();
      });
    });

    it('应该在内容超过10000字时显示错误', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const contentInput = screen.getByLabelText(/详细内容/);
      const longContent = 'b'.repeat(10001);
      await userEvent.type(contentInput, longContent);

      await waitFor(() => {
        expect(screen.getByText('内容不能超过10000字')).toBeInTheDocument();
      });
    });

    it('应该在跟进日期早于当前时间时显示错误', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const dateInput = screen.getByLabelText(/下次跟进时间/);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().slice(0, 16);

      await userEvent.type(dateInput, pastDateStr);

      await waitFor(() => {
        expect(
          screen.getByText('跟进日期不能早于当前时间')
        ).toBeInTheDocument();
      });
    });

    it('应该在有效表单时通过验证', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'new-comm-123' }),
        })
      ) as jest.Mock;

      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByLabelText(/摘要/);
      await userEvent.type(summaryInput, '测试摘要');

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.queryByText('摘要不能为空')).not.toBeInTheDocument();
      });
    });
  });

  describe('表单提交', () => {
    beforeEach(() => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: 'new-comm-123' }),
        })
      ) as jest.Mock;
    });

    it('应该在成功时调用onSuccess', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByLabelText(/摘要/);
      await userEvent.type(summaryInput, '测试摘要');

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });
    });

    it('应该在失败时显示错误提示', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('网络错误'));

      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByLabelText(/摘要/);
      await userEvent.type(summaryInput, '测试摘要');

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('提交失败，请重试');
      });

      alertSpy.mockRestore();
    });

    it('应该在提交时显示加载状态', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const summaryInput = screen.getByLabelText(/摘要/);
      await userEvent.type(summaryInput, '测试摘要');

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: '提交中...' })
        ).toBeInTheDocument();
      });
    });
  });

  describe('取消操作', () => {
    it('应该在点击取消按钮时调用onCancel', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: '取消' });
      await userEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('沟通类型选择', () => {
    it('应该支持选择所有沟通类型', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const typeSelect = screen.getByLabelText(/沟通类型/);
      await userEvent.selectOptions(typeSelect, '邮件');

      expect(screen.getByDisplayValue('邮件')).toBeInTheDocument();
    });
  });

  describe('重要性标记', () => {
    it('应该支持标记为重要', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const importantCheckbox = screen.getByLabelText(/标记为重要/);
      await userEvent.click(importantCheckbox);

      expect(importantCheckbox).toBeChecked();
    });
  });

  describe('日期选择', () => {
    it('应该支持选择跟进日期', async () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      const dateInput = screen.getByLabelText(/下次跟进时间/);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().slice(0, 16);

      await userEvent.type(dateInput, futureDateStr);

      expect(dateInput).toHaveValue(futureDateStr);
    });
  });
});
