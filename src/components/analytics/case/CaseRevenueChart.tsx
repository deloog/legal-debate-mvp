/**
 * CaseRevenueChart - 案件收益分析组件
 */

'use client';

import React from 'react';
import type { CaseRevenueAnalysisData } from '@/types/stats';

export interface CaseRevenueChartProps {
  data: CaseRevenueAnalysisData;
  className?: string;
}

export function CaseRevenueChart({ data, className }: CaseRevenueChartProps) {
  const width = 500;
  const height = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 70 };

  // 计算Y轴范围
  const maxValue = Math.max(
    ...data.trend.map(item => item.revenue),
    ...data.byType.map(item => item.totalRevenue)
  );
  const minValue = 0;

  // 计算X轴位置
  const getX = (index: number) => {
    const chartWidth = width - padding.left - padding.right;
    return padding.left + (index / (data.trend.length - 1)) * chartWidth;
  };

  // 计算Y轴位置
  const getY = (value: number) => {
    const chartHeight = height - padding.top - padding.bottom;
    const normalizedValue = (value - minValue) / (maxValue - minValue || 1);
    return height - padding.bottom - normalizedValue * chartHeight;
  };

  return (
    <div className={`case-revenue-chart ${className || ''}`}>
      <h3 className='chart-title'>案件收益分析</h3>

      <div className='summary-cards'>
        <div className='summary-card'>
          <div className='card-label'>总收益</div>
          <div className='card-value'>
            ¥{data.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className='summary-card'>
          <div className='card-label'>平均收益</div>
          <div className='card-value'>
            ¥{data.averageRevenue.toLocaleString()}
          </div>
        </div>
        <div className='summary-card'>
          <div className='card-label'>最高收益</div>
          <div className='card-value'>¥{data.maxRevenue.toLocaleString()}</div>
        </div>
        <div className='summary-card'>
          <div className='card-label'>最低收益</div>
          <div className='card-value'>¥{data.minRevenue.toLocaleString()}</div>
        </div>
      </div>

      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const value = minValue + (maxValue - minValue) * ratio;
          return (
            <g key={ratio}>
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
                ¥{(value / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}

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

        {/* 折线 */}
        <polyline
          points={data.trend
            .map((item, index) => `${getX(index)},${getY(item.revenue)}`)
            .join(' ')}
          fill='none'
          stroke='#3b82f6'
          strokeWidth={2}
          className='revenue-line'
        />

        {/* 数据点 */}
        {data.trend.map((item, index) => (
          <g key={index}>
            <circle
              cx={getX(index)}
              cy={getY(item.revenue)}
              r={4}
              fill='#3b82f6'
              stroke='#fff'
              strokeWidth={2}
              className='revenue-point'
            />
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

      <div className='revenue-breakdown'>
        <h4>按类型收益分析</h4>
        <div className='breakdown-list'>
          {data.byType.map((item, index) => (
            <div key={index} className='breakdown-item'>
              <span className='item-label'>{item.type}</span>
              <span className='item-count'>{item.caseCount}件</span>
              <span className='item-revenue'>
                ¥{item.totalRevenue.toLocaleString()}
              </span>
              <div className='item-bar'>
                <div
                  className='item-bar-fill'
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <span className='item-percentage'>
                {item.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
