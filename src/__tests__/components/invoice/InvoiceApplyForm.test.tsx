/**
 * @jest-environment jsdom
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { InvoiceApplyForm } from '@/components/invoice/InvoiceApplyForm';
import { InvoiceType } from '@/types/payment';

// Mock AuthProvider
jest.mock('@/app/providers/AuthProvider', () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: 'user123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'LAWYER',
      createdAt: new Date(),
    },
    loading: false,
    checkAuth: jest.fn(),
    logout: jest.fn(),
  })),
}));

// Mock next/navigation
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: mockPush,
    back: mockBack,
  })),
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('InvoiceApplyForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('表单渲染', () => {
    it('应该正确渲染表单组件', () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      expect(screen.getByText('申请发票')).toBeInTheDocument();
      expect(screen.getByText('订单编号：')).toBeInTheDocument();
      expect(screen.getByText('order123')).toBeInTheDocument();
      expect(screen.getByText('开票金额：')).toBeInTheDocument();
      expect(screen.getByText('¥99.99')).toBeInTheDocument();
    });

    it('应该显示发票类型选项', () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      expect(screen.getByText('个人发票')).toBeInTheDocument();
      expect(screen.getByText('企业发票')).toBeInTheDocument();
    });

    it('应该预填充用户邮箱', () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const emailInput = screen.getByPlaceholderText('发票将发送到此邮箱');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('应该显示温馨提示', () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      expect(screen.getByText('温馨提示：')).toBeInTheDocument();
      expect(
        screen.getByText('发票将在1-3个工作日内开具完成')
      ).toBeInTheDocument();
    });

    it('应该有提交和取消按钮', () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      expect(screen.getByText('提交申请')).toBeInTheDocument();
      expect(screen.getByText('取消')).toBeInTheDocument();
    });
  });

  describe('发票类型切换', () => {
    it('初始状态下不应显示企业发票字段', () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      expect(
        screen.queryByPlaceholderText('请输入企业名称或单位名称')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByPlaceholderText('请输入15-20位税号')
      ).not.toBeInTheDocument();
    });

    it('切换到企业发票应显示企业发票字段', async () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const enterpriseRadio = screen.getByLabelText('企业发票');
      fireEvent.click(enterpriseRadio);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('请输入企业名称或单位名称')
        ).toBeInTheDocument();
        expect(
          screen.getByPlaceholderText('请输入15-20位税号')
        ).toBeInTheDocument();
      });
    });
  });

  describe('表单验证', () => {
    it('个人发票提交时应验证邮箱', async () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const emailInput = screen.getByPlaceholderText('发票将发送到此邮箱');
      await act(async () => {
        fireEvent.change(emailInput, { target: { value: '' } });
      });

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('接收邮箱不能为空')).toBeInTheDocument();
      });
    });

    it('企业发票提交时应验证发票抬头', async () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const enterpriseRadio = screen.getByLabelText('企业发票');
      await act(async () => {
        fireEvent.click(enterpriseRadio);
      });

      await waitFor(() => {
        const titleInput =
          screen.getByPlaceholderText('请输入企业名称或单位名称');
        return expect(titleInput).toBeInTheDocument();
      });

      const titleInput =
        screen.getByPlaceholderText('请输入企业名称或单位名称');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: '' } });
      });

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('发票抬头不能为空')).toBeInTheDocument();
      });
    });

    it('企业发票提交时应验证税号', async () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const enterpriseRadio = screen.getByLabelText('企业发票');
      await act(async () => {
        fireEvent.click(enterpriseRadio);
      });

      await waitFor(() => {
        const titleInput =
          screen.getByPlaceholderText('请输入企业名称或单位名称');
        expect(titleInput).toBeInTheDocument();
      });

      const titleInput =
        screen.getByPlaceholderText('请输入企业名称或单位名称');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: '测试企业' } });
      });

      const taxNumberInput = screen.getByPlaceholderText('请输入15-20位税号');
      await act(async () => {
        fireEvent.change(taxNumberInput, { target: { value: '' } });
      });

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('税号不能为空')).toBeInTheDocument();
      });
    });

    it('企业发票提交时应验证税号格式', async () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const enterpriseRadio = screen.getByLabelText('企业发票');
      await act(async () => {
        fireEvent.click(enterpriseRadio);
      });

      await waitFor(() => {
        const titleInput =
          screen.getByPlaceholderText('请输入企业名称或单位名称');
        expect(titleInput).toBeInTheDocument();
      });

      const titleInput =
        screen.getByPlaceholderText('请输入企业名称或单位名称');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: '测试企业' } });
      });

      const taxNumberInput = screen.getByPlaceholderText('请输入15-20位税号');
      await act(async () => {
        fireEvent.change(taxNumberInput, { target: { value: '123' } });
      });

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText('税号格式不正确，应为15-20位数字或字母')
        ).toBeInTheDocument();
      });
    });

    it('发票抬头超过100个字符应显示错误', async () => {
      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const enterpriseRadio = screen.getByLabelText('企业发票');
      await act(async () => {
        fireEvent.click(enterpriseRadio);
      });

      await waitFor(() => {
        const titleInput =
          screen.getByPlaceholderText('请输入企业名称或单位名称');
        expect(titleInput).toBeInTheDocument();
      });

      const longTitle = 'a'.repeat(101);

      const titleInput =
        screen.getByPlaceholderText('请输入企业名称或单位名称');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: longTitle } });
      });

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText('发票抬头不能超过100个字符')
        ).toBeInTheDocument();
      });
    });
  });

  describe('API调用', () => {
    it('个人发票提交应调用正确的API参数', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'invoice123' },
        }),
      });

      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/invoices/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: 'order123',
            type: InvoiceType.PERSONAL,
            title: undefined,
            taxNumber: undefined,
            email: 'test@example.com',
          }),
        });
      });
    });

    it('企业发票提交应包含企业信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'invoice123' },
        }),
      });

      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const enterpriseRadio = screen.getByLabelText('企业发票');
      await act(async () => {
        fireEvent.click(enterpriseRadio);
      });

      await waitFor(() => {
        const titleInput =
          screen.getByPlaceholderText('请输入企业名称或单位名称');
        expect(titleInput).toBeInTheDocument();
      });

      const titleInput =
        screen.getByPlaceholderText('请输入企业名称或单位名称');
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: '测试企业' } });
      });

      const taxNumberInput = screen.getByPlaceholderText('请输入15-20位税号');
      await act(async () => {
        fireEvent.change(taxNumberInput, {
          target: { value: '123456789012345678' },
        });
      });

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/invoices/apply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: 'order123',
            type: InvoiceType.ENTERPRISE,
            title: '测试企业',
            taxNumber: '123456789012345678',
            email: 'test@example.com',
          }),
        });
      });
    });

    it('API调用失败应显示错误信息', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({
          message: '订单不存在',
        }),
      });

      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('申请失败')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('订单不存在')).toBeInTheDocument();
      });
    });

    it('网络错误应显示默认错误信息', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('申请失败')).toBeInTheDocument();
      });

      await waitFor(() => {
        const errorDiv = screen.getByText('Network error');
        expect(errorDiv).toBeInTheDocument();
        expect(errorDiv).toHaveClass('text-red-800');
      });
    });
  });

  describe('加载状态', () => {
    it('提交成功后应显示成功状态', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'invoice123' },
        }),
      });

      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // 等待API调用完成
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // 运行定时器以触发setTimeout
      act(() => {
        jest.runOnlyPendingTimers();
      });

      await waitFor(() => {
        expect(screen.getByText('申请成功')).toBeInTheDocument();
      });
    });

    it('提交成功后应调用router.push跳转', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { id: 'invoice123' },
        }),
      });

      render(<InvoiceApplyForm orderId='order123' orderAmount={99.99} />);

      const submitButton = screen.getByText('提交申请');
      await act(async () => {
        fireEvent.click(submitButton);
      });

      // 等待API调用完成
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      // 运行所有定时器
      act(() => {
        jest.runAllTimers();
      });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/invoices/apply/success?invoiceId=invoice123'
        );
      });
    });
  });
});
