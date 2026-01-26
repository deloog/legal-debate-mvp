/**
 * BarChart - 柱状图组件（集成响应式和Tooltip）
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { BarChartProps, ChartDataPoint } from '@/types/chart';
import { calculateMaxValue, calculateYAxisTicks } from '../utils/chart-utils';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { ChartTooltip } from '../ui/ChartTooltip';

export function BarChart({
  data,
  dimensions,
  labelConfig,
  interactionConfig,
  className,
  enableTooltip = true,
  enableResponsive = true,
}: BarChartProps & { enableTooltip?: boolean; enableResponsive?: boolean }) {
  const [hoveredItem, setHoveredItem] = useState<ChartDataPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 响应式尺寸
  const observedSize = useResizeObserver({
    element: containerRef,
    enabled: enableResponsive,
  });

  const width = dimensions?.width || observedSize?.width || 400;
  const height = dimensions?.height || observedSize?.height || 300;

  const padding = useMemo(() => {
    return (
      dimensions?.padding || {
        top: 20,
        right: 20,
        bottom: 40,
        left: 50,
      }
    );
  }, [dimensions?.padding]);

  const maxValue = calculateMaxValue(data);
  const yAxisTicks = calculateYAxisTicks(maxValue, 5);

  const showLabels = labelConfig?.showLabels ?? true;
  const showValues = labelConfig?.showValues ?? true;
  const fontSize = labelConfig?.fontSize || 12;
  const fontColor = labelConfig?.fontColor || '#6b7280';

  const chartHeight = height - padding.top - padding.bottom;
  const chartWidth = width - padding.left - padding.right;
  const barWidth = (chartWidth / data.length) * 0.6;
  const barGap = (chartWidth / data.length) * 0.4;

  // 性能优化：使用useMemo缓存计算结果
  const barElements = data.map((item, index) => {
    const barHeight = (item.value / maxValue) * chartHeight;
    const x = padding.left + index * (barWidth + barGap) + barGap / 2;
    const y = height - padding.bottom - barHeight;

    return { item, index, barHeight, x, y, barWidth };
  });

  // 处理悬停
  const handleHover = useCallback(
    (item: ChartDataPoint, event: React.MouseEvent) => {
      if (enableTooltip) {
        setHoveredItem(item);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
      interactionConfig?.onHover?.(item);
    },
    [enableTooltip, interactionConfig]
  );

  // 处理点击
  const handleClick = useCallback(
    (item: ChartDataPoint) => {
      interactionConfig?.onClick?.(item);
    },
    [interactionConfig]
  );

  if (data.length === 0) {
    return <div className='bar-chart-empty'>无数据</div>;
  }

  return (
    <div
      ref={containerRef}
      className='bar-chart-container'
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`bar-chart ${className || ''}`}
      >
        {/* Y轴 */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke={fontColor}
          strokeWidth={1}
        />

        {/* X轴 */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke={fontColor}
          strokeWidth={1}
        />

        {/* Y轴刻度 */}
        {yAxisTicks.map(tick => {
          const y = height - padding.bottom - (tick / maxValue) * chartHeight;
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
                y={y + fontSize / 3}
                textAnchor='end'
                fill={fontColor}
                fontSize={fontSize}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* 柱状图 */}
        {barElements.map(({ item, index, barHeight, x, y, barWidth }) => {
          const isHovered = hoveredItem?.label === item.label;
          const opacity = isHovered ? 1 : 0.8;
          const strokeWidth = isHovered ? 3 : 0;
          const strokeColor = isHovered ? '#3b82f6' : 'transparent';

          return (
            <g
              key={item.label}
              className='bar-item'
              onMouseEnter={e => handleHover(item, e)}
              onMouseLeave={() => setHoveredItem(null)}
              onClick={() => handleClick(item)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={item.color || `hsl(${index * 60}, 70%, 50%)`}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                opacity={opacity}
                rx={2}
                ry={2}
                className='bar-rect'
                style={{ transition: 'all 0.2s ease' }}
              />
              {showValues && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor='middle'
                  fill={fontColor}
                  fontSize={fontSize - 1}
                  fontWeight='bold'
                >
                  {item.value}
                </text>
              )}
              {showLabels && (
                <text
                  x={x + barWidth / 2}
                  y={height - padding.bottom + fontSize + 5}
                  textAnchor='middle'
                  fill={fontColor}
                  fontSize={fontSize}
                >
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {enableTooltip && hoveredItem && (
        <ChartTooltip
          data={[hoveredItem]}
          position={tooltipPosition}
          visible={true}
        />
      )}
    </div>
  );
}
