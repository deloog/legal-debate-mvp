'use client';

/**
 * 客户统计组件
 * 显示客户统计数据和图表
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ClientStatCard } from './ClientStatCard';
import { ClientTypeChart } from './ClientTypeChart';
import { ClientSourceChart } from './ClientSourceChart';
import { ClientTagChart } from './ClientTagChart';
import { MonthlyGrowthChart } from './MonthlyGrowthChart';
import { RecentClients } from './RecentClients';
import { type ClientStatistics as ClientStatisticsType } from '@/types/client';

interface ClientStatisticsProps {
  userId: string;
}

export default function ClientStatistics({
  userId,
}: ClientStatisticsProps): React.ReactElement {
  const [statistics, setStatistics] = useState<ClientStatisticsType | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatistics();
  }, [userId]);

  const fetchStatistics = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/clients/statistics');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取统计数据失败');
      }
      const data: ClientStatisticsType = await response.json();
      setStatistics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center h-64'>
          <div className='text-muted-foreground'>加载中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center h-64'>
          <div className='text-red-500'>{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center h-64'>
          <div className='text-muted-foreground'>暂无数据</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 概览卡片 */}
      <div className='grid grid-cols-1 md:grid-cols-5 gap-4'>
        <ClientStatCard
          title='客户总数'
          value={statistics.totalClients}
          color='blue'
        />
        <ClientStatCard
          title='活跃客户'
          value={statistics.activeClients}
          color='green'
        />
        <ClientStatCard
          title='非活跃客户'
          value={statistics.inactiveClients}
          color='yellow'
        />
        <ClientStatCard
          title='流失客户'
          value={statistics.lostClients}
          color='red'
        />
        <ClientStatCard
          title='黑名单'
          value={statistics.blacklistedClients}
          color='gray'
        />
      </div>

      {/* 客户类型分布 */}
      <ClientTypeChart
        clientsByType={statistics.clientsByType}
        totalClients={statistics.totalClients}
      />

      {/* 客户来源分布 */}
      <ClientSourceChart
        clientsBySource={statistics.clientsBySource}
        totalClients={statistics.totalClients}
      />

      {/* 标签分布 */}
      <ClientTagChart clientsByTags={statistics.clientsByTags} />

      {/* 月度增长趋势 */}
      <MonthlyGrowthChart monthlyGrowth={statistics.monthlyGrowth} />

      {/* 最近创建的客户 */}
      <RecentClients recentClients={statistics.recentClients} />
    </div>
  );
}
