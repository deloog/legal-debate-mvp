/**
 * ChartTooltip - 图表工具提示组件
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface TooltipData {
  label?: string;
  value: string | number;
  color?: string;
  description?: string;
  category?: string;
}

interface ChartTooltipProps {
  data: TooltipData[];
  position: { x: number; y: number };
  visible: boolean;
  className?: string;
}

export function ChartTooltip({
  data,
  position,
  visible,
  className,
}: ChartTooltipProps) {
  if (!visible || !data || data.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute z-50 pointer-events-none transition-opacity duration-200',
        'bg-gray-900 text-white text-sm rounded-md shadow-lg',
        'border border-gray-700',
        'p-3 min-w-48 max-w-64',
        className
      )}
      style={{
        left: position.x + 10,
        top: position.y - 10,
        opacity: visible ? 1 : 0,
      }}
    >
      <div className='space-y-2'>
        {data.map((item, index) => (
          <div key={index} className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-2 min-w-0 flex-1'>
              {item.color && (
                <div
                  className='w-3 h-3 rounded-full shrink-0'
                  style={{ backgroundColor: item.color }}
                />
              )}
              <div className='min-w-0 flex-1'>
                {item.label && (
                  <div className='font-medium truncate'>{item.label}</div>
                )}
                {item.description && (
                  <div className='text-xs text-gray-300 truncate'>
                    {item.description}
                  </div>
                )}
                {item.category && (
                  <div className='text-xs text-gray-400 truncate'>
                    {item.category}
                  </div>
                )}
              </div>
            </div>
            <div className='font-semibold text-white shrink-0'>
              {item.value}
            </div>
          </div>
        ))}
      </div>
      {/* 箭头 */}
      <div
        className='absolute w-2 h-2 bg-gray-900 border-l border-t border-gray-700 transform rotate-45'
        style={{
          left: -4,
          top: '50%',
          marginTop: -4,
        }}
      />
    </div>
  );
}

/**
 * 简化的 Tooltip 组件，用于单个数据点
 */
interface SimpleTooltipProps {
  content: string | number;
  position: { x: number; y: number };
  visible: boolean;
  className?: string;
}

export function SimpleTooltip({
  content,
  position,
  visible,
  className,
}: SimpleTooltipProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute z-50 pointer-events-none transition-opacity duration-200',
        'bg-gray-800 text-white text-xs rounded-md shadow-lg',
        'px-2 py-1',
        className
      )}
      style={{
        left: position.x + 5,
        top: position.y - 5,
        opacity: visible ? 1 : 0,
      }}
    >
      {content}
      {/* 箭头 */}
      <div
        className='absolute w-1 h-1 bg-gray-800 transform rotate-45'
        style={{
          left: 2,
          top: '50%',
          marginTop: -2,
        }}
      />
    </div>
  );
}
