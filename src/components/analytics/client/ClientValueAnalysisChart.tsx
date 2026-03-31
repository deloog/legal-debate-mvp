/**
 * ClientValueAnalysisChart - 客户价值分析图组件
 */

'use client';

import { PieChart } from '../charts/PieChart';
import type { PieChartData } from '@/types/chart';
import { getClientValueLevelColor } from '../utils/chart-utils';

export interface ClientValueAnalysisChartProps {
  data: Array<{
    level: string;
    count: number;
    percentage: number;
  }>;
  className?: string;
}

export function ClientValueAnalysisChart({
  data,
  className,
}: ClientValueAnalysisChartProps) {
  const pieData: PieChartData[] = data.map(item => ({
    label:
      item.level === 'HIGH'
        ? '高价值'
        : item.level === 'MEDIUM'
          ? '中价值'
          : '低价值',
    value: item.count,
    percentage: item.percentage,
    color: getClientValueLevelColor(item.level),
  }));

  const totalValue = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`client-value-analysis-chart ${className || ''}`}>
      <h3 className='chart-title'>客户价值分布</h3>
      <div className='chart-container'>
        <PieChart
          data={pieData}
          dimensions={{ width: 400, height: 350 }}
          labelConfig={{
            showLabels: true,
            showValues: true,
            showPercentage: true,
            fontSize: 12,
          }}
        />
      </div>
      <div className='chart-stats'>
        <div className='stat-item'>
          <span className='label'>总客户数:</span>
          <span className='value'>{totalValue}</span>
        </div>
        {data.map(item => (
          <div key={item.level} className='stat-item'>
            <span
              className='label'
              style={{ color: getClientValueLevelColor(item.level) }}
            >
              {item.level === 'HIGH'
                ? '高价值'
                : item.level === 'MEDIUM'
                  ? '中价值'
                  : '低价值'}
              :
            </span>
            <span className='value'>
              {item.count} ({item.percentage.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
