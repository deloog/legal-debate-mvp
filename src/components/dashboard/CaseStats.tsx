/**
 * 案件统计组件
 * 展示案件类型分布和效率统计
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CaseEfficiencyData,
  CaseTypeDistributionData,
} from '@/types/stats';

interface CaseStatsProps {
  timeRange?: string;
  status?: string;
  caseType?: string;
}

interface CaseStatsData {
  typeDistribution: CaseTypeDistributionData | null;
  efficiency: CaseEfficiencyData | null;
  loading: boolean;
  error: string | null;
}

/**
 * 案件统计组件
 */
export function CaseStats(props: CaseStatsProps) {
  const { timeRange, status, caseType } = props;
  const [data, setData] = useState<CaseStatsData>({
    typeDistribution: null,
    efficiency: null,
    loading: true,
    error: null,
  });

  const fetchCaseStats = useCallback(async () => {
    try {
      setData({
        typeDistribution: null,
        efficiency: null,
        loading: true,
        error: null,
      });

      const params = new URLSearchParams();
      if (timeRange) {
        params.append('timeRange', timeRange);
      }
      if (status) {
        params.append('status', status);
      }
      if (caseType) {
        params.append('caseType', caseType);
      }

      const [typeDistResponse, efficiencyResponse] = await Promise.all([
        fetch(`/api/stats/cases/type-distribution?${params.toString()}`),
        fetch(`/api/stats/cases/efficiency?${params.toString()}`),
      ]);

      if (!typeDistResponse.ok || !efficiencyResponse.ok) {
        throw new Error('获取统计数据失败');
      }

      const typeDistData = await typeDistResponse.json();
      const efficiencyData = await efficiencyResponse.json();

      setData({
        typeDistribution: typeDistData.data,
        efficiency: efficiencyData.data,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('获取案件统计失败:', error);
      setData(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '获取统计数据失败',
      }));
    }
  }, [timeRange, status, caseType]);

  useEffect(() => {
    fetchCaseStats();
  }, [fetchCaseStats]);

  if (data.loading) {
    return <div className='p-4'>加载中...</div>;
  }

  if (data.error) {
    return <div className='p-4 text-red-500'>{data.error}</div>;
  }

  return (
    <div className='space-y-6'>
      {data.typeDistribution && (
        <TypeDistributionSection data={data.typeDistribution} />
      )}
      {data.efficiency && <EfficiencySection data={data.efficiency} />}
    </div>
  );
}

/**
 * 案件类型分布部分
 */
function TypeDistributionSection({ data }: { data: CaseTypeDistributionData }) {
  return (
    <div className='rounded-lg border bg-white p-6'>
      <h3 className='mb-4 text-lg font-semibold'>案件类型分布</h3>

      <div className='mb-6 grid grid-cols-3 gap-4'>
        <div className='rounded bg-blue-50 p-4'>
          <div className='text-sm text-gray-600'>总案件数</div>
          <div className='text-2xl font-bold text-blue-600'>
            {data.summary.totalCases}
          </div>
        </div>
        <div className='rounded bg-green-50 p-4'>
          <div className='text-sm text-gray-600'>已完成</div>
          <div className='text-2xl font-bold text-green-600'>
            {data.summary.completedCases}
          </div>
        </div>
        <div className='rounded bg-yellow-50 p-4'>
          <div className='text-sm text-gray-600'>活跃中</div>
          <div className='text-2xl font-bold text-yellow-600'>
            {data.summary.activeCases}
          </div>
        </div>
      </div>

      <div className='space-y-3'>
        {data.distribution.map(item => (
          <div key={item.type} className='flex items-center'>
            <div className='flex-1'>
              <div className='mb-1 flex justify-between'>
                <span className='font-medium'>{item.type}</span>
                <span className='text-sm text-gray-600'>
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className='h-2 w-full rounded-full bg-gray-200'>
                <div
                  className='h-2 rounded-full bg-blue-500'
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 案件效率统计部分
 */
function EfficiencySection({ data }: { data: CaseEfficiencyData }) {
  return (
    <div className='rounded-lg border bg-white p-6'>
      <h3 className='mb-4 text-lg font-semibold'>案件效率统计</h3>

      <div className='mb-6 grid grid-cols-2 gap-4'>
        <div className='rounded bg-purple-50 p-4'>
          <div className='text-sm text-gray-600'>平均完成时间</div>
          <div className='text-2xl font-bold text-purple-600'>
            {data.summary.averageCompletionTime.toFixed(2)} 小时
          </div>
        </div>
        <div className='rounded bg-pink-50 p-4'>
          <div className='text-sm text-gray-600'>中位数完成时间</div>
          <div className='text-2xl font-bold text-pink-600'>
            {data.summary.medianCompletionTime.toFixed(2)} 小时
          </div>
        </div>
        <div className='rounded bg-green-50 p-4'>
          <div className='text-sm text-gray-600'>最快完成</div>
          <div className='text-2xl font-bold text-green-600'>
            {data.summary.fastestCompletionTime.toFixed(2)} 小时
          </div>
        </div>
        <div className='rounded bg-red-50 p-4'>
          <div className='text-sm text-gray-600'>最慢完成</div>
          <div className='text-2xl font-bold text-red-600'>
            {data.summary.slowestCompletionTime.toFixed(2)} 小时
          </div>
        </div>
      </div>

      <div className='rounded bg-blue-50 p-4'>
        <div className='text-sm text-gray-600'>已完成案件总数</div>
        <div className='text-3xl font-bold text-blue-600'>
          {data.summary.totalCompletedCases}
        </div>
      </div>
    </div>
  );
}
