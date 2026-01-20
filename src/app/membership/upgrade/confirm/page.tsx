'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Crown, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UpgradeComparison } from '@/components/membership/UpgradeComparison';
import { PriceBreakdown } from '@/components/membership/PriceBreakdown';
import { MembershipTierDef, BillingCycle } from '@/types/membership';

// =============================================================================
// 类型定义
// =============================================================================

interface MembershipInfoResponse {
  success: boolean;
  data?: {
    currentMembership: {
      tier: MembershipTierDef | null;
    } | null;
    availableTiers: MembershipTierDef[];
  };
  error?: string;
}

// =============================================================================
// 主页面组件
// =============================================================================

export default function MembershipUpgradeConfirmPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tierId = searchParams.get('tierId');
  const billingCycleParam = searchParams.get('billingCycle');

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const [membershipData, setMembershipData] =
    useState<MembershipInfoResponse | null>(null);
  const [selectedTier, setSelectedTier] = useState<MembershipTierDef | null>(
    null
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    BillingCycle.MONTHLY
  );

  const loadMembershipData = useCallback(async (): Promise<void> => {
    if (!tierId) {
      setError('缺少会员等级参数');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/memberships/tiers');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取会员信息失败');
      }

      setMembershipData(data);

      // 查找目标会员等级
      const targetTier = data.data?.availableTiers.find(
        tier => tier.id === tierId
      );

      if (!targetTier) {
        throw new Error('未找到指定的会员等级');
      }

      setSelectedTier(targetTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [tierId]);

  // 加载会员数据
  useEffect(() => {
    void loadMembershipData();
  }, [loadMembershipData]);

  // 设置计费周期
  useEffect(() => {
    if (billingCycleParam) {
      const cycle = billingCycleParam.toUpperCase() as BillingCycle;
      if (Object.values(BillingCycle).includes(cycle)) {
        setBillingCycle(cycle);
      }
    }
  }, [billingCycleParam]);

  const handleConfirm = async (): Promise<void> => {
    if (!selectedTier) {
      setError('请选择会员等级');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // 调用升级API
      const response = await fetch('/api/memberships/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tierId: selectedTier.id,
          billingCycle,
          autoRenew: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '升级失败，请稍后重试');
      }

      // 跳转到支付页面
      if (data.data?.order?.paymentUrl) {
        window.location.href = data.data.order.paymentUrl;
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '升级失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (): void => {
    router.push('/membership/upgrade');
  };

  const handleBack = (): void => {
    router.push('/membership');
  };

  const handleGoToMembership = (): void => {
    router.push('/membership');
  };

  // 加载状态
  if (loading) {
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
  if (error && !membershipData) {
    return (
      <div className='container mx-auto flex min-h-screen items-center justify-center px-4 py-8'>
        <div className='max-w-md text-center'>
          <AlertCircle className='mx-auto mb-4 h-16 w-16 text-red-500' />
          <h2 className='mb-2 text-2xl font-bold text-gray-900'>加载失败</h2>
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

  // 成功状态
  if (success) {
    return (
      <div className='container mx-auto flex min-h-screen items-center justify-center px-4 py-8'>
        <div className='max-w-md text-center'>
          <CheckCircle className='mx-auto mb-4 h-16 w-16 text-green-500' />
          <h2 className='mb-2 text-2xl font-bold text-gray-900'>升级成功</h2>
          <p className='mb-6 text-gray-600'>
            恭喜！您的会员等级已升级成功，现在可以享受更多功能了。
          </p>
          <Button onClick={handleGoToMembership} className='w-full'>
            前往会员中心
          </Button>
        </div>
      </div>
    );
  }

  const currentTier = membershipData?.data?.currentMembership?.tier || null;

  if (!selectedTier) {
    return null;
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页面标题 */}
      <div className='mb-8'>
        <button
          onClick={handleCancel}
          className='mb-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          返回选择等级
        </button>
        <div className='flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
            <Crown className='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>确认会员升级</h1>
            <p className='text-gray-600'>请仔细核对升级信息</p>
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

      <div className='grid gap-6 lg:grid-cols-2'>
        {/* 左侧：权益对比 */}
        <div>
          <UpgradeComparison
            currentTier={currentTier}
            targetTier={selectedTier}
          />
        </div>

        {/* 右侧：价格和操作 */}
        <div className='space-y-6'>
          {/* 计费周期选择 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h3 className='text-lg font-semibold text-gray-900 mb-4'>
              选择计费周期
            </h3>
            <div className='grid grid-cols-3 gap-3'>
              {[
                { value: BillingCycle.MONTHLY, label: '月付' },
                { value: BillingCycle.QUARTERLY, label: '季付' },
                { value: BillingCycle.YEARLY, label: '年付' },
              ].map(option => (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => setBillingCycle(option.value)}
                  className={`p-3 border rounded-lg transition-colors ${
                    billingCycle === option.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className='text-sm font-medium'>{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 价格明细 */}
          {selectedTier.billingCycle === billingCycle && (
            <PriceBreakdown
              price={selectedTier.price}
              billingCycle={billingCycle}
              savings={
                billingCycle === BillingCycle.QUARTERLY
                  ? selectedTier.price * 0.1
                  : billingCycle === BillingCycle.YEARLY
                    ? selectedTier.price * 0.2
                    : undefined
              }
            />
          )}

          {/* 操作按钮 */}
          <div className='space-y-3'>
            <Button
              onClick={handleConfirm}
              disabled={submitting}
              className='w-full'
            >
              {submitting ? '处理中...' : '确认升级'}
            </Button>
            <Button
              onClick={handleCancel}
              variant='outline'
              disabled={submitting}
              className='w-full'
            >
              取消
            </Button>
          </div>

          {/* 注意事项 */}
          <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
            <h4 className='mb-2 text-sm font-semibold text-blue-900'>
              注意事项
            </h4>
            <ul className='list-inside list-disc space-y-1 text-sm text-blue-800'>
              <li>升级后立即生效，您将获得所选会员等级的所有权益</li>
              <li>订单生效后无法降级，请谨慎选择</li>
              <li>如有疑问，请联系客服</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
