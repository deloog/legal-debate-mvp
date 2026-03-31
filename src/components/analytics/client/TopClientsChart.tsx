/**
 * TopClientsChart - Top客户图组件
 */

'use client';

import { BarChart } from '../charts/BarChart';
import type { BarChartData } from '@/types/chart';
import { formatNumber } from '../utils/chart-utils';

export interface TopClientsChartProps {
  data: Array<{
    clientId: string;
    clientName: string;
    totalValue: number;
    caseCount: number;
    valueScore: number;
  }>;
  className?: string;
  onClientClick?: (clientId: string) => void;
}

export function TopClientsChart({
  data,
  className,
  onClientClick,
}: TopClientsChartProps) {
  const barData: BarChartData[] = data.map(item => ({
    label: item.clientName,
    value: item.totalValue,
    color: getBarColor(item.valueScore),
  }));

  const totalValue = data.reduce((sum, item) => sum + item.totalValue, 0);
  const avgValue = totalValue / data.length;

  return (
    <div className={`top-clients-chart ${className || ''}`}>
      <h3 className='chart-title'>Top {data.length} 客户</h3>
      <BarChart
        data={barData}
        dimensions={{ width: 500, height: 350 }}
        labelConfig={{
          showLabels: true,
          showValues: false,
          fontSize: 10,
        }}
        interactionConfig={{
          onClick: (item: unknown) => {
            const clientData = data.find(
              d => d.clientName === (item as { label: string }).label
            );
            if (clientData && onClientClick) {
              onClientClick(clientData.clientId);
            }
          },
        }}
      />
      <div className='chart-stats'>
        <div className='stat-item'>
          <span className='label'>总价值:</span>
          <span className='value'>¥{formatNumber(totalValue)}</span>
        </div>
        <div className='stat-item'>
          <span className='label'>平均价值:</span>
          <span className='value'>¥{formatNumber(avgValue)}</span>
        </div>
      </div>
      <div className='client-list'>
        {data.map((item, index) => (
          <div
            key={item.clientId}
            className={`client-item ${onClientClick ? 'clickable' : ''}`}
            onClick={() => onClientClick?.(item.clientId)}
          >
            <span className='rank'>#{index + 1}</span>
            <span className='name'>{item.clientName}</span>
            <span className='value'>¥{formatNumber(item.totalValue)}</span>
            <span className='cases'>{item.caseCount}个案件</span>
            <span className={`score ${getScoreLevel(item.valueScore)}`}>
              {item.valueScore}分
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getBarColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#6b7280';
}

function getScoreLevel(score: number): string {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
