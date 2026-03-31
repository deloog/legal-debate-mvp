/**
 * ClientSourceAnalysisChart - 客户来源分析图组件
 */

'use client';

import { PieChart } from '../charts/PieChart';
import type { PieChartData } from '@/types/chart';
import { getClientSourceColor } from '../utils/chart-utils';

export interface ClientSourceAnalysisChartProps {
  data: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  className?: string;
}

export function ClientSourceAnalysisChart({
  data,
  className,
}: ClientSourceAnalysisChartProps) {
  const pieData: PieChartData[] = data.map(item => ({
    label: getSourceLabel(item.source),
    value: item.count,
    percentage: item.percentage,
    color: getClientSourceColor(item.source),
  }));

  const totalClients = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className={`client-source-analysis-chart ${className || ''}`}>
      <h3 className='chart-title'>客户来源分析</h3>
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
          <span className='value'>{totalClients}</span>
        </div>
        {data.map(item => (
          <div key={item.source} className='stat-item'>
            <span
              className='label'
              style={{ color: getClientSourceColor(item.source) }}
            >
              {getSourceLabel(item.source)}:
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

function getSourceLabel(source: string): string {
  const sourceLabelMap: Record<string, string> = {
    REFERRAL: '推荐',
    ONLINE: '线上',
    EVENT: '活动',
    ADVERTISING: '广告',
    OTHER: '其他',
  };
  return sourceLabelMap[source] || '未知';
}
