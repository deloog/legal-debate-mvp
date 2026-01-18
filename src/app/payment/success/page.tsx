'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PaymentSuccess } from '@/components/payment/PaymentSuccess';
import type { Order } from '@/types/payment';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('orderId');
  const orderNo = searchParams.get('orderNo');

  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId && !orderNo) {
        setError('缺少订单参数');
        setLoading(false);
        return;
      }

      try {
        const url = orderId
          ? `/api/orders/${orderId}`
          : `/api/orders/by-order-no/${orderNo}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '获取订单信息失败');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || '获取订单信息失败');
        }

        const orderData = result.data as Order;

        // 验证订单状态
        if (orderData.status !== 'PAID') {
          throw new Error(`订单状态不正确: ${orderData.status}`);
        }

        setOrder(orderData);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取订单信息失败');
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [orderId, orderNo]);

  const handleReturnHome = () => {
    router.push('/');
  };

  const handleViewOrders = () => {
    router.push('/orders');
  };

  // 加载状态
  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900 mb-4'></div>
          <p className='text-gray-600'>加载订单信息...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !order) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center max-w-md px-4'>
          <div className='text-red-500 text-6xl mb-4'>⚠️</div>
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>
            获取订单信息失败
          </h1>
          <p className='text-gray-600 mb-6'>{error || '未知错误'}</p>
          <button
            onClick={handleReturnHome}
            className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  // 准备支付信息
  const paidAtDate = order.paidAt || order.createdAt;
  const paymentInfo = {
    orderNo: order.orderNo,
    amount: order.amount,
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paidAt: paidAtDate.toISOString(),
    membershipTier: order.membershipTier
      ? {
          name: order.membershipTier.name,
          displayName: order.membershipTier.displayName,
          expiresAt: new Date(
            new Date().getTime() + 365 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }
      : undefined,
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
