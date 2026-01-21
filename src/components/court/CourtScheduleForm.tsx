'use client';

import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { CourtScheduleDetail } from '../../types/court-schedule';

/**
 * 法庭日程表单组件
 * 功能：创建和编辑法庭日程
 */

interface CourtScheduleFormProps {
  schedule?: CourtScheduleDetail;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CourtScheduleForm(props: CourtScheduleFormProps) {
  const { schedule, onClose, onSuccess } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<CourtScheduleDetail[]>([]);

  const [formData, setFormData] = useState({
    caseId: schedule?.caseId || '',
    title: schedule?.title || '',
    type: schedule?.type || ('TRIAL' as const),
    startTime: schedule?.startTime
      ? new Date(schedule.startTime).toISOString().slice(0, 16)
      : '',
    endTime: schedule?.endTime
      ? new Date(schedule.endTime).toISOString().slice(0, 16)
      : '',
    location: schedule?.location || '',
    judge: schedule?.judge || '',
    notes: schedule?.notes || '',
  });

  const [cases, setCases] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const response = await fetch('/api/cases', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = (await response.json()) as {
          cases: Array<{ id: string; title: string }>;
        };
        setCases(data.cases || []);
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };

  const handleInputChange = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setConflicts([]);

    try {
      // 先检测冲突
      const conflictResponse = await fetch('/api/court-schedules/conflicts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: formData.caseId,
          startTime: new Date(formData.startTime),
          endTime: new Date(formData.endTime),
        }),
      });

      if (conflictResponse.ok) {
        const conflictData = (await conflictResponse.json()) as {
          conflicts: CourtScheduleDetail[];
        };

        if (conflictData.conflicts.length > 0) {
          setConflicts(conflictData.conflicts);
          setError('检测到日程冲突，请确认后继续');
          setIsLoading(false);
          return;
        }
      }

      // 创建或更新日程
      const url = schedule
        ? `/api/court-schedules/${schedule.id}`
        : '/api/court-schedules';
      const method = schedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: formData.caseId,
          title: formData.title,
          type: formData.type,
          startTime: new Date(formData.startTime),
          endTime: new Date(formData.endTime),
          location: formData.location,
          judge: formData.judge,
          notes: formData.notes,
        }),
      });

      if (response.ok) {
        onSuccess?.();
        onClose();
      } else {
        const data = (await response.json()) as { error?: string };
        setError(data.error || '操作失败，请重试');
      }
    } catch (error) {
      console.error('Failed to save schedule:', error);
      setError('网络错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
          {schedule ? '编辑日程' : '创建日程'}
        </h2>
        <Button type='button' variant='ghost' onClick={handleCancel}>
          ✕
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='rounded bg-red-50 p-4 text-red-900 dark:bg-red-950 dark:text-red-300'>
          {error}
        </div>
      )}

      {/* 冲突提示 */}
      {conflicts.length > 0 && (
        <div className='rounded bg-yellow-50 p-4 dark:bg-yellow-950 dark:text-yellow-900'>
          <p className='mb-2 font-semibold'>以下日程可能冲突：</p>
          <ul className='space-y-1 text-sm'>
            {conflicts.map(conflict => (
              <li key={conflict.id}>
                {conflict.title} -{' '}
                {new Date(conflict.startTime).toLocaleString('zh-CN')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 表单字段 */}
      <div className='grid gap-4'>
        {/* 关联案件 */}
        <div>
          <Label htmlFor='caseId'>关联案件</Label>
          <select
            id='caseId'
            name='caseId'
            value={formData.caseId}
            onChange={handleInputChange}
            required
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          >
            <option value=''>请选择案件</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* 日程标题 */}
        <div>
          <Label htmlFor='title'>日程标题</Label>
          <input
            id='title'
            name='title'
            type='text'
            value={formData.title}
            onChange={handleInputChange}
            required
            placeholder='例如：张三诉李四民间借贷纠纷案开庭'
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          />
        </div>

        {/* 日程类型 */}
        <div>
          <Label htmlFor='type'>日程类型</Label>
          <select
            id='type'
            name='type'
            value={formData.type}
            onChange={handleInputChange}
            required
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          >
            <option value='TRIAL'>开庭</option>
            <option value='MEDIATION'>调解</option>
            <option value='ARBITRATION'>仲裁</option>
            <option value='MEETING'>会谈</option>
            <option value='OTHER'>其他</option>
          </select>
        </div>

        {/* 开始时间 */}
        <div>
          <Label htmlFor='startTime'>开始时间</Label>
          <input
            id='startTime'
            name='startTime'
            type='datetime-local'
            value={formData.startTime}
            onChange={handleInputChange}
            required
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          />
        </div>

        {/* 结束时间 */}
        <div>
          <Label htmlFor='endTime'>结束时间</Label>
          <input
            id='endTime'
            name='endTime'
            type='datetime-local'
            value={formData.endTime}
            onChange={handleInputChange}
            required
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          />
        </div>

        {/* 地点 */}
        <div>
          <Label htmlFor='location'>地点</Label>
          <input
            id='location'
            name='location'
            type='text'
            value={formData.location}
            onChange={handleInputChange}
            placeholder='例如：第一法庭'
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          />
        </div>

        {/* 法官 */}
        <div>
          <Label htmlFor='judge'>法官</Label>
          <input
            id='judge'
            name='judge'
            type='text'
            value={formData.judge}
            onChange={handleInputChange}
            placeholder='法官姓名'
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          />
        </div>

        {/* 备注 */}
        <div>
          <Label htmlFor='notes'>备注</Label>
          <textarea
            id='notes'
            name='notes'
            value={formData.notes}
            onChange={handleInputChange}
            rows={3}
            placeholder='备注信息'
            className='w-full rounded border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900'
          />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className='flex justify-end gap-2 pt-4'>
        <Button type='button' variant='outline' onClick={handleCancel}>
          取消
        </Button>
        <Button type='submit' disabled={isLoading}>
          {isLoading ? '保存中...' : schedule ? '更新' : '创建'}
        </Button>
      </div>
    </form>
  );
}
