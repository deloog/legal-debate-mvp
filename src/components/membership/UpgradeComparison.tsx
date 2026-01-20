'use client';

import { Check, X } from 'lucide-react';
import { MembershipTierDef } from '@/types/membership';

// =============================================================================
// 类型定义
// =============================================================================

interface UpgradeComparisonProps {
  currentTier: MembershipTierDef | null;
  targetTier: MembershipTierDef;
}

interface FeatureItem {
  label: string;
  inCurrent: boolean;
  inTarget: boolean;
  isNew?: boolean;
}

// =============================================================================
// 辅助函数
// =============================================================================

function getFeatureList(
  currentTier: MembershipTierDef | null,
  targetTier: MembershipTierDef
): FeatureItem[] {
  const currentFeatures = currentTier?.features || [];
  const targetFeatures = targetTier.features || [];

  const allFeatures = new Set([...currentFeatures, ...targetFeatures]);

  return Array.from(allFeatures).map(feature => {
    const inCurrent = currentFeatures.includes(feature);
    const inTarget = targetFeatures.includes(feature);

    return {
      label: feature,
      inCurrent,
      inTarget,
      isNew: !inCurrent && inTarget,
    };
  });
}

// =============================================================================
// 主组件
// =============================================================================

export function UpgradeComparison({
  currentTier,
  targetTier,
}: UpgradeComparisonProps): React.ReactElement {
  const features = getFeatureList(currentTier, targetTier);

  return (
    <div className='bg-white rounded-lg shadow overflow-hidden'>
      {/* 表头 */}
      <div className='grid grid-cols-3 bg-gray-50'>
        <div className='p-4 border-b border-r border-gray-200'>
          <div className='text-sm font-medium text-gray-900'>功能</div>
        </div>
        <div className='p-4 border-b border-r border-gray-200'>
          <div className='text-sm font-medium text-gray-900'>当前等级</div>
          <div className='mt-1 text-lg font-semibold text-gray-700'>
            {currentTier?.displayName || '免费版'}
          </div>
        </div>
        <div className='p-4 border-b bg-blue-50'>
          <div className='text-sm font-medium text-blue-900'>升级后等级</div>
          <div className='mt-1 text-lg font-semibold text-blue-700'>
            {targetTier.displayName}
          </div>
        </div>
      </div>

      {/* 功能列表 */}
      <div className='divide-y divide-gray-200'>
        {features.map((feature, index) => (
          <div key={index} className='grid grid-cols-3 hover:bg-gray-50'>
            {/* 功能名称 */}
            <div
              className={`p-4 border-r border-gray-200 text-sm ${
                feature.isNew ? 'font-semibold text-blue-600' : 'text-gray-900'
              }`}
            >
              {feature.label}
              {feature.isNew && (
                <span className='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800'>
                  新增
                </span>
              )}
            </div>

            {/* 当前等级 */}
            <div className='p-4 border-r border-gray-200 flex items-center justify-center'>
              {feature.inCurrent ? (
                <Check className='h-5 w-5 text-green-600' />
              ) : (
                <X className='h-5 w-5 text-gray-400' />
              )}
            </div>

            {/* 升级后等级 */}
            <div
              className={`p-4 flex items-center justify-center ${
                feature.isNew ? 'bg-blue-50' : ''
              }`}
            >
              {feature.inTarget ? (
                <Check className='h-5 w-5 text-green-600' />
              ) : (
                <X className='h-5 w-5 text-gray-400' />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
