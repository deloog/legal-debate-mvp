/**
 * 合同表单组件测试
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractForm from '@/app/contracts/new/page';

describe('ContractForm', () => {
  it('应该渲染所有表单字段', () => {
    render(<ContractForm />);

    expect(screen.getByLabelText(/委托人类型/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/委托人姓名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/案件类型/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/律师费总额/i)).toBeInTheDocument();
  });

  it('应该验证必填字段', async () => {
    render(<ContractForm />);

    const submitButton = screen.getByRole('button', { name: /创建合同/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/委托人姓名不能为空/i)).toBeInTheDocument();
    });
  });

  it('应该正确提交表单数据', async () => {
    const mockSubmit = jest.fn();
    // ContractForm 是一个页面组件，不接受 onSubmit 属性
    // 这个测试需要重新设计或删除
    render(<ContractForm />);

    // 填写表单
    fireEvent.change(screen.getByLabelText(/委托人姓名/i), {
      target: { value: '张三' },
    });
    fireEvent.change(screen.getByLabelText(/律师费总额/i), {
      target: { value: '10000' },
    });

    // 提交表单
    const submitButton = screen.getByRole('button', { name: /创建合同/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          clientName: '张三',
          totalFee: 10000,
        })
      );
    });
  });
});
