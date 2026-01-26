/**
 * EnhancedFunnelChart - 增强的漏斗图组件
 * 集成响应式、交互式Tooltip和层级切换功能
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { FunnelChartData } from '@/types/chart';
import { InteractiveChartContainer } from '@/components/analytics/ui/InteractiveChartContainer';
import { ChartTooltip } from '@/components/analytics/ui/ChartTooltip';
import {
  calculateFunnelCoordinates,
  formatPercentage,
  calculatePercentage,
  generateColors,
  truncateText,
} from '../utils/chart-utils';

export interface EnhancedFunnelChartProps {
  data: FunnelChartData[];
  showLabels?: boolean;
  showValues?: boolean;
  showLegend?: boolean;
  onStageClick?: (stage: FunnelChartData, index: number) => void;
  onStageHover?: (stage: FunnelChartData | null, index: number) => void;
  colors?: string[];
  className?: string;
}

export function EnhancedFunnelChart({
  data,
  showLabels = true,
  showValues = true,
  showLegend = true,
  onStageClick,
  onStageHover,
  colors,
  className,
}: EnhancedFunnelChartProps) {
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const width = 500;
  const height = 450;
  const padding = { top: 20, right: 20, bottom: 20, left: 20 };

  const stageColors = useMemo(
    () => colors || generateColors(data.length),
    [colors, data.length]
  );

  const handleStageHover = (index: number) => {
    setHoveredStage(index);
    setTooltipVisible(true);
    onStageHover?.(data[index], index);
  };

  const handleStageLeave = () => {
    setHoveredStage(null);
    setTooltipVisible(false);
    onStageHover?.(null, -1);
  };

  const handleStageClick = (index: number) => {
    onStageClick?.(data[index], index);
  };

  if (data.length === 0) {
    return <div className='funnel-chart-empty'>无数据</div>;
  }

  const renderChart = () => {
    return (
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className={`enhanced-funnel-chart ${className || ''}`}
        >
          {data.map((stage, index) => {
            const coords = calculateFunnelCoordinates(
              index,
              data.length,
              width,
              height,
              padding
            );
            const isHovered = hoveredStage === index;
            const color = stageColors[index];

            return (
              <g key={index} className='funnel-stage-group'>
                {/* 梯形 */}
                <path
                  d={`M ${coords.x1} ${coords.y1} L ${width - coords.x1} ${
                    coords.y1
                  } L ${width - coords.x2} ${
                    coords.y2
                  } L ${coords.x2} ${coords.y2} Z`}
                  fill={color}
                  stroke='#fff'
                  strokeWidth={2}
                  onMouseEnter={() => handleStageHover(index)}
                  onMouseLeave={handleStageLeave}
                  onClick={() => handleStageClick(index)}
                  style={{
                    cursor: 'pointer',
                    transition: 'opacity 0.2s ease',
                    opacity: hoveredStage !== null && !isHovered ? 0.5 : 1,
                  }}
                />

                {/* 标签 */}
                {showLabels && (
                  <text
                    x={width / 2}
                    y={coords.y1 + (coords.y2 - coords.y1) / 2}
                    textAnchor='middle'
                    fill='#fff'
                    fontSize={14}
                    fontWeight='bold'
                    pointerEvents='none'
                  >
                    {truncateText(stage.label, 15)}
                  </text>
                )}

                {/* 数值 */}
                {showValues && (
                  <text
                    x={width / 2}
                    y={coords.y1 + (coords.y2 - coords.y1) / 2 + 18}
                    textAnchor='middle'
                    fill='#fff'
                    fontSize={12}
                    pointerEvents='none'
                  >
                    {stage.count}
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
              maxWidth: '220px',
            }}
          >
            {data.map((stage, index) => {
              const color = stageColors[index];
              const prevCount = index > 0 ? data[index - 1].count : null;
              const conversionRate =
                prevCount !== null
                  ? calculatePercentage(stage.count, prevCount)
                  : 100;
              const totalCount = data[0].count;
              const overallConversion = calculatePercentage(
                stage.count,
                totalCount
              );

              return (
                <div
                  key={index}
                  onClick={() => handleStageClick(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    opacity:
                      hoveredStage !== null && hoveredStage !== index ? 0.5 : 1,
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      backgroundColor: color,
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  />
                  <div style={{ fontSize: '12px', color: '#374151' }}>
                    <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                      {stage.label}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      数值: {stage.count}
                    </div>
                    {index > 0 && (
                      <div style={{ fontSize: '11px', color: '#059669' }}>
                        转化率: {formatPercentage(conversionRate)}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      整体转化: {formatPercentage(overallConversion)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tooltip */}
        {hoveredStage !== null && tooltipVisible && (
          <ChartTooltip
            data={[
              {
                label: data[hoveredStage].label,
                value: data[hoveredStage].count,
                color: stageColors[hoveredStage],
                description:
                  hoveredStage > 0
                    ? `转化率: ${formatPercentage(
                        calculatePercentage(
                          data[hoveredStage].count,
                          data[hoveredStage - 1].count
                        )
                      )}`
                    : '起始层级',
              },
            ]}
            position={{
              x: width / 2,
              y:
                padding.top +
                (hoveredStage * (height - padding.top - padding.bottom)) /
                  data.length +
                (height - padding.top - padding.bottom) / data.length / 2,
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
