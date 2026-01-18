import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, Tag } from 'lucide-react';
import { Order, OrderStatus } from '@/types/payment';

interface OrderDetailHeaderProps {
  order: Order;
}

export function OrderDetailHeader({ order }: OrderDetailHeaderProps) {
  const getStatusVariant = (
    status: OrderStatus
  ): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case OrderStatus.PAID:
        return 'default';
      case OrderStatus.PENDING:
        return 'secondary';
      case OrderStatus.CANCELLED:
      case OrderStatus.FAILED:
      case OrderStatus.EXPIRED:
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getStatusText = (status: OrderStatus): string => {
    switch (status) {
      case OrderStatus.PENDING:
        return '待支付';
      case OrderStatus.PROCESSING:
        return '处理中';
      case OrderStatus.PAID:
        return '已支付';
      case OrderStatus.FAILED:
        return '支付失败';
      case OrderStatus.CANCELLED:
        return '已取消';
      case OrderStatus.REFUNDED:
        return '已退款';
      case OrderStatus.EXPIRED:
        return '已过期';
      default:
        return '未知状态';
    }
  };

  const formatDate = (date: Date | string): string => {
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

  return (
    <Card>
      <div className='p-6'>
        <div className='mb-4 flex items-start justify-between'>
          <div>
            <h2 className='mb-2 text-2xl font-bold text-gray-900'>订单信息</h2>
            <div className='font-mono text-lg text-gray-700'>
              订单号: {order.orderNo}
            </div>
          </div>
          <Badge variant={getStatusVariant(order.status)} className='text-lg'>
            {getStatusText(order.status)}
          </Badge>
        </div>

        <div className='space-y-3 border-t border-gray-200 pt-4'>
          <div className='flex items-center gap-3'>
            <Calendar className='h-5 w-5 text-gray-400' />
            <div className='flex-1'>
              <div className='text-sm text-gray-600'>创建时间</div>
              <div className='font-medium text-gray-900'>
                {formatDate(order.createdAt)}
              </div>
            </div>
          </div>

          <div className='flex items-center gap-3'>
            <DollarSign className='h-5 w-5 text-gray-400' />
            <div className='flex-1'>
              <div className='text-sm text-gray-600'>订单金额</div>
              <div className='text-xl font-bold text-gray-900'>
                {formatAmount(order.amount)}
              </div>
            </div>
          </div>

          {order.description && (
            <div className='flex items-center gap-3'>
              <Tag className='h-5 w-5 text-gray-400' />
              <div className='flex-1'>
                <div className='text-sm text-gray-600'>订单描述</div>
                <div className='font-medium text-gray-900'>
                  {order.description}
                </div>
              </div>
            </div>
          )}

          {order.failedReason && (
            <div className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
              <div className='font-semibold'>失败原因</div>
              <div>{order.failedReason}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
