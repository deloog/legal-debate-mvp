/**
 * ClientConversionFunnelChart - 客户转化漏斗图组件
 */

'use client';

import { FunnelChart } from '../charts/FunnelChart';
import { getClientStatusColor } from '../utils/chart-utils';

export interface ClientConversionFunnelChartProps {
  data: Array<{
    stage: string;
    count: number;
    percentage: number;
  }>;
  className?: string;
}

export function ClientConversionFunnelChart({
  data,
  className,
}: ClientConversionFunnelChartProps) {
  const funnelData = data.map(item => ({
    label: item.stage,
    count: item.count,
    percentage: item.percentage,
    color: getClientStatusColor(item.stage),
  }));

  return (
    <div className={`client-conversion-funnel-chart ${className || ''}`}>
      <h3 className='chart-title'>客户转化漏斗</h3>
      <FunnelChart
        data={funnelData}
        dimensions={{ width: 400, height: 350 }}
        labelConfig={{
          showLabels: true,
          showValues: true,
          showPercentage: true,
          fontSize: 12,
        }}
      />
      <div className='chart-legend'>
        <div className='legend-item'>
          <div
            className='legend-color'
            style={{ background: getClientStatusColor('ACTIVE') }}
          />
          <span>活跃客户</span>
        </div>
        <div className='legend-item'>
          <div
            className='legend-color'
            style={{ background: getClientStatusColor('INACTIVE') }}
          />
          <span>非活跃客户</span>
        </div>
        <div className='legend-item'>
          <div
            className='legend-color'
            style={{ background: getClientStatusColor('LOST') }}
          />
          <span>流失客户</span>
        </div>
        <div className='legend-item'>
          <div
            className='legend-color'
            style={{ background: getClientStatusColor('BLACKLISTED') }}
          />
          <span>黑名单客户</span>
        </div>
      </div>
    </div>
  );
}
