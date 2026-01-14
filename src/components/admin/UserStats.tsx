'use client';

import { useState, useCallback } from 'react';
import {
  TimeRange,
  DateGranularity,
  type RegistrationTrendData,
  type ActivityData,
} from '@/types/stats';
import { StatsSummary } from './UserStatsCards';

const TIME_RANGE_OPTIONS = [
  { value: TimeRange.TODAY, label: '今天' },
  { value: TimeRange.YESTERDAY, label: '昨天' },
  { value: TimeRange.LAST_7_DAYS, label: '最近7天' },
  { value: TimeRange.LAST_30_DAYS, label: '最近30天' },
  { value: TimeRange.LAST_90_DAYS, label: '最近90天' },
  { value: TimeRange.THIS_WEEK, label: '本周' },
  { value: TimeRange.LAST_WEEK, label: '上周' },
  { value: TimeRange.THIS_MONTH, label: '本月' },
  { value: TimeRange.LAST_MONTH, label: '上月' },
  { value: TimeRange.THIS_YEAR, label: '今年' },
];

const GRANULARITY_OPTIONS = [
  { value: DateGranularity.DAY, label: '按天' },
  { value: DateGranularity.WEEK, label: '按周' },
  { value: DateGranularity.MONTH, label: '按月' },
];

interface ChartDataPoint {
  date: string;
  value: number;
}

function TrendChart({
  data,
  label,
}: {
  data: ChartDataPoint[];
  label: string;
}): React.ReactElement {
  if (!data || data.length === 0) {
    return (
      <div className='flex items-center justify-center h-64 text-gray-500'>
        暂无数据
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between mb-4'>
        <h4 className='text-sm font-medium text-gray-700'>{label}</h4>
      </div>
      <div className='flex items-end gap-1 h-48'>
        {data.map((point, index) => {
          const height = (point.value / maxValue) * 100;
          return (
            <div
              key={index}
              className='flex-1 flex flex-col items-center group'
              title={`${point.date}: ${point.value}`}
            >
              <div
                className='w-full bg-blue-500 hover:bg-blue-600 transition-colors rounded-t'
                style={{ height: `${Math.max(height, 1)}%` }}
              />
              <div className='text-xs text-gray-400 mt-1 rotate-45 origin-left truncate w-16'>
                {point.date}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function UserStats(): React.ReactElement {
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.LAST_30_DAYS);
  const [granularity, setGranularity] = useState<DateGranularity>(
    DateGranularity.DAY
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationData, setRegistrationData] =
    useState<RegistrationTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityData | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 加载注册趋势数据
      const registrationParams = new URLSearchParams({
        timeRange,
        granularity,
      });
      const registrationResponse = await fetch(
        `/api/stats/users/registration-trend?${registrationParams}`
      );
      if (!registrationResponse.ok) {
        throw new Error('获取注册趋势失败');
      }
      const registrationResult = await registrationResponse.json();
      setRegistrationData(registrationResult.data);

      // 加载活跃度数据
      const activityParams = new URLSearchParams({
        timeRange,
      });
      const activityResponse = await fetch(
        `/api/stats/users/activity?${activityParams}`
      );
      if (!activityResponse.ok) {
        throw new Error('获取活跃度数据失败');
      }
      const activityResult = await activityResponse.json();
      setActivityData(activityResult.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [timeRange, granularity]);

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <div className='flex flex-wrap items-center gap-4'>
          <h2 className='text-lg font-semibold text-gray-900'>用户统计</h2>
          <div className='flex items-center gap-2 ml-auto'>
            <select
              value={timeRange}
              onChange={e => {
                setTimeRange(e.target.value as TimeRange);
              }}
              className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {TIME_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={granularity}
              onChange={e => {
                setGranularity(e.target.value as DateGranularity);
              }}
              className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              {GRANULARITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={loadData}
              className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              查询
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className='flex items-center justify-center h-64'>
          <div className='text-gray-600'>加载中...</div>
        </div>
      ) : error ? (
        <div className='flex items-center justify-center h-64'>
          <div className='text-red-600'>{error}</div>
        </div>
      ) : (
        <>
          {registrationData && (
            <>
              <StatsSummary
                totalUsers={registrationData.summary.totalUsers}
                newUsers={registrationData.summary.newUsers}
                growthRate={registrationData.summary.growthRate}
                averageDaily={registrationData.summary.averageDaily}
                activeUsers={activityData?.summary.activeUsers}
                activeRate={activityData?.summary.activeRate}
                avgLoginFrequency={activityData?.summary.avgLoginFrequency}
              />
              <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                <div className='bg-white rounded-lg shadow p-6'>
                  <h3 className='text-base font-semibold text-gray-900 mb-4'>
                    用户注册趋势
                  </h3>
                  <TrendChart
                    data={registrationData.trend.map(point => ({
                      date: point.date,
                      value: point.count,
                    }))}
                    label='注册用户数'
                  />
                </div>
                {activityData && (
                  <div className='bg-white rounded-lg shadow p-6'>
                    <h3 className='text-base font-semibold text-gray-900 mb-4'>
                      用户活跃度趋势
                    </h3>
                    <TrendChart
                      data={activityData.trend.map(point => ({
                        date: point.date,
                        value: point.activeUsers,
                      }))}
                      label='活跃用户数'
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
