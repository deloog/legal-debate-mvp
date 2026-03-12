'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ClientForm } from '../../components/client/ClientForm';
import { ClientList } from '../../components/client/ClientList';
import {
  ClientDetail,
  ClientQueryParams,
  ClientType,
  ClientStatus,
  ClientSource,
  CreateClientInput,
  UpdateClientInput,
} from '../../types/client';

/**
 * 客户管理页面主入口
 * 功能：展示客户列表、搜索、筛选和快速操作
 */
export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<ClientDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientDetail | undefined>(
    undefined
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ClientType | undefined>(
    undefined
  );
  const [filterStatus, setFilterStatus] = useState<ClientStatus | undefined>(
    undefined
  );
  const [filterSource, setFilterSource] = useState<ClientSource | undefined>(
    undefined
  );
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [total, setTotal] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params: ClientQueryParams = {
        page,
        limit,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }
      if (filterType) {
        params.clientType = filterType;
      }
      if (filterStatus) {
        params.status = filterStatus;
      }
      if (filterSource) {
        params.source = filterSource;
      }

      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });

      const response = await fetch(`/api/clients?${searchParams.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('获取客户列表失败');
      }

      const data = await response.json();
      setClients(data.clients || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('获取客户列表失败:', error);
      if (typeof window !== 'undefined') {
        alert('获取客户列表失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchTerm, filterType, filterStatus, filterSource]);

  const handleCreateClient = async (data: CreateClientInput) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '创建客户失败');
      }

      setShowForm(false);
      await fetchClients();
    } catch (error) {
      console.error('创建客户失败:', error);
      if (typeof window !== 'undefined') {
        alert(error instanceof Error ? error.message : '创建客户失败');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateClient = async (data: UpdateClientInput) => {
    if (!editingClient?.id) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '更新客户失败');
      }

      setEditingClient(undefined);
      await fetchClients();
    } catch (error) {
      console.error('更新客户失败:', error);
      if (typeof window !== 'undefined') {
        alert(error instanceof Error ? error.message : '更新客户失败');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      const response = await fetch(`/api/clients/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除客户失败');
      }

      await fetchClients();
    } catch (error) {
      console.error('删除客户失败:', error);
      if (typeof window !== 'undefined') {
        alert('删除客户失败，请重试');
      }
      throw error;
    }
  };

  const handleViewDetail = (id: string) => {
    router.push(`/clients/${id}`);
  };

  const handleEdit = (id: string) => {
    const client = clients.find(c => c.id === id);
    if (client) {
      setEditingClient(client);
      setShowForm(true);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchClients();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterType(undefined);
    setFilterStatus(undefined);
    setFilterSource(undefined);
    setPage(1);
    fetchClients();
  };

  // 初始加载
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  if (showForm || editingClient) {
    return (
      <div className='min-h-screen bg-zinc-50 px-6 py-6 dark:bg-black'>
        <div className='mx-auto max-w-3xl'>
          <Button
            variant='outline'
            onClick={() => {
              setShowForm(false);
              setEditingClient(undefined);
            }}
            className='mb-4'
          >
            返回列表
          </Button>
          <ClientForm
            initialData={editingClient as UpdateClientInput | undefined}
            userId={editingClient?.userId || ''}
            onSubmit={
              (editingClient ? handleUpdateClient : handleCreateClient) as (
                data: CreateClientInput | UpdateClientInput
              ) => Promise<void>
            }
            onCancel={() => {
              setShowForm(false);
              setEditingClient(undefined);
            }}
            isSubmitting={isSubmitting}
            mode={editingClient ? 'edit' : 'create'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              客户管理
            </h1>
            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
              管理您的所有客户档案
            </p>
          </div>
          <Button variant='primary' onClick={() => setShowForm(true)}>
            创建客户
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 搜索和筛选 */}
        <div className='mb-6 rounded-lg border bg-white shadow-sm dark:bg-zinc-950'>
          <div className='p-6'>
            <div className='grid gap-4 md:grid-cols-5'>
              <Input
                type='text'
                placeholder='搜索客户姓名、电话...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <select
                value={filterType || ''}
                onChange={e =>
                  setFilterType(
                    e.target.value ? (e.target.value as ClientType) : undefined
                  )
                }
                className='rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部类型</option>
                <option value={ClientType.INDIVIDUAL}>个人客户</option>
                <option value={ClientType.ENTERPRISE}>企业客户</option>
                <option value={ClientType.POTENTIAL}>潜在客户</option>
              </select>
              <select
                value={filterStatus || ''}
                onChange={e =>
                  setFilterStatus(
                    e.target.value
                      ? (e.target.value as ClientStatus)
                      : undefined
                  )
                }
                className='rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部状态</option>
                <option value={ClientStatus.ACTIVE}>活跃</option>
                <option value={ClientStatus.INACTIVE}>非活跃</option>
                <option value={ClientStatus.LOST}>流失</option>
                <option value={ClientStatus.BLACKLISTED}>黑名单</option>
              </select>
              <select
                value={filterSource || ''}
                onChange={e =>
                  setFilterSource(
                    e.target.value
                      ? (e.target.value as ClientSource)
                      : undefined
                  )
                }
                className='rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部来源</option>
                <option value={ClientSource.REFERRAL}>推荐</option>
                <option value={ClientSource.ONLINE}>网络</option>
                <option value={ClientSource.EVENT}>活动</option>
                <option value={ClientSource.ADVERTISING}>广告</option>
                <option value={ClientSource.OTHER}>其他</option>
              </select>
              <div className='flex space-x-2'>
                <Button variant='primary' onClick={handleSearch}>
                  搜索
                </Button>
                <Button variant='outline' onClick={handleResetFilters}>
                  重置
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 客户列表 */}
        <Suspense fallback={<LoadingSkeleton />}>
          <ClientList
            clients={clients}
            loading={loading}
            onViewDetail={handleViewDetail}
            onEdit={handleEdit}
            onDelete={handleDeleteClient}
            onCreate={() => setShowForm(true)}
            onRefresh={fetchClients}
          />
        </Suspense>

        {/* 分页控件 */}
        {total > limit && (
          <div className='mt-6 flex items-center justify-center space-x-2'>
            <Button
              variant='outline'
              disabled={page === 1 || loading}
              onClick={() => {
                setPage(prev => prev - 1);
                fetchClients();
              }}
            >
              上一页
            </Button>
            <span className='text-sm text-gray-600'>
              第 {page} 页，共 {Math.ceil(total / limit)} 页
            </span>
            <Button
              variant='outline'
              disabled={page >= Math.ceil(total / limit) || loading}
              onClick={() => {
                setPage(prev => prev + 1);
                fetchClients();
              }}
            >
              下一页
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className='h-40 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
        >
          <div className='mb-4 flex items-center gap-4'>
            <div className='h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800' />
          </div>
          <div className='space-y-2'>
            <div className='h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
          </div>
        </div>
      ))}
    </div>
  );
}
