'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Loader2,
  ArrowLeft,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FollowUpTaskPriority, FollowUpTaskStatus } from '@/types/client';
import { FollowUpTaskForm } from '@/components/client/FollowUpTaskForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FollowUpTask {
  id: string;
  clientId: string;
  communicationId: string;
  userId: string;
  type: string;
  summary: string;
  dueDate: string;
  priority: FollowUpTaskPriority;
  status: FollowUpTaskStatus;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Client {
  id: string;
  name: string;
  clientType: string;
  status: string;
}

export default function ClientFollowUpsPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<FollowUpTask | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  // 筛选状态
  const [filterPriority, setFilterPriority] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!clientId) return;

    try {
      setLoading(true);
      setError(null);

      // 并行获取客户信息和跟进任务
      const [clientRes, tasksRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/follow-up-tasks?clientId=${clientId}&limit=100`),
      ]);

      if (!clientRes.ok) {
        throw new Error('获取客户信息失败');
      }

      const clientData = await clientRes.json();
      setClient(clientData);

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        setTasks(tasksData.data?.tasks || []);
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

  // 统计
  const stats = {
    pending: tasks.filter(t => t.status === 'PENDING').length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length,
    overdue: tasks.filter(
      t => t.status === 'PENDING' && new Date(t.dueDate) < new Date()
    ).length,
    highPriority: tasks.filter(
      t => t.status === 'PENDING' && t.priority === 'HIGH'
    ).length,
  };

  // 筛选后的任务
  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'pending' && task.status !== 'PENDING') return false;
    if (activeTab === 'completed' && task.status !== 'COMPLETED') return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    return true;
  });

  const handleComplete = async (id: string) => {
    try {
      const response = await fetch(`/api/follow-up-tasks/${id}/complete`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('标记完成失败');
      }

      toast.success('任务已完成');
      fetchData();
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      toast.error('操作失败', { description: message });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此跟进任务吗？此操作不可恢复。')) {
      return;
    }

    try {
      const response = await fetch(`/api/follow-up-tasks/${id}`, {
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

  const handleEdit = (task: FollowUpTask) => {
    setEditingTask(task);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingTask(null);
    fetchData();
  };

  const getPriorityBadge = (priority: FollowUpTaskPriority): string => {
    const badges: Record<FollowUpTaskPriority, string> = {
      HIGH: 'bg-red-100 text-red-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-green-100 text-green-800',
    };
    return badges[priority] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityLabel = (priority: FollowUpTaskPriority): string => {
    const labels: Record<FollowUpTaskPriority, string> = {
      HIGH: '高',
      MEDIUM: '中',
      LOW: '低',
    };
    return labels[priority] || priority;
  };

  const getStatusBadge = (status: FollowUpTaskStatus): string => {
    const badges: Record<FollowUpTaskStatus, string> = {
      PENDING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: FollowUpTaskStatus): string => {
    const labels: Record<FollowUpTaskStatus, string> = {
      PENDING: '待处理',
      COMPLETED: '已完成',
      CANCELLED: '已取消',
    };
    return labels[status] || status;
  };

  const isOverdue = (dueDate: string, status: FollowUpTaskStatus): boolean => {
    return status === 'PENDING' && new Date(dueDate) < new Date();
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
            <span className='text-zinc-900 dark:text-zinc-100'>跟进任务</span>
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
                  跟进任务
                </h1>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  {client.name} - 共 {tasks.length} 个任务
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingTask(null);
                setShowForm(true);
              }}
            >
              <Plus className='mr-2 h-4 w-4' />
              新增任务
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
              className='py-4 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
            >
              沟通记录
            </Link>
            <Link
              href={`/clients/${clientId}/follow-ups`}
              className='border-b-2 border-blue-600 py-4 text-sm font-medium text-blue-600'
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
        {/* 统计卡片 */}
        <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardContent className='flex items-center p-4'>
              <div className='mr-4 rounded-full bg-blue-100 p-3 dark:bg-blue-900/20'>
                <Clock className='h-6 w-6 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  待处理
                </p>
                <p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>
                  {stats.pending}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='flex items-center p-4'>
              <div className='mr-4 rounded-full bg-green-100 p-3 dark:bg-green-900/20'>
                <CheckCircle className='h-6 w-6 text-green-600 dark:text-green-400' />
              </div>
              <div>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  已完成
                </p>
                <p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>
                  {stats.completed}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='flex items-center p-4'>
              <div className='mr-4 rounded-full bg-red-100 p-3 dark:bg-red-900/20'>
                <AlertCircle className='h-6 w-6 text-red-600 dark:text-red-400' />
              </div>
              <div>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  已逾期
                </p>
                <p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>
                  {stats.overdue}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className='flex items-center p-4'>
              <div className='mr-4 rounded-full bg-orange-100 p-3 dark:bg-orange-900/20'>
                <AlertCircle className='h-6 w-6 text-orange-600 dark:text-orange-400' />
              </div>
              <div>
                <p className='text-sm text-zinc-600 dark:text-zinc-400'>
                  高优先级
                </p>
                <p className='text-2xl font-bold text-zinc-900 dark:text-zinc-100'>
                  {stats.highPriority}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 任务看板 */}
        <Card>
          <CardHeader className='flex flex-row items-center justify-between'>
            <CardTitle>任务看板</CardTitle>
            <div className='flex gap-4'>
              <select
                aria-label='优先级'
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className='rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900'
              >
                <option value=''>全部优先级</option>
                <option value='HIGH'>高</option>
                <option value='MEDIUM'>中</option>
                <option value='LOW'>低</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className='mb-4'>
                <TabsTrigger value='all'>全部 ({tasks.length})</TabsTrigger>
                <TabsTrigger value='pending'>
                  待处理 ({stats.pending})
                </TabsTrigger>
                <TabsTrigger value='completed'>
                  已完成 ({stats.completed})
                </TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {filteredTasks.length === 0 ? (
                  <div className='py-12 text-center'>
                    <p className='text-zinc-500'>暂无跟进任务</p>
                    <Button
                      onClick={() => {
                        setEditingTask(null);
                        setShowForm(true);
                      }}
                      className='mt-4'
                    >
                      <Plus className='mr-2 h-4 w-4' />
                      添加第一个任务
                    </Button>
                  </div>
                ) : (
                  <div className='space-y-4'>
                    {filteredTasks.map(task => (
                      <div
                        key={task.id}
                        className={`rounded-lg border p-4 shadow-sm hover:shadow-md dark:border-zinc-800 ${
                          isOverdue(task.dueDate, task.status)
                            ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10'
                            : 'border-zinc-200 bg-white dark:bg-zinc-900'
                        }`}
                      >
                        <div className='mb-2 flex items-start justify-between'>
                          <div className='flex items-center gap-2'>
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${getPriorityBadge(
                                task.priority
                              )}`}
                            >
                              {getPriorityLabel(task.priority)}
                            </span>
                            <span
                              className={`rounded px-2 py-1 text-xs font-medium ${getStatusBadge(
                                task.status
                              )}`}
                            >
                              {getStatusLabel(task.status)}
                            </span>
                            {isOverdue(task.dueDate, task.status) && (
                              <span className='rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800'>
                                已逾期
                              </span>
                            )}
                          </div>
                          <div className='flex gap-2'>
                            {task.status === 'PENDING' && (
                              <Button
                                variant='outline'
                                size='sm'
                                onClick={() => handleComplete(task.id)}
                              >
                                <CheckCircle className='mr-1 h-4 w-4' />
                                完成
                              </Button>
                            )}
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => handleEdit(task)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant='outline'
                              size='sm'
                              onClick={() => handleDelete(task.id)}
                              className='text-red-600 hover:bg-red-50'
                            >
                              删除
                            </Button>
                          </div>
                        </div>

                        <h3 className='mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100'>
                          {task.summary}
                        </h3>

                        {task.notes && (
                          <p className='mb-3 text-sm text-zinc-600 dark:text-zinc-400'>
                            {task.notes}
                          </p>
                        )}

                        <div className='flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500'>
                          <div className='flex items-center gap-4'>
                            <p>
                              到期时间:{' '}
                              {new Date(task.dueDate).toLocaleString('zh-CN')}
                            </p>
                            {task.completedAt && (
                              <p>
                                完成时间:{' '}
                                {new Date(task.completedAt).toLocaleString(
                                  'zh-CN'
                                )}
                              </p>
                            )}
                          </div>
                          <p>
                            创建时间:{' '}
                            {new Date(task.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* 表单对话框 */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? '编辑跟进任务' : '添加跟进任务'}
            </DialogTitle>
          </DialogHeader>
          <FollowUpTaskForm
            clientId={clientId}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingTask(null);
            }}
            editingTask={
              editingTask
                ? {
                    id: editingTask.id,
                    summary: editingTask.summary,
                    type: editingTask.type,
                    priority: editingTask.priority,
                    dueDate: editingTask.dueDate,
                    notes: editingTask.notes,
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
