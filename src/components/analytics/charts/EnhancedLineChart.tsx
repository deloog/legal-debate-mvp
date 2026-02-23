/**
 * EnhancedLineChart - 增强的折线图组件
 * 集成响应式、交互式Tooltip和缩放功能
 */

'use client';

import _React, { useState } from 'react';
import type { LineChartData, LineChartDataPoint } from '@/types/chart';
import {
  InteractiveChartContainer,
  type ChartInteraction,
} from '@/components/analytics/ui/InteractiveChartContainer';
import { ChartTooltip } from '@/components/analytics/ui/ChartTooltip';
import {
  calculateDataRange,
  calculateLinePointX,
  calculateLinePointY,
} from '../utils/chart-utils';

export interface EnhancedLineChartProps {
  data: LineChartData[];
  labelConfig?: {
    showLabels?: boolean;
    showValues?: boolean;
    fontSize?: number;
    fontColor?: string;
  };
  showLegend?: boolean;
  showDataPoints?: boolean;
  onPointClick?: (point: LineChartDataPoint, seriesIndex: number) => void;
  onSeriesToggle?: (seriesIndex: number, visible: boolean) => void;
  className?: string;
}

export function EnhancedLineChart({
  data,
  labelConfig = {},
  showLegend = true,
  showDataPoints = true,
  onPointClick,
  onSeriesToggle,
  className,
}: EnhancedLineChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    point: LineChartDataPoint;
    seriesIndex: number;
    pointIndex: number;
  } | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Set<number>>(
    new Set(data.map((_, i) => i))
  );

  const width = 600;
  const height = 350;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };

  const showLabels = labelConfig.showLabels ?? true;
  const showValues = labelConfig.showValues ?? true;
  const fontSize = labelConfig.fontSize || 12;
  const fontColor = labelConfig.fontColor || '#6b7280';

  const filteredData = data.filter((_, i) => visibleSeries.has(i));

  if (filteredData.length === 0) {
    return <div className='line-chart-empty'>无数据</div>;
  }

  const { minValue, maxValue } = calculateDataRange(
    filteredData[0]?.data || []
  );

  const handlePointHover = (
    point: LineChartDataPoint,
    seriesIndex: number,
    pointIndex: number
  ) => {
    setHoveredPoint({ point, seriesIndex, pointIndex });
    setTooltipVisible(true);
  };

  const handlePointLeave = () => {
    setHoveredPoint(null);
    setTooltipVisible(false);
  };

  const handlePointClick = (point: LineChartDataPoint, seriesIndex: number) => {
    onPointClick?.(point, seriesIndex);
  };

  const toggleSeries = (seriesIndex: number) => {
    setVisibleSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesIndex)) {
        newSet.delete(seriesIndex);
      } else {
        newSet.add(seriesIndex);
      }
      onSeriesToggle?.(seriesIndex, newSet.has(seriesIndex));
      return newSet;
    });
  };

  const renderChart = (interaction: ChartInteraction) => {
    const { x: panX, y: panY } = interaction.pan;

    return (
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={`enhanced-line-chart ${className || ''}`}
        >
          {filteredData.map((series, seriesIndex) => {
            const seriesColor =
              series.color || `hsl(${seriesIndex * 60}, 70%, 50%)`;
            const points = series.data.map((point, pointIndex) => {
              const x = calculateLinePointX(
                pointIndex,
                series.data.length,
                width,
                {
                  left: padding.left,
                  right: padding.right,
                }
              );
              const y = calculateLinePointY(
                point.value,
                minValue,
                maxValue,
                height,
                { top: padding.top, bottom: padding.bottom }
              );
              return { x, y, point };
            });

            return (
              <g key={series.title} className='line-series'>
                {/* 线条 */}
                <polyline
                  points={points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill='none'
                  stroke={seriesColor}
                  strokeWidth={2}
                  className='line-path'
                  opacity={
                    hoveredPoint
                      ? hoveredPoint.seriesIndex === seriesIndex
                        ? 1
                        : 0.3
                      : 1
                  }
                />

                {/* 数据点 */}
                {showDataPoints &&
                  points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={4}
                      fill={seriesColor}
                      stroke='#fff'
                      strokeWidth={2}
                      className='line-point'
                      onMouseEnter={() =>
                        handlePointHover(p.point, seriesIndex, i)
                      }
                      onMouseLeave={handlePointLeave}
                      onClick={() => handlePointClick(p.point, seriesIndex)}
                      style={{ cursor: 'pointer' }}
                    />
                  ))}

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

        {/* 图例 */}
        {showLegend && (
          <div
            className='chart-legend'
            style={{
              position: 'absolute',
              top: padding.top,
              right: padding.right,
              background: 'white',
              padding: '8px',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            {data.map((series, i) => {
              const seriesColor = series.color || `hsl(${i * 60}, 70%, 50%)`;
              const isVisible = visibleSeries.has(i);
              return (
                <div
                  key={i}
                  onClick={() => toggleSeries(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    opacity: isVisible ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: seriesColor,
                    }}
                  />
                  <span style={{ fontSize: '12px', color: fontColor }}>
                    {series.title}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Tooltip */}
        {hoveredPoint && tooltipVisible && (
          <ChartTooltip
            data={[
              {
                label: hoveredPoint.point.label,
                value: hoveredPoint.point.value,
                color:
                  data[hoveredPoint.seriesIndex].color ||
                  `hsl(${hoveredPoint.seriesIndex * 60}, 70%, 50%)`,
                description: data[hoveredPoint.seriesIndex].title,
              },
            ]}
            position={{
              x:
                calculateLinePointX(
                  hoveredPoint.pointIndex,
                  data[hoveredPoint.seriesIndex].data.length,
                  width,
                  { left: padding.left, right: padding.right }
                ) + panX,
              y:
                calculateLinePointY(
                  hoveredPoint.point.value,
                  minValue,
                  maxValue,
                  height,
                  { top: padding.top, bottom: padding.bottom }
                ) + panY,
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
