import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Crown } from 'lucide-react';
import {
  MembershipTierDef,
  MembershipTier,
  BillingCycle,
} from '@/types/membership';

interface TierSelectionProps {
  tiers: MembershipTierDef[];
  currentTier?: MembershipTier | null;
  selectedTierId: string | null;
  onTierSelect: (tierId: string) => void;
  selectedBillingCycle: BillingCycle;
  onBillingCycleChange: (cycle: BillingCycle) => void;
}

export function TierSelection({
  tiers,
  currentTier,
  selectedTierId,
  onTierSelect,
  selectedBillingCycle,
  onBillingCycleChange,
}: TierSelectionProps) {
  const billingCycleOptions: Array<{ value: BillingCycle; label: string }> = [
    { value: BillingCycle.MONTHLY, label: '月付' },
    { value: BillingCycle.QUARTERLY, label: '季付' },
    { value: BillingCycle.YEARLY, label: '年付' },
  ];

  const getTierColor = (tierName: MembershipTier): string => {
    switch (tierName) {
      case MembershipTier.ENTERPRISE:
        return 'border-purple-500 bg-purple-50';
      case MembershipTier.PROFESSIONAL:
        return 'border-blue-500 bg-blue-50';
      case MembershipTier.BASIC:
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getBadgeColor = (tierName: MembershipTier): string => {
    switch (tierName) {
      case MembershipTier.ENTERPRISE:
        return 'bg-purple-500 text-white';
      case MembershipTier.PROFESSIONAL:
        return 'bg-blue-500 text-white';
      case MembershipTier.BASIC:
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const formatPrice = (price: number, cycle: BillingCycle): string => {
    const multiplier = cycle === 'QUARTERLY' ? 3 : cycle === 'YEARLY' ? 12 : 1;
    const totalPrice = Math.round(price * multiplier);
    return `¥${totalPrice}`;
  };

  const calculateSavings = (
    basePrice: number,
    cycle: BillingCycle
  ): number | null => {
    if (cycle === 'MONTHLY') return null;
    const multiplier = cycle === 'QUARTERLY' ? 3 : cycle === 'YEARLY' ? 12 : 1;
    const normalPrice = basePrice * multiplier;
    const discountedPrice =
      cycle === 'QUARTERLY' ? basePrice * 3 * 0.9 : basePrice * 12 * 0.85;
    const savings = Math.round(normalPrice - discountedPrice);
    return savings > 0 ? savings : null;
  };

  const getBillingCycleText = (cycle: BillingCycle): string => {
    switch (cycle) {
      case BillingCycle.MONTHLY:
        return '/ 月';
      case BillingCycle.QUARTERLY:
        return '/ 季';
      case BillingCycle.YEARLY:
        return '/ 年';
      case BillingCycle.LIFETIME:
        return ' / 永久';
      default:
        return '';
    }
  };

  return (
    <div className='space-y-6'>
      {/* 计费周期选择 */}
      <div className='flex items-center justify-between rounded-lg border bg-white p-4'>
        <div className='flex items-center gap-3'>
          <Crown className='h-5 w-5 text-blue-600' />
          <div>
            <h3 className='font-semibold text-gray-900'>计费周期</h3>
            <p className='text-sm text-gray-600'>
              选择更长的周期可享受更多优惠
            </p>
          </div>
        </div>
        <div className='flex gap-2'>
          {billingCycleOptions.map(option => (
            <Button
              key={option.value}
              variant={
                selectedBillingCycle === option.value ? 'default' : 'outline'
              }
              onClick={() => onBillingCycleChange(option.value)}
              size='sm'
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* 会员等级选择 */}
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {tiers.map(tier => {
          const isCurrentTier = currentTier === tier.tier;
          const isSelected = selectedTierId === tier.id;
          const price = formatPrice(tier.price, selectedBillingCycle);
          const savings = calculateSavings(tier.price, selectedBillingCycle);
          const showSavings = savings !== null && savings > 0;

          return (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                isSelected
                  ? 'border-2 border-blue-500 shadow-lg'
                  : `border ${getTierColor(tier.tier)}`
              }`}
              onClick={() => onTierSelect(tier.id)}
            >
              {isCurrentTier && (
                <div className='absolute right-4 top-4'>
                  <Badge className={getBadgeColor(tier.tier)}>当前方案</Badge>
                </div>
              )}

              <div className='p-6'>
                {/* 等级名称和描述 */}
                <div className='mb-4'>
                  <h3 className='mb-2 text-xl font-bold text-gray-900'>
                    {tier.displayName}
                  </h3>
                  <p className='text-sm text-gray-600'>{tier.description}</p>
                </div>

                {/* 价格 */}
                <div className='mb-4'>
                  <div className='flex items-baseline gap-1'>
                    <span className='text-3xl font-bold text-gray-900'>
                      {price}
                    </span>
                    <span className='text-sm text-gray-600'>
                      {getBillingCycleText(selectedBillingCycle)}
                    </span>
                  </div>
                  {showSavings && (
                    <div className='mt-1 text-xs text-red-600'>
                      节省 ¥{savings}
                    </div>
                  )}
                </div>

                {/* 功能列表 */}
                <div className='mb-4'>
                  <h4 className='mb-2 text-sm font-semibold text-gray-900'>
                    功能特性
                  </h4>
                  <ul className='space-y-1'>
                    {tier.features.slice(0, 5).map((feature, index) => (
                      <li
                        key={index}
                        className='flex items-start gap-2 text-sm text-gray-700'
                      >
                        <Check className='h-4 w-4 shrink-0 text-green-600' />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {tier.features.length > 5 && (
                      <li className='ml-6 text-sm text-gray-600'>
                        等{tier.features.length}项功能...
                      </li>
                    )}
                  </ul>
                </div>

                {/* 选中标记 */}
                {isSelected && (
                  <div className='mt-4 flex items-center justify-center rounded-lg bg-blue-100 py-2 text-sm font-medium text-blue-700'>
                    已选择
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
