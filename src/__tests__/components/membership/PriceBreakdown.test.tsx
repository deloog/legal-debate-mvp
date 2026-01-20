import React from 'react';
import { render, screen } from '@testing-library/react';
import { PriceBreakdown } from '@/components/membership/PriceBreakdown';
import { BillingCycle } from '@/types/membership';

describe('PriceBreakdown', () => {
  it('应该正确渲染价格明细', () => {
    render(<PriceBreakdown price={99} billingCycle={BillingCycle.MONTHLY} />);

    expect(screen.getByText('价格明细')).toBeInTheDocument();
    expect(screen.getByText('¥99.00')).toBeInTheDocument();
  });

  it('应该正确显示月付价格', () => {
    render(<PriceBreakdown price={99} billingCycle={BillingCycle.MONTHLY} />);

    expect(screen.getByText('¥99.00')).toBeInTheDocument();
    expect(screen.getByText('/月付')).toBeInTheDocument();
  });

  it('应该正确显示季付价格', () => {
    render(
      <PriceBreakdown
        price={299}
        billingCycle={BillingCycle.QUARTERLY}
        savings={30}
      />
    );

    expect(screen.getByText('¥299.00')).toBeInTheDocument();
    expect(screen.getByText('/季付')).toBeInTheDocument();
    expect(screen.getByText('¥30.00')).toBeInTheDocument();
  });

  it('应该正确显示年付价格', () => {
    render(
      <PriceBreakdown
        price={999}
        billingCycle={BillingCycle.YEARLY}
        savings={200}
      />
    );

    expect(screen.getByText('¥999.00')).toBeInTheDocument();
    expect(screen.getByText('/年付')).toBeInTheDocument();
    expect(screen.getByText('¥200.00')).toBeInTheDocument();
  });

  it('应该正确显示永久版价格', () => {
    render(
      <PriceBreakdown price={4999} billingCycle={BillingCycle.LIFETIME} />
    );

    expect(screen.getByText('¥4999.00')).toBeInTheDocument();
    expect(screen.getByText('/永久')).toBeInTheDocument();
  });

  it('季付时应该显示月均价格', () => {
    render(
      <PriceBreakdown price={300} billingCycle={BillingCycle.QUARTERLY} />
    );

    expect(screen.getByText('¥100.00')).toBeInTheDocument();
    expect(screen.getByText('/月')).toBeInTheDocument();
  });

  it('年付时应该显示月均价格', () => {
    render(<PriceBreakdown price={1200} billingCycle={BillingCycle.YEARLY} />);

    expect(screen.getByText('¥100.00')).toBeInTheDocument();
    expect(screen.getByText('/月')).toBeInTheDocument();
  });

  it('月付时不应该显示月均价格', () => {
    render(<PriceBreakdown price={100} billingCycle={BillingCycle.MONTHLY} />);

    // 月均价格应该不存在
    expect(screen.queryByText('月均价格')).not.toBeInTheDocument();
  });

  it('永久版时不应该显示月均价格', () => {
    render(
      <PriceBreakdown price={4999} billingCycle={BillingCycle.LIFETIME} />
    );

    expect(screen.queryByText('月均价格')).not.toBeInTheDocument();
  });

  it('应该显示节省金额', () => {
    render(
      <PriceBreakdown
        price={999}
        billingCycle={BillingCycle.YEARLY}
        savings={200}
      />
    );

    expect(screen.getByText('节省')).toBeInTheDocument();
    expect(screen.getByText('¥200.00')).toBeInTheDocument();
  });

  it('节省金额为0时不应该显示节省区块', () => {
    render(
      <PriceBreakdown
        price={99}
        billingCycle={BillingCycle.MONTHLY}
        savings={0}
      />
    );

    expect(screen.queryByText('节省')).not.toBeInTheDocument();
  });

  it('永久版时应该显示正确说明', () => {
    render(
      <PriceBreakdown price={4999} billingCycle={BillingCycle.LIFETIME} />
    );

    expect(
      screen.getByText('一次性购买，永久使用，无需续费')
    ).toBeInTheDocument();
  });

  it('非永久版时应该显示正确说明', () => {
    render(<PriceBreakdown price={99} billingCycle={BillingCycle.MONTHLY} />);

    expect(
      screen.getByText('购买后立即生效，到期后自动续费，可随时取消')
    ).toBeInTheDocument();
  });

  it('应该支持自定义货币符号', () => {
    render(
      <PriceBreakdown
        price={99}
        billingCycle={BillingCycle.MONTHLY}
        currency='$'
      />
    );

    expect(screen.getByText('$99.00')).toBeInTheDocument();
  });
});
