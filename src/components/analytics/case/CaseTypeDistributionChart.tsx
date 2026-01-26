/**
 * CaseTypeDistributionChart - 案件类型分布饼图组件
 */

'use client';

import React from 'react';
import type { CaseTypeDistributionData } from '@/types/stats';

export interface CaseTypeDistributionChartProps {
  data: CaseTypeDistributionData;
  className?: string;
}

export function CaseTypeDistributionChart({
  data,
  className,
}: CaseTypeDistributionChartProps) {
  const width = 300;
  const height = 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 20;

  // 计算饼图扇区
  const slices = data.distribution.reduce(
    (acc, item, index) => {
      const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
      const startAngle = acc.currentAngle;
      const endAngle = acc.currentAngle + sliceAngle;

      const x1 = centerX + radius * Math.cos(startAngle - Math.PI / 2);
      const y1 = centerY + radius * Math.sin(startAngle - Math.PI / 2);
      const x2 = centerX + radius * Math.cos(endAngle - Math.PI / 2);
      const y2 = centerY + radius * Math.sin(endAngle - Math.PI / 2);

      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

      const slice = {
        ...item,
        startAngle,
        endAngle,
        pathData: [
          `M ${centerX} ${centerY}`,
          `L ${x1} ${y1}`,
          `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
          'Z',
        ].join(' '),
        color: getSliceColor(index),
      };

      return {
        slices: [...acc.slices, slice],
        currentAngle: endAngle,
      };
    },
    {
      slices: [] as Array<{
        type: string;
        count: number;
        percentage: number;
        pathData: string;
        color: string;
      }>,
      currentAngle: 0,
    }
  ).slices;

  return (
    <div className={`case-type-distribution-chart ${className || ''}`}>
      <h3 className='chart-title'>案件类型分布</h3>
      <div className='chart-container'>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          {slices.map((slice, index) => (
            <path
              key={index}
              d={slice.pathData}
              fill={slice.color}
              stroke='#fff'
              strokeWidth={2}
              className='pie-slice'
            />
          ))}
        </svg>
        <div className='chart-legend'>
          {slices.map((slice, index) => (
            <div key={index} className='legend-item'>
              <span
                className='legend-color'
                style={{ backgroundColor: slice.color }}
              />
              <span className='legend-label'>
                {slice.type} ({slice.count})
              </span>
              <span className='legend-value'>
                {slice.percentage.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className='chart-summary'>
        <div className='summary-item'>
          <span className='label'>总案件:</span>
          <span className='value'>{data.summary.totalCases}</span>
        </div>
        <div className='summary-item'>
          <span className='label'>已完成:</span>
          <span className='value'>{data.summary.completedCases}</span>
        </div>
        <div className='summary-item'>
          <span className='label'>进行中:</span>
          <span className='value'>{data.summary.activeCases}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 获取扇区颜色
 */
function getSliceColor(index: number): string {
  const colors = [
    '#3b82f6', // blue-500
    '#10b981', // green-500
    '#f59e0b', // amber-500
    '#ef4444', // red-500
    '#8b5cf6', // violet-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
  ];
  return colors[index % colors.length];
}
