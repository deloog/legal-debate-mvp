'use client';

/**
 * 客户卡片组件
 * 显示单个客户信息
 */

import React from 'react';
import { ClientType, ClientStatus, type ClientDetail } from '@/types/client';

interface ClientCardProps {
  client: ClientDetail;
}

export function ClientCard({ client }: ClientCardProps): React.ReactElement {
  const clientTypeLabels: Record<ClientType, string> = {
    [ClientType.INDIVIDUAL]: '个人',
    [ClientType.ENTERPRISE]: '企业',
    [ClientType.POTENTIAL]: '潜在',
  };

  const clientStatusColors: Record<ClientStatus, string> = {
    [ClientStatus.ACTIVE]: 'bg-green-100 text-green-700',
    [ClientStatus.INACTIVE]: 'bg-yellow-100 text-yellow-700',
    [ClientStatus.LOST]: 'bg-red-100 text-red-700',
    [ClientStatus.BLACKLISTED]: 'bg-gray-100 text-gray-700',
  };

  const clientStatusLabels: Record<ClientStatus, string> = {
    [ClientStatus.ACTIVE]: '活跃',
    [ClientStatus.INACTIVE]: '非活跃',
    [ClientStatus.LOST]: '流失',
    [ClientStatus.BLACKLISTED]: '黑名单',
  };

  return (
    <div className='flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors'>
      <div className='flex-1'>
        <div className='flex items-center gap-3'>
          <h4 className='font-semibold'>{client.name}</h4>
          <span className='text-sm px-2 py-1 bg-gray-100 rounded'>
            {clientTypeLabels[client.clientType]}
          </span>
          <span
            className={`text-sm px-2 py-1 rounded ${clientStatusColors[client.status]}`}
          >
            {clientStatusLabels[client.status]}
          </span>
        </div>
        <div className='text-sm text-muted-foreground mt-1'>
          {client.phone && <span>电话: {client.phone}</span>}
          {client.email && <span className='ml-4'>邮箱: {client.email}</span>}
        </div>
        <div className='flex items-center gap-4 mt-2 text-sm text-muted-foreground'>
          <span>案件数: {client.cases || 0}</span>
          <span>
            创建时间: {new Date(client.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
