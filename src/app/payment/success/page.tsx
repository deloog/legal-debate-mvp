'use client';

import { PaymentSuccess } from '@/components/payment/PaymentSuccess';
import { PaymentMethod } from '@/types/payment';
import { useMemo } from 'react';

export default function PaymentSuccessPage() {
  // TODO: 从 URL 参数或状态获取实际支付信息
  const paymentInfo = useMemo(
    () => ({
      orderNo: 'ORD20250117001',
      amount: 299.0,
      currency: 'CNY',
      paymentMethod: PaymentMethod.WECHAT,
      paidAt: new Date().toISOString(),
      membershipTier: {
        name: 'PROFESSIONAL',
        displayName: '专业版会员',
        expiresAt: new Date(
          new Date().getTime() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    }),
    []
  );

  const handleReturnHome = () => {
    window.location.href = '/';
  };

  const handleViewOrders = () => {
    window.location.href = '/orders';
  };

  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4'>
      <div className='container mx-auto'>
        <PaymentSuccess
          {...paymentInfo}
          onReturnHome={handleReturnHome}
          onViewOrders={handleViewOrders}
        />
      </div>
    </div>
  );
}
