'use client';

import { Clock, RefreshCw } from 'lucide-react';
import type { PaymentMethod } from '@/types/payment';

interface PaymentProcessingProps {
  orderNo: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  pollingCount: number;
  maxPollingCount: number;
}

export function PaymentProcessing({
  orderNo,
  amount,
  currency,
  paymentMethod,
  pollingCount,
  maxPollingCount,
}: PaymentProcessingProps) {
  const getPaymentMethodName = (method: PaymentMethod): string => {
    const names: Record<PaymentMethod, string> = {
      WECHAT: '微信支付',
      ALIPAY: '支付宝',
      BALANCE: '余额支付',
    };
    return names[method] || '未知支付方式';
  };

  const progressPercent = Math.min(
    Math.round((pollingCount / maxPollingCount) * 100),
    100
  );

  return (
    <div className='mx-auto max-w-2xl'>
      <div className='mb-8 text-center'>
        <div className='mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100'>
          <RefreshCw className='h-12 w-12 animate-spin text-blue-600' />
        </div>
        <h1 className='mb-2 text-3xl font-bold text-gray-900'>支付处理中</h1>
        <p className='text-gray-600'>正在确认您的支付结果，请稍候...</p>
      </div>

      <div className='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
        <h2 className='mb-4 text-lg font-semibold text-gray-900'>订单信息</h2>
        <div className='space-y-3'>
          <div className='flex justify-between'>
            <span className='text-gray-600'>订单号</span>
            <span className='font-medium text-gray-900'>{orderNo}</span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-600'>支付金额</span>
            <span className='font-medium text-gray-900'>
              {currency === 'CNY' ? '¥' : currency} {amount.toFixed(2)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-600'>支付方式</span>
            <span className='font-medium text-gray-900'>
              {getPaymentMethodName(paymentMethod)}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-gray-600'>查询次数</span>
            <span className='font-medium text-gray-900'>
              {pollingCount} / {maxPollingCount}
            </span>
          </div>
        </div>
      </div>

      <div className='mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6'>
        <div className='mb-3 flex items-center gap-3'>
          <Clock className='h-5 w-5 text-blue-600' />
          <h2 className='text-lg font-semibold text-gray-900'>处理进度</h2>
        </div>
        <div className='mb-2 h-2 w-full overflow-hidden rounded-full bg-blue-200'>
          <div
            className='h-full bg-blue-600 transition-all duration-300 ease-in-out'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className='text-sm text-gray-600'>
          正在查询支付结果，请勿关闭页面...
        </p>
      </div>

      <div className='rounded-lg bg-gray-50 p-4'>
        <h3 className='mb-2 text-sm font-semibold text-gray-900'>温馨提示</h3>
        <ul className='space-y-1 text-sm text-gray-600'>
          <li>• 支付成功后页面将自动跳转</li>
          <li>• 如页面长时间未跳转，请刷新页面或联系客服</li>
          <li>• 您可以在&ldquo;我的订单&rdquo;中查看订单状态</li>
        </ul>
      </div>
    </div>
  );
}
