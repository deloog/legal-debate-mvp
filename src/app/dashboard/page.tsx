'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  users: {
    total: number;
    active: number;
    lawyers: number;
    enterprises: number;
    growth: number;
  };
  cases: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    growth: number;
  };
  debates: {
    total: number;
    generated: number;
    inProgress: number;
    completed: number;
    avgQuality: number;
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

function DashboardPage(): React.ReactElement {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, casesRes, debatesRes, performanceRes] =
        await Promise.all([
          fetch('/api/stats/users'),
          fetch('/api/stats/cases'),
          fetch('/api/stats/debates'),
          fetch('/api/stats/performance'),
        ]);

      if (
        !usersRes.ok ||
        !casesRes.ok ||
        !debatesRes.ok ||
        !performanceRes.ok
      ) {
        throw new Error('获取统计数据失败');
      }

      const usersData = await usersRes.json();
      const casesData = await casesRes.json();
      const debatesData = await debatesRes.json();
      const performanceData = await performanceRes.json();

      setStats({
        users: usersData.data,
        cases: casesData.data,
        debates: debatesData.data,
        performance: performanceData.data,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-red-600'>{error}</div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
        <button
          onClick={loadStats}
          className='px-4 py-2 text-blue-600 hover:text-blue-900'
        >
          刷新数据
        </button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <StatCard
          title='总用户数'
          value={stats.users.total}
          change={stats.users.growth}
          label='较上期'
          link='/dashboard/users'
          color='blue'
        />
        <StatCard
          title='总案件数'
          value={stats.cases.total}
          change={stats.cases.growth}
          label='较上期'
          link='/dashboard/cases'
          color='green'
        />
        <StatCard
          title='总辩论数'
          value={stats.debates.total}
          change={stats.debates.avgQuality}
          label='平均质量分'
          link='/dashboard/debates'
          color='purple'
        />
        <StatCard
          title='系统状态'
          value={`${stats.performance.uptime.toFixed(1)}%`}
          change={stats.performance.avgResponseTime}
          label='平均响应时间(ms)'
          link='/dashboard/performance'
          color='orange'
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <DetailCard
          title='用户统计'
          link='/dashboard/users'
          data={[
            { label: '活跃用户', value: stats.users.active },
            { label: '律师用户', value: stats.users.lawyers },
            { label: '企业用户', value: stats.users.enterprises },
          ]}
          color='blue'
        />
        <DetailCard
          title='案件统计'
          link='/dashboard/cases'
          data={[
            { label: '待处理', value: stats.cases.pending },
            { label: '处理中', value: stats.cases.processing },
            { label: '已完成', value: stats.cases.completed },
          ]}
          color='green'
        />
        <DetailCard
          title='辩论统计'
          link='/dashboard/debates'
          data={[
            { label: '已生成', value: stats.debates.generated },
            { label: '进行中', value: stats.debates.inProgress },
            { label: '已完成', value: stats.debates.completed },
          ]}
          color='purple'
        />
        <DetailCard
          title='性能统计'
          link='/dashboard/performance'
          data={[
            {
              label: '平均响应时间',
              value: `${stats.performance.avgResponseTime}ms`,
            },
            { label: '错误率', value: `${stats.performance.errorRate}%` },
            { label: '系统可用性', value: `${stats.performance.uptime}%` },
          ]}
          color='orange'
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  change: number;
  label: string;
  link: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  label,
  link,
  color,
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  return (
    <Link href={link}>
      <div
        className={`p-6 rounded-lg border ${colorClasses[color]} hover:shadow-lg transition-shadow`}
      >
        <h3 className='text-sm font-medium text-gray-500'>{title}</h3>
        <p className='mt-2 text-3xl font-bold text-gray-900'>{value}</p>
        <p className='mt-2 text-sm text-gray-600'>
          {label}:{' '}
          <span className={change >= 0 ? 'text-green-600' : 'text-red-600'}>
            {change >= 0 ? '+' : ''}
            {typeof change === 'number' ? change.toFixed(2) : change}
          </span>
        </p>
      </div>
    </Link>
  );
};

interface DetailCardProps {
  title: string;
  link: string;
  data: Array<{ label: string; value: number | string }>;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const DetailCard: React.FC<DetailCardProps> = ({
  title,
  link,
  data,
  color,
}) => {
  const colorClasses = {
    blue: 'text-blue-600 hover:text-blue-900',
    green: 'text-green-600 hover:text-green-900',
    purple: 'text-purple-600 hover:text-purple-900',
    orange: 'text-orange-600 hover:text-orange-900',
  };

  return (
    <Link href={link}>
      <div className='bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
          <span className={`text-sm font-medium ${colorClasses[color]}`}>
            查看详情 →
          </span>
        </div>
        <div className='space-y-3'>
          {data.map((item, index) => (
            <div
              key={index}
              className='flex items-center justify-between py-2 border-b border-gray-100 last:border-0'
            >
              <span className='text-sm text-gray-600'>{item.label}</span>
              <span className='text-sm font-medium text-gray-900'>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
};

export default DashboardPage;
