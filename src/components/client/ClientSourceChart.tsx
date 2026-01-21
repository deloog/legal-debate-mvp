'use client';

/**
 * 客户来源分布图表组件
 * 显示按来源统计的客户数据
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatBar } from './StatBar';

interface ClientSourceChartProps {
  clientsBySource: Record<string, number>;
  totalClients: number;
}

export function ClientSourceChart({
  clientsBySource,
  totalClients,
}: ClientSourceChartProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>客户来源分布</CardTitle>
        <CardDescription>按客户来源统计</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {Object.entries(clientsBySource).length === 0 ? (
            <div className='text-muted-foreground text-center py-4'>
              暂无客户来源数据
            </div>
          ) : (
            Object.entries(clientsBySource).map(([source, count]) => (
              <StatBar
                key={source}
                label={source}
                value={count as number}
                total={totalClients}
                color='bg-purple-500'
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
