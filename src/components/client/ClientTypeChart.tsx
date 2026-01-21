'use client';

/**
 * 客户类型分布图表组件
 * 显示按类型统计的客户数据
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ClientType } from '@/types/client';
import { StatBar } from './StatBar';

interface ClientTypeChartProps {
  clientsByType: Record<string, number>;
  totalClients: number;
}

export function ClientTypeChart({
  clientsByType,
  totalClients,
}: ClientTypeChartProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>客户类型分布</CardTitle>
        <CardDescription>按客户类型统计</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <StatBar
            label='个人客户'
            value={clientsByType[ClientType.INDIVIDUAL] || 0}
            total={totalClients}
            color='bg-blue-500'
          />
          <StatBar
            label='企业客户'
            value={clientsByType[ClientType.ENTERPRISE] || 0}
            total={totalClients}
            color='bg-green-500'
          />
          <StatBar
            label='潜在客户'
            value={clientsByType[ClientType.POTENTIAL] || 0}
            total={totalClients}
            color='bg-yellow-500'
          />
        </div>
      </CardContent>
    </Card>
  );
}
