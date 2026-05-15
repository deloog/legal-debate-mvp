'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { FollowUpTaskPriority } from '@/types/client';

/**
 * 任务类型选项
 */
const TASK_TYPES = [
  { value: 'PHONE', label: '电话' },
  { value: 'EMAIL', label: '邮件' },
  { value: 'MEETING', label: '面谈' },
  { value: 'WECHAT', label: '微信' },
  { value: 'OTHER', label: '其他' },
];

/**
 * 优先级选项
 */
const PRIORITIES = [
  { value: 'HIGH', label: '高', color: 'text-red-600' },
  { value: 'MEDIUM', label: '中', color: 'text-yellow-600' },
  { value: 'LOW', label: '低', color: 'text-green-600' },
];

/**
 * 编辑任务数据结构
 */
interface EditingTask {
  id: string;
  summary: string;
  type: string;
  priority: string;
  dueDate: string;
  notes?: string | null;
}

/**
 * 组件属性
 */
interface FollowUpTaskFormProps {
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
  editingTask?: EditingTask;
}

/**
 * 跟进任务表单组件
 */
export function FollowUpTaskForm({
  clientId,
  onSuccess,
  onCancel,
  editingTask,
}: FollowUpTaskFormProps) {
  const [summary, setSummary] = useState(editingTask?.summary || '');
  const [type, setType] = useState<string>(editingTask?.type || 'PHONE');
  const [priority, setPriority] = useState<string>(
    editingTask?.priority || 'MEDIUM'
  );
  const [dueDate, setDueDate] = useState<string>(() => {
    if (editingTask?.dueDate) {
      // 转换 ISO 日期为本地日期时间格式
      const date = new Date(editingTask.dueDate);
      return date.toISOString().slice(0, 16);
    }
    return '';
  });
  const [notes, setNotes] = useState(editingTask?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 验证表单
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!summary.trim()) {
      newErrors.summary = '请输入任务摘要';
    } else if (summary.trim().length < 2) {
      newErrors.summary = '摘要至少需要2个字符';
    }

    if (!dueDate) {
      newErrors.dueDate = '请选择到期时间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [summary, dueDate]);

  // 处理提交
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const url = editingTask
          ? `/api/follow-up-tasks/${editingTask.id}`
          : '/api/follow-up-tasks';

        const method = editingTask ? 'PUT' : 'POST';

        const body = {
          clientId,
          type,
          summary: summary.trim(),
          priority: priority as FollowUpTaskPriority,
          dueDate: new Date(dueDate).toISOString(),
          notes: notes.trim() || undefined,
          ...(editingTask ? {} : { status: 'PENDING' }),
        };

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || data.message || '操作失败');
        }

        toast.success(editingTask ? '任务更新成功' : '任务创建成功');
        onSuccess();
      } catch (error) {
        const message = error instanceof Error ? error.message : '操作失败';
        toast.error(editingTask ? '更新失败' : '创建失败', {
          description: message,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      clientId,
      summary,
      type,
      priority,
      dueDate,
      notes,
      editingTask,
      onSuccess,
      validate,
    ]
  );

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* 任务摘要 */}
      <div>
        <Label htmlFor='summary'>
          任务摘要 <span className='text-red-500'>*</span>
        </Label>
        <Input
          id='summary'
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder='请输入任务摘要'
          className={errors.summary ? 'border-red-500' : ''}
        />
        {errors.summary && (
          <p className='mt-1 text-sm text-red-500'>{errors.summary}</p>
        )}
      </div>

      {/* 任务类型和优先级 */}
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <Label htmlFor='type'>任务类型</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id='type'>
              <SelectValue placeholder='选择类型' />
            </SelectTrigger>
            <SelectContent>
              {TASK_TYPES.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor='priority'>优先级</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id='priority'>
              <SelectValue placeholder='选择优先级' />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(item => (
                <SelectItem key={item.value} value={item.value}>
                  <span className={item.color}>{item.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 到期时间 */}
      <div>
        <Label htmlFor='dueDate'>
          到期时间 <span className='text-red-500'>*</span>
        </Label>
        <Input
          id='dueDate'
          type='datetime-local'
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className={errors.dueDate ? 'border-red-500' : ''}
        />
        {errors.dueDate && (
          <p className='mt-1 text-sm text-red-500'>{errors.dueDate}</p>
        )}
      </div>

      {/* 备注 */}
      <div>
        <Label htmlFor='notes'>备注</Label>
        <Textarea
          id='notes'
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder='可选：添加任务备注'
          rows={3}
        />
      </div>

      {/* 按钮组 */}
      <div className='flex justify-end gap-2 pt-4'>
        <Button
          type='button'
          variant='outline'
          onClick={onCancel}
          disabled={isSubmitting}
        >
          取消
        </Button>
        <Button type='submit' disabled={isSubmitting}>
          {isSubmitting
            ? editingTask
              ? '更新中...'
              : '创建中...'
            : editingTask
              ? '更新'
              : '保存'}
        </Button>
      </div>
    </form>
  );
}
