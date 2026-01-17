import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Crown, User } from 'lucide-react';
import { UserMembership, TierLimitConfig } from '@/types/membership';

interface MembershipInfoProps {
  membership: UserMembership | null;
  tierLimit: TierLimitConfig | null;
  usageStats: {
    casesCreated: number;
    debatesGenerated: number;
    documentsAnalyzed: number;
    lawArticleSearches: number;
    aiTokensUsed: number;
    storageUsedMB: number;
  } | null;
  isLoading: boolean;
}

export function MembershipInfo({
  membership,
  tierLimit,
  usageStats,
  isLoading,
}: MembershipInfoProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>会员信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-8'>
            <div className='mb-2 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
            <p className='text-sm text-gray-500'>加载中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!membership || !tierLimit || !usageStats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>会员信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col items-center justify-center py-8 text-gray-500'>
            <User className='mb-2 h-12 w-12' />
            <p className='text-center'>您当前是免费用户</p>
            <p className='text-sm'>升级会员以解锁更多功能</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'ENTERPRISE':
        return 'bg-purple-500';
      case 'PROFESSIONAL':
        return 'bg-blue-500';
      case 'BASIC':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'EXPIRED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
      case 'SUSPENDED':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return '活跃';
      case 'EXPIRED':
        return '已过期';
      case 'CANCELLED':
        return '已取消';
      case 'SUSPENDED':
        return '已暂停';
      case 'PENDING':
        return '待处理';
      default:
        return status;
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const calculateProgress = (current: number, limit: number | null): number => {
    if (limit === null) return 100;
    if (limit === 0) return 100;
    return Math.min((current / limit) * 100, 100);
  };

  const isLimitExceeded = (current: number, limit: number | null): boolean => {
    if (limit === null) return false;
    return current >= limit;
  };

  const getUsageDisplay = (current: number, limit: number | null): string => {
    if (limit === null) return `${current.toLocaleString()}`;
    return `${current.toLocaleString()} / ${limit.toLocaleString()}`;
  };

  const renderProgressBar = (
    label: string,
    current: number,
    limit: number | null,
    unit: string
  ) => {
    const progress = calculateProgress(current, limit);
    const exceeded = isLimitExceeded(current, limit);

    return (
      <div className='mb-4'>
        <div className='flex items-center justify-between text-sm'>
          <span className='font-medium text-gray-700'>{label}</span>
          <span
            className={`font-medium ${exceeded ? 'text-red-600' : 'text-gray-500'}`}
          >
            {getUsageDisplay(current, limit)} {unit}
          </span>
        </div>
        <Progress
          value={progress}
          className={`mt-2 h-2 ${exceeded ? 'bg-red-200' : 'bg-gray-200'}`}
          indicatorClassName={
            exceeded ? 'bg-red-600' : getTierColor(membership.tier)
          }
        />
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Crown className='h-5 w-5 text-yellow-500' />
          会员信息
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* 会员等级和状态 */}
        <div className='flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-2'>
              <Badge className={`${getTierColor(membership.tier)} text-white`}>
                {membership.tier}
              </Badge>
              <Badge className={getStatusColor(membership.status)}>
                {getStatusText(membership.status)}
              </Badge>
            </div>
          </div>
          {membership.status === 'ACTIVE' && (
            <div className='flex items-center gap-2 text-sm text-gray-600'>
              <Calendar className='h-4 w-4' />
              <span>到期日期: {formatDate(membership.endDate)}</span>
            </div>
          )}
        </div>

        {/* 使用量统计 */}
        <div className='space-y-2'>
          <h4 className='font-semibold text-gray-900'>使用量统计</h4>
          <div className='rounded-lg bg-gray-50 p-4'>
            {renderProgressBar(
              '案件创建',
              usageStats.casesCreated,
              tierLimit.limits.MAX_CASES,
              '个'
            )}
            {renderProgressBar(
              '辩论生成',
              usageStats.debatesGenerated,
              tierLimit.limits.MAX_DEBATES,
              '个'
            )}
            {renderProgressBar(
              '文档分析',
              usageStats.documentsAnalyzed,
              tierLimit.limits.MAX_DOCUMENTS,
              '个'
            )}
            {renderProgressBar(
              '法条搜索',
              usageStats.lawArticleSearches,
              tierLimit.limits.MAX_LAW_ARTICLE_SEARCHES,
              '次'
            )}
            {renderProgressBar(
              'AI 令牌',
              usageStats.aiTokensUsed,
              tierLimit.limits.MAX_AI_TOKENS_MONTHLY,
              '个'
            )}
            {renderProgressBar(
              '存储空间',
              usageStats.storageUsedMB,
              tierLimit.limits.MAX_STORAGE_MB,
              'MB'
            )}
          </div>
        </div>

        {/* 会员详情 */}
        {membership.status === 'ACTIVE' && membership.autoRenew && (
          <div className='flex items-center gap-2 text-sm text-blue-600'>
            <div className='h-2 w-2 rounded-full bg-blue-600' />
            <span>已开启自动续费</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
