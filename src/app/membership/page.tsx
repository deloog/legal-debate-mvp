'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MembershipInfo } from '@/components/membership/MembershipInfo';
import { TierUpgradeCard } from '@/components/membership/TierUpgradeCard';
import { UsageHistory } from '@/components/membership/UsageHistory';
import { Button } from '@/components/ui/button';
import { Crown, ArrowRight, AlertCircle } from 'lucide-react';
import {
  UserMembership,
  MembershipTierDef,
  TierLimitConfig,
  MembershipHistory,
  MembershipTier,
} from '@/types/membership';

interface MembershipData {
  currentMembership: UserMembership | null;
  availableTiers: MembershipTierDef[];
  usageStats: {
    casesCreated: number;
    debatesGenerated: number;
    documentsAnalyzed: number;
    lawArticleSearches: number;
    aiTokensUsed: number;
    storageUsedMB: number;
  } | null;
  tierLimit: TierLimitConfig | null;
}

export default function MembershipPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [membershipData, setMembershipData] = useState<MembershipData | null>(
    null
  );
  const [history, setHistory] = useState<MembershipHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchMembershipData = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const [meResponse, tiersResponse] = await Promise.all([
        fetch('/api/memberships/me'),
        fetch('/api/memberships/tiers'),
      ]);

      if (!meResponse.ok || !tiersResponse.ok) {
        throw new Error('获取会员信息失败');
      }

      const meData = await meResponse.json();
      const tiersData = await tiersResponse.json();

      if (meData.success && tiersData.success) {
        setMembershipData({
          currentMembership: meData.data?.currentMembership || null,
          availableTiers: tiersData.data?.tiers || [],
          usageStats: meData.data?.usageStats || null,
          tierLimit: tiersData.data?.limits || null,
        });
      } else {
        throw new Error(meData.error || tiersData.error || '获取会员信息失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取会员信息失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHistoryData = async (): Promise<void> => {
    try {
      setHistoryLoading(true);
      const response = await fetch('/api/memberships/history');

      if (!response.ok) {
        throw new Error('获取会员历史失败');
      }

      const data = await response.json();

      if (data.success) {
        setHistory(data.data?.records || []);
      } else {
        throw new Error(data.error || '获取会员历史失败');
      }
    } catch (err) {
      console.error('获取会员历史失败:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void fetchMembershipData();
    void fetchHistoryData();
  }, []);

  const handleUpgrade = (tierId: string): void => {
    router.push(`/membership/upgrade?tierId=${tierId}`);
  };

  const getRecommendedTier = (
    currentTier: MembershipTier | null
  ): MembershipTier | null => {
    if (!currentTier || currentTier === MembershipTier.FREE) {
      return MembershipTier.BASIC;
    }
    if (currentTier === MembershipTier.BASIC) {
      return MembershipTier.PROFESSIONAL;
    }
    return null;
  };

  const recommendedTier = membershipData?.currentMembership
    ? getRecommendedTier(membershipData.currentMembership.tier)
    : MembershipTier.BASIC;

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

  if (error) {
    return (
      <div className='container mx-auto flex min-h-screen items-center justify-center px-4 py-8'>
        <div className='max-w-md text-center'>
          <AlertCircle className='mx-auto mb-4 h-16 w-16 text-red-500' />
          <h2 className='mb-2 text-2xl font-bold text-gray-900'>加载失败</h2>
          <p className='mb-6 text-gray-600'>{error}</p>
          <Button onClick={() => window.location.reload()}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页面标题 */}
      <div className='mb-8 flex items-center gap-3'>
        <div className='flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100'>
          <Crown className='h-6 w-6 text-blue-600' />
        </div>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>会员中心</h1>
          <p className='text-gray-600'>管理您的会员等级和使用情况</p>
        </div>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        {/* 左侧：会员信息 */}
        <div className='space-y-6'>
          {membershipData && (
            <MembershipInfo
              membership={membershipData.currentMembership}
              tierLimit={membershipData.tierLimit}
              usageStats={membershipData.usageStats}
              isLoading={isLoading}
            />
          )}

          {/* 会员变更历史 */}
          <UsageHistory history={history} isLoading={historyLoading} />

          {/* 升级引导 */}
          {membershipData?.currentMembership?.tier === MembershipTier.FREE && (
            <div className='rounded-lg border border-blue-200 bg-blue-50 p-6'>
              <h3 className='mb-2 flex items-center gap-2 text-lg font-semibold text-gray-900'>
                <Crown className='h-5 w-5 text-blue-600' />
                升级会员，解锁更多功能
              </h3>
              <p className='mb-4 text-sm text-gray-600'>
                升级到付费会员，您可以获得更多功能权限和使用额度
              </p>
              <Button
                variant='primary'
                onClick={() => {
                  router.push('/membership/upgrade');
                }}
                className='w-full'
              >
                查看升级方案
                <ArrowRight className='ml-2 h-4 w-4' />
              </Button>
            </div>
          )}
        </div>

        {/* 右侧：会员等级卡片 */}
        <div className='space-y-6'>
          <h2 className='text-xl font-semibold text-gray-900'>会员等级方案</h2>
          <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-1'>
            {membershipData?.availableTiers.map(tier => {
              const isRecommended = recommendedTier === tier.tier;
              return (
                <TierUpgradeCard
                  key={tier.id}
                  tier={tier}
                  currentTier={membershipData.currentMembership?.tier || null}
                  onUpgrade={handleUpgrade}
                  isRecommended={isRecommended}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
