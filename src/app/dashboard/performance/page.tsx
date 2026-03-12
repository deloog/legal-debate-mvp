'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface PerformanceStats {
  avgResponseTime: number;
  errorRate: number;
  uptime: number;
  totalRequests: number;
  successRate: number;
}

interface PerformanceTrend {
  date: string;
  avgResponseTime: number;
  errorRate: number;
  uptime: number;
}

const TIME_RANGE_OPTIONS = [
  { value: '1h', label: '近1小时' },
  { value: '24h', label: '近24小时' },
  { value: '7d', label: '近7天' },
];

function PerformanceDashboardPage(): React.ReactElement | null {
  const router = useRouter();
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [trend, setTrend] = useState<PerformanceTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<string>('24h');

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/stats/performance?range=${timeRange}`);
      if (!response.ok) {
        throw new Error('获取性能统计失败');
      }
      const result = await response.json();
      setStats(result.data);
      setTrend(result.data.trend || []);
    } catch (err) {
      console.error('加载失败:', err);
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
        <h1 className='text-2xl font-bold text-gray-900'>性能统计</h1>
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
          title='平均响应时间'
          value={`${stats.avgResponseTime.toFixed(0)}ms`}
        />
        <MetricCard title='错误率' value={`${stats.errorRate.toFixed(2)}%`} />
        <MetricCard title='系统可用性' value={`${stats.uptime.toFixed(1)}%`} />
        <MetricCard
          title='成功率'
          value={`${stats.successRate.toFixed(1)}%`}
          subtitle={`总请求数: ${stats.totalRequests}`}
        />
      </div>

      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>性能趋势</h2>
        <div className='space-y-2'>
          {trend.slice(-10).map((item, index) => (
            <div
              key={index}
              className='flex items-center justify-between py-2 border-b border-gray-100 last:border-0'
            >
              <span className='text-sm text-gray-600'>{item.date}</span>
              <span className='text-sm text-gray-900'>
                响应时间:{item.avgResponseTime.toFixed(0)}ms | 错误率:
                {item.errorRate.toFixed(2)}% | 可用性:
                {item.uptime.toFixed(1)}%
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

export default PerformanceDashboardPage;
