'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CommunicationRecordForm } from '@/components/client/CommunicationRecordForm';
import { CommunicationType } from '@/types/client';

interface CommunicationRecord {
  id: string;
  clientId: string;
  userId: string;
  type: CommunicationType;
  summary: string;
  content: string | null;
  nextFollowUpDate: string | null;
  isImportant: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Client {
  id: string;
  name: string;
  clientType: string;
  status: string;
}

export default function ClientCommunicationsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [communications, setCommunications] = useState<CommunicationRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<CommunicationRecord | null>(null);

  // 筛选状态
  const [filterType, setFilterType] = useState<CommunicationType | ''>('');
  const [filterImportant, setFilterImportant] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!clientId) return;

    try {
      setLoading(true);
      setError(null);

      // 并行获取客户信息和沟通记录
      const [clientRes, commRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/clients/${clientId}/communications`),
      ]);

      if (!clientRes.ok) {
        throw new Error('获取客户信息失败');
      }

      const clientData = await clientRes.json();
      setClient(clientData);

      if (commRes.ok) {
        const commData = await commRes.json();
        setCommunications(commData.communications || []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载数据失败';
      setError(message);
      toast.error('加载失败', { description: message });
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 筛选后的沟通记录
  const filteredCommunications = communications.filter(record => {
    if (filterType && record.type !== filterType) return false;
    if (filterImportant === 'true' && !record.isImportant) return false;
    if (filterImportant === 'false' && record.isImportant) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此沟通记录吗？此操作不可恢复。')) {
      return;
    }

    try {
      const response = await fetch(`/api/communications/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      toast.success('删除成功');
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      toast.error('删除失败', { description: message });
    }
  };

  const handleEdit = (record: CommunicationRecord) => {
    setEditingRecord(record);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingRecord(null);
    fetchData();
  };

  const getTypeBadge = (type: CommunicationType): string => {
    const badges: Record<CommunicationType, string> = {
      [CommunicationType.PHONE]: 'bg-blue-100 text-blue-800',
      [CommunicationType.EMAIL]: 'bg-green-100 text-green-800',
      [CommunicationType.MEETING]: 'bg-purple-100 text-purple-800',
      [CommunicationType.WECHAT]: 'bg-yellow-100 text-yellow-800',
      [CommunicationType.OTHER]: 'bg-gray-100 text-gray-800',
    };
    return badges[type] || 'bg-gray-100 text-gray-800';
  };

  const getTypeLabel = (type: CommunicationType): string => {
    const labels: Record<CommunicationType, string> = {
      [CommunicationType.PHONE]: '电话',
      [CommunicationType.EMAIL]: '邮件',
      [CommunicationType.MEETING]: '面谈',
      [CommunicationType.WECHAT]: '微信',
      [CommunicationType.OTHER]: '其他',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center'>
        <div className='flex items-center space-x-2'>
          <Loader2 className='h-6 w-6 animate-spin' />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center'>
        <Card className='max-w-md'>
          <CardContent className='py-12 text-center'>
            <p className='text-lg text-red-600'>{error}</p>
            <Button onClick={fetchData} className='mt-4'>
              重试
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center'>
        <Card className='max-w-md'>
          <CardContent className='py-12 text-center'>
            <p className='text-lg text-gray-600'>客户不存在</p>
            <Button onClick={() => router.push('/clients')} className='mt-4'>
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
        <div className='mx-auto max-w-7xl'>
          {/* 面包屑 */}
          <div className='mb-4 flex items-center space-x-2 text-sm text-zinc-600 dark:text-zinc-400'>
            <Link
              href='/clients'
              className='hover:text-zinc-900 dark:hover:text-zinc-100'
            >
              客户管理
            </Link>
            <span>/</span>
            <Link
              href={`/clients/${clientId}`}
              className='hover:text-zinc-900 dark:hover:text-zinc-100'
            >
              {client.name}
            </Link>
            <span>/</span>
            <span className='text-zinc-900 dark:text-zinc-100'>沟通记录</span>
          </div>

          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-4'>
              <Button
                variant='ghost'
                onClick={() => router.push(`/clients/${clientId}`)}
              >
                <ArrowLeft className='mr-2 h-4 w-4' />
                返回客户详情
              </Button>
              <div>
                <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
                  沟通记录
                </h1>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  {client.name} - 共 {communications.length} 条记录
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingRecord(null);
                setShowForm(true);
              }}
            >
              <Plus className='mr-2 h-4 w-4' />
              新增沟通记录
            </Button>
          </div>
        </div>
      </header>

      {/* 子页面导航 */}
      <div className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl px-6'>
          <nav className='flex space-x-8'>
            <Link
              href={`/clients/${clientId}`}
              className='py-4 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            >
              基本信息
            </Link>
            <Link
              href={`/clients/${clientId}/communications`}
              className='border-b-2 border-blue-600 py-4 text-sm font-medium text-blue-600'
            >
              沟通记录
            </Link>
            <Link
              href={`/clients/${clientId}/follow-ups`}
              className='py-4 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            >
              跟进任务
            </Link>
            <Link
              href={`/clients/${clientId}#cases`}
              className='py-4 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            >
              案件历史
            </Link>
          </nav>
        </div>
      </div>

      {/* 主内容 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 筛选工具栏 */}
        <Card className='mb-6'>
          <CardContent className='py-4'>
            <div className='flex flex-wrap gap-4'>
              <div>
                <label className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                  沟通类型
                </label>
                <select
                  aria-label='沟通类型'
                  value={filterType}
                  onChange={e =>
                    setFilterType(e.target.value as CommunicationType | '')
                  }
                  className='rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900'
                >
                  <option value=''>全部类型</option>
                  <option value={CommunicationType.PHONE}>电话</option>
                  <option value={CommunicationType.EMAIL}>邮件</option>
                  <option value={CommunicationType.MEETING}>面谈</option>
                  <option value={CommunicationType.WECHAT}>微信</option>
                  <option value={CommunicationType.OTHER}>其他</option>
                </select>
              </div>

              <div>
                <label className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                  重要程度
                </label>
                <select
                  aria-label='重要程度'
                  value={filterImportant}
                  onChange={e => setFilterImportant(e.target.value)}
                  className='rounded-md border border-zinc-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900'
                >
                  <option value=''>全部</option>
                  <option value='true'>重要</option>
                  <option value='false'>普通</option>
                </select>
              </div>

              <div className='flex-1' />

              <div className='flex items-end'>
                <Button
                  variant='outline'
                  onClick={() => {
                    setFilterType('');
                    setFilterImportant('');
                  }}
                >
                  重置筛选
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 沟通记录列表 */}
        <Card>
          <CardHeader>
            <CardTitle>沟通记录列表</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCommunications.length === 0 ? (
              <div className='py-12 text-center'>
                <p className='text-zinc-500'>暂无沟通记录</p>
                <Button
                  onClick={() => {
                    setEditingRecord(null);
                    setShowForm(true);
                  }}
                  className='mt-4'
                >
                  <Plus className='mr-2 h-4 w-4' />
                  添加第一条记录
                </Button>
              </div>
            ) : (
              <div className='space-y-4'>
                {filteredCommunications.map(record => (
                  <div
                    key={record.id}
                    className='rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900'
                  >
                    <div className='mb-2 flex items-start justify-between'>
                      <div className='flex items-center gap-2'>
                        <span
                          className={`rounded px-2 py-1 text-xs font-medium ${getTypeBadge(record.type)}`}
                        >
                          {getTypeLabel(record.type)}
                        </span>
                        {record.isImportant && (
                          <span className='rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800'>
                            重要
                          </span>
                        )}
                      </div>
                      <div className='flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => handleEdit(record)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => handleDelete(record.id)}
                          className='text-red-600 hover:bg-red-50'
                        >
                          删除
                        </Button>
                      </div>
                    </div>

                    <h3 className='mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                      {record.summary}
                    </h3>

                    {record.content && (
                      <p className='mb-3 text-sm text-zinc-600 dark:text-zinc-400'>
                        {record.content}
                      </p>
                    )}

                    {record.nextFollowUpDate && (
                      <div className='mb-3 rounded bg-blue-50 px-3 py-2 dark:bg-blue-900/20'>
                        <p className='text-sm text-blue-900 dark:text-blue-300'>
                          下次跟进时间:{' '}
                          {new Date(record.nextFollowUpDate).toLocaleString(
                            'zh-CN'
                          )}
                        </p>
                      </div>
                    )}

                    <div className='flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500'>
                      <p>
                        创建时间:{' '}
                        {new Date(record.createdAt).toLocaleString('zh-CN')}
                      </p>
                      {record.updatedAt !== record.createdAt && (
                        <p>
                          更新时间:{' '}
                          {new Date(record.updatedAt).toLocaleString('zh-CN')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 表单对话框 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? '编辑沟通记录' : '添加沟通记录'}
            </DialogTitle>
          </DialogHeader>
          <CommunicationRecordForm
            clientId={clientId}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingRecord(null);
            }}
            editingRecord={
              editingRecord
                ? {
                    id: editingRecord.id,
                    type: editingRecord.type,
                    summary: editingRecord.summary,
                    content: editingRecord.content,
                    nextFollowUpDate: editingRecord.nextFollowUpDate
                      ? new Date(editingRecord.nextFollowUpDate)
                      : null,
                    isImportant: editingRecord.isImportant,
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
