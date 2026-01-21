'use client';

/**
 * 月度增长趋势图表组件
 * 显示最近12个月客户增长情况
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface MonthlyGrowthData {
  month: string;
  count: number;
}

interface MonthlyGrowthChartProps {
  monthlyGrowth: MonthlyGrowthData[];
}

export function MonthlyGrowthChart({
  monthlyGrowth,
}: MonthlyGrowthChartProps): React.ReactElement {
  const maxCount = Math.max(...monthlyGrowth.map(g => g.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle>客户增长趋势</CardTitle>
        <CardDescription>最近12个月客户增长情况</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-2'>
          {monthlyGrowth.map(item => (
            <div key={item.month} className='flex items-center gap-4'>
              <span className='w-16 text-sm text-muted-foreground'>
                {item.month}
              </span>
              <div className='flex-1 bg-gray-100 rounded-full h-6 overflow-hidden'>
                <div
                  className='h-full bg-blue-500 transition-all duration-300'
                  style={{
                    width:
                      maxCount > 0 ? `${(item.count / maxCount) * 100}%` : '0%',
                  }}
                />
              </div>
              <span className='w-12 text-sm text-right'>{item.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
