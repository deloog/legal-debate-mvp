/**
 * CaseSuccessRateChart - 案件成功率分析组件
 */

'use client';

import type { CaseSuccessRateData } from '@/types/stats';

export interface CaseSuccessRateChartProps {
  data: CaseSuccessRateData;
  className?: string;
}

export function CaseSuccessRateChart({
  data,
  className,
}: CaseSuccessRateChartProps) {
  const width = 400;
  const height = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };

  // 计算Y轴范围
  const maxValue = 100;
  const minValue = 0;

  // 计算X轴位置
  const getX = (index: number) => {
    const chartWidth = width - padding.left - padding.right;
    return padding.left + (index / (data.trend.length - 1)) * chartWidth;
  };

  // 计算Y轴位置
  const getY = (value: number) => {
    const chartHeight = height - padding.top - padding.bottom;
    const normalizedValue = (value - minValue) / (maxValue - minValue);
    return height - padding.bottom - normalizedValue * chartHeight;
  };

  // 计算柱状图宽度
  const barWidth =
    (width - padding.left - padding.right) / data.trend.length - 10;

  return (
    <div className={`case-success-rate-chart ${className || ''}`}>
      <h3 className='chart-title'>案件成功率分析</h3>

      <div className='summary-cards'>
        <div className='summary-card'>
          <div className='card-label'>总案件数</div>
          <div className='card-value'>{data.totalCases}</div>
        </div>
        <div className='summary-card'>
          <div className='card-label'>成功案件</div>
          <div className='card-value'>{data.successfulCases}</div>
        </div>
        <div className='summary-card highlight'>
          <div className='card-label'>成功率</div>
          <div className='card-value'>{data.successRate.toFixed(1)}%</div>
        </div>
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 网格线 */}
        {[0, 25, 50, 75, 100].map(value => (
          <g key={value}>
            <line
              x1={padding.left}
              y1={getY(value)}
              x2={width - padding.right}
              y2={getY(value)}
              stroke='#e5e7eb'
              strokeWidth={1}
            />
            <text
              x={padding.left - 10}
              y={getY(value) + 4}
              textAnchor='end'
              fill='#6b7280'
              fontSize={11}
            >
              {value}%
            </text>
          </g>
        ))}

        {/* X轴 */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke='#9ca3af'
          strokeWidth={1}
        />

        {/* Y轴 */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke='#9ca3af'
          strokeWidth={1}
        />

        {/* 柱状图 */}
        {data.trend.map((item, index) => (
          <g key={index}>
            <rect
              x={getX(index) - barWidth / 2}
              y={getY(item.successRate)}
              width={barWidth}
              height={height - padding.bottom - getY(item.successRate)}
              fill='#10b981'
              className='bar'
              rx={2}
            />
            <text
              x={getX(index)}
              y={getY(item.successRate) - 5}
              textAnchor='middle'
              fill='#10b981'
              fontSize={10}
              fontWeight='bold'
            >
              {item.successRate.toFixed(0)}%
            </text>
            <text
              x={getX(index)}
              y={height - padding.bottom + 20}
              textAnchor='middle'
              fill='#6b7280'
              fontSize={10}
            >
              {item.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>

      <div className='breakdown-section'>
        <h4>按类型成功率</h4>
        <div className='breakdown-list'>
          {data.byType.map((item, index) => (
            <div key={index} className='breakdown-item'>
              <span className='item-label'>{item.type}</span>
              <span className='item-value'>{item.successRate.toFixed(1)}%</span>
              <div className='item-bar'>
                <div
                  className='item-bar-fill'
                  style={{
                    width: `${item.successRate}%`,
                    backgroundColor: getBarColor(item.successRate),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 根据成功率获取颜色
 */
function getBarColor(rate: number): string {
  if (rate >= 80) return '#10b981'; // green
  if (rate >= 60) return '#3b82f6'; // blue
  if (rate >= 40) return '#f59e0b'; // amber
  return '#ef4444'; // red
}
