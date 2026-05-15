'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { PaymentMethod, CreateOrderResponse } from '@/types/payment';

interface PaymentConfirmProps {
  amount: number;
  currency?: string;
  membershipTierId?: string;
  existingOrderId?: string;
  billingCycle?: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';
  description?: string;
  paymentMethod: PaymentMethod | null;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  onOrderCreated?: (data: NonNullable<CreateOrderResponse['data']>) => void;
}

export function PaymentConfirm({
  amount,
  membershipTierId,
  existingOrderId,
  billingCycle = 'MONTHLY',
  description = '会员升级',
  paymentMethod,
  onConfirm,
  onCancel,
  isLoading = false,
  onOrderCreated,
}: PaymentConfirmProps) {
  const [orderData, setOrderData] = useState<
    CreateOrderResponse['data'] | null
  >(null);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 订单倒计时
  const [timeLeft, setTimeLeft] = useState<number>(7200); // 2小时 = 7200秒

  // 创建订单
  useEffect(() => {
    if (!existingOrderId && membershipTierId && paymentMethod) {
      void createOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membershipTierId, paymentMethod, existingOrderId]);

  // 倒计时
  useEffect(() => {
    if (timeLeft <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const createOrder = async (): Promise<void> => {
    try {
      setIsCreatingOrder(true);
      setError(null);

      if (!membershipTierId || !paymentMethod) {
        throw new Error('缺少必要参数');
      }

      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          membershipTierId,
          paymentMethod,
          billingCycle,
          description,
          autoRenew: false,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建订单失败');
      }

      setOrderData(data.data);
      if (data.data) {
        onOrderCreated?.(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建订单失败');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const getPaymentMethodName = (method: PaymentMethod): string => {
    switch (method) {
      case PaymentMethod.WECHAT:
        return '微信支付';
      case PaymentMethod.ALIPAY:
        return '支付宝';
      case PaymentMethod.BALANCE:
        return '余额支付';
      default:
        return '未知支付方式';
    }
  };

  return (
    <div className='space-y-4'>
      <h3 className='text-lg font-semibold text-gray-900'>支付确认</h3>

      {/* 错误提示 */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-start gap-3'>
            <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-600' />
            <div>
              <h4 className='mb-1 font-semibold text-red-900'>错误</h4>
              <p className='text-sm text-red-800'>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 订单信息 */}
      <div className='rounded-lg border border-gray-200 bg-white p-4'>
        <div className='space-y-3'>
          {/* 支付金额 */}
          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>支付金额</span>
            <span className='text-2xl font-bold text-gray-900'>
              ¥{amount.toFixed(2)}
            </span>
          </div>

          {/* 支付方式 */}
          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>支付方式</span>
            <span className='font-semibold text-gray-900'>
              {paymentMethod ? getPaymentMethodName(paymentMethod) : '-'}
            </span>
          </div>

          {/* 订单描述 */}
          <div className='flex items-center justify-between'>
            <span className='text-gray-600'>订单描述</span>
            <span className='font-medium text-gray-900'>{description}</span>
          </div>

          {/* 订单号 */}
          {orderData?.orderNo && (
            <div className='flex items-center justify-between'>
              <span className='text-gray-600'>订单号</span>
              <span className='font-mono text-sm text-gray-900'>
                {orderData.orderNo}
              </span>
            </div>
          )}

          {/* 倒计时 */}
          <div className='flex items-center justify-between rounded-lg bg-blue-50 p-3'>
            <div className='flex items-center gap-2'>
              <Clock className='h-4 w-4 text-blue-600' />
              <span className='text-sm text-blue-900'>支付剩余时间</span>
            </div>
            <span className='font-mono text-lg font-semibold text-blue-900'>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      </div>

      {/* 支付二维码或链接 */}
      {orderData?.codeUrl && (
        <div className='rounded-lg border border-gray-200 bg-white p-4'>
          <div className='mb-4 text-center'>
            <p className='mb-2 text-sm text-gray-600'>
              请使用手机扫描下方二维码完成支付
            </p>
            <div className='mx-auto flex h-48 w-48 items-center justify-center rounded-lg border-2 border-gray-300 bg-white'>
              <Image
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180&data=${encodeURIComponent(orderData.codeUrl)}`}
                alt='支付二维码'
                width={176}
                height={176}
                className='h-44 w-44'
                unoptimized
              />
            </div>
          </div>
        </div>
      )}

      {/* 支付宝二维码（统一映射为 codeUrl 之前的兼容展示） */}
      {(orderData as CreateOrderResponse['data'] & { qrCode?: string })
        ?.qrCode &&
        !orderData?.codeUrl && (
          <div className='rounded-lg border border-gray-200 bg-white p-4'>
            <div className='mb-4 text-center'>
              <p className='mb-2 text-sm text-gray-600'>
                请使用手机扫描下方二维码完成支付
              </p>
              <div className='mx-auto flex h-48 w-48 items-center justify-center rounded-lg border-2 border-gray-300 bg-white'>
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180&data=${encodeURIComponent(
                    (
                      orderData as CreateOrderResponse['data'] & {
                        qrCode?: string;
                      }
                    ).qrCode || ''
                  )}`}
                  alt='支付二维码'
                  width={176}
                  height={176}
                  className='h-44 w-44'
                  unoptimized
                />
              </div>
            </div>
          </div>
        )}

      {/* 支付链接 */}
      {orderData?.paymentUrl && (
        <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <p className='mb-2 text-sm text-blue-900'>点击下方链接完成支付</p>
          <a
            href={orderData.paymentUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white transition-colors hover:bg-blue-700'
          >
            前往支付
          </a>
        </div>
      )}

      {/* 支付成功提示 */}
      {orderData?.status === 'PAID' && (
        <div className='rounded-lg border border-green-200 bg-green-50 p-4'>
          <div className='flex items-center gap-3'>
            <CheckCircle2 className='h-6 w-6 text-green-600' />
            <div>
              <h4 className='font-semibold text-green-900'>支付成功</h4>
              <p className='text-sm text-green-800'>
                您的支付已完成，会员权益已生效。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className='flex gap-3'>
        <Button
          onClick={onCancel}
          variant='outline'
          className='flex-1'
          disabled={isLoading || isCreatingOrder}
        >
          取消
        </Button>
        <Button
          onClick={onConfirm}
          className='flex-1'
          disabled={
            isLoading ||
            isCreatingOrder ||
            !paymentMethod ||
            !orderData ||
            timeLeft <= 0
          }
        >
          {isLoading ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              处理中...
            </>
          ) : (
            '确认支付'
          )}
        </Button>
      </div>

      {/* 温馨提示 */}
      <div className='rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
        <h4 className='mb-2 font-semibold text-yellow-900'>温馨提示</h4>
        <ul className='list-inside list-disc space-y-1 text-sm text-yellow-800'>
          <li>请在2小时内完成支付，否则订单将自动取消</li>
          <li>支付成功后请勿关闭页面，系统将自动跳转</li>
          <li>如有疑问，请联系客服</li>
        </ul>
      </div>
    </div>
  );
}
