'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { CommunicationRecordList } from '../../../components/client/CommunicationRecordList';
import {
  ClientDetail,
  ClientType,
  ClientStatus,
  CaseSummary,
} from '../../../types/client';

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'info' | 'communications' | 'cases'
  >('info');

  useEffect(() => {
    const id = Array.isArray(params.id) ? params.id[0] : params.id;
    if (id) {
      fetchClient(id);
    }
  }, [params.id]);

  const fetchClient = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/clients/${id}?include=cases`);

      if (!response.ok) {
        throw new Error('获取客户详情失败');
      }

      const data = await response.json();
      setClient(data);
    } catch (error) {
      console.error('获取客户详情失败:', error);
      alert('获取客户详情失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!client?.id) return;

    if (confirm('确定要删除此客户吗？此操作不可恢复。')) {
      try {
        const response = await fetch(`/api/clients/${client.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('删除客户失败');
        }

        router.push('/clients');
      } catch (error) {
        console.error('删除客户失败:', error);
        alert('删除客户失败，请重试');
      }
    }
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <div className='mx-auto max-w-7xl px-6 py-8'>
          <div className='animate-pulse space-y-4'>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='h-40 rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className='min-h-screen bg-zinc-50 flex items-center justify-center dark:bg-black'>
        <Card className='max-w-md'>
          <CardContent className='py-12 text-center'>
            <p className='text-lg text-gray-600'>客户不存在</p>
            <Button
              variant='primary'
              onClick={() => router.push('/clients')}
              className='mt-4'
            >
              返回列表
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div className='flex items-center space-x-4'>
            <Button variant='ghost' onClick={() => router.push('/clients')}>
              返回列表
            </Button>
            <div>
              <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
                {client.name}
              </h1>
              <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                客户详情
              </p>
            </div>
          </div>
          <div className='flex space-x-2'>
            <Button
              variant='outline'
              onClick={() => router.push(`/clients/edit/${client.id}`)}
            >
              编辑
            </Button>
            <Button
              variant='outline'
              onClick={handleDelete}
              className='text-red-600 hover:bg-red-50'
            >
              删除
            </Button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 选项卡 */}
        <div className='mb-6 border-b border-zinc-200 dark:border-zinc-800'>
          <nav className='flex space-x-8'>
            <button
              onClick={() => setActiveTab('info')}
              className={`pb-4 text-sm font-medium ${
                activeTab === 'info'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              基本信息
            </button>
            <button
              onClick={() => setActiveTab('cases')}
              className={`pb-4 text-sm font-medium ${
                activeTab === 'cases'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              案件历史
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              className={`pb-4 text-sm font-medium ${
                activeTab === 'communications'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              沟通记录
            </button>
          </nav>
        </div>

        {/* 基本信息 */}
        {activeTab === 'info' && <BasicInfo client={client} />}

        {/* 案件历史 */}
        {activeTab === 'cases' && <CasesTab cases={client.caseHistory} />}

        {/* 沟通记录 */}
        {activeTab === 'communications' && (
          <CommunicationsTab clientId={client.id} />
        )}
      </main>
    </div>
  );
}

function BasicInfo({ client }: { client: ClientDetail }) {
  const getClientTypeName = (type: ClientType): string => {
    const names = {
      [ClientType.INDIVIDUAL]: '个人客户',
      [ClientType.ENTERPRISE]: '企业客户',
      [ClientType.POTENTIAL]: '潜在客户',
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

  return (
    <div className='grid gap-6 lg:grid-cols-3'>
      {/* 主要信息 */}
      <Card className='lg:col-span-2'>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid gap-4 md:grid-cols-2'>
            <div>
              <p className='mb-1 text-sm text-gray-500'>客户类型</p>
              <p className='text-sm font-medium'>
                {getClientTypeName(client.clientType)}
              </p>
            </div>
            <div>
              <p className='mb-1 text-sm text-gray-500'>客户状态</p>
              <p className='text-sm font-medium'>
                {getStatusName(client.status)}
              </p>
            </div>
            {client.phone && (
              <div>
                <p className='mb-1 text-sm text-gray-500'>联系电话</p>
                <p className='text-sm font-medium'>{client.phone}</p>
              </div>
            )}
            {client.email && (
              <div>
                <p className='mb-1 text-sm text-gray-500'>电子邮箱</p>
                <p className='text-sm font-medium'>{client.email}</p>
              </div>
            )}
            {client.address && (
              <div className='md:col-span-2'>
                <p className='mb-1 text-sm text-gray-500'>地址</p>
                <p className='text-sm font-medium'>{client.address}</p>
              </div>
            )}
            {client.tags && client.tags.length > 0 && (
              <div className='md:col-span-2'>
                <p className='mb-2 text-sm text-gray-500'>标签</p>
                <div className='flex flex-wrap gap-2'>
                  {client.tags.map((tag, index) => (
                    <span
                      key={index}
                      className='rounded bg-blue-100 px-3 py-1 text-sm text-blue-800'
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {client.notes && (
              <div className='md:col-span-2'>
                <p className='mb-1 text-sm text-gray-500'>备注</p>
                <p className='text-sm text-gray-700'>{client.notes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <Card>
        <CardHeader>
          <CardTitle>统计信息</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-4'>
            <div>
              <p className='mb-1 text-sm text-gray-500'>关联案件数</p>
              <p className='text-2xl font-semibold text-gray-900'>
                {client.cases || 0}
              </p>
            </div>
            <div>
              <p className='mb-1 text-sm text-gray-500'>沟通记录数</p>
              <p className='text-2xl font-semibold text-gray-900'>
                {client.communications || 0}
              </p>
            </div>
            <div>
              <p className='mb-1 text-sm text-gray-500'>创建时间</p>
              <p className='text-sm text-gray-700'>
                {new Date(client.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
            <div>
              <p className='mb-1 text-sm text-gray-500'>更新时间</p>
              <p className='text-sm text-gray-700'>
                {new Date(client.updatedAt).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CasesTab({ cases }: { cases?: CaseSummary[] }) {
  const router = useRouter();

  const getStatusBadge = (status: string): string => {
    const badges: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ACTIVE: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-yellow-100 text-yellow-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string): string => {
    const texts: Record<string, string> = {
      DRAFT: '草稿',
      ACTIVE: '进行中',
      COMPLETED: '已完成',
      ARCHIVED: '已归档',
    };
    return texts[status] || status;
  };

  if (!cases || cases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>案件历史</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='py-8 text-center'>
            <p className='text-gray-500'>暂无案件历史</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>案件历史</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {cases.map(caseItem => (
            <div
              key={caseItem.id}
              className='flex cursor-pointer flex-col rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
              onClick={() => router.push(`/cases/${caseItem.id}`)}
            >
              <div className='mb-2 flex items-center justify-between'>
                <h3 className='font-medium text-zinc-900 dark:text-zinc-50'>
                  {caseItem.title}
                </h3>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(
                    caseItem.status
                  )}`}
                >
                  {getStatusText(caseItem.status)}
                </span>
              </div>
              <div className='mb-2 text-sm text-gray-600 dark:text-gray-400'>
                <span className='mr-4'>类型: {caseItem.type}</span>
                {caseItem.caseNumber && (
                  <span>案号: {caseItem.caseNumber}</span>
                )}
              </div>
              {caseItem.cause && (
                <div className='mb-2 text-sm text-gray-600 dark:text-gray-400'>
                  案由: {caseItem.cause}
                </div>
              )}
              <div className='text-xs text-gray-500 dark:text-gray-500'>
                创建时间: {new Date(caseItem.createdAt).toLocaleString('zh-CN')}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CommunicationsTab({ clientId }: { clientId: string }) {
  return <CommunicationRecordList clientId={clientId} />;
}
