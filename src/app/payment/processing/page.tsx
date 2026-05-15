'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { PaymentMethod } from '@/types/payment';
import { PaymentProcessing } from '@/components/payment/PaymentProcessing';
import { PaymentFail } from '@/components/payment/PaymentFail';

const POLLING_INTERVAL = 2000; // 2秒
const MAX_POLLING_COUNT = 30; // 最多轮询30次，约60秒

export default function PaymentProcessingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [currency, setCurrency] = useState<string>('CNY');
  const [paymentMethod, setPaymentMethod] = useState<string>('WECHAT');
  const [pollingCount, setPollingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<boolean>(false);
  const [pollingStopped, setPollingStopped] = useState<boolean>(false);

  const startPolling = useCallback(
    (orderIdParam: string | null, orderNoParam: string | null) => {
      let count = 0;
      let pollingTimer: NodeJS.Timeout | null = null;

      const pollPaymentStatus = async () => {
        if (count >= MAX_POLLING_COUNT) {
          setPollingStopped(true);
          if (pollingTimer) {
            clearInterval(pollingTimer);
          }
          return;
        }

        try {
          count++;
          setPollingCount(count);

          const url = new URL('/api/payments/query', window.location.origin);
          if (orderIdParam) {
            url.searchParams.append('orderId', orderIdParam);
          } else if (orderNoParam) {
            url.searchParams.append('orderNo', orderNoParam);
          }

          const response = await fetch(url.toString(), {
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error('查询支付状态失败');
          }

          const result = await response.json();
          if (!result.success) {
            throw new Error(result.message || '查询支付状态失败');
          }

          const paymentStatus = result.data?.paymentStatus;

          // 支付成功，跳转到成功页面
          if (paymentStatus === 'SUCCESS') {
            if (pollingTimer) {
              clearInterval(pollingTimer);
            }
            const successUrl = new URL(
              '/payment/success',
              window.location.origin
            );
            if (orderIdParam) {
              successUrl.searchParams.append('orderId', orderIdParam);
            } else if (orderNoParam) {
              successUrl.searchParams.append('orderNo', orderNoParam);
            }
            router.push(successUrl.toString());
            return;
          }

          // 支付失败，跳转到失败页面
          if (
            paymentStatus === 'FAILED' ||
            paymentStatus === 'CANCELLED' ||
            paymentStatus === 'EXPIRED'
          ) {
            if (pollingTimer) {
              clearInterval(pollingTimer);
            }
            setFailed(true);
            return;
          }

          // 继续轮询
        } catch (err) {
          console.error('轮询支付状态失败:', err);
          // 继续轮询，直到达到最大次数
        }
      };

      // 立即执行第一次查询
      pollPaymentStatus();

      // 设置定时轮询
      pollingTimer = setInterval(pollPaymentStatus, POLLING_INTERVAL);

      // 清理定时器
      return () => {
        if (pollingTimer) {
          clearInterval(pollingTimer);
        }
      };
    },
    [router]
  );

  useEffect(() => {
    const orderIdParam = searchParams.get('orderId');
    const orderNoParam = searchParams.get('orderNo');
    const amountParam = searchParams.get('amount');
    const currencyParam = searchParams.get('currency');
    const paymentMethodParam = searchParams.get('paymentMethod');

    if (!orderIdParam && !orderNoParam) {
      setError('缺少订单参数');
      setLoading(false);
      return;
    }

    setOrderId(orderIdParam);
    setOrderNo(orderNoParam);
    setAmount(amountParam ? parseFloat(amountParam) : 0);
    setCurrency(currencyParam || 'CNY');
    setPaymentMethod(paymentMethodParam || 'WECHAT');
    setLoading(false);

    // 开始轮询支付状态
    startPolling(orderIdParam, orderNoParam);
  }, [searchParams, startPolling]);

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
  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center max-w-md px-4'>
          <div className='text-red-500 text-6xl mb-4'>⚠️</div>
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>参数错误</h1>
          <p className='text-gray-600 mb-6'>{error}</p>
          <button
            onClick={() => router.push('/orders')}
            className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
          >
            返回订单列表
          </button>
        </div>
      </div>
    );
  }

  // 支付失败状态
  if (failed) {
    return (
      <div className='min-h-screen bg-gray-50 py-8 px-4'>
        <div className='container mx-auto'>
          <PaymentFail
            errorMessage='支付失败，请重试或联系客服'
            onRetry={() => router.push('/orders')}
            onReturnHome={() => router.push('/')}
          />
        </div>
      </div>
    );
  }

  // 轮询超时状态
  if (pollingStopped) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center max-w-md px-4'>
          <div className='text-yellow-500 text-6xl mb-4'>⏱️</div>
          <h1 className='text-2xl font-bold text-gray-900 mb-2'>查询超时</h1>
          <p className='text-gray-600 mb-6'>
            支付结果查询超时，请稍后在&ldquo;我的订单&rdquo;中查看订单状态
          </p>
          <div className='flex gap-3 justify-center'>
            <button
              onClick={() => router.push(`/orders/${orderId || orderNo}`)}
              className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
            >
              查看订单详情
            </button>
            <button
              onClick={() => router.push('/orders')}
              className='bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
            >
              返回订单列表
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 正常处理中状态
  return (
    <div className='min-h-screen bg-gray-50 py-8 px-4'>
      <div className='container mx-auto'>
        <PaymentProcessing
          orderNo={orderNo || ''}
          amount={amount}
          currency={currency}
          paymentMethod={paymentMethod as PaymentMethod}
          pollingCount={pollingCount}
          maxPollingCount={MAX_POLLING_COUNT}
        />
      </div>
    </div>
  );
}
