'use client';

/**
 * 客户统计卡片组件
 * 显示单个统计数据
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ClientStatCardProps {
  title: string;
  value: number;
  color: string;
}

export function ClientStatCard({
  title,
  value,
  color,
}: ClientStatCardProps): React.ReactElement {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500',
  };

  return (
    <Card>
      <CardContent className='p-6'>
        <div className='flex items-center justify-between'>
          <div>
            <p className='text-sm font-medium text-muted-foreground'>{title}</p>
            <p className='text-3xl font-bold mt-2'>{value}</p>
          </div>
          <div
            className={`w-12 h-12 rounded-full ${colorClasses[color]} flex items-center justify-center text-white`}
          >
            <span className='text-xl'>#</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
