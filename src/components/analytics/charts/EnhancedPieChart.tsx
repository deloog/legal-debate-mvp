/**
 * EnhancedPieChart - 增强的饼图组件
 * 集成响应式、交互式Tooltip和扇区切换功能
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { PieChartData } from '@/types/chart';
import { InteractiveChartContainer } from '@/components/analytics/ui/InteractiveChartContainer';
import { ChartTooltip } from '@/components/analytics/ui/ChartTooltip';
import {
  calculatePieSliceAngles,
  calculatePieSliceCoordinates,
  calculateTotal,
  formatPercentage,
  calculatePercentage,
  generateColors,
} from '../utils/chart-utils';

export interface EnhancedPieChartProps {
  data: PieChartData[];
  showLabels?: boolean;
  showValues?: boolean;
  showLegend?: boolean;
  onSliceClick?: (slice: PieChartData, index: number) => void;
  onSliceHover?: (slice: PieChartData | null, index: number) => void;
  colors?: string[];
  className?: string;
}

export function EnhancedPieChart({
  data,
  showLabels = true,
  showValues = true,
  showLegend = true,
  onSliceClick,
  onSliceHover,
  colors,
  className,
}: EnhancedPieChartProps) {
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const width = 400;
  const height = 400;
  const padding = { top: 20, right: 20, bottom: 20, left: 20 };
  const radius = Math.min(width, height) / 2 - padding.top - padding.bottom;
  const centerX = width / 2;
  const centerY = height / 2;

  const sliceColors = useMemo(
    () => colors || generateColors(data.length),
    [colors, data.length]
  );

  const total = useMemo(() => calculateTotal(data), [data]);

  const handleSliceHover = (index: number) => {
    setHoveredSlice(index);
    setTooltipVisible(true);
    onSliceHover?.(data[index], index);
  };

  const handleSliceLeave = () => {
    setHoveredSlice(null);
    setTooltipVisible(false);
    onSliceHover?.(null, -1);
  };

  const handleSliceClick = (index: number) => {
    onSliceClick?.(data[index], index);
  };

  if (data.length === 0) {
    return <div className='pie-chart-empty'>无数据</div>;
  }

  const renderChart = () => {
    return (
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={`enhanced-pie-chart ${className || ''}`}
        >
          {data.map((slice, index) => {
            const { startAngle, endAngle } = calculatePieSliceAngles(
              index,
              total,
              data
            );
            const { x1, y1, x2, y2, largeArc } = calculatePieSliceCoordinates(
              centerX,
              centerY,
              radius,
              startAngle,
              endAngle
            );

            const percentage = calculatePercentage(slice.value, total);
            const isHovered = hoveredSlice === index;
            const color = sliceColors[index];

            // 计算标签位置（扇区中心角度）
            const midAngle = (((startAngle + endAngle) / 2) * Math.PI) / 180;
            const labelRadius = radius * 0.7;
            const labelX = centerX + labelRadius * Math.cos(midAngle);
            const labelY = centerY + labelRadius * Math.sin(midAngle);

            return (
              <g key={index} className='pie-slice-group'>
                {/* 扇区 */}
                <path
                  d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={color}
                  stroke='#fff'
                  strokeWidth={2}
                  onMouseEnter={() => handleSliceHover(index)}
                  onMouseLeave={handleSliceLeave}
                  onClick={() => handleSliceClick(index)}
                  style={{
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: `${centerX}px ${centerY}px`,
                    opacity: hoveredSlice !== null && !isHovered ? 0.5 : 1,
                  }}
                />

                {/* 标签 */}
                {showLabels && percentage >= 5 && (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor='middle'
                    fill='#fff'
                    fontSize={12}
                    fontWeight='bold'
                    pointerEvents='none'
                  >
                    {showValues
                      ? `${slice.value} (${formatPercentage(percentage)})`
                      : formatPercentage(percentage)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* 图例 */}
        {showLegend && (
          <div
            className='chart-legend'
            style={{
              position: 'absolute',
              top: padding.top,
              right: padding.right,
              background: 'white',
              padding: '12px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              maxWidth: '200px',
            }}
          >
            {data.map((slice, index) => {
              const color = sliceColors[index];
              const percentage = calculatePercentage(slice.value, total);
              return (
                <div
                  key={index}
                  onClick={() => handleSliceClick(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    opacity:
                      hoveredSlice !== null && hoveredSlice !== index ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      backgroundColor: color,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#374151' }}>
                    <div style={{ fontWeight: 500 }}>{slice.label}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {slice.value} ({formatPercentage(percentage)})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tooltip */}
        {hoveredSlice !== null && tooltipVisible && (
          <ChartTooltip
            data={[
              {
                label: data[hoveredSlice].label,
                value: data[hoveredSlice].value,
                color: sliceColors[hoveredSlice],
                description: `占比: ${formatPercentage(calculatePercentage(data[hoveredSlice].value, total))}`,
              },
            ]}
            position={{
              x: width / 2,
              y: height / 2,
            }}
            visible={true}
          />
        )}
      </div>
    );
  };

  return (
    <InteractiveChartContainer
      minDimensions={{ width: 300, height: 300 }}
      maxDimensions={{ width: 600, height: 600 }}
      interactionConfig={{ enableZoom: false, enablePan: false }}
    >
      {renderChart}
    </InteractiveChartContainer>
  );
}
