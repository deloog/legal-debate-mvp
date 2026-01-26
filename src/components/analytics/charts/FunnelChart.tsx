/**
 * FunnelChart - 漏斗图组件（集成响应式和Tooltip）
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { FunnelChartProps, ChartDataPoint } from '@/types/chart';
import {
  calculateFunnelCoordinates,
  formatPercentage,
} from '../utils/chart-utils';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { ChartTooltip } from '../ui/ChartTooltip';

export function FunnelChart({
  data,
  dimensions,
  labelConfig,
  interactionConfig,
  className,
  enableTooltip = true,
  enableResponsive = true,
}: FunnelChartProps & { enableTooltip?: boolean; enableResponsive?: boolean }) {
  const [hoveredStage, setHoveredStage] = useState<(typeof data)[0] | null>(
    null
  );
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 响应式尺寸
  const observedSize = useResizeObserver({
    element: containerRef,
    enabled: enableResponsive,
  });

  const width = dimensions?.width || observedSize?.width || 400;
  const height = dimensions?.height || observedSize?.height || 300;
  const padding = useMemo(
    () => dimensions?.padding || { top: 20, bottom: 40 },
    [dimensions?.padding]
  );

  const showLabels = labelConfig?.showLabels ?? true;
  const showValues = labelConfig?.showValues ?? true;
  const showPercentage = labelConfig?.showPercentage ?? true;
  const fontSize = labelConfig?.fontSize || 12;

  // 性能优化：使用useMemo缓存计算结果
  const stageElements = useMemo(() => {
    if (data.length === 0) {
      return [];
    }
    return data.map((item, index) => {
      const { x1, y1, x2, y2 } = calculateFunnelCoordinates(
        index,
        data.length,
        width,
        height,
        padding
      );
      const color = item.color || `hsl(${index * 60}, 70%, 50%)`;

      return { item, index, x1, y1, x2, y2, color };
    });
  }, [data, width, height, padding]);

  // 处理悬停
  const handleHover = useCallback(
    (item: (typeof data)[0], event: React.MouseEvent) => {
      if (enableTooltip) {
        setHoveredStage(item);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
      interactionConfig?.onHover?.(item);
    },
    [enableTooltip, interactionConfig]
  );

  // 处理点击
  const handleClick = useCallback(
    (item: (typeof data)[0]) => {
      interactionConfig?.onClick?.(item);
    },
    [interactionConfig]
  );

  if (data.length === 0) {
    return <div className='funnel-chart-empty'>无数据</div>;
  }

  return (
    <div
      ref={containerRef}
      className='funnel-chart-container'
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`funnel-chart ${className || ''}`}
      >
        {stageElements.map(({ item, x1, y1, x2, y2, color }) => {
          const isHovered = hoveredStage?.label === item.label;
          const strokeWidth = isHovered ? 4 : 2;
          const opacity = isHovered ? 1 : 0.8;

          return (
            <g
              key={item.label}
              className='funnel-item'
              onMouseEnter={e => handleHover(item, e)}
              onMouseLeave={() => setHoveredStage(null)}
              onClick={() => handleClick(item)}
              style={{ cursor: 'pointer' }}
            >
              <polygon
                points={`${x1} ${y1} ${width - x1} ${y1} ${width - x2} ${y2} ${x2} ${y2}`}
                fill={color}
                fillOpacity={opacity}
                stroke={isHovered ? '#3b82f6' : '#fff'}
                strokeWidth={strokeWidth}
                style={{ transition: 'all 0.2s ease' }}
              />
              {showLabels && (
                <text
                  x={width / 2}
                  y={(y1 + y2) / 2}
                  textAnchor='middle'
                  fill='#fff'
                  fontSize={fontSize}
                  fontWeight='bold'
                >
                  {item.label}
                </text>
              )}
              {showValues && (
                <text
                  x={width / 2}
                  y={(y1 + y2) / 2 + fontSize + 5}
                  textAnchor='middle'
                  fill='#fff'
                  fontSize={fontSize - 1}
                >
                  {item.count}
                </text>
              )}
              {showPercentage && (
                <text
                  x={width - x2 + 10}
                  y={(y1 + y2) / 2}
                  textAnchor='start'
                  fill='#6b7280'
                  fontSize={fontSize - 1}
                >
                  {formatPercentage(item.percentage)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {enableTooltip && hoveredStage && (
        <ChartTooltip
          data={[
            {
              ...hoveredStage,
              value: (hoveredStage as unknown as { count: number }).count,
            } as unknown as ChartDataPoint,
          ]}
          position={tooltipPosition}
          visible={true}
        />
      )}
    </div>
  );
}
