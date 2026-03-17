import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  // 注意：组件的 label 没有 htmlFor 属性，所以不能用 getByLabelText。
  // 使用 getByPlaceholderText / getByRole / getByDisplayValue 等方式查询。

  describe('基础渲染', () => {
    it('应该渲染表单元素', () => {
      render(
        <CommunicationRecordForm
          clientId={mockClientId}
          onSuccess={mockOnSuccess}
          onCancel={mockOnCancel}
        />
      );

      // label 文本存在
      expect(screen.getByText(/沟通类型/)).toBeInTheDocument();
      expect(screen.getByText(/^摘要/)).toBeInTheDocument();
      expect(screen.getByText(/详细内容/)).toBeInTheDocument();
      expect(screen.getByText(/下次跟进时间/)).toBeInTheDocument();
      expect(screen.getByText(/标记为重要/)).toBeInTheDocument();
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

      // 默认沟通类型为"电话"
      expect(screen.getByDisplayValue('电话')).toBeInTheDocument();
      // 重要标记 checkbox 默认未选中
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();
    });
  });

  describe('编辑模式', () => {
    // 使用 UTC 时间字符串，避免时区影响 toISOString() 结果
    const editDate = new Date('2026-01-25T10:00:00Z');
    const mockEditingRecord = {
      id: 'comm-123',
      type: CommunicationType.EMAIL,
      summary: '测试摘要',
      content: '测试内容',
      nextFollowUpDate: editDate,
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
      // datetime-local 的值是 editDate.toISOString().slice(0, 16)
      const expectedDateStr = editDate.toISOString().slice(0, 16);
      expect(screen.getByDisplayValue(expectedDateStr)).toBeInTheDocument();
      // 重要标记已选中
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
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

      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
      // input 有 maxLength=1000，用 fireEvent.change 直接绕过 maxLength 限制设置超长值
      const longSummary = 'a'.repeat(1001);
      fireEvent.change(summaryInput, { target: { value: longSummary } });

      // 验证是在 submit 时触发的
      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

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

      const contentInput =
        screen.getByPlaceholderText('请输入详细内容（可选）');
      // textarea 有 maxLength=10000，用 fireEvent.change 直接绕过 maxLength 限制设置超长值
      const longContent = 'b'.repeat(10001);
      fireEvent.change(contentInput, { target: { value: longContent } });

      // 验证是在 submit 时触发的，还需要填写摘要（否则先报摘要错误）
      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
      fireEvent.change(summaryInput, { target: { value: '有效摘要' } });

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

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

      // 用 type=datetime-local 属性定位
      const dateInput = document.querySelector(
        'input[type="datetime-local"]'
      ) as HTMLInputElement;
      expect(dateInput).toBeTruthy();

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateStr = pastDate.toISOString().slice(0, 16);

      // 用 fireEvent.change 直接设置 datetime-local 的值
      fireEvent.change(dateInput, { target: { value: pastDateStr } });

      // 填写摘要，让表单可以 submit
      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
      fireEvent.change(summaryInput, { target: { value: '有效摘要' } });

      const submitButton = screen.getByRole('button', { name: '保存' });
      await userEvent.click(submitButton);

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

      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
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

      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
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

      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
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

      const summaryInput = screen.getByPlaceholderText('请输入沟通摘要');
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

      // 通过 combobox role 找到 select（表单中唯一的 select）
      const typeSelect = screen.getByRole('combobox');
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

      const importantCheckbox = screen.getByRole('checkbox');
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

      // 用 type 属性定位 datetime-local 输入框
      const dateInput = document.querySelector(
        'input[type="datetime-local"]'
      ) as HTMLInputElement;
      expect(dateInput).toBeTruthy();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const futureDateStr = futureDate.toISOString().slice(0, 16);

      await userEvent.type(dateInput, futureDateStr);

      expect(dateInput).toHaveValue(futureDateStr);
    });
  });
});
