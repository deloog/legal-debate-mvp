/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { Check } from 'lucide-react';

describe('PaymentMethodSelector', () => {
  it('should render correctly with given props', () => {
    render(
      <PaymentMethodSelector selectedMethod={null} onMethodSelect={jest.fn()} />
    );

    expect(screen.getByText('选择支付方式')).toBeInTheDocument();
    expect(screen.getByText('微信支付')).toBeInTheDocument();
    expect(screen.getByText('支付宝')).toBeInTheDocument();
    expect(screen.getByText('银行卡')).toBeInTheDocument();
    expect(screen.getByText('余额支付')).toBeInTheDocument();
  });

  it('should call onMethodSelect when a payment method is clicked', () => {
    const onMethodSelect = jest.fn();
    render(
      <PaymentMethodSelector
        selectedMethod={null}
        onMethodSelect={onMethodSelect}
      />
    );

    // 找到微信支付的容器
    const wechatContainer = screen
      .getByText('微信支付')
      .closest('.cursor-pointer') as HTMLElement;
    expect(wechatContainer).toBeInTheDocument();
    if (wechatContainer) {
      fireEvent.click(wechatContainer);
    }

    expect(onMethodSelect).toHaveBeenCalledWith('wechat');
  });

  it('should show selected method with check icon', () => {
    render(
      <PaymentMethodSelector
        selectedMethod='alipay'
        onMethodSelect={jest.fn()}
      />
    );

    // 检查支付宝是否有Check图标
    const alipayContainer = screen
      .getByText('支付宝')
      .closest('.cursor-pointer');
    const checkIcon = alipayContainer?.querySelector('svg');
    expect(checkIcon).toBeInTheDocument();
  });

  it('should not allow selection when disabled', () => {
    const onMethodSelect = jest.fn();
    render(
      <PaymentMethodSelector
        selectedMethod={null}
        onMethodSelect={onMethodSelect}
        disabled={true}
      />
    );

    // 点击后不应该触发回调（因为disabled属性会阻止onClick）
    const wechatContainer = screen
      .getByText('微信支付')
      .closest('.cursor-pointer') as HTMLElement;
    expect(wechatContainer).toBeInTheDocument();

    if (wechatContainer) {
      fireEvent.click(wechatContainer);
    }
    expect(onMethodSelect).not.toHaveBeenCalled();
  });

  it('should display warning message about payment features', () => {
    render(
      <PaymentMethodSelector selectedMethod={null} onMethodSelect={jest.fn()} />
    );

    expect(
      screen.getByText(/支付功能正在开发中，当前仅供演示/)
    ).toBeInTheDocument();
  });

  it('should display descriptions for each payment method', () => {
    render(
      <PaymentMethodSelector selectedMethod={null} onMethodSelect={jest.fn()} />
    );

    expect(screen.getByText('推荐使用，支持快捷支付')).toBeInTheDocument();
    expect(screen.getByText('安全便捷，支持花呗分期')).toBeInTheDocument();
    expect(screen.getByText('支持各大银行信用卡/储蓄卡')).toBeInTheDocument();
    expect(screen.getByText('使用账户余额支付')).toBeInTheDocument();
  });

  it('should highlight selected payment method with blue border and background', () => {
    render(
      <PaymentMethodSelector
        selectedMethod='wechat'
        onMethodSelect={jest.fn()}
      />
    );

    // 获取微信支付的最外层容器
    const wechatContainer = screen
      .getByText('微信支付')
      .closest('.cursor-pointer') as HTMLElement;
    expect(wechatContainer?.className).toContain('border-blue-500');
    expect(wechatContainer?.className).toContain('bg-blue-50');
  });

  it('should not highlight unselected payment method', () => {
    render(
      <PaymentMethodSelector
        selectedMethod='alipay'
        onMethodSelect={jest.fn()}
      />
    );

    // 获取微信支付的最外层容器（未选中）
    const wechatContainer = screen
      .getByText('微信支付')
      .closest('.cursor-pointer') as HTMLElement;
    expect(wechatContainer?.className).toContain('border-gray-200');
    expect(wechatContainer?.className).toContain('bg-white');
    expect(wechatContainer?.className).not.toContain('border-blue-500');
  });
});
