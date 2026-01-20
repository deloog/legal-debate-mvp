'use client';

import { BillingCycle } from '@/types/membership';

// =============================================================================
// 类型定义
// =============================================================================

interface PriceBreakdownProps {
  price: number;
  billingCycle: BillingCycle;
  savings?: number;
  currency?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

function getBillingCycleLabel(cycle: BillingCycle): string {
  const labels: Record<BillingCycle, string> = {
    [BillingCycle.MONTHLY]: '月付',
    [BillingCycle.QUARTERLY]: '季付',
    [BillingCycle.YEARLY]: '年付',
    [BillingCycle.LIFETIME]: '永久',
  };
  return labels[cycle] || cycle;
}

function calculateMonthlyPrice(price: number, cycle: BillingCycle): number {
  switch (cycle) {
    case BillingCycle.MONTHLY:
      return price;
    case BillingCycle.QUARTERLY:
      return price / 3;
    case BillingCycle.YEARLY:
      return price / 12;
    case BillingCycle.LIFETIME:
      return 0;
    default:
      return price;
  }
}

// =============================================================================
// 主组件
// =============================================================================

export function PriceBreakdown({
  price,
  billingCycle,
  savings,
  currency = '¥',
}: PriceBreakdownProps): React.ReactElement {
  const cycleLabel = getBillingCycleLabel(billingCycle);
  const monthlyPrice = calculateMonthlyPrice(price, billingCycle);

  return (
    <div className='bg-white rounded-lg shadow p-6'>
      <h3 className='text-lg font-semibold text-gray-900 mb-4'>价格明细</h3>

      <div className='space-y-4'>
        {/* 主要价格 */}
        <div className='flex items-baseline justify-between'>
          <span className='text-gray-600'>价格</span>
          <div className='flex items-baseline'>
            <span className='text-3xl font-bold text-gray-900'>
              {currency}
              {price.toFixed(2)}
            </span>
            <span className='ml-2 text-sm text-gray-500'>/{cycleLabel}</span>
          </div>
        </div>

        {/* 月均价格（如果不是月付或永久） */}
        {billingCycle !== BillingCycle.MONTHLY &&
          billingCycle !== BillingCycle.LIFETIME && (
            <div className='flex items-baseline justify-between'>
              <span className='text-gray-600'>月均价格</span>
              <div className='flex items-baseline'>
                <span className='text-lg font-semibold text-gray-700'>
                  {currency}
                  {monthlyPrice.toFixed(2)}
                </span>
                <span className='ml-2 text-sm text-gray-500'>/月</span>
              </div>
            </div>
          )}

        {/* 节省金额 */}
        {savings !== undefined && savings > 0 && (
          <div className='flex items-center justify-between rounded-lg bg-green-50 p-3'>
            <span className='font-medium text-green-900'>节省</span>
            <div className='flex items-baseline'>
              <span className='text-2xl font-bold text-green-700'>
                {currency}
                {savings.toFixed(2)}
              </span>
              <span className='ml-2 text-sm text-green-600'>对比月付</span>
            </div>
          </div>
        )}

        {/* 费用说明 */}
        <div className='pt-4 border-t border-gray-200'>
          <p className='text-sm text-gray-500'>
            {billingCycle === BillingCycle.LIFETIME
              ? '一次性购买，永久使用，无需续费'
              : '购买后立即生效，到期后自动续费，可随时取消'}
          </p>
        </div>
      </div>
    </div>
  );
}
