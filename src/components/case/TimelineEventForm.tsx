'use client';

import { useState } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { TimelineEvent } from '@/types/case';

/**
 * 时间线事件类型标签映射
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  FILING: '立案',
  PRETRIAL: '审前准备',
  TRIAL: '开庭审理',
  JUDGMENT: '判决',
  APPEAL: '上诉',
  EXECUTION: '执行',
  CLOSED: '结案',
  CUSTOM: '自定义',
};

/**
 * 时间线事件表单组件
 */
interface TimelineEventFormProps {
  caseId: string;
  event?: TimelineEvent | null;
  onClose: () => void;
}

export function TimelineEventForm({
  caseId,
  event,
  onClose,
}: TimelineEventFormProps) {
  const isEditing = !!event;
  const [eventType, setEventType] = useState(event?.eventType || 'FILING');
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [eventDate, setEventDate] = useState(
    event?.eventDate
      ? new Date(event.eventDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 提交表单
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 验证
    if (!title.trim()) {
      setError('标题不能为空');
      return;
    }

    try {
      setLoading(true);
      const url = isEditing
        ? `/api/v1/timeline-events/${event.id}`
        : `/api/v1/cases/${caseId}/timeline`;

      // 认证通过 httpOnly cookie 自动携带，无需手动传 token
      const response = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType,
          title: title.trim(),
          description: description.trim() || null,
          eventDate: new Date(eventDate),
        }),
      });

      if (!response.ok) {
        throw new Error(isEditing ? '更新失败' : '创建失败');
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理事件类型变化时自动更新标题
   */
  const handleEventTypeChange = (newEventType: string) => {
    setEventType(newEventType as TimelineEvent['eventType']);
    // 如果标题是自动生成的，根据新类型更新
    if (
      !isEditing &&
      (!title || Object.keys(EVENT_TYPE_LABELS).includes(title))
    ) {
      setTitle(EVENT_TYPE_LABELS[newEventType] || newEventType);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900'>
        {/* 标题栏 */}
        <div className='mb-6 flex items-center justify-between'>
          <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            {isEditing ? '编辑时间线事件' : '添加时间线事件'}
          </h3>
          <button
            onClick={onClose}
            className='rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* 事件类型 */}
          <div className='space-y-2'>
            <Label htmlFor='eventType'>事件类型</Label>
            <select
              id='eventType'
              value={eventType}
              onChange={e => handleEventTypeChange(e.target.value)}
              className='w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
            >
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* 标题 */}
          <div className='space-y-2'>
            <Label htmlFor='title'>
              标题 <span className='text-red-500'>*</span>
            </Label>
            <input
              id='title'
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder='请输入事件标题'
              maxLength={200}
              className='w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
            />
          </div>

          {/* 描述 */}
          <div className='space-y-2'>
            <Label htmlFor='description'>描述</Label>
            <textarea
              id='description'
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder='请输入事件描述（可选）'
              rows={4}
              maxLength={2000}
              className='w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
            />
            <p className='text-xs text-zinc-500'>{description.length}/2000</p>
          </div>

          {/* 事件日期 */}
          <div className='space-y-2'>
            <Label htmlFor='eventDate'>
              事件日期 <span className='text-red-500'>*</span>
            </Label>
            <div className='relative'>
              <Calendar className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400' />
              <input
                id='eventDate'
                type='date'
                value={eventDate}
                onChange={e => setEventDate(e.target.value)}
                className='w-full rounded-md border border-zinc-300 bg-white pl-10 pr-3 py-2 text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50'
              />
            </div>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className='rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400'>
              {error}
            </div>
          )}

          {/* 操作按钮 */}
          <div className='flex items-center justify-end gap-3 pt-4'>
            <Button
              type='button'
              variant='outline'
              onClick={onClose}
              disabled={loading}
            >
              取消
            </Button>
            <Button type='submit' disabled={loading} className='min-w-25'>
              {loading ? '保存中...' : isEditing ? '更新' : '创建'}
              {!loading && <Save className='ml-2 h-4 w-4' />}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TimelineEventForm;
