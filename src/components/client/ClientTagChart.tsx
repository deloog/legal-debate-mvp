'use client';

/**
 * 客户标签分布图表组件
 * 显示按标签统计的客户数据
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TagBadge } from './TagBadge';

interface ClientTagChartProps {
  clientsByTags: Record<string, number>;
}

export function ClientTagChart({
  clientsByTags,
}: ClientTagChartProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>客户标签分布</CardTitle>
        <CardDescription>按标签统计客户数</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='flex flex-wrap gap-2'>
          {Object.entries(clientsByTags).length === 0 ? (
            <div className='text-muted-foreground text-center py-4 w-full'>
              暂无标签数据
            </div>
          ) : (
            Object.entries(clientsByTags)
              .sort(([, a], [, b]) => b - a)
              .map(([tag, count]) => (
                <TagBadge key={tag} tag={tag} count={count} />
              ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
