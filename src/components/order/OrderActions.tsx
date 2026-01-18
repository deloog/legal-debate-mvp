'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { OrderStatus } from '@/types/payment';
import { useState } from 'react';

interface OrderActionsProps {
  orderId: string;
  status: OrderStatus;
}

export function OrderActions({ orderId, status }: OrderActionsProps) {
  const [isCancelling, setIsCancelling] = useState(false);

  const handleBackToList = (): void => {
    window.location.href = '/orders';
  };

  const handleCancelOrder = async (): Promise<void> => {
    if (!confirm('确定要取消这个订单吗？')) {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel',
          reason: '用户主动取消',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '取消订单失败');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || '取消订单失败');
      }

      alert('订单已取消');
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '取消订单失败');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRefresh = (): void => {
    window.location.reload();
  };

  return (
    <Card>
      <div className='p-6'>
        <h2 className='mb-4 text-2xl font-bold text-gray-900'>订单操作</h2>

        <div className='space-y-3'>
          {/* 待支付状态 */}
          {status === OrderStatus.PENDING && (
            <>
              <Button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                variant='outline'
                className='w-full'
              >
                <AlertCircle className='mr-2 h-4 w-4' />
                {isCancelling ? '取消中...' : '取消订单'}
              </Button>
              <div className='rounded-md bg-blue-50 p-3 text-sm text-blue-800'>
                <div className='font-semibold'>待支付提示</div>
                <div className='mt-1'>
                  订单尚未支付，请尽快完成支付。如果需要取消订单，可以点击上方按钮。
                </div>
              </div>
            </>
          )}

          {/* 已支付状态 */}
          {status === OrderStatus.PAID && (
            <div className='rounded-md bg-green-50 p-3 text-sm text-green-800'>
              <div className='font-semibold'>支付成功</div>
              <div className='mt-1'>
                订单已支付成功，会员权益已生效。如需发票或退款，请联系客服。
              </div>
            </div>
          )}

          {/* 已取消状态 */}
          {status === OrderStatus.CANCELLED && (
            <div className='rounded-md bg-gray-50 p-3 text-sm text-gray-800'>
              <div className='font-semibold'>订单已取消</div>
              <div className='mt-1'>
                该订单已被取消，如需重新购买，请访问会员中心。
              </div>
            </div>
          )}

          {/* 已过期状态 */}
          {status === OrderStatus.EXPIRED && (
            <div className='rounded-md bg-orange-50 p-3 text-sm text-orange-800'>
              <div className='font-semibold'>订单已过期</div>
              <div className='mt-1'>订单已超过支付期限，请重新创建订单。</div>
            </div>
          )}

          {/* 支付失败状态 */}
          {status === OrderStatus.FAILED && (
            <div className='rounded-md bg-red-50 p-3 text-sm text-red-800'>
              <div className='font-semibold'>支付失败</div>
              <div className='mt-1'>
                订单支付失败，请重新创建订单或联系客服。
              </div>
            </div>
          )}

          {/* 通用操作按钮 */}
          <div className='grid grid-cols-2 gap-3'>
            <Button
              onClick={handleBackToList}
              variant='outline'
              className='w-full'
            >
              <ArrowLeft className='mr-2 h-4 w-4' />
              返回列表
            </Button>
            <Button
              onClick={handleRefresh}
              variant='outline'
              className='w-full'
            >
              <RefreshCw className='mr-2 h-4 w-4' />
              刷新页面
            </Button>
          </div>

          {/* 联系客服 */}
          <div className='rounded-md bg-gray-50 p-4 text-center'>
            <div className='mb-2 text-sm font-semibold text-gray-900'>
              需要帮助？
            </div>
            <div className='text-sm text-gray-600'>
              如有任何问题，请联系客服：
            </div>
            <div className='mt-2 text-sm text-blue-600'>
              邮箱：support@example.com
            </div>
            <div className='text-sm text-blue-600'>电话：400-xxx-xxxx</div>
          </div>
        </div>
      </div>
    </Card>
  );
}
