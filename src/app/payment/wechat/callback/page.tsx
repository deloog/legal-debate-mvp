'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface CallbackResult {
  success: boolean;
  message: string;
  redirectUrl?: string;
  delay?: number;
}

export default function WechatPayCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(true);
  const [result, setResult] = useState<CallbackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          params[key] = value;
        });

        if (Object.keys(params).length === 0) {
          setError('缺少回调参数');
          setLoading(false);
          return;
        }

        const response = await fetch('/api/payments/wechat/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error('处理回调失败');
        }

        const data: CallbackResult = await response.json();
        setResult(data);

        if (data.success && data.redirectUrl) {
          setTimeout(() => {
            router.push(data.redirectUrl || '/orders');
          }, data.delay || 2000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('处理微信支付回调失败:', err);
        setError(
          err instanceof Error ? err.message : '处理回调失败，请稍后查看订单'
        );
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router]);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center max-w-md px-4'>
          <div className='mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100'>
            <div className='inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600'></div>
          </div>
          <h1 className='mb-2 text-2xl font-bold text-gray-900'>
            正在处理支付结果
          </h1>
          <p className='text-gray-600'>
            {result?.message || '正在确认您的支付结果，请稍候...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center max-w-md px-4'>
          <div className='text-red-500 text-6xl mb-4'>⚠️</div>
          <h1 className='mb-2 text-2xl font-bold text-gray-900'>处理失败</h1>
          <p className='mb-6 text-gray-600'>
            {error || '处理回调失败，请稍后查看订单'}
          </p>
          <div className='flex flex-col gap-3'>
            <button
              onClick={() => router.push('/orders')}
              className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
            >
              查看我的订单
            </button>
            <button
              onClick={() => router.push('/')}
              className='bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const delaySeconds = result.delay ? Math.round(result.delay / 1000) : 2;

  return (
    <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
      <div className='text-center max-w-md px-4'>
        <div className='text-green-500 text-6xl mb-4'>✓</div>
        <h1 className='mb-2 text-2xl font-bold text-gray-900'>支付成功</h1>
        <p className='mb-6 text-gray-600'>{result.message}</p>
        <p className='mb-4 text-sm text-gray-500'>
          页面将在 {delaySeconds} 秒后自动跳转
        </p>
        <button
          onClick={() => router.push(result.redirectUrl || '/orders')}
          className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors'
        >
          立即跳转
        </button>
      </div>
    </div>
  );
}
