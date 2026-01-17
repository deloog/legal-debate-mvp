import React from 'react';
import { render, screen } from '@testing-library/react';
import { PaymentSuccess } from '@/components/payment/PaymentSuccess';
import { PaymentMethod } from '@/types/payment';

describe('PaymentSuccess', () => {
  const defaultProps = {
    orderNo: 'ORD20250117001',
    amount: 299.0,
    currency: 'CNY',
    paymentMethod: PaymentMethod.WECHAT,
    paidAt: '2025-01-17T09:00:00.000Z',
    membershipTier: {
      name: 'PROFESSIONAL',
      displayName: '专业版会员',
      expiresAt: '2026-01-17T09:00:00.000Z',
    },
  };

  describe('基础渲染', () => {
    it('应该渲染支付成功标题', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText('支付成功')).toBeInTheDocument();
    });

    it('应该渲染成功图标', () => {
      const { container } = render(<PaymentSuccess {...defaultProps} />);
      const icon = container.querySelector('.text-green-600');
      expect(icon).toBeInTheDocument();
    });

    it('应该渲染感谢信息', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(
        screen.getByText('感谢您的支付，订单已成功完成')
      ).toBeInTheDocument();
    });
  });

  describe('订单信息', () => {
    it('应该显示订单号', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText('ORD20250117001')).toBeInTheDocument();
    });

    it('应该显示支付金额', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText('¥ 299.00')).toBeInTheDocument();
    });

    it('应该显示支付时间', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText(/2025\/1\/17/)).toBeInTheDocument();
    });
  });

  describe('支付方式显示', () => {
    it('应该显示微信支付', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText('微信支付')).toBeInTheDocument();
    });

    it('应该显示支付宝', () => {
      render(
        <PaymentSuccess
          {...defaultProps}
          paymentMethod={PaymentMethod.ALIPAY}
        />
      );
      expect(screen.getByText('支付宝')).toBeInTheDocument();
    });

    it('应该显示余额支付', () => {
      render(
        <PaymentSuccess
          {...defaultProps}
          paymentMethod={PaymentMethod.BALANCE}
        />
      );
      expect(screen.getByText('余额支付')).toBeInTheDocument();
    });

    it('应该显示未知支付方式', () => {
      const { container } = render(
        <PaymentSuccess
          {...defaultProps}
          paymentMethod={undefined as unknown as PaymentMethod}
        />
      );
      expect(container.textContent).toContain('未知支付方式');
    });
  });

  describe('会员信息', () => {
    it('应该显示会员等级', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText('专业版会员')).toBeInTheDocument();
    });

    it('应该显示到期时间', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText(/2026\/1\/17/)).toBeInTheDocument();
    });

    it('不应显示会员信息卡片当membershipTier不存在时', () => {
      const { container } = render(
        <PaymentSuccess {...defaultProps} membershipTier={undefined} />
      );
      expect(container.textContent).not.toContain('会员信息已更新');
    });

    it('不应显示到期时间当expiresAt不存在时', () => {
      const { container } = render(
        <PaymentSuccess
          {...defaultProps}
          membershipTier={{ name: 'FREE', displayName: '免费会员' }}
        />
      );
      expect(container.textContent).toContain('会员等级');
      expect(container.textContent).not.toContain('到期时间');
    });
  });

  describe('操作按钮', () => {
    it('应该渲染返回首页按钮', () => {
      const handleReturnHome = jest.fn();
      const { container } = render(
        <PaymentSuccess {...defaultProps} onReturnHome={handleReturnHome} />
      );
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button?.textContent).toContain('返回首页');
    });

    it('应该渲染查看订单按钮当onViewOrders存在时', () => {
      const handleViewOrders = jest.fn();
      const { container } = render(
        <PaymentSuccess {...defaultProps} onViewOrders={handleViewOrders} />
      );
      const buttons = container.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(1);
      expect(container.textContent).toContain('查看订单');
    });

    it('应该渲染继续使用按钮', () => {
      const { container } = render(<PaymentSuccess {...defaultProps} />);
      expect(container.textContent).toContain('继续使用');
    });
  });

  describe('温馨提示', () => {
    it('应该显示温馨提示标题', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(screen.getByText('温馨提示')).toBeInTheDocument();
    });

    it('应该显示所有提示信息', () => {
      render(<PaymentSuccess {...defaultProps} />);
      expect(
        screen.getByText(/您可以在.*我的订单.*中查看订单详情/)
      ).toBeInTheDocument();
      expect(
        screen.getByText('• 如有任何问题，请联系客服')
      ).toBeInTheDocument();
      expect(
        screen.getByText('• 会员权益已即时生效，请尽情使用')
      ).toBeInTheDocument();
    });
  });

  describe('货币显示', () => {
    it('应该显示人民币符号当货币为CNY时', () => {
      render(<PaymentSuccess {...defaultProps} currency='CNY' />);
      expect(screen.getByText('¥ 299.00')).toBeInTheDocument();
    });

    it('应该显示原始货币代码当货币不是CNY时', () => {
      render(<PaymentSuccess {...defaultProps} currency='USD' />);
      expect(screen.getByText('USD 299.00')).toBeInTheDocument();
    });
  });

  describe('可访问性', () => {
    it('应该使用适当的HTML标签结构', () => {
      const { container } = render(<PaymentSuccess {...defaultProps} />);
      expect(container.querySelector('h1')).toBeInTheDocument();
      expect(container.querySelector('h2')).toBeInTheDocument();
      expect(container.querySelector('h3')).toBeInTheDocument();
    });
  });
});
