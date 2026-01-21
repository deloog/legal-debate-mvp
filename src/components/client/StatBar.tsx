'use client';

/**
 * 统计条形图组件
 * 显示单条统计数据
 */

import React from 'react';

interface StatBarProps {
  label: string;
  value: number;
  total: number;
  color: string;
}

export function StatBar({
  label,
  value,
  total,
  color,
}: StatBarProps): React.ReactElement {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className='flex items-center gap-4'>
      <span className='w-24 text-sm'>{label}</span>
      <div className='flex-1 bg-gray-100 rounded-full h-4 overflow-hidden'>
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className='w-16 text-sm text-right'>
        {value} ({percentage.toFixed(1)}%)
      </span>
    </div>
  );
}
