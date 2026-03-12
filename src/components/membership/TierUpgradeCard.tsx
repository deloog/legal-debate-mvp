import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { MembershipTierDef, MembershipTier } from '@/types/membership';

interface TierUpgradeCardProps {
  tier: MembershipTierDef;
  currentTier?: MembershipTier | null;
  onUpgrade?: (tierId: string) => void;
  isRecommended?: boolean;
}

export function TierUpgradeCard({
  tier,
  currentTier,
  onUpgrade,
  isRecommended = false,
}: TierUpgradeCardProps) {
  const isCurrentTier = currentTier === tier.tier;
  const canUpgrade = !isCurrentTier;

  const getTierColor = (tierName: string): string => {
    switch (tierName) {
      case 'ENTERPRISE':
        return 'border-purple-500 bg-purple-50';
      case 'PROFESSIONAL':
        return 'border-blue-500 bg-blue-50';
      case 'BASIC':
        return 'border-green-500 bg-green-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getBadgeColor = (tierName: string): string => {
    switch (tierName) {
      case 'ENTERPRISE':
        return 'bg-purple-500 text-white';
      case 'PROFESSIONAL':
        return 'bg-blue-500 text-white';
      case 'BASIC':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const formatPrice = (price: number): string => {
    return `¥${price}`;
  };

  const getBillingCycleText = (cycle: string): string => {
    switch (cycle) {
      case 'MONTHLY':
        return '/ 月';
      case 'QUARTERLY':
        return '/ 季';
      case 'YEARLY':
        return '/ 年';
      case 'LIFETIME':
        return ' / 永久';
      default:
        return '';
    }
  };

  return (
    <Card
      className={`relative flex flex-col ${isRecommended ? 'border-2 border-blue-500' : ''} ${getTierColor(tier.tier)} transition-all hover:shadow-lg`}
    >
      {isRecommended && (
        <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
          <Badge className='bg-blue-500 text-white'>推荐</Badge>
        </div>
      )}
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span>{tier.displayName}</span>
          {isCurrentTier && (
            <Badge className={getBadgeColor(tier.tier)}>当前方案</Badge>
          )}
        </CardTitle>
        <CardDescription>{tier.description}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-1 flex-col'>
        {/* 价格展示 */}
        <div className='mb-6 flex items-baseline gap-1'>
          <span className='text-4xl font-bold text-gray-900'>
            {formatPrice(tier.price)}
          </span>
          <span className='text-sm text-gray-600'>
            {getBillingCycleText(tier.billingCycle)}
          </span>
        </div>

        {/* 功能列表 */}
        <div className='mb-6 flex-1'>
          <h4 className='mb-3 font-semibold text-gray-900'>功能特性</h4>
          <ul className='space-y-2'>
            {tier.features.map((feature, index) => (
              <li
                key={index}
                className='flex items-start gap-2 text-sm text-gray-700'
              >
                <Check className='h-4 w-4 shrink-0 text-green-600' />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 权限展示 */}
        <div className='mb-6'>
          <h4 className='mb-3 font-semibold text-gray-900'>权限说明</h4>
          <div className='space-y-1 text-sm text-gray-600'>
            {tier.permissions?.canCreateCase && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>创建案件</span>
              </div>
            )}
            {tier.permissions?.canCreateDebate && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>创建辩论</span>
              </div>
            )}
            {tier.permissions?.canAnalyzeDocument && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>分析文档</span>
              </div>
            )}
            {tier.permissions?.canSearchLawArticle && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>搜索法条</span>
              </div>
            )}
            {tier.permissions?.canUseAdvancedFeatures && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>高级功能</span>
              </div>
            )}
            {tier.permissions?.canExportData && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>数据导出</span>
              </div>
            )}
            {tier.permissions?.canUseBatchProcessing && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>批量处理</span>
              </div>
            )}
            {tier.permissions?.canUseCustomModel && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>自定义模型</span>
              </div>
            )}
            {tier.permissions?.prioritySupport && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>优先支持</span>
              </div>
            )}
            {tier.permissions?.dedicatedSupport && (
              <div className='flex items-center gap-2'>
                <Check className='h-3 w-3 text-green-600' />
                <span>专属客服</span>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        {canUpgrade && onUpgrade && (
          <Button
            onClick={() => onUpgrade(tier.id)}
            disabled={!canUpgrade}
            className='w-full'
          >
            立即升级
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
