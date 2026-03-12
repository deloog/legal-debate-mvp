'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { TaskForm } from '@/components/task/TaskForm';
import {
  TaskDetail,
  TaskStatus,
  TaskPriority,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from '@/types/task';

interface TaskListResponse {
  tasks: TaskDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 优先级对应的颜色
 */
const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.LOW]:
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  [TaskPriority.MEDIUM]:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  [TaskPriority.HIGH]:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  [TaskPriority.URGENT]:
    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * 状态对应的颜色
 */
const STATUS_COLORS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]:
    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  [TaskStatus.IN_PROGRESS]:
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  [TaskStatus.COMPLETED]:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  [TaskStatus.CANCELLED]:
    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

/**
 * 任务列表组件
 * 功能：展示任务列表、搜索、筛选、排序、分页
 */
export function TaskList() {
  const [tasks, setTasks] = useState<TaskDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDetail | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  async function fetchTasks() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      });

      if (search) {
        params.append('search', search);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      if (priorityFilter) {
        params.append('priority', priorityFilter);
      }

      const response = await fetch(`/api/tasks?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message ?? '获取任务列表失败');
      }

      const data: TaskListResponse = await response.json();
      setTasks(data.tasks);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取任务列表失败');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, priorityFilter, sortBy, sortOrder]);

  async function handleDelete(taskId: string) {
    if (!confirm('确定要删除此任务吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message ?? '删除失败');
      }

      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  async function handleComplete(taskId: string) {
    try {
      const response = await fetch(`/api/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message ?? '完成任务失败');
      }

      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : '完成任务失败');
    }
  }

  function handleCreateSuccess() {
    setShowCreateDialog(false);
    fetchTasks();
  }

  function handleEditSuccess() {
    setShowEditDialog(false);
    setEditingTask(null);
    fetchTasks();
  }

  function handleEditClick(task: TaskDetail) {
    setEditingTask(task);
    setShowEditDialog(true);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  return (
    <div className='space-y-6'>
      {/* 搜索和筛选区 */}
      <Card className='p-6'>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
          <div className='md:col-span-2'>
            <Input
              type='text'
              placeholder='搜索任务标题或描述...'
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className='block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              <option value=''>所有状态</option>
              {Object.values(TaskStatus).map(status => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={e => {
                setPriorityFilter(e.target.value);
                setPage(1);
              }}
              className='block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              <option value=''>所有优先级</option>
              {Object.values(TaskPriority).map(priority => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='mt-4 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400'>
            <span>共 {total} 个任务</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className='rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              <option value='createdAt'>创建时间</option>
              <option value='updatedAt'>更新时间</option>
              <option value='dueDate'>截止日期</option>
              <option value='priority'>优先级</option>
            </select>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
              className='rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              <option value='desc'>降序</option>
              <option value='asc'>升序</option>
            </select>
          </div>

          <Button onClick={() => setShowCreateDialog(true)}>创建任务</Button>
        </div>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'>
          {error}
        </div>
      )}

      {/* 任务列表 */}
      {loading ? (
        <div className='space-y-4'>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className='h-32 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
            >
              <div className='space-y-2'>
                <div className='h-6 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
                <div className='h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <Card className='p-12 text-center'>
          <p className='text-lg text-zinc-600 dark:text-zinc-400'>
            暂无任务，点击上方按钮创建新任务
          </p>
        </Card>
      ) : (
        <div className='space-y-4'>
          {tasks.map(task => (
            <Card key={task.id} className='p-6'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1'>
                  <div className='mb-2 flex items-center gap-2'>
                    <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                      {task.title}
                    </h3>
                    <Badge
                      className={PRIORITY_COLORS[task.priority as TaskPriority]}
                    >
                      {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                    </Badge>
                    <Badge className={STATUS_COLORS[task.status as TaskStatus]}>
                      {TASK_STATUS_LABELS[task.status as TaskStatus]}
                    </Badge>
                  </div>

                  {task.description && (
                    <p className='mb-4 text-sm text-zinc-600 dark:text-zinc-400'>
                      {task.description}
                    </p>
                  )}

                  <div className='flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400'>
                    {task.case && (
                      <span>
                        <span className='font-medium'>案件：</span>
                        {task.case.title}
                      </span>
                    )}
                    {task.assignedUser && (
                      <span>
                        <span className='font-medium'>负责人：</span>
                        {task.assignedUser.name || task.assignedUser.email}
                      </span>
                    )}
                    {task.dueDate && (
                      <span>
                        <span className='font-medium'>截止日期：</span>
                        {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                      </span>
                    )}
                    {task.estimatedHours && (
                      <span>
                        <span className='font-medium'>预估工时：</span>
                        {task.estimatedHours}小时
                      </span>
                    )}
                  </div>
                </div>

                <div className='flex shrink-0 flex-col gap-2'>
                  {task.status === TaskStatus.TODO ||
                  task.status === TaskStatus.IN_PROGRESS ? (
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleComplete(task.id)}
                    >
                      完成
                    </Button>
                  ) : null}
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => handleEditClick(task)}
                  >
                    编辑
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => handleDelete(task.id)}
                  >
                    删除
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <Card className='flex items-center justify-between p-4'>
          <p className='text-sm text-zinc-600 dark:text-zinc-400'>
            第 {page} 页，共 {totalPages} 页
          </p>
          <div className='flex gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              上一页
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              下一页
            </Button>
          </div>
        </Card>
      )}

      {/* 创建任务对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogTitle>创建任务</DialogTitle>
          <TaskForm
            onCancel={() => setShowCreateDialog(false)}
            onSuccess={handleCreateSuccess}
          />
        </DialogContent>
      </Dialog>

      {/* 编辑任务对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogTitle>编辑任务</DialogTitle>
          {editingTask && (
            <TaskForm
              task={editingTask}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingTask(null);
              }}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
