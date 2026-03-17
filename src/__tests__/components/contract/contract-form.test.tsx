/**
 * 合同表单组件测试
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContractForm from '@/app/contracts/new/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('ContractForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该渲染所有表单字段', () => {
    render(<ContractForm />);

    expect(screen.getByText(/委托人类型/)).toBeInTheDocument();
    // 初始 clientType=INDIVIDUAL，label 显示"姓名"
    expect(screen.getByText(/^姓名/)).toBeInTheDocument();
    expect(
      screen.getByText(/案件类型/, { selector: 'label' })
    ).toBeInTheDocument();
    expect(screen.getByText(/律师费总额/)).toBeInTheDocument();
  });

  it('应该验证必填字段', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: { message: '委托人姓名不能为空' },
      }),
    });

    render(<ContractForm />);

    // 使用 fireEvent.submit 绕过 HTML5 required 验证，直接触发 onSubmit 处理器
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/委托人姓名不能为空/i)).toBeInTheDocument();
    });
  });

  it('应该正确提交表单数据', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'contract-1' },
      }),
    });

    render(<ContractForm />);

    // 使用 fireEvent.submit 绕过 HTML5 required 验证
    const form = document.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/contracts',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });
});
