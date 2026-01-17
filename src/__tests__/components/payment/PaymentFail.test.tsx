import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { PaymentFail } from '@/components/payment/PaymentFail';
import { PaymentMethod } from '@/types/payment';

describe('PaymentFail', () => {
  const defaultProps = {
    orderNo: 'ORD20250117001',
    amount: 299.0,
    currency: 'CNY',
    paymentMethod: PaymentMethod.WECHAT,
    errorCode: 'PAYMENT_FAILED',
    errorMessage: '支付失败，请重试',
  };

  const handlers = {
    onRetry: jest.fn(),
    onReturnHome: jest.fn(),
    onContactSupport: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.open
    global.open = jest.fn();
  });

  describe('基础渲染', () => {
    it('应该渲染支付失败标题', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('支付失败')).toBeInTheDocument();
    });

    it('应该渲染失败图标', () => {
      const { container } = render(<PaymentFail {...defaultProps} />);
      const icon = container.querySelector('.text-red-600');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('错误信息', () => {
    it('应该显示错误详情卡片当有errorCode或errorMessage时', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('错误详情')).toBeInTheDocument();
      expect(screen.getByText('错误代码')).toBeInTheDocument();
      expect(screen.getByText('PAYMENT_FAILED')).toBeInTheDocument();
    });

    it('应该显示错误信息当errorMessage存在时', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getAllByText('支付失败，请重试').length).toBeGreaterThan(0);
    });

    it('不应显示错误详情卡片当没有errorCode和errorMessage时', () => {
      const { container } = render(<PaymentFail />);
      expect(container.textContent).not.toContain('错误详情');
    });
  });

  describe('错误消息映射', () => {
    it('应该显示支付超时消息', () => {
      render(<PaymentFail errorCode='PAYMENT_TIMEOUT' />);
      expect(screen.getByText('支付超时，请重试')).toBeInTheDocument();
    });

    it('应该显示订单过期消息', () => {
      render(<PaymentFail errorCode='ORDER_EXPIRED' />);
      expect(screen.getByText('订单已过期，请重新下单')).toBeInTheDocument();
    });

    it('应该显示余额不足消息', () => {
      render(<PaymentFail errorCode='INSUFFICIENT_BALANCE' />);
      expect(screen.getByText('余额不足，请充值')).toBeInTheDocument();
    });

    it('应该使用自定义errorMessage当存在时', () => {
      render(<PaymentFail errorMessage='自定义错误消息' />);
      expect(screen.getAllByText('自定义错误消息').length).toBeGreaterThan(0);
    });

    it('应该显示默认错误消息当errorCode不匹配时', () => {
      render(<PaymentFail errorCode='UNKNOWN_ERROR' />);
      expect(screen.getByText('支付失败，请重试')).toBeInTheDocument();
    });
  });

  describe('订单信息', () => {
    it('应该显示订单信息当orderNo存在时', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('订单信息')).toBeInTheDocument();
      expect(screen.getByText('ORD20250117001')).toBeInTheDocument();
    });

    it('应该显示支付金额当amount和currency存在时', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('¥ 299.00')).toBeInTheDocument();
    });

    it('应该显示支付方式当paymentMethod存在时', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('微信支付')).toBeInTheDocument();
    });

    it('不应显示订单信息卡片当orderNo不存在时', () => {
      const { container } = render(<PaymentFail />);
      expect(container.textContent).not.toContain('订单信息');
    });
  });

  describe('支付方式显示', () => {
    it('应该显示微信支付', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('微信支付')).toBeInTheDocument();
    });

    it('应该显示支付宝', () => {
      render(
        <PaymentFail {...defaultProps} paymentMethod={PaymentMethod.ALIPAY} />
      );
      expect(screen.getByText('支付宝')).toBeInTheDocument();
    });

    it('应该显示余额支付', () => {
      render(
        <PaymentFail {...defaultProps} paymentMethod={PaymentMethod.BALANCE} />
      );
      expect(screen.getByText('余额支付')).toBeInTheDocument();
    });
  });

  describe('重试按钮', () => {
    it('应该显示重试按钮当可以重试时', () => {
      render(<PaymentFail {...defaultProps} onRetry={handlers.onRetry} />);
      expect(screen.getByText('重试支付')).toBeInTheDocument();
    });

    it('应该调用onRetry当点击重试按钮时', () => {
      render(<PaymentFail {...defaultProps} onRetry={handlers.onRetry} />);
      const button = screen.getByText('重试支付');
      fireEvent.click(button);
      expect(handlers.onRetry).toHaveBeenCalledTimes(1);
    });

    it('不应显示重试按钮当订单过期时', () => {
      const { container } = render(
        <PaymentFail errorCode='ORDER_EXPIRED' onRetry={handlers.onRetry} />
      );
      expect(container.textContent).not.toContain('重试支付');
    });

    it('不应显示重试按钮当订单取消时', () => {
      const { container } = render(
        <PaymentFail errorCode='ORDER_CANCELLED' onRetry={handlers.onRetry} />
      );
      expect(container.textContent).not.toContain('重试支付');
    });

    it('不应显示重试按钮当订单无效时', () => {
      const { container } = render(
        <PaymentFail errorCode='INVALID_ORDER' onRetry={handlers.onRetry} />
      );
      expect(container.textContent).not.toContain('重试支付');
    });

    it('不应显示重试按钮当onRetry不存在时', () => {
      const { container } = render(<PaymentFail {...defaultProps} />);
      expect(container.textContent).not.toContain('重试支付');
    });
  });

  describe('其他按钮', () => {
    it('应该渲染返回首页按钮', () => {
      render(
        <PaymentFail {...defaultProps} onReturnHome={handlers.onReturnHome} />
      );
      expect(screen.getByText('返回首页')).toBeInTheDocument();
    });

    it('应该调用onReturnHome当点击返回首页按钮时', () => {
      render(
        <PaymentFail {...defaultProps} onReturnHome={handlers.onReturnHome} />
      );
      const button = screen.getByText('返回首页');
      fireEvent.click(button);
      expect(handlers.onReturnHome).toHaveBeenCalledTimes(1);
    });

    it('应该渲染联系客服按钮当onContactSupport存在时', () => {
      render(
        <PaymentFail
          {...defaultProps}
          onContactSupport={handlers.onContactSupport}
        />
      );
      expect(screen.getByText('联系客服')).toBeInTheDocument();
    });

    it('应该调用onContactSupport当点击联系客服按钮时', () => {
      render(
        <PaymentFail
          {...defaultProps}
          onContactSupport={handlers.onContactSupport}
        />
      );
      const button = screen.getByText('联系客服');
      fireEvent.click(button);
      expect(handlers.onContactSupport).toHaveBeenCalledTimes(1);
    });

    it('不应显示联系客服按钮当onContactSupport不存在时', () => {
      const { container } = render(<PaymentFail {...defaultProps} />);
      // 检查按钮区域不包含联系客服按钮（温馨提示中会有联系客服文本）
      const buttonsContainer = container.querySelector('.flex.flex-col');
      expect(buttonsContainer?.textContent).not.toContain('联系客服');
    });
  });

  describe('温馨提示', () => {
    it('应该显示温馨提示标题', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(screen.getByText('温馨提示')).toBeInTheDocument();
    });

    it('应该显示所有提示信息', () => {
      render(<PaymentFail {...defaultProps} />);
      expect(
        screen.getByText(/您可以在.*我的订单.*中查看订单详情/)
      ).toBeInTheDocument();
      expect(
        screen.getByText('• 如问题持续存在，请联系客服寻求帮助')
      ).toBeInTheDocument();
      expect(
        screen.getByText('• 请确保支付环境安全，避免支付中断')
      ).toBeInTheDocument();
      expect(
        screen.getByText('• 订单有效期通常为2小时，请及时支付')
      ).toBeInTheDocument();
    });
  });

  describe('货币显示', () => {
    it('应该显示人民币符号当货币为CNY时', () => {
      render(<PaymentFail {...defaultProps} currency='CNY' />);
      expect(screen.getByText('¥ 299.00')).toBeInTheDocument();
    });

    it('应该显示原始货币代码当货币不是CNY时', () => {
      render(<PaymentFail {...defaultProps} currency='USD' />);
      expect(screen.getByText('USD 299.00')).toBeInTheDocument();
    });
  });

  describe('可访问性', () => {
    it('应该使用适当的HTML标签结构', () => {
      const { container } = render(<PaymentFail {...defaultProps} />);
      expect(container.querySelector('h1')).toBeInTheDocument();
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
    });
  });

  describe('边缘情况', () => {
    it('应该正确处理没有props的情况', () => {
      render(<PaymentFail />);
      expect(screen.getByText('支付失败')).toBeInTheDocument();
      expect(screen.getByText('支付失败，请重试')).toBeInTheDocument();
    });

    it('应该只显示错误信息当只有errorCode时', () => {
      render(<PaymentFail errorCode='PAYMENT_TIMEOUT' />);
      expect(screen.getByText('支付超时，请重试')).toBeInTheDocument();
      expect(screen.queryByText('订单信息')).not.toBeInTheDocument();
    });

    it('应该显示自定义错误信息覆盖errorCode', () => {
      render(
        <PaymentFail errorCode='PAYMENT_TIMEOUT' errorMessage='自定义消息' />
      );
      expect(screen.getAllByText('自定义消息').length).toBeGreaterThan(0);
      expect(screen.queryByText('支付超时，请重试')).not.toBeInTheDocument();
    });
  });
});
