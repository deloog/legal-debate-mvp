/**
 * LineChart - 折线图组件（集成响应式和Tooltip）
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { LineChartProps, ChartDataPoint } from '@/types/chart';
import {
  calculateDataRange,
  calculateLinePointX,
  calculateLinePointY,
} from '../utils/chart-utils';
import { useResizeObserver } from '../hooks/useResizeObserver';
import { ChartTooltip } from '../ui/ChartTooltip';

export function LineChart({
  data,
  dimensions,
  labelConfig,
  interactionConfig,
  className,
  enableTooltip = true,
  enableResponsive = true,
}: LineChartProps & { enableTooltip?: boolean; enableResponsive?: boolean }) {
  const [hoveredPoint, setHoveredPoint] = useState<ChartDataPoint | null>(null);
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
    () =>
      dimensions?.padding || {
        top: 20,
        right: 20,
        bottom: 40,
        left: 50,
      },
    [dimensions?.padding]
  );

  const { minValue, maxValue } = calculateDataRange(data[0]?.data || []);

  const showLabels = labelConfig?.showLabels ?? true;
  const showValues = labelConfig?.showValues ?? true;
  const fontSize = labelConfig?.fontSize || 12;
  const fontColor = labelConfig?.fontColor || '#6b7280';

  // 处理悬停
  const handleHover = useCallback(
    (point: ChartDataPoint, event: React.MouseEvent) => {
      if (enableTooltip) {
        setHoveredPoint(point);
        setTooltipPosition({ x: event.clientX, y: event.clientY });
      }
      interactionConfig?.onHover?.(point);
    },
    [enableTooltip, interactionConfig]
  );

  // 处理点击
  const handleClick = useCallback(
    (point: ChartDataPoint) => {
      interactionConfig?.onClick?.(point);
    },
    [interactionConfig]
  );

  // 性能优化：使用useMemo缓存计算结果
  const seriesElements = useMemo(() => {
    if (data.length === 0 || data[0]?.data.length === 0) {
      return [];
    }
    return data.map((series, seriesIndex) => {
      const seriesColor = series.color || `hsl(${seriesIndex * 60}, 70%, 50%)`;
      const points = series.data.map((point, pointIndex) => {
        const x = calculateLinePointX(pointIndex, series.data.length, width, {
          left: padding.left,
          right: padding.right,
        });
        const y = calculateLinePointY(point.value, minValue, maxValue, height, {
          top: padding.top,
          bottom: padding.bottom,
        });
        return { x, y, point };
      });

      return { series, seriesIndex, seriesColor, points };
    });
  }, [data, minValue, maxValue, width, height, padding]);

  if (data.length === 0 || data[0]?.data.length === 0) {
    return <div className='line-chart-empty'>无数据</div>;
  }

  return (
    <div
      ref={containerRef}
      className='line-chart-container'
      style={{ width, height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className={`line-chart ${className || ''}`}
      >
        {seriesElements.map(({ series, seriesColor, points }) => {
          return (
            <g key={series.title} className='line-series'>
              {/* 线条 */}
              <polyline
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
                fill='none'
                stroke={seriesColor}
                strokeWidth={2}
                className='line-path'
                style={{ transition: 'all 0.2s ease' }}
              />

              {/* 数据点 */}
              {points.map((p, i) => {
                const isHovered = hoveredPoint?.label === p.point.label;
                const radius = isHovered ? 6 : 4;
                return (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={radius}
                    fill={seriesColor}
                    stroke='#fff'
                    strokeWidth={2}
                    className='line-point'
                    onMouseEnter={e => handleHover(p.point, e)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => handleClick(p.point)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  />
                );
              })}

              {/* 标签 */}
              {showLabels &&
                points.map((p, i) => (
                  <text
                    key={`label-${i}`}
                    x={p.x}
                    y={height - padding.bottom + fontSize + 5}
                    textAnchor='middle'
                    fill={fontColor}
                    fontSize={fontSize - 1}
                  >
                    {p.point.label}
                  </text>
                ))}

              {/* 数值 */}
              {showValues &&
                points.map((p, i) => (
                  <text
                    key={`value-${i}`}
                    x={p.x}
                    y={p.y - 10}
                    textAnchor='middle'
                    fill={seriesColor}
                    fontSize={fontSize - 1}
                    fontWeight='bold'
                  >
                    {p.point.value}
                  </text>
                ))}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {enableTooltip && hoveredPoint && (
        <ChartTooltip
          data={[hoveredPoint]}
          position={tooltipPosition}
          visible={true}
        />
      )}
    </div>
  );
}
