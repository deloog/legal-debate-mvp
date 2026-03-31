/**
 * ClientGrowthTrendChart - 客户增长趋势图组件
 */

'use client';

import { LineChart } from '../charts/LineChart';
import type { LineChartData } from '@/types/chart';
import { formatMonthLabel } from '../utils/chart-utils';

export interface ClientGrowthTrendChartProps {
  data: Array<{
    month: string;
    count: number;
  }>;
  className?: string;
}

export function ClientGrowthTrendChart({
  data,
  className,
}: ClientGrowthTrendChartProps) {
  const lineData: LineChartData[] = [
    {
      title: '客户增长',
      data: data.map(item => ({
        label: formatMonthLabel(item.month),
        value: item.count,
      })),
      color: '#3b82f6',
    },
  ];

  const totalCount = data.reduce((sum, item) => sum + item.count, 0);
  const avgGrowth = totalCount / data.length;

  return (
    <div className={`client-growth-trend-chart ${className || ''}`}>
      <h3 className='chart-title'>客户增长趋势</h3>
      <LineChart
        data={lineData}
        dimensions={{ width: 500, height: 300 }}
        labelConfig={{
          showLabels: true,
          showValues: true,
          fontSize: 11,
        }}
      />
      <div className='chart-stats'>
        <div className='stat-item'>
          <span className='label'>总增长:</span>
          <span className='value'>{totalCount}</span>
        </div>
        <div className='stat-item'>
          <span className='label'>平均月增长:</span>
          <span className='value'>{avgGrowth.toFixed(1)}</span>
        </div>
        <div className='stat-item'>
          <span className='label'>最高月增长:</span>
          <span className='value'>{Math.max(...data.map(d => d.count))}</span>
        </div>
      </div>
    </div>
  );
}
