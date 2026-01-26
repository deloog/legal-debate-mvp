/**
 * EnhancedBarChart - 增强的柱状图组件
 * 集成响应式、交互式Tooltip和缩放功能
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { BarChartData } from '@/types/chart';
import { InteractiveChartContainer } from '@/components/analytics/ui/InteractiveChartContainer';
import { ChartTooltip } from '@/components/analytics/ui/ChartTooltip';
import {
  calculateDataRange,
  calculateBarWidth,
  calculateBarX,
  calculateBarHeight,
  calculateBarY,
} from '../utils/chart-utils';

export interface EnhancedBarChartProps {
  data: BarChartData[];
  labelConfig?: {
    showLabels?: boolean;
    showValues?: boolean;
    fontSize?: number;
    fontColor?: string;
  };
  showLegend?: boolean;
  onBarClick?: (bar: BarChartData, index: number) => void;
  onBarHover?: (bar: BarChartData | null, index: number) => void;
  barColor?: string;
  hoverColor?: string;
  className?: string;
}

export function EnhancedBarChart({
  data,
  labelConfig = {},
  onBarClick,
  onBarHover,
  barColor = '#3b82f6',
  hoverColor = '#2563eb',
  className,
}: EnhancedBarChartProps) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const width = 600;
  const height = 350;
  const padding = useMemo(
    () => ({ top: 20, right: 20, bottom: 40, left: 50 }),
    []
  );

  const showLabels = labelConfig.showLabels ?? true;
  const showValues = labelConfig.showValues ?? true;
  const fontSize = labelConfig.fontSize || 12;
  const fontColor = labelConfig.fontColor || '#6b7280';

  const { minValue, maxValue } = useMemo(
    () => calculateDataRange(data),
    [data]
  );

  const barWidth = useMemo(
    () => calculateBarWidth(data.length, width, padding),
    [data.length, width, padding]
  );

  const handleBarHover = (index: number) => {
    setHoveredBar(index);
    setTooltipVisible(true);
    onBarHover?.(data[index], index);
  };

  const handleBarLeave = () => {
    setHoveredBar(null);
    setTooltipVisible(false);
    onBarHover?.(null, -1);
  };

  const handleBarClick = (index: number) => {
    onBarClick?.(data[index], index);
  };

  if (data.length === 0) {
    return <div className='bar-chart-empty'>无数据</div>;
  }

  const renderChart = () => {
    const maxBarHeight = height - padding.top - padding.bottom;

    return (
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={`enhanced-bar-chart ${className || ''}`}
        >
          {/* 渐变定义 */}
          <defs>
            <linearGradient id='barGradient' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0%' stopColor={barColor} stopOpacity={1} />
              <stop offset='100%' stopColor={barColor} stopOpacity={0.7} />
            </linearGradient>
          </defs>

          {/* 柱状图 */}
          {data.map((bar, index) => {
            const barHeight = calculateBarHeight(
              bar.value,
              minValue,
              maxValue,
              maxBarHeight
            );
            const barY = calculateBarY(barHeight, height, padding);
            const barX = calculateBarX(
              index,
              data.length,
              width,
              padding,
              barWidth
            );

            return (
              <g key={index} className='bar-group'>
                {/* 柱子 */}
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={hoveredBar === index ? hoverColor : barColor}
                  onMouseEnter={() => handleBarHover(index)}
                  onMouseLeave={handleBarLeave}
                  onClick={() => handleBarClick(index)}
                  style={{
                    cursor: 'pointer',
                    transition: 'fill 0.2s ease',
                  }}
                />

                {/* 标签 */}
                {showLabels && (
                  <text
                    x={barX + barWidth / 2}
                    y={height - padding.bottom + fontSize + 5}
                    textAnchor='middle'
                    fill={fontColor}
                    fontSize={fontSize - 1}
                  >
                    {bar.label}
                  </text>
                )}

                {/* 数值 */}
                {showValues && (
                  <text
                    x={barX + barWidth / 2}
                    y={barY - 5}
                    textAnchor='middle'
                    fill={fontColor}
                    fontSize={fontSize - 1}
                    fontWeight='bold'
                  >
                    {bar.value}
                  </text>
                )}
              </g>
            );
          })}

          {/* Y轴 */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke='#e5e7eb'
            strokeWidth={1}
          />

          {/* X轴 */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke='#e5e7eb'
            strokeWidth={1}
          />
        </svg>

        {/* Tooltip */}
        {hoveredBar !== null && tooltipVisible && (
          <ChartTooltip
            data={[
              {
                label: data[hoveredBar].label,
                value: data[hoveredBar].value,
                color: barColor,
                description: `排名: ${hoveredBar + 1}`,
              },
            ]}
            position={{
              x:
                calculateBarX(
                  hoveredBar,
                  data.length,
                  width,
                  padding,
                  barWidth
                ) +
                barWidth / 2,
              y:
                calculateBarY(
                  calculateBarHeight(
                    data[hoveredBar].value,
                    minValue,
                    maxValue,
                    maxBarHeight
                  ),
                  height,
                  padding
                ) - 10,
            }}
            visible={true}
          />
        )}
      </div>
    );
  };

  return (
    <InteractiveChartContainer
      minDimensions={{ width: 300, height: 200 }}
      maxDimensions={{ width: 1200, height: 800 }}
    >
      {renderChart}
    </InteractiveChartContainer>
  );
}
