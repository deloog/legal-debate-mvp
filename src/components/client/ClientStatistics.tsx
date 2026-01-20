'use client';

/**
 * 客户统计组件
 * 显示客户统计数据和图表
 */

import React, { useState, useEffect } from 'react';
import {
  ClientType,
  ClientStatus,
  type ClientStatistics,
  type ClientDetail,
} from '@/types/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface ClientStatisticsProps {
  userId: string;
}

export default function ClientStatistics({
  userId,
}: ClientStatisticsProps): React.ReactElement {
  const [statistics, setStatistics] = useState<ClientStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 获取统计数据
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
      const data: ClientStatistics = await response.json();
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
        <StatCard
          title='客户总数'
          value={statistics.totalClients}
          color='blue'
        />
        <StatCard
          title='活跃客户'
          value={statistics.activeClients}
          color='green'
        />
        <StatCard
          title='非活跃客户'
          value={statistics.inactiveClients}
          color='yellow'
        />
        <StatCard title='流失客户' value={statistics.lostClients} color='red' />
        <StatCard
          title='黑名单'
          value={statistics.blacklistedClients}
          color='gray'
        />
      </div>

      {/* 客户类型分布 */}
      <Card>
        <CardHeader>
          <CardTitle>客户类型分布</CardTitle>
          <CardDescription>按客户类型统计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <StatBar
              label='个人客户'
              value={statistics.clientsByType.INDIVIDUAL || 0}
              total={statistics.totalClients}
              color='bg-blue-500'
            />
            <StatBar
              label='企业客户'
              value={statistics.clientsByType.ENTERPRISE || 0}
              total={statistics.totalClients}
              color='bg-green-500'
            />
            <StatBar
              label='潜在客户'
              value={statistics.clientsByType.POTENTIAL || 0}
              total={statistics.totalClients}
              color='bg-yellow-500'
            />
          </div>
        </CardContent>
      </Card>

      {/* 客户来源分布 */}
      <Card>
        <CardHeader>
          <CardTitle>客户来源分布</CardTitle>
          <CardDescription>按客户来源统计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {Object.entries(statistics.clientsBySource).length === 0 ? (
              <div className='text-muted-foreground text-center py-4'>
                暂无客户来源数据
              </div>
            ) : (
              Object.entries(statistics.clientsBySource).map(
                ([source, count]) => (
                  <StatBar
                    key={source}
                    label={source}
                    value={count}
                    total={statistics.totalClients}
                    color='bg-purple-500'
                  />
                )
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* 标签分布 */}
      <Card>
        <CardHeader>
          <CardTitle>客户标签分布</CardTitle>
          <CardDescription>按标签统计客户数</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-wrap gap-2'>
            {Object.entries(statistics.clientsByTags).length === 0 ? (
              <div className='text-muted-foreground text-center py-4 w-full'>
                暂无标签数据
              </div>
            ) : (
              Object.entries(statistics.clientsByTags)
                .sort(([, a], [, b]) => b - a)
                .map(([tag, count]) => (
                  <TagBadge key={tag} tag={tag} count={count} />
                ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* 月度增长趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>客户增长趋势</CardTitle>
          <CardDescription>最近12个月客户增长情况</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            {statistics.monthlyGrowth.map(item => (
              <div key={item.month} className='flex items-center gap-4'>
                <span className='w-16 text-sm text-muted-foreground'>
                  {item.month}
                </span>
                <div className='flex-1 bg-gray-100 rounded-full h-6 overflow-hidden'>
                  <div
                    className='h-full bg-blue-500 transition-all duration-300'
                    style={{
                      width: `${(item.count / Math.max(...statistics.monthlyGrowth.map(g => g.count))) * 100}%`,
                    }}
                  />
                </div>
                <span className='w-12 text-sm text-right'>{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 最近创建的客户 */}
      <Card>
        <CardHeader>
          <CardTitle>最近创建的客户</CardTitle>
          <CardDescription>最近添加的10位客户</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            {statistics.recentClients.length === 0 ? (
              <div className='text-muted-foreground text-center py-4'>
                暂无客户数据
              </div>
            ) : (
              statistics.recentClients.map(client => (
                <ClientCard key={client.id} client={client} />
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 统计卡片组件
 */
function StatCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}): React.ReactElement {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <Card>
      <CardContent className='p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium text-muted-foreground'>{title}</p>
            <p className='text-3xl font-bold mt-2'>{value}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-full ${colorClasses[color]} flex items-center justify-center text-white`}
          >
            <span className='text-xl'>#</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 统计条形图组件
 */
function StatBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}): React.ReactElement {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className='flex items-center gap-4'>
      <span className='w-24 text-sm'>{label}</span>
      <div className='flex-1 bg-gray-100 rounded-full h-4 overflow-hidden'>
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className='w-16 text-sm text-right'>
        {value} ({percentage.toFixed(1)}%)
      </span>
    </div>
  );
}

/**
 * 标签徽章组件
 */
function TagBadge({
  tag,
  count,
}: {
  tag: string;
  count: number;
}): React.ReactElement {
  return (
    <div className='inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full'>
      <span className='text-sm font-medium'>{tag}</span>
      <span className='text-xs bg-blue-200 px-2 py-0.5 rounded-full'>
        {count}
      </span>
    </div>
  );
}

/**
 * 客户卡片组件
 */
function ClientCard({ client }: { client: ClientDetail }): React.ReactElement {
  const clientTypeLabels: Record<ClientType, string> = {
    [ClientType.INDIVIDUAL]: '个人',
    [ClientType.ENTERPRISE]: '企业',
    [ClientType.POTENTIAL]: '潜在',
  };

  const clientStatusColors: Record<ClientStatus, string> = {
    [ClientStatus.ACTIVE]: 'bg-green-100 text-green-700',
    [ClientStatus.INACTIVE]: 'bg-yellow-100 text-yellow-700',
    [ClientStatus.LOST]: 'bg-red-100 text-red-700',
    [ClientStatus.BLACKLISTED]: 'bg-gray-100 text-gray-700',
  };

  const clientStatusLabels: Record<ClientStatus, string> = {
    [ClientStatus.ACTIVE]: '活跃',
    [ClientStatus.INACTIVE]: '非活跃',
    [ClientStatus.LOST]: '流失',
    [ClientStatus.BLACKLISTED]: '黑名单',
  };

  return (
    <div className='flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors'>
      <div className='flex-1'>
        <div className='flex items-center gap-3'>
          <h4 className='font-semibold'>{client.name}</h4>
          <span className='text-sm px-2 py-1 bg-gray-100 rounded'>
            {clientTypeLabels[client.clientType]}
          </span>
          <span
            className={`text-sm px-2 py-1 rounded ${clientStatusColors[client.status]}`}
          >
            {clientStatusLabels[client.status]}
          </span>
        </div>
        <div className='text-sm text-muted-foreground mt-1'>
          {client.phone && <span>电话: {client.phone}</span>}
          {client.email && <span className='ml-4'>邮箱: {client.email}</span>}
        </div>
        <div className='flex items-center gap-4 mt-2 text-sm text-muted-foreground'>
          <span>案件数: {client.cases || 0}</span>
          <span>
            创建时间: {new Date(client.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
