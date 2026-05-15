'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TierSelection } from '@/components/payment/TierSelection';
import { PaymentMethodSelector } from '@/components/payment/PaymentMethodSelector';
import { UpgradeConfirm } from '@/components/payment/UpgradeConfirm';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Crown, AlertCircle } from 'lucide-react';
import {
  MembershipTierDef,
  MembershipTier,
  BillingCycle,
} from '@/types/membership';

type PaymentMethod = 'wechat' | 'alipay' | 'bank_card' | 'balance';

interface MembershipData {
  currentMembership: {
    tier: MembershipTier;
  } | null;
  availableTiers: MembershipTierDef[];
}

export default function MembershipUpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTierId = searchParams.get('tierId');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membershipData, setMembershipData] = useState<MembershipData | null>(
    null
  );
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [selectedBillingCycle, setSelectedBillingCycle] =
    useState<BillingCycle>(BillingCycle.MONTHLY);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(null);

  const selectedTier = membershipData?.availableTiers.find(
    tier => tier.id === selectedTierId
  );

  // 加载会员数据
  useEffect(() => {
    void fetchMembershipData();
  }, []);

  // 设置预选等级
  useEffect(() => {
    if (preselectedTierId && membershipData?.availableTiers) {
      const tier = membershipData.availableTiers.find(
        t => t.id === preselectedTierId
      );
      if (tier) {
        setSelectedTierId(preselectedTierId);
      }
    }
  }, [preselectedTierId, membershipData]);

  const fetchMembershipData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/memberships/tiers');

      if (!response.ok) {
        throw new Error('获取会员等级信息失败');
      }

      const data = await response.json();

      if (data.success) {
        setMembershipData({
          currentMembership: null,
          availableTiers: data.data?.tiers || [],
        });
      } else {
        throw new Error(data.error || '获取会员等级信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取会员等级信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTierSelect = (tierId: string): void => {
    setSelectedTierId(tierId);
    setStep(2);
  };

  const handlePaymentMethodSelect = (method: PaymentMethod): void => {
    setSelectedPaymentMethod(method);
  };

  const handleConfirm = async (): Promise<void> => {
    if (!selectedTierId) {
      setError('请选择会员等级');
      return;
    }

    if (!selectedPaymentMethod) {
      setError('请选择支付方式');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const params = new URLSearchParams({
        tierId: selectedTierId,
        billingCycle: selectedBillingCycle,
        paymentMethod: selectedPaymentMethod,
      });
      router.push(`/payment?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '升级失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = (): void => {
    if (step === 1) {
      router.push('/membership');
    } else if (step === 2) {
      setStep(1);
    }
  };

  const handleBack = (): void => {
    router.push('/membership');
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
  if (error && step === 3) {
    return (
      <div className='container mx-auto flex min-h-screen items-center justify-center px-4 py-8'>
        <div className='max-w-md text-center'>
          <AlertCircle className='mx-auto mb-4 h-16 w-16 text-red-500' />
          <h2 className='mb-2 text-2xl font-bold text-gray-900'>升级失败</h2>
          <p className='mb-6 text-gray-600'>{error}</p>
          <div className='flex gap-3'>
            <Button onClick={handleBack} variant='outline' className='flex-1'>
              返回会员中心
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
          onClick={handleBack}
          className='flex h-10 w-10 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors'
        >
          <ArrowLeft className='h-5 w-5 text-gray-600' />
        </button>
        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
            <Crown className='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>升级会员</h1>
            <p className='text-gray-600'>选择适合您的会员方案</p>
          </div>
        </div>
      </div>

      {/* 进度指示器 */}
      <div className='mb-8'>
        <div className='flex items-center justify-between'>
          <div className='flex flex-1 items-center'>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step >= 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              1
            </div>
            <span
              className={`ml-2 text-sm ${
                step >= 1 ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              选择等级
            </span>
          </div>
          <div
            className={`mx-4 flex-1 border-t-2 ${
              step > 1 ? 'border-blue-600' : 'border-gray-200'
            }`}
          />
          <div className='flex flex-1 items-center'>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step >= 2
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              2
            </div>
            <span
              className={`ml-2 text-sm ${
                step >= 2 ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              选择支付
            </span>
          </div>
          <div
            className={`mx-4 flex-1 border-t-2 ${
              step > 2 ? 'border-blue-600' : 'border-gray-200'
            }`}
          />
          <div className='flex flex-1 items-center'>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                step >= 3
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              3
            </div>
            <span
              className={`ml-2 text-sm ${
                step >= 3 ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              完成支付
            </span>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && step !== 3 && (
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

      {/* 步骤内容 */}
      <div className='max-w-4xl mx-auto'>
        {step === 1 && membershipData && (
          <TierSelection
            tiers={membershipData.availableTiers}
            currentTier={membershipData.currentMembership?.tier || null}
            selectedTierId={selectedTierId}
            onTierSelect={handleTierSelect}
            selectedBillingCycle={selectedBillingCycle}
            onBillingCycleChange={setSelectedBillingCycle}
          />
        )}

        {step === 2 && selectedTier && (
          <div className='grid gap-6 lg:grid-cols-2'>
            {/* 左侧：支付方式选择 */}
            <PaymentMethodSelector
              selectedMethod={selectedPaymentMethod}
              onMethodSelect={handlePaymentMethodSelect}
              disabled={isSubmitting}
            />

            {/* 右侧：升级确认 */}
            <UpgradeConfirm
              tier={selectedTier}
              billingCycle={selectedBillingCycle}
              paymentMethod={selectedPaymentMethod}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              isLoading={isSubmitting}
            />
          </div>
        )}
      </div>
    </div>
  );
}
