'use client';

import { CheckCircle2, Home, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentMethod } from '@/types/payment';

interface PaymentSuccessProps {
  orderNo: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paidAt: string;
  membershipTier?: {
    name: string;
    displayName: string;
    expiresAt?: string;
  };
  onReturnHome?: () => void;
  onViewOrders?: () => void;
}

export function PaymentSuccess({
  orderNo,
  amount,
  currency,
  paymentMethod,
  paidAt,
  membershipTier,
  onReturnHome,
  onViewOrders,
}: PaymentSuccessProps) {
  const getPaymentMethodName = (method: PaymentMethod): string => {
    const names: Record<PaymentMethod, string> = {
      [PaymentMethod.WECHAT]: '微信支付',
      [PaymentMethod.ALIPAY]: '支付宝',
      [PaymentMethod.BALANCE]: '余额支付',
    };
    return names[method] || '未知支付方式';
  };

  return (
    <div className='mx-auto max-w-2xl'>
      <div className='mb-8 text-center'>
        <div className='mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100'>
          <CheckCircle2 className='h-12 w-12 text-green-600' />
        </div>
        <h1 className='mb-2 text-3xl font-bold text-gray-900'>支付成功</h1>
        <p className='text-gray-600'>感谢您的支付，订单已成功完成</p>
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
            <span className='text-gray-600'>支付时间</span>
            <span className='font-medium text-gray-900'>
              {new Date(paidAt).toLocaleString('zh-CN')}
            </span>
          </div>
        </div>
      </div>

      {membershipTier && (
        <div className='mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6'>
          <div className='mb-3 flex items-center gap-3'>
            <User className='h-5 w-5 text-blue-600' />
            <h2 className='text-lg font-semibold text-gray-900'>
              会员信息已更新
            </h2>
          </div>
          <div className='space-y-2'>
            <div className='flex justify-between'>
              <span className='text-gray-600'>会员等级</span>
              <span className='font-medium text-gray-900'>
                {membershipTier.displayName}
              </span>
            </div>
            {membershipTier.expiresAt && (
              <div className='flex justify-between'>
                <span className='text-gray-600'>到期时间</span>
                <span className='font-medium text-gray-900'>
                  {new Date(membershipTier.expiresAt).toLocaleDateString(
                    'zh-CN'
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className='flex flex-col gap-3 sm:flex-row'>
        <Button onClick={onReturnHome} variant='outline' className='flex-1'>
          <Home className='mr-2 h-4 w-4' />
          返回首页
        </Button>
        {onViewOrders && (
          <Button onClick={onViewOrders} variant='outline' className='flex-1'>
            <FileText className='mr-2 h-4 w-4' />
            查看订单
          </Button>
        )}
        <Button className='flex-1'>继续使用</Button>
      </div>

      <div className='mt-6 rounded-lg bg-gray-50 p-4'>
        <h3 className='mb-2 text-sm font-semibold text-gray-900'>温馨提示</h3>
        <ul className='space-y-1 text-sm text-gray-600'>
          <li>• 您可以在&ldquo;我的订单&rdquo;中查看订单详情</li>
          <li>• 如有任何问题，请联系客服</li>
          <li>• 会员权益已即时生效，请尽情使用</li>
        </ul>
      </div>
    </div>
  );
}
