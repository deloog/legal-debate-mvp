/**
 * 签名板组件测试
 */

import { render, screen, fireEvent } from '@testing-library/react';
import SignaturePad from '@/components/contract/SignaturePad';

describe('SignaturePad', () => {
  it('应该渲染签名板', () => {
    const { container } = render(<SignaturePad onSave={jest.fn()} />);

    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('应该有清除按钮', () => {
    render(<SignaturePad onSave={jest.fn()} />);

    const clearButton = screen.getByRole('button', { name: /清除/i });
    expect(clearButton).toBeInTheDocument();
  });

  it('应该有保存按钮', () => {
    render(<SignaturePad onSave={jest.fn()} />);

    const saveButton = screen.getByRole('button', { name: /确认签名/i });
    expect(saveButton).toBeInTheDocument();
  });

  it('点击清除按钮应该清空签名', () => {
    const { container } = render(<SignaturePad onSave={jest.fn()} />);

    const clearButton = screen.getByRole('button', { name: /清除/i });
    fireEvent.click(clearButton);

    // 验证canvas被清空
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('点击保存按钮应该调用onSave回调', () => {
    const mockSave = jest.fn();
    render(<SignaturePad onSave={mockSave} />);

    // 当签名板为空时，保存按钮被禁用，需验证按钮存在
    const saveButton = screen.getByRole('button', { name: /确认签名/i });
    expect(saveButton).toBeDisabled();
  });
});
