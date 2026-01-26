/**
 * PieChart - 饼图组件（集成响应式和Tooltip）
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { PieChartProps, ChartDataPoint } from '@/types/chart';
import {
  calculatePieSliceAngles,
  calculatePieSliceCoordinates,
  formatPercentage,
} from '../utils/chart-utils';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { ChartTooltip } from '../ui/ChartTooltip';

/**
 * 饼图组件
 */
export function PieChart({
  data,
  dimensions,
  labelConfig,
  interactionConfig,
  className,
  enableTooltip = true,
  enableResponsive = true,
}: PieChartProps & { enableTooltip?: boolean; enableResponsive?: boolean }) {
  const [hoveredSlice, setHoveredSlice] = useState<ChartDataPoint | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 响应式尺寸
  const observedSize = useResizeObserver({
    element: containerRef,
    enabled: enableResponsive,
  });

  const width = dimensions?.width || observedSize?.width || 400;
  const height = dimensions?.height || observedSize?.height || 300;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 40;

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const showLabels = labelConfig?.showLabels ?? true;
  const showValues = labelConfig?.showValues ?? false;
  const showPercentage = labelConfig?.showPercentage ?? true;
  const fontSize = labelConfig?.fontSize || 12;

  // 性能优化：使用useMemo缓存计算结果
  const sliceElements = useMemo(() => {
    if (total === 0) {
      return [];
    }
    return data.map((slice, index) => {
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

      const percentage = (slice.value / total) * 100;
      const color = slice.color || `hsl(${index * 60}, 70%, 50%)`;

      return {
        slice,
        index,
        startAngle,
        endAngle,
        x1,
        y1,
        x2,
        y2,
        largeArc,
        percentage,
        color,
      };
    });
  }, [data, total, centerX, centerY, radius]);

  // 处理悬停
  const handleHover = useCallback(
    (slice: ChartDataPoint, event: React.MouseEvent) => {
      if (enableTooltip) {
        setHoveredSlice(slice);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
      interactionConfig?.onHover?.(slice);
    },
    [enableTooltip, interactionConfig]
  );

  // 处理点击
  const handleClick = useCallback(
    (slice: ChartDataPoint) => {
      interactionConfig?.onClick?.(slice);
    },
    [interactionConfig]
  );

  if (total === 0) {
    return <div className='pie-chart-empty'>无数据</div>;
  }

  return (
    <div
      ref={containerRef}
      className='pie-chart-container'
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`pie-chart ${className || ''}`}
      >
        {sliceElements.map(
          ({
            slice,
            startAngle,
            endAngle,
            x1,
            y1,
            x2,
            y2,
            largeArc,
            percentage,
            color,
          }) => {
            const isHovered = hoveredSlice?.label === slice.label;
            const strokeWidth = isHovered ? 4 : 2;
            const scale = isHovered ? 1.05 : 1;
            const transformOrigin = `${centerX}px ${centerY}px`;

            return (
              <g
                key={slice.label}
                className='pie-slice'
                onMouseEnter={e => handleHover(slice, e)}
                onMouseLeave={() => setHoveredSlice(null)}
                onClick={() => handleClick(slice)}
                style={{ cursor: 'pointer' }}
              >
                <path
                  d={`M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                  fill={color}
                  stroke={isHovered ? '#3b82f6' : '#fff'}
                  strokeWidth={strokeWidth}
                  style={{
                    transition: 'all 0.2s ease',
                    transform: `scale(${scale})`,
                    transformOrigin,
                  }}
                />
                {(showLabels || showValues || showPercentage) &&
                  percentage > 5 && (
                    <text
                      x={
                        centerX +
                        radius *
                          0.6 *
                          Math.cos(
                            (((startAngle + endAngle) / 2) * Math.PI) / 180
                          )
                      }
                      y={
                        centerY +
                        radius *
                          0.6 *
                          Math.sin(
                            (((startAngle + endAngle) / 2) * Math.PI) / 180
                          )
                      }
                      textAnchor='middle'
                      fill='#fff'
                      fontSize={fontSize}
                      fontWeight='bold'
                    >
                      {showLabels && `${slice.label} `}
                      {showValues && `${slice.value} `}
                      {showPercentage && formatPercentage(percentage)}
                    </text>
                  )}
              </g>
            );
          }
        )}
      </svg>

      {/* Tooltip */}
      {enableTooltip && hoveredSlice && (
        <ChartTooltip
          data={[hoveredSlice]}
          position={tooltipPosition}
          visible={true}
        />
      )}
    </div>
  );
}
