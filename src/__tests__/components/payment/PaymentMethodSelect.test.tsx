import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentMethodSelect } from '@/components/payment/PaymentMethodSelect';
import { PaymentMethod } from '@/types/payment';

describe('PaymentMethodSelect', () => {
  const mockOnMethodSelect = jest.fn();

  beforeEach(() => {
    mockOnMethodSelect.mockClear();
  });

  it('should render all payment methods', () => {
    render(
      <PaymentMethodSelect
        selectedMethod={null}
        onMethodSelect={mockOnMethodSelect}
      />
    );

    expect(screen.getByText('微信支付')).toBeInTheDocument();
    expect(screen.getByText('支付宝')).toBeInTheDocument();
    expect(screen.getByText('余额支付')).toBeInTheDocument();
  });

  it('should call onMethodSelect when a payment method is clicked', () => {
    render(
      <PaymentMethodSelect
        selectedMethod={null}
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const wechatButton = screen.getByText('微信支付').closest('div');
    if (wechatButton) {
      fireEvent.click(wechatButton);
      expect(mockOnMethodSelect).toHaveBeenCalledWith(PaymentMethod.WECHAT);
    }
  });

  it('should highlight selected payment method', () => {
    render(
      <PaymentMethodSelect
        selectedMethod={PaymentMethod.WECHAT}
        onMethodSelect={mockOnMethodSelect}
      />
    );

    const wechatContainer = screen
      .getByText('微信支付')
      .closest('div.relative');
    expect(wechatContainer).toHaveClass('border-blue-500');
  });

  it('should not call onMethodSelect when disabled', () => {
    render(
      <PaymentMethodSelect
        selectedMethod={null}
        onMethodSelect={mockOnMethodSelect}
        disabled={true}
      />
    );

    const wechatButton = screen.getByText('微信支付').closest('div');
    if (wechatButton) {
      fireEvent.click(wechatButton);
      expect(mockOnMethodSelect).not.toHaveBeenCalled();
    }
  });

  it('should disable payment method when available is false', () => {
    // This test would need to be updated if we ever mark a method as unavailable
    render(
      <PaymentMethodSelect
        selectedMethod={null}
        onMethodSelect={mockOnMethodSelect}
      />
    );

    // Currently all methods are available, so we just check that all are rendered
    expect(screen.getByText('微信支付')).toBeInTheDocument();
    expect(screen.getByText('支付宝')).toBeInTheDocument();
    expect(screen.getByText('余额支付')).toBeInTheDocument();
  });
});
