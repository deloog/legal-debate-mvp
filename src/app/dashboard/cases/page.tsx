'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CaseStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  growth: number;
  avgDuration: number;
}

interface CaseTrend {
  date: string;
  total: number;
  completed: number;
  avgDuration: number;
}

const TIME_RANGE_OPTIONS = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' },
];

function CasesDashboardPage(): React.ReactElement | null {
  const router = useRouter();
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [trend, setTrend] = useState<CaseTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<string>('7d');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stats/cases?range=${timeRange}`);
      if (!response.ok) {
        throw new Error('获取案件统计失败');
      }
      const result = await response.json();
      setStats(result.data);
      setTrend(result.data.trend || []);
    } catch (err) {
      void err;
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>加载中...</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900'>案件统计</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className='px-4 py-2 text-blue-600 hover:text-blue-900'
        >
          返回
        </button>
      </div>

      <div className='flex items-center gap-4'>
        {TIME_RANGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTimeRange(opt.value)}
            className={`px-4 py-2 rounded-lg ${
              timeRange === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <MetricCard
          title='总案件数'
          value={stats.total}
          change={stats.growth}
        />
        <MetricCard title='待处理' value={stats.pending} />
        <MetricCard title='处理中' value={stats.processing} />
        <MetricCard
          title='平均处理时长'
          value={`${stats.avgDuration.toFixed(1)}小时`}
        />
      </div>

      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>
          案件处理趋势
        </h2>
        <div className='space-y-2'>
          {trend.slice(-7).map((item, index) => (
            <div
              key={index}
              className='flex items-center justify-between py-2 border-b border-gray-100 last:border-0'
            >
              <span className='text-sm text-gray-600'>{item.date}</span>
              <span className='text-sm text-gray-900'>
                总计: {item.total} | 完成: {item.completed} | 平均时长:{' '}
                {item.avgDuration.toFixed(1)}小时
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  subtitle,
}) => (
  <div className='bg-white rounded-lg shadow p-6'>
    <h3 className='text-sm font-medium text-gray-500'>{title}</h3>
    <p className='mt-2 text-2xl font-bold text-gray-900'>{value}</p>
    {change !== undefined && (
      <p className='mt-2 text-sm text-gray-600'>
        较上期:{' '}
        <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)}
        </span>
      </p>
    )}
    {subtitle && <p className='mt-1 text-sm text-gray-500'>{subtitle}</p>}
  </div>
);

export default CasesDashboardPage;
