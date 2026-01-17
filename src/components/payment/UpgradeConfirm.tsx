import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Calendar, Shield } from 'lucide-react';
import {
  MembershipTierDef,
  MembershipTier,
  BillingCycle,
} from '@/types/membership';

interface UpgradeConfirmProps {
  tier: MembershipTierDef;
  billingCycle: BillingCycle;
  paymentMethod: string | null;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function UpgradeConfirm({
  tier,
  billingCycle,
  paymentMethod,
  onConfirm,
  onCancel,
  isLoading = false,
}: UpgradeConfirmProps) {
  const formatPrice = (price: number, cycle: BillingCycle): string => {
    const multiplier = cycle === 'QUARTERLY' ? 3 : cycle === 'YEARLY' ? 12 : 1;
    const totalPrice = Math.round(price * multiplier);
    return `¥${totalPrice}`;
  };

  const getBillingCycleText = (cycle: BillingCycle): string => {
    switch (cycle) {
      case BillingCycle.MONTHLY:
        return '月付';
      case BillingCycle.QUARTERLY:
        return '季付';
      case BillingCycle.YEARLY:
        return '年付';
      case BillingCycle.LIFETIME:
        return '永久';
      default:
        return '';
    }
  };

  const getTierColor = (tierName: MembershipTier): string => {
    switch (tierName) {
      case MembershipTier.ENTERPRISE:
        return 'text-purple-600';
      case MembershipTier.PROFESSIONAL:
        return 'text-blue-600';
      case MembershipTier.BASIC:
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getPaymentMethodName = (method: string): string => {
    switch (method) {
      case 'wechat':
        return '微信支付';
      case 'alipay':
        return '支付宝';
      case 'bank_card':
        return '银行卡';
      case 'balance':
        return '余额支付';
      default:
        return '未知';
    }
  };

  return (
    <Card className='border-2 border-blue-200'>
      <div className='p-6'>
        {/* 标题 */}
        <div className='mb-6 flex items-center gap-3'>
          <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
            <Crown className='h-6 w-6 text-blue-600' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>确认升级</h2>
            <p className='text-sm text-gray-600'>请确认您的升级信息</p>
          </div>
        </div>

        {/* 升级信息 */}
        <div className='mb-6 space-y-4'>
          {/* 会员等级 */}
          <div className='flex items-start justify-between'>
            <div className='flex-1'>
              <div className='mb-1 flex items-center gap-2'>
                <h3 className='font-semibold text-gray-900'>会员等级</h3>
                <Badge className={getTierColor(tier.tier)}>
                  {tier.displayName}
                </Badge>
              </div>
              <p className='text-sm text-gray-600'>{tier.description}</p>
            </div>
          </div>

          {/* 计费周期 */}
          <div className='flex items-center justify-between border-t pt-4'>
            <div className='flex items-center gap-2'>
              <Calendar className='h-4 w-4 text-gray-600' />
              <span className='text-sm text-gray-600'>计费周期</span>
            </div>
            <span className='text-sm font-semibold text-gray-900'>
              {getBillingCycleText(billingCycle)}
            </span>
          </div>

          {/* 支付方式 */}
          <div className='flex items-center justify-between border-t pt-4'>
            <div className='flex items-center gap-2'>
              <Shield className='h-4 w-4 text-gray-600' />
              <span className='text-sm text-gray-600'>支付方式</span>
            </div>
            <span className='text-sm font-semibold text-gray-900'>
              {paymentMethod ? getPaymentMethodName(paymentMethod) : '未选择'}
            </span>
          </div>

          {/* 支付金额 */}
          <div className='flex items-center justify-between border-t pt-4'>
            <span className='text-sm text-gray-600'>支付金额</span>
            <span className='text-2xl font-bold text-gray-900'>
              {formatPrice(tier.price, billingCycle)}
            </span>
          </div>
        </div>

        {/* 功能摘要 */}
        <div className='mb-6 rounded-lg border bg-gray-50 p-4'>
          <h4 className='mb-3 font-semibold text-gray-900'>包含功能</h4>
          <ul className='space-y-2'>
            {tier.features.slice(0, 4).map((feature, index) => (
              <li
                key={index}
                className='flex items-start gap-2 text-sm text-gray-700'
              >
                <Check className='h-4 w-4 shrink-0 text-green-600' />
                <span>{feature}</span>
              </li>
            ))}
            {tier.features.length > 4 && (
              <li className='ml-6 text-sm text-gray-600'>
                等{tier.features.length}项功能
              </li>
            )}
          </ul>
        </div>

        {/* 注意事项 */}
        <div className='mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4'>
          <h4 className='mb-2 text-sm font-semibold text-yellow-900'>
            注意事项
          </h4>
          <ul className='space-y-1 text-xs text-yellow-800'>
            <li>• 升级后立即生效，按新等级计算使用量限制</li>
            <li>• 当前会员剩余时间将折算到新会员</li>
            <li>• 升级后可在会员中心管理您的订阅</li>
            <li>• 任何问题请随时联系客服</li>
          </ul>
        </div>

        {/* 操作按钮 */}
        <div className='flex gap-3'>
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant='outline'
            className='flex-1'
          >
            取消
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || !paymentMethod}
            className='flex-1'
          >
            {isLoading ? '处理中...' : '确认支付'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
