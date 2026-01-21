'use client';

/**
 * 标签徽章组件
 * 显示客户标签
 */

import React from 'react';

interface TagBadgeProps {
  tag: string;
  count: number;
}

export function TagBadge({ tag, count }: TagBadgeProps): React.ReactElement {
  return (
    <div className='inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full'>
      <span className='text-sm font-medium'>{tag}</span>
      <span className='text-xs bg-blue-200 px-2 py-0.5 rounded-full'>
        {count}
      </span>
    </div>
  );
}
