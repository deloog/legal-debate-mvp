import { Card } from '@/components/ui/card';
import { Crown, Check, Star } from 'lucide-react';

interface OrderMembershipInfoProps {
  tierName: string;
  tierDisplayName: string;
  tierDescription: string;
  price: number;
}

export function OrderMembershipInfo({
  tierName,
  tierDisplayName,
  tierDescription,
  price,
}: OrderMembershipInfoProps) {
  const formatAmount = (amount: number): string => {
    return `¥${amount.toFixed(2)}`;
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'PROFESSIONAL':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'ENTERPRISE':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'BASIC':
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getTierFeatures = (tier: string): string[] => {
    const features: Record<string, string[]> = {
      FREE: ['基础文档解析', '5个辩论案例/月'],
      BASIC: ['高级文档解析', '20个辩论案例/月', 'AI智能推荐'],
      PROFESSIONAL: [
        '无限文档解析',
        '无限辩论案例',
        'AI智能推荐',
        '优先技术支持',
      ],
      ENTERPRISE: [
        '无限文档解析',
        '无限辩论案例',
        'AI智能推荐',
        '优先技术支持',
        '专属客户经理',
        '定制化服务',
      ],
    };
    return features[tier] || features.BASIC;
  };

  const tierFeatures = getTierFeatures(tierName);
  const tierColor = getTierColor(tierName);

  return (
    <Card>
      <div className={`rounded-lg border-2 p-6 ${tierColor}`}>
        <div className='mb-4 flex items-start justify-between'>
          <div className='flex items-center gap-3'>
            <Crown className='h-8 w-8' />
            <h2 className='text-2xl font-bold'>{tierDisplayName}</h2>
          </div>
          <div className='flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-semibold'>
            <Star className='h-4 w-4' />
            {tierName}
          </div>
        </div>

        <div className='mb-4 space-y-3'>
          <div>
            <div className='text-sm opacity-75'>会员价格</div>
            <div className='text-3xl font-bold'>{formatAmount(price)}</div>
          </div>

          <div>
            <div className='text-sm opacity-75'>会员描述</div>
            <div className='font-medium'>{tierDescription}</div>
          </div>
        </div>

        <div className='space-y-2 border-t border-current/20 pt-4'>
          <div className='text-sm font-semibold'>会员权益</div>
          {tierFeatures.map((feature, index) => (
            <div key={index} className='flex items-center gap-2 text-sm'>
              <Check className='h-4 w-4 shrink-0' />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
