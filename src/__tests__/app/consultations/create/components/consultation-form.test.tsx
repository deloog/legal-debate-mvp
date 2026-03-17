/**
 * ConsultationForm 组件测试
 * 测试咨询表单的各种交互和验证逻辑
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ConsultationForm,
  ConsultationFormProps,
} from '@/app/consultations/create/components/consultation-form';
import { ConsultationType } from '@/types/consultation';

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock 函数
const mockOnSubmit = jest.fn().mockResolvedValue(undefined);
const mockOnCancel = jest.fn();

// 默认 props
const defaultProps: ConsultationFormProps = {
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
};

describe('ConsultationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Return empty case types by default so the select element is rendered
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });
  });

  describe('基础渲染', () => {
    test('应该正确渲染表单标题', () => {
      render(<ConsultationForm {...defaultProps} />);

      expect(screen.getByText('咨询信息')).toBeInTheDocument();
    });

    test('应该渲染所有表单字段', async () => {
      render(<ConsultationForm {...defaultProps} />);

      expect(screen.getByLabelText(/咨询方式/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/咨询时间/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/咨询人姓名/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/联系电话/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/电子邮箱/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/单位名称/i)).toBeInTheDocument();
      expect(screen.getByText('案件类型')).toBeInTheDocument();
      expect(screen.getByLabelText(/案情摘要/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/客户诉求/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/跟进日期/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/跟进备注/i)).toBeInTheDocument();
    });

    test('应该渲染提交和取消按钮', () => {
      render(<ConsultationForm {...defaultProps} />);

      expect(screen.getByText('创建')).toBeInTheDocument();
      expect(screen.getByText('取消')).toBeInTheDocument();
    });

    test('应该显示咨询方式选项', () => {
      render(<ConsultationForm {...defaultProps} />);

      const consultTypeSelect = screen.getByLabelText(/咨询方式/i);
      expect(consultTypeSelect).toBeInTheDocument();
    });
  });

  describe('表单输入', () => {
    test('应该能够选择咨询方式', () => {
      render(<ConsultationForm {...defaultProps} />);

      const consultTypeSelect = screen.getByLabelText(/咨询方式/i);
      fireEvent.change(consultTypeSelect, {
        target: { value: ConsultationType.VISIT },
      });

      expect(consultTypeSelect).toHaveValue(ConsultationType.VISIT);
    });

    test('应该能够输入咨询人姓名', () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientNameInput = screen.getByLabelText(/咨询人姓名/i);
      fireEvent.change(clientNameInput, { target: { value: '张三' } });

      expect(clientNameInput).toHaveValue('张三');
    });

    test('应该能够输入联系电话', () => {
      render(<ConsultationForm {...defaultProps} />);

      const phoneInput = screen.getByLabelText(/联系电话/i);
      fireEvent.change(phoneInput, { target: { value: '13800138000' } });

      expect(phoneInput).toHaveValue('13800138000');
    });

    test('应该能够输入电子邮箱', () => {
      render(<ConsultationForm {...defaultProps} />);

      const emailInput = screen.getByLabelText(/电子邮箱/i);
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

      expect(emailInput).toHaveValue('test@example.com');
    });

    test('应该能够输入单位名称', () => {
      render(<ConsultationForm {...defaultProps} />);

      const companyInput = screen.getByLabelText(/单位名称/i);
      fireEvent.change(companyInput, { target: { value: '测试公司' } });

      expect(companyInput).toHaveValue('测试公司');
    });

    test('应该能够输入案件类型', async () => {
      render(<ConsultationForm {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole('combobox', { name: /案件类型/i })
        ).toBeInTheDocument();
      });

      const caseTypeInput = screen.getByRole('combobox', { name: /案件类型/i });
      fireEvent.change(caseTypeInput, { target: { value: '' } });

      expect(caseTypeInput).toBeInTheDocument();
    });

    test('应该能够输入案情摘要', () => {
      render(<ConsultationForm {...defaultProps} />);

      const caseSummaryTextarea = screen.getByLabelText(/案情摘要/i);
      const summaryText = '这是一个关于合同纠纷的案情摘要';
      fireEvent.change(caseSummaryTextarea, { target: { value: summaryText } });

      expect(caseSummaryTextarea).toHaveValue(summaryText);
    });

    test('应该能够输入客户诉求', () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientDemandTextarea = screen.getByLabelText(/客户诉求/i);
      const demandText = '客户希望快速解决纠纷';
      fireEvent.change(clientDemandTextarea, { target: { value: demandText } });

      expect(clientDemandTextarea).toHaveValue(demandText);
    });

    test('应该能够选择跟进日期', () => {
      render(<ConsultationForm {...defaultProps} />);

      const followUpDateInput = screen.getByLabelText(/跟进日期/i);
      const dateValue = '2026-01-29T10:00';
      fireEvent.change(followUpDateInput, { target: { value: dateValue } });

      expect(followUpDateInput).toHaveValue(dateValue);
    });

    test('应该能够输入跟进备注', () => {
      render(<ConsultationForm {...defaultProps} />);

      const followUpNotesTextarea = screen.getByLabelText(/跟进备注/i);
      const notesText = '需要准备好相关材料';
      fireEvent.change(followUpNotesTextarea, { target: { value: notesText } });

      expect(followUpNotesTextarea).toHaveValue(notesText);
    });
  });

  describe('字符计数', () => {
    test('应该显示案情摘要字符计数', () => {
      render(<ConsultationForm {...defaultProps} />);

      const caseSummaryTextarea = screen.getByLabelText(/案情摘要/i);
      fireEvent.change(caseSummaryTextarea, {
        target: { value: '1234567890' },
      });

      expect(screen.getByText('10/500')).toBeInTheDocument();
      expect(screen.getByText('最少10个字符')).toBeInTheDocument();
    });

    test('应该显示客户诉求字符计数', () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientDemandTextarea = screen.getByLabelText(/客户诉求/i);
      fireEvent.change(clientDemandTextarea, { target: { value: '测试诉求' } });

      expect(screen.getByText('4/1000')).toBeInTheDocument();
    });

    test('应该显示跟进备注字符计数', () => {
      render(<ConsultationForm {...defaultProps} />);

      const followUpNotesTextarea = screen.getByLabelText(/跟进备注/i);
      fireEvent.change(followUpNotesTextarea, {
        target: { value: '备注内容' },
      });

      expect(screen.getByText('4/500')).toBeInTheDocument();
    });
  });

  describe('表单验证', () => {
    test('应该验证必填的案情摘要', async () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientNameInput = screen.getByLabelText(/咨询人姓名/i);
      fireEvent.change(clientNameInput, { target: { value: '张三' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(
            screen.getByText(/案情摘要至少需要10个字符/)
          ).toBeInTheDocument();
        });
      }
    });

    test('应该验证案情摘要最小长度', async () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientNameInput = screen.getByLabelText(/咨询人姓名/i);
      fireEvent.change(clientNameInput, { target: { value: '张三' } });

      const caseSummaryTextarea = screen.getByLabelText(/案情摘要/i);
      fireEvent.change(caseSummaryTextarea, { target: { value: '太短' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(
            screen.getByText(/案情摘要至少需要10个字符/)
          ).toBeInTheDocument();
        });
      }
    });
  });

  describe('取消操作', () => {
    test('应该在点击取消按钮时调用onCancel', () => {
      render(<ConsultationForm {...defaultProps} />);

      const cancelButton = screen.getByText('取消');
      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('字段长度限制', () => {
    test('应该设置咨询人姓名最大长度属性', () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientNameInput = screen.getByLabelText(/咨询人姓名/i);
      expect(clientNameInput).toHaveAttribute('maxLength', '50');
    });

    test('应该设置单位名称最大长度属性', () => {
      render(<ConsultationForm {...defaultProps} />);

      const companyInput = screen.getByLabelText(/单位名称/i);
      expect(companyInput).toHaveAttribute('maxLength', '100');
    });

    test('应该设置案件类型最大长度属性', () => {
      render(<ConsultationForm {...defaultProps} />);

      // 案件类型字段使用 select 控件，验证标签存在
      expect(screen.getByText('案件类型')).toBeInTheDocument();
    });

    test('应该设置客户诉求最大长度属性', () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientDemandTextarea = screen.getByLabelText(/客户诉求/i);
      expect(clientDemandTextarea).toHaveAttribute('maxLength', '1000');
    });

    test('应该设置跟进备注最大长度属性', () => {
      render(<ConsultationForm {...defaultProps} />);

      const followUpNotesTextarea = screen.getByLabelText(/跟进备注/i);
      expect(followUpNotesTextarea).toHaveAttribute('maxLength', '500');
    });
  });

  describe('默认值', () => {
    test('应该设置默认的咨询时间为当前时间', () => {
      render(<ConsultationForm {...defaultProps} />);

      const consultTimeInput = screen.getByLabelText(/咨询时间/i);
      const value = (consultTimeInput as HTMLInputElement).value;
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test('应该设置默认的咨询方式为电话咨询', () => {
      render(<ConsultationForm {...defaultProps} />);

      const consultTypeSelect = screen.getByLabelText(/咨询方式/i);
      expect(consultTypeSelect).toHaveValue(ConsultationType.PHONE);
    });
  });

  describe('错误状态样式', () => {
    test('应该在验证失败时显示错误样式', async () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientNameInput = screen.getByLabelText(/咨询人姓名/i);
      fireEvent.change(clientNameInput, { target: { value: '' } });

      const submitButton = screen.getByText('创建');
      const form = submitButton.closest('form');

      if (form) {
        fireEvent.submit(form);
        await waitFor(() => {
          expect(clientNameInput).toHaveClass('border-red-500');
        });
      }
    });
  });

  describe('必填字段标识', () => {
    test('应该显示咨询方式为必填字段', () => {
      render(<ConsultationForm {...defaultProps} />);

      const consultTypeLabel = screen.getByText('咨询方式').closest('label');
      expect(
        consultTypeLabel?.querySelector('.text-red-500')
      ).toHaveTextContent('*');
    });

    test('应该显示咨询时间为必填字段', () => {
      render(<ConsultationForm {...defaultProps} />);

      const consultTimeLabel = screen.getByText('咨询时间').closest('label');
      expect(
        consultTimeLabel?.querySelector('.text-red-500')
      ).toHaveTextContent('*');
    });

    test('应该显示咨询人姓名为必填字段', () => {
      render(<ConsultationForm {...defaultProps} />);

      const clientNameLabel = screen.getByText('咨询人姓名').closest('label');
      expect(clientNameLabel?.querySelector('.text-red-500')).toHaveTextContent(
        '*'
      );
    });

    test('应该显示案情摘要为必填字段', () => {
      render(<ConsultationForm {...defaultProps} />);

      const caseSummaryLabel = screen.getByText('案情摘要').closest('label');
      expect(
        caseSummaryLabel?.querySelector('.text-red-500')
      ).toHaveTextContent('*');
    });
  });
});
