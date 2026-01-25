'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  TaskDetail,
  TaskStatus,
  TaskPriority,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from '@/types/task';
import { Card } from '@/components/ui/card';

interface TaskFormProps {
  task?: TaskDetail;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * 任务表单组件
 * 功能：创建或编辑任务信息
 */
export function TaskForm({ task, onCancel, onSuccess }: TaskFormProps) {
  const router = useRouter();
  const isEditing = task !== undefined;

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(
    task?.status ?? TaskStatus.TODO
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? TaskPriority.MEDIUM
  );
  const [caseId, setCaseId] = useState(task?.caseId ?? '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? '');
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
  const [estimatedHours, setEstimatedHours] = useState(
    task?.estimatedHours?.toString() ?? ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('任务标题不能为空');
      return;
    }

    if (title.length > 200) {
      setError('任务标题不能超过200个字符');
      return;
    }

    if (description && description.length > 2000) {
      setError('任务描述不能超过2000个字符');
      return;
    }

    try {
      setLoading(true);

      const url = isEditing ? `/api/tasks/${task!.id}` : '/api/tasks';
      const method = isEditing ? 'PUT' : 'POST';

      const bodyData: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
      };

      if (caseId) {
        bodyData.caseId = caseId;
      }

      if (assignedTo) {
        bodyData.assignedTo = assignedTo;
      }

      if (dueDate) {
        bodyData.dueDate = new Date(dueDate);
      }

      if (estimatedHours) {
        const hours = parseFloat(estimatedHours);
        if (!isNaN(hours) && hours >= 0 && hours <= 1000) {
          bodyData.estimatedHours = hours;
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message ?? '保存失败');
      }

      onSuccess();
      if (isEditing) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className='p-6'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        {error && (
          <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'>
            {error}
          </div>
        )}

        <div>
          <Label htmlFor='title'>
            任务标题 <span className='text-red-500'>*</span>
          </Label>
          <Input
            id='title'
            type='text'
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder='请输入任务标题'
            maxLength={200}
            className='mt-1'
          />
          <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
            {title.length}/200
          </p>
        </div>

        <div>
          <Label htmlFor='description'>任务描述</Label>
          <Textarea
            id='description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder='请输入任务描述（可选）'
            rows={4}
            maxLength={2000}
            className='mt-1'
          />
          <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
            {description.length}/2000
          </p>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <Label htmlFor='status'>
              状态 <span className='text-red-500'>*</span>
            </Label>
            <select
              id='status'
              value={status}
              onChange={e => setStatus(e.target.value as TaskStatus)}
              className='mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              {Object.values(TaskStatus).map(s => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor='priority'>
              优先级 <span className='text-red-500'>*</span>
            </Label>
            <select
              id='priority'
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
              className='mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            >
              {Object.values(TaskPriority).map(p => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor='caseId'>关联案件</Label>
          <Input
            id='caseId'
            type='text'
            value={caseId}
            onChange={e => setCaseId(e.target.value)}
            placeholder='请输入案件ID（可选）'
            className='mt-1'
          />
        </div>

        <div>
          <Label htmlFor='assignedTo'>分配给</Label>
          <Input
            id='assignedTo'
            type='text'
            value={assignedTo}
            onChange={e => setAssignedTo(e.target.value)}
            placeholder='请输入用户ID（可选）'
            className='mt-1'
          />
        </div>

        <div>
          <Label htmlFor='dueDate'>截止日期</Label>
          <Input
            id='dueDate'
            type='date'
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            className='mt-1'
          />
        </div>

        <div>
          <Label htmlFor='estimatedHours'>预估工时（小时）</Label>
          <Input
            id='estimatedHours'
            type='number'
            value={estimatedHours}
            onChange={e => setEstimatedHours(e.target.value)}
            placeholder='请输入预估工时（可选）'
            min={0}
            max={1000}
            step={0.5}
            className='mt-1'
          />
        </div>

        <div className='flex justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={loading}
          >
            取消
          </Button>
          <Button type='submit' disabled={loading}>
            {loading ? '保存中...' : isEditing ? '保存' : '创建'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
