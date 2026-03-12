'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  ClientDetail,
  ClientType,
  ClientStatus,
  ClientSource,
} from '../../types/client';

export interface ClientListProps {
  clients: ClientDetail[];
  loading?: boolean;
  onViewDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onCreate?: () => void;
  onRefresh?: () => void;
}

export function ClientList({
  clients,
  loading = false,
  onViewDetail,
  onEdit,
  onDelete,
  onCreate,
  onRefresh,
}: ClientListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此客户吗？此操作不可恢复。')) {
      setDeleteId(id);
      try {
        await onDelete(id);
      } finally {
        setDeleteId(null);
      }
    }
  };

  const getClientTypeName = (type: ClientType): string => {
    const names = {
      [ClientType.INDIVIDUAL]: '个人',
      [ClientType.ENTERPRISE]: '企业',
      [ClientType.POTENTIAL]: '潜在',
    };
    return names[type] || type;
  };

  const getStatusName = (status: ClientStatus): string => {
    const names = {
      [ClientStatus.ACTIVE]: '活跃',
      [ClientStatus.INACTIVE]: '非活跃',
      [ClientStatus.LOST]: '流失',
      [ClientStatus.BLACKLISTED]: '黑名单',
    };
    return names[status] || status;
  };

  const getStatusColor = (status: ClientStatus): string => {
    const colors = {
      [ClientStatus.ACTIVE]: 'bg-green-100 text-green-800',
      [ClientStatus.INACTIVE]: 'bg-gray-100 text-gray-800',
      [ClientStatus.LOST]: 'bg-red-100 text-red-800',
      [ClientStatus.BLACKLISTED]: 'bg-black text-white',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSourceName = (source: ClientSource | undefined): string => {
    if (!source) return '-';
    const names = {
      [ClientSource.REFERRAL]: '推荐',
      [ClientSource.ONLINE]: '网络',
      [ClientSource.EVENT]: '活动',
      [ClientSource.ADVERTISING]: '广告',
      [ClientSource.OTHER]: '其他',
    };
    return names[source] || source;
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (clients.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-end space-x-2'>
        {onRefresh && (
          <Button variant='outline' onClick={onRefresh} disabled={loading}>
            刷新
          </Button>
        )}
        {onCreate && (
          <Button variant='primary' onClick={onCreate}>
            创建客户
          </Button>
        )}
      </div>

      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {clients.map(client => (
          <ClientCard
            key={client.id}
            client={client}
            onViewDetail={onViewDetail}
            onEdit={onEdit}
            onDelete={handleDelete}
            isDeleting={deleteId === client.id}
            getClientTypeName={getClientTypeName}
            getStatusName={getStatusName}
            getStatusColor={getStatusColor}
            getSourceName={getSourceName}
          />
        ))}
      </div>
    </div>
  );
}

interface ClientCardProps {
  client: ClientDetail;
  onViewDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  getClientTypeName: (type: ClientType) => string;
  getStatusName: (status: ClientStatus) => string;
  getStatusColor: (status: ClientStatus) => string;
  getSourceName: (source: ClientSource | undefined) => string;
}

function ClientCard({
  client,
  onViewDetail,
  onEdit,
  onDelete,
  isDeleting,
  getClientTypeName,
  getStatusName,
  getStatusColor,
  getSourceName,
}: ClientCardProps) {
  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardContent className='p-6'>
        {/* 头部信息 */}
        <div className='mb-4 flex items-start justify-between'>
          <div className='flex-1'>
            <h3 className='text-lg font-semibold text-gray-900'>
              {client.name}
            </h3>
            <p className='mt-1 text-sm text-gray-500'>
              {getClientTypeName(client.clientType)}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
              client.status
            )}`}
          >
            {getStatusName(client.status)}
          </span>
        </div>

        {/* 联系信息 */}
        <div className='mb-4 space-y-2 text-sm text-gray-600'>
          {client.phone && (
            <div className='flex items-center'>
              <span className='mr-2 font-medium'>电话:</span>
              <span>{client.phone}</span>
            </div>
          )}
          {client.email && (
            <div className='flex items-center'>
              <span className='mr-2 font-medium'>邮箱:</span>
              <span className='truncate'>{client.email}</span>
            </div>
          )}
          {client.address && (
            <div className='flex items-start'>
              <span className='mr-2 font-medium'>地址:</span>
              <span className='truncate'>{client.address}</span>
            </div>
          )}
        </div>

        {/* 标签 */}
        {client.tags && client.tags.length > 0 && (
          <div className='mb-4 flex flex-wrap gap-1'>
            {client.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className='rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800'
              >
                {tag}
              </span>
            ))}
            {client.tags.length > 3 && (
              <span className='rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600'>
                +{client.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* 底部信息 */}
        <div className='flex items-center justify-between border-t pt-4 text-xs text-gray-500'>
          <div>
            <span className='mr-3'>
              来源: {getSourceName(client.source ?? undefined)}
            </span>
            <span>案件: {client.cases || 0}</span>
          </div>
          <div className='text-gray-400'>
            {new Date(client.createdAt).toLocaleDateString('zh-CN')}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className='mt-4 flex justify-end space-x-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onViewDetail(client.id)}
          >
            查看
          </Button>
          <Button variant='ghost' size='sm' onClick={() => onEdit(client.id)}>
            编辑
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onDelete(client.id)}
            disabled={isDeleting}
            className='text-red-600 hover:bg-red-50'
          >
            {isDeleting ? '删除中...' : '删除'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
      {[...Array(6)].map((_, index) => (
        <Card key={index}>
          <CardContent className='p-6'>
            <div className='mb-4 flex items-start justify-between'>
              <div className='flex-1 space-y-2'>
                <div className='h-5 w-2/3 animate-pulse rounded bg-gray-200' />
                <div className='h-4 w-1/2 animate-pulse rounded bg-gray-200' />
              </div>
              <div className='h-6 w-16 animate-pulse rounded-full bg-gray-200' />
            </div>
            <div className='mb-4 space-y-2'>
              <div className='h-4 w-full animate-pulse rounded bg-gray-200' />
              <div className='h-4 w-3/4 animate-pulse rounded bg-gray-200' />
            </div>
            <div className='mb-4 flex gap-1'>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className='h-5 w-16 animate-pulse rounded bg-gray-200'
                />
              ))}
            </div>
            <div className='flex justify-between border-t pt-4'>
              <div className='h-4 w-24 animate-pulse rounded bg-gray-200' />
              <div className='h-4 w-20 animate-pulse rounded bg-gray-200' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <Card>
      <CardContent className='py-16 text-center'>
        <div className='mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100'>
          <svg
            className='h-12 w-12 text-gray-400'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
            />
          </svg>
        </div>
        <h3 className='mb-2 text-lg font-semibold text-gray-900'>暂无客户</h3>
        <p className='mb-6 text-gray-500'>开始创建您的第一个客户档案</p>
        {onCreate && (
          <Button variant='primary' onClick={onCreate}>
            创建客户
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
