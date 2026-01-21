'use client';

/**
 * 最近创建的客户列表组件
 * 显示最近添加的客户
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { type ClientDetail } from '@/types/client';
import { ClientCard } from './ClientCard';

interface RecentClientsProps {
  recentClients: ClientDetail[];
}

export function RecentClients({
  recentClients,
}: RecentClientsProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>最近创建的客户</CardTitle>
        <CardDescription>最近添加的10位客户</CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {recentClients.length === 0 ? (
            <div className='text-muted-foreground text-center py-4'>
              暂无客户数据
            </div>
          ) : (
            recentClients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
