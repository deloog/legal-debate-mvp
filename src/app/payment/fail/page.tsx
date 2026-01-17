'use client';

import { PaymentFail } from '@/components/payment/PaymentFail';
import { PaymentMethod } from '@/types/payment';
import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

export default function PaymentFailPage() {
  const searchParams = useSearchParams();

  const errorCode = searchParams.get('errorCode') || 'PAYMENT_FAILED';
  const errorMessage = searchParams.get('error') || '支付失败，请重试';
  const canRetry = searchParams.get('canRetry') === 'true';
  const orderNo = searchParams.get('orderNo') || '';

  const paymentInfo = useMemo(
    () => ({
      orderNo,
      amount: 0,
      currency: 'CNY',
      paymentMethod: PaymentMethod.WECHAT,
      errorCode,
      errorMessage,
      canRetry,
    }),
    [orderNo, errorCode, errorMessage, canRetry]
  );

  const handleRetry = () => {
    // 重试支付：返回上一个页面或支付页面
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/payment';
    }
  };

  const handleReturnHome = () => {
    window.location.href = '/';
  };

  const handleContactSupport = () => {
    // 联系客服
    window.open('mailto:support@example.com', '_blank');
  };

  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4'>
      <div className='container mx-auto'>
        <PaymentFail
          {...paymentInfo}
          onRetry={handleRetry}
          onReturnHome={handleReturnHome}
          onContactSupport={handleContactSupport}
        />
      </div>
    </div>
  );
}
