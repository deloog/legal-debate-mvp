import { Card } from '@/components/ui/card';
import { CreditCard, Clock, Receipt } from 'lucide-react';
import { OrderStatus, PaymentMethod } from '@/types/payment';
import type { PaymentRecord } from '@/types/payment';

interface OrderPaymentInfoProps {
  order: {
    id: string;
    orderNo: string;
    amount: number;
    currency: string;
    paymentMethod: PaymentMethod;
    status: OrderStatus;
    createdAt: Date;
    paidAt?: Date;
    paymentRecords?: PaymentRecord[];
  };
}

export function OrderPaymentInfo({ order }: OrderPaymentInfoProps) {
  const getPaymentMethodName = (method: PaymentMethod): string => {
    const names: Record<PaymentMethod, string> = {
      [PaymentMethod.WECHAT]: '微信支付',
      [PaymentMethod.ALIPAY]: '支付宝',
      [PaymentMethod.BALANCE]: '余额支付',
    };
    return names[method] || '未知支付方式';
  };

  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAmount = (amount: number): string => {
    return `¥${amount.toFixed(2)}`;
  };

  const latestPaymentRecord = order.paymentRecords?.[0];

  return (
    <Card>
      <div className='p-6'>
        <h2 className='mb-4 text-2xl font-bold text-gray-900'>支付信息</h2>

        <div className='space-y-3 border-t border-gray-200 pt-4'>
          <div className='flex items-center gap-3'>
            <CreditCard className='h-5 w-5 text-gray-400' />
            <div className='flex-1'>
              <div className='text-sm text-gray-600'>支付方式</div>
              <div className='font-medium text-gray-900'>
                {getPaymentMethodName(order.paymentMethod)}
              </div>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <Clock className='h-5 w-5 text-gray-400' />
            <div className='flex-1'>
              <div className='text-sm text-gray-600'>支付时间</div>
              <div className='font-medium text-gray-900'>
                {formatDate(order.paidAt)}
              </div>
            </div>
          </div>

          {latestPaymentRecord && (
            <div className='flex items-center gap-3'>
              <Receipt className='h-5 w-5 text-gray-400' />
              <div className='flex-1'>
                <div className='text-sm text-gray-600'>交易流水号</div>
                <div className='font-mono text-sm text-gray-900'>
                  {latestPaymentRecord.transactionId || '-'}
                </div>
              </div>
            </div>
          )}

          {latestPaymentRecord?.thirdPartyOrderNo && (
            <div className='flex items-center gap-3'>
              <Receipt className='h-5 w-5 text-gray-400' />
              <div className='flex-1'>
                <div className='text-sm text-gray-600'>第三方订单号</div>
                <div className='font-mono text-sm text-gray-900'>
                  {latestPaymentRecord.thirdPartyOrderNo}
                </div>
              </div>
            </div>
          )}
        </div>

        {order.status === OrderStatus.PENDING && (
          <div className='mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800'>
            <div className='font-semibold'>待支付</div>
            <div className='mt-1'>
              订单尚未支付，请在{formatDate(order.createdAt)}后2小时内完成支付
            </div>
          </div>
        )}

        {order.status === OrderStatus.PAID && !order.paidAt && (
          <div className='mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800'>
            <div className='font-semibold'>支付成功</div>
            <div className='mt-1'>
              订单已支付成功，金额 {formatAmount(order.amount)}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
