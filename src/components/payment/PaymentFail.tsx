'use client';

import { XCircle, RefreshCw, Home, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentMethod } from '@/types/payment';

interface PaymentFailProps {
  orderNo?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: PaymentMethod;
  errorCode?: string;
  errorMessage?: string;
  canRetry?: boolean;
  onRetry?: () => void;
  onReturnHome?: () => void;
  onContactSupport?: () => void;
}

export function PaymentFail({
  orderNo,
  amount,
  currency,
  paymentMethod,
  errorCode,
  errorMessage,
  canRetry: canRetryProp,
  onRetry,
  onReturnHome,
  onContactSupport,
}: PaymentFailProps) {
  const getPaymentMethodName = (method?: PaymentMethod): string => {
    if (!method) return '未知支付方式';
    const names: Record<PaymentMethod, string> = {
      [PaymentMethod.WECHAT]: '微信支付',
      [PaymentMethod.ALIPAY]: '支付宝',
      [PaymentMethod.BALANCE]: '余额支付',
    };
    return names[method] || '未知支付方式';
  };

  const getErrorMessage = (code?: string, message?: string): string => {
    if (message) return message;
    const errorMessages: Record<string, string> = {
      PAYMENT_TIMEOUT: '支付超时，请重试',
      PAYMENT_FAILED: '支付失败，请重试',
      ORDER_EXPIRED: '订单已过期，请重新下单',
      ORDER_CANCELLED: '订单已取消，请重新下单',
      INSUFFICIENT_BALANCE: '余额不足，请充值',
      NETWORK_ERROR: '网络错误，请检查网络后重试',
      SERVER_ERROR: '服务器错误，请稍后重试',
      INVALID_ORDER: '订单无效，请重新下单',
    };
    return code
      ? errorMessages[code] || '支付失败，请重试'
      : '支付失败，请重试';
  };

  const canRetry =
    canRetryProp !== undefined
      ? canRetryProp
      : errorCode !== 'ORDER_EXPIRED' &&
        errorCode !== 'ORDER_CANCELLED' &&
        errorCode !== 'INVALID_ORDER';

  return (
    <div className='mx-auto max-w-2xl'>
      {/* 失败图标和标题 */}
      <div className='mb-8 text-center'>
        <div className='mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100'>
          <XCircle className='h-12 w-12 text-red-600' />
        </div>
        <h1 className='mb-2 text-3xl font-bold text-gray-900'>支付失败</h1>
        <p className='text-gray-600'>
          {getErrorMessage(errorCode, errorMessage)}
        </p>
      </div>

      {/* 错误信息卡片 */}
      {(errorCode || errorMessage) && (
        <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-6'>
          <div className='mb-3 flex items-center gap-3'>
            <HelpCircle className='h-5 w-5 text-red-600' />
            <h2 className='text-lg font-semibold text-gray-900'>错误详情</h2>
          </div>
          <div className='space-y-2'>
            {errorCode && (
              <div className='flex justify-between'>
                <span className='text-gray-600'>错误代码</span>
                <span className='font-medium text-gray-900'>{errorCode}</span>
              </div>
            )}
            {errorMessage && (
              <div className='flex justify-between'>
                <span className='text-gray-600'>错误信息</span>
                <span className='font-medium text-gray-900'>
                  {errorMessage}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 订单信息卡片 */}
      {orderNo && (
        <div className='mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm'>
          <h2 className='mb-4 text-lg font-semibold text-gray-900'>订单信息</h2>
          <div className='space-y-3'>
            <div className='flex justify-between'>
              <span className='text-gray-600'>订单号</span>
              <span className='font-medium text-gray-900'>{orderNo}</span>
            </div>
            {amount && currency && (
              <div className='flex justify-between'>
                <span className='text-gray-600'>支付金额</span>
                <span className='font-medium text-gray-900'>
                  {currency === 'CNY' ? '¥' : currency} {amount.toFixed(2)}
                </span>
              </div>
            )}
            {paymentMethod && (
              <div className='flex justify-between'>
                <span className='text-gray-600'>支付方式</span>
                <span className='font-medium text-gray-900'>
                  {getPaymentMethodName(paymentMethod)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className='flex flex-col gap-3 sm:flex-row'>
        {canRetry && onRetry && (
          <Button onClick={onRetry} className='flex-1'>
            <RefreshCw className='mr-2 h-4 w-4' />
            重试支付
          </Button>
        )}
        <Button onClick={onReturnHome} variant='outline' className='flex-1'>
          <Home className='mr-2 h-4 w-4' />
          返回首页
        </Button>
        {onContactSupport && (
          <Button
            onClick={onContactSupport}
            variant='outline'
            className='flex-1'
          >
            <HelpCircle className='mr-2 h-4 w-4' />
            联系客服
          </Button>
        )}
      </div>

      {/* 温馨提示 */}
      <div className='mt-6 rounded-lg bg-gray-50 p-4'>
        <h3 className='mb-2 text-sm font-semibold text-gray-900'>温馨提示</h3>
        <ul className='space-y-1 text-sm text-gray-600'>
          <li>• 您可以在&ldquo;我的订单&rdquo;中查看订单详情</li>
          <li>• 如问题持续存在，请联系客服寻求帮助</li>
          <li>• 请确保支付环境安全，避免支付中断</li>
          <li>• 订单有效期通常为2小时，请及时支付</li>
        </ul>
      </div>
    </div>
  );
}
