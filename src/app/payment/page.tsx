'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, AlertCircle } from 'lucide-react';
import { PaymentMethodSelect } from '@/components/payment/PaymentMethodSelect';
import { PaymentConfirm } from '@/components/payment/PaymentConfirm';
import { PaymentMethod } from '@/types/payment';

interface MembershipTierInfo {
  id: string;
  name: string;
  displayName: string;
  tier: string;
  price: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';
  originalPrice?: unknown; // 保存原始价格数据用于调试
}

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tierId = searchParams.get('tierId');
  const billingCycle =
    (searchParams.get('billingCycle') as
      | 'MONTHLY'
      | 'QUARTERLY'
      | 'YEARLY'
      | 'LIFETIME') || 'MONTHLY';
  const orderId = searchParams.get('orderId');
  const paymentMethodParam = searchParams.get('paymentMethod');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tierInfo, setTierInfo] = useState<MembershipTierInfo | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);
  const [createdOrder, setCreatedOrder] = useState<{
    orderId: string;
    orderNo: string;
  } | null>(null);

  // 加载会员等级信息
  useEffect(() => {
    if (tierId) {
      void fetchTierInfo();
    } else if (orderId) {
      void fetchOrderInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierId, orderId]);

  useEffect(() => {
    if (paymentMethodParam) {
      const upper = paymentMethodParam.toUpperCase();
      if (Object.values(PaymentMethod).includes(upper as PaymentMethod)) {
        setSelectedPaymentMethod(upper as PaymentMethod);
      }
    }
  }, [paymentMethodParam]);

  const fetchTierInfo = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/memberships/tiers');

      if (!response.ok) {
        throw new Error('获取会员信息失败');
      }

      const data = await response.json();

      if (data.success && data.data?.tiers) {
        const tier = data.data.tiers.find(
          (t: MembershipTierInfo) => t.id === tierId
        );
        if (tier) {
          // 处理price字段：可能是字符串、数字或其他格式
          let normalizedPrice = 0;
          if (typeof tier.price === 'number') {
            normalizedPrice = tier.price;
          } else if (typeof tier.price === 'string') {
            // 尝试从字符串中提取数字
            const match = tier.price.match(/(\d+(?:\.\d+)?)/);
            if (match) {
              normalizedPrice = parseFloat(match[0]);
            }
          }

          setTierInfo({
            ...tier,
            price: normalizedPrice,
            billingCycle,
            originalPrice: tier.price, // 保存原始价格用于调试
          });
        } else {
          throw new Error('会员等级不存在');
        }
      } else {
        throw new Error(data.error || '获取会员信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取会员信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrderInfo = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      if (!orderId) {
        throw new Error('订单ID不存在');
      }

      const response = await fetch(`/api/orders/${orderId}`);

      if (!response.ok) {
        throw new Error('获取订单信息失败');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // 处理price字段
        let normalizedPrice = 0;
        const amount = Number(data.data.amount);
        if (!isNaN(amount)) {
          normalizedPrice = amount;
        }

        setTierInfo({
          id: data.data.membershipTierId,
          name: data.data.membershipTier?.name || '',
          displayName: data.data.membershipTier?.displayName || '',
          tier: data.data.membershipTier?.tier || '',
          price: normalizedPrice,
          currency: data.data.currency,
          billingCycle: 'MONTHLY',
        });
        setSelectedPaymentMethod(data.data.paymentMethod as PaymentMethod);
        setCreatedOrder({
          orderId: data.data.id,
          orderNo: data.data.orderNo,
        });
      } else {
        throw new Error(data.error || '获取订单信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取订单信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentMethodSelect = (method: PaymentMethod): void => {
    setSelectedPaymentMethod(method);
  };

  const handlePaymentConfirm = async (): Promise<void> => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!createdOrder || !selectedPaymentMethod || !tierInfo) {
        throw new Error('订单尚未准备完成，请稍候重试');
      }

      const params = new URLSearchParams({
        orderId: createdOrder.orderId,
        paymentMethod: selectedPaymentMethod,
        amount: String(tierInfo.price),
        currency: tierInfo.currency,
      });

      router.push(`/payment/processing?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '支付失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (): void => {
    if (confirm('确定要取消支付吗？')) {
      router.back();
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className='container mx-auto flex min-h-screen items-center justify-center px-4 py-8'>
        <div className='text-center'>
          <div className='mb-4 flex items-center justify-center'>
            <div className='h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
          </div>
          <p className='text-gray-600'>加载中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='container mx-auto flex min-h-screen items-center justify-center px-4 py-8'>
        <div className='max-w-md text-center'>
          <AlertCircle className='mx-auto mb-4 h-16 w-16 text-red-500' />
          <h2 className='mb-2 text-2xl font-bold text-gray-900'>加载失败</h2>
          <p className='mb-6 text-gray-600'>{error}</p>
          <div className='flex gap-3'>
            <Button
              onClick={() => router.back()}
              variant='outline'
              className='flex-1'
            >
              返回
            </Button>
            <Button onClick={() => window.location.reload()} className='flex-1'>
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页面标题 */}
      <div className='mb-8 flex items-center gap-3'>
        <button
          onClick={handleCancel}
          className='flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors'
        >
          <ArrowLeft className='h-5 w-5 text-gray-600' />
        </button>
        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
            <Crown className='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>支付页面</h1>
            <p className='text-gray-600'>请选择支付方式完成支付</p>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='mb-6 rounded-lg border border-red-200 bg-red-50 p-4'>
          <div className='flex items-start gap-3'>
            <AlertCircle className='mt-0.5 h-5 w-5 shrink-0 text-red-600' />
            <div>
              <h4 className='mb-1 font-semibold text-red-900'>错误</h4>
              <p className='text-sm text-red-800'>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* 会员等级信息 */}
      {tierInfo && (
        <div className='mb-6 rounded-lg border border-gray-200 bg-white p-6'>
          <div className='flex items-start justify-between'>
            <div>
              <h3 className='mb-2 text-xl font-bold text-gray-900'>
                {tierInfo.displayName}
              </h3>
              <p className='mb-4 text-gray-600'>{tierInfo.name}</p>
              <div className='flex items-baseline gap-2'>
                <span className='text-sm text-gray-600'>支付金额：</span>
                <span className='text-2xl font-bold text-gray-900'>
                  ¥{tierInfo.price.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 支付方式选择和确认 */}
      <div className='grid gap-6 lg:grid-cols-2'>
        {/* 左侧：支付方式选择 */}
        <PaymentMethodSelect
          selectedMethod={selectedPaymentMethod}
          onMethodSelect={handlePaymentMethodSelect}
          disabled={isSubmitting}
        />

        {/* 右侧：支付确认 */}
        {tierInfo && (
          <PaymentConfirm
            amount={tierInfo.price}
            membershipTierId={tierInfo.id}
            existingOrderId={orderId ?? undefined}
            billingCycle={tierInfo.billingCycle}
            description='会员升级'
            paymentMethod={selectedPaymentMethod}
            onConfirm={handlePaymentConfirm}
            onCancel={handleCancel}
            isLoading={isSubmitting}
            onOrderCreated={data => {
              setCreatedOrder({
                orderId: data.orderId,
                orderNo: data.orderNo,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
