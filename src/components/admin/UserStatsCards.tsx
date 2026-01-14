'use client';

interface StatCardProps {
  title: string;
  value: number;
  trend?: number;
  trendLabel?: string;
  unit?: string;
}

interface StatsSummaryProps {
  totalUsers: number;
  newUsers: number;
  growthRate: number;
  averageDaily: number;
  activeUsers?: number;
  activeRate?: number;
  avgLoginFrequency?: number;
}

export function StatCard({
  title,
  value,
  trend,
  trendLabel = '增长率',
  unit = '',
}: StatCardProps): React.ReactElement {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className='bg-white rounded-lg shadow p-6'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium text-gray-500'>{title}</h3>
        {trend !== undefined && (
          <span
            className={`text-xs font-medium ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend > 0 ? '+' : ''}
            {trend.toFixed(1)}% {trendLabel}
          </span>
        )}
      </div>
      <div className='mt-2'>
        <div className='text-3xl font-bold text-gray-900'>
          {value.toLocaleString()} {unit}
        </div>
      </div>
    </div>
  );
}

export function StatsSummary({
  totalUsers,
  newUsers,
  growthRate,
  averageDaily,
  activeUsers,
  activeRate,
  avgLoginFrequency,
}: StatsSummaryProps): React.ReactElement {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
      <StatCard title='总用户数' value={totalUsers} unit='人' />
      <StatCard title='新增用户' value={newUsers} trend={growthRate} />
      <StatCard title='日均新增' value={averageDaily} unit='人' />
      {activeUsers !== undefined && activeRate !== undefined ? (
        <StatCard
          title='活跃用户'
          value={activeUsers}
          trend={activeRate}
          trendLabel='活跃率'
        />
      ) : (
        <StatCard
          title='平均登录频率'
          value={avgLoginFrequency ?? 0}
          unit='次/周'
        />
      )}
    </div>
  );
}
