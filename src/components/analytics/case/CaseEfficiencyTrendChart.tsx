/**
 * CaseEfficiencyTrendChart - 案件效率趋势图组件
 */

'use client';

import React from 'react';
import type { CaseEfficiencyData } from '@/types/stats';

export interface CaseEfficiencyTrendChartProps {
  data: CaseEfficiencyData;
  className?: string;
}

export function CaseEfficiencyTrendChart({
  data,
  className,
}: CaseEfficiencyTrendChartProps) {
  const width = 600;
  const height = 350;
  const padding = {
    top: 40,
    right: 20,
    bottom: 60,
    left: 60,
  };

  if (data.trend.length === 0) {
    return (
      <div className={`case-efficiency-trend-chart ${className || ''}`}>
        <h3 className='chart-title'>案件效率趋势</h3>
        <div className='empty-state'>无数据</div>
      </div>
    );
  }

  // 计算Y轴范围
  const avgCompletionTimes = data.trend.map(item => item.averageCompletionTime);
  const maxTime = Math.max(...avgCompletionTimes, 1);
  const minTime = Math.min(...avgCompletionTimes, 0);
  const timeRange = maxTime - minTime || 1;

  // 计算Y轴刻度
  const yAxisTicks = calculateYAxisTicks(minTime, maxTime, 5);

  // 计算X轴刻度
  const xStep =
    data.trend.length > 1
      ? (width - padding.left - padding.right) / (data.trend.length - 1)
      : (width - padding.left - padding.right) / 2;

  // 计算点的坐标
  const points = data.trend.map((item, index) => {
    const x = padding.left + index * xStep;
    const y =
      padding.top +
      (1 - (item.averageCompletionTime - minTime) / timeRange) *
        (height - padding.top - padding.bottom);
    return { x, y, ...item };
  });

  return (
    <div className={`case-efficiency-trend-chart ${className || ''}`}>
      <h3 className='chart-title'>案件完成时间趋势（小时）</h3>

      <div className='chart-summary'>
        <div className='summary-item'>
          <span className='label'>平均完成时间:</span>
          <span className='value'>
            {data.summary.averageCompletionTime.toFixed(2)} 小时
          </span>
        </div>
        <div className='summary-item'>
          <span className='label'>中位数完成时间:</span>
          <span className='value'>
            {data.summary.medianCompletionTime.toFixed(2)} 小时
          </span>
        </div>
        <div className='summary-item'>
          <span className='label'>最快完成时间:</span>
          <span className='value success'>
            {data.summary.fastestCompletionTime.toFixed(2)} 小时
          </span>
        </div>
        <div className='summary-item'>
          <span className='label'>最慢完成时间:</span>
          <span className='value warning'>
            {data.summary.slowestCompletionTime.toFixed(2)} 小时
          </span>
        </div>
      </div>

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className='trend-chart'
        role='img'
        aria-label='案件完成时间趋势图'
      >
        {/* 网格线 */}
        {yAxisTicks.map(tick => {
          const y =
            padding.top +
            (1 - (tick - minTime) / timeRange) *
              (height - padding.top - padding.bottom);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke='#e5e7eb'
                strokeWidth={1}
                strokeDasharray='4'
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor='end'
                fill='#6b7280'
                fontSize={11}
              >
                {tick.toFixed(1)}
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
          stroke='#6b7280'
          strokeWidth={2}
        />

        {/* Y轴 */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke='#6b7280'
          strokeWidth={2}
        />

        {/* 折线 */}
        <polyline
          points={points.map(p => `${p.x},${p.y}`).join(' ')}
          fill='none'
          stroke='#3b82f6'
          strokeWidth={2}
          strokeLinejoin='round'
        />

        {/* 渐变填充 */}
        <polygon
          points={`${padding.left},${height - padding.bottom} ${points.map(p => `${p.x},${p.y}`).join(' ')} ${points[points.length - 1].x},${height - padding.bottom}`}
          fill='url(#gradient)'
          opacity={0.1}
        />

        {/* 数据点 */}
        {points.map((point, index) => (
          <g key={index}>
            {/* 外圈 */}
            <circle
              cx={point.x}
              cy={point.y}
              r={6}
              fill='white'
              stroke='#3b82f6'
              strokeWidth={2}
              className='data-point-outer'
            />
            {/* 内圈 */}
            <circle
              cx={point.x}
              cy={point.y}
              r={3}
              fill='#3b82f6'
              className='data-point-inner'
            />
            {/* X轴标签 */}
            <text
              x={point.x}
              y={height - padding.bottom + 20}
              textAnchor='middle'
              fill='#6b7280'
              fontSize={10}
            >
              {formatDateLabel(point.date)}
            </text>
            {/* 悬停提示 */}
            <title>
              {`${formatDateLabel(point.date)}\n完成案件数: ${
                point.completedCases
              }\n平均完成时间: ${point.averageCompletionTime.toFixed(2)} 小时`}
            </title>
          </g>
        ))}

        {/* 渐变定义 */}
        <defs>
          <linearGradient id='gradient' x1='0%' y1='0%' x2='0%' y2='100%'>
            <stop offset='0%' stopColor='#3b82f6' stopOpacity={0.3} />
            <stop offset='100%' stopColor='#3b82f6' stopOpacity={0} />
          </linearGradient>
        </defs>
      </svg>

      {/* 图例 */}
      <div className='chart-legend'>
        <div className='legend-item'>
          <span
            className='legend-color'
            style={{ backgroundColor: '#3b82f6' }}
          />
          <span className='legend-label'>平均完成时间</span>
        </div>
      </div>

      {/* 统计信息 */}
      <div className='chart-stats'>
        <div className='stat-item'>
          <span className='stat-label'>已完成案件总数:</span>
          <span className='stat-value'>{data.summary.totalCompletedCases}</span>
        </div>
        <div className='stat-item'>
          <span className='stat-label'>数据点数:</span>
          <span className='stat-value'>{data.trend.length}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 计算Y轴刻度
 */
function calculateYAxisTicks(
  minValue: number,
  maxValue: number,
  tickCount: number
): number[] {
  const range = maxValue - minValue;
  const step = Math.ceil(range / tickCount);
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(minValue + i * step);
  }
  return ticks;
}

/**
 * 格式化日期标签
 */
function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}
