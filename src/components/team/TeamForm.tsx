'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  TeamDetail,
  TeamType,
  TeamStatus,
  TEAM_TYPE_LABELS,
  TEAM_STATUS_LABELS,
  validateCreateTeamInput,
} from '@/types/team';

/**
 * 团队表单组件
 * 功能：创建或编辑团队信息
 */
export function TeamForm({ team }: { team?: TeamDetail }) {
  const router = useRouter();
  const isEditing = team !== undefined;

  const [name, setName] = useState(team?.name ?? '');
  const [type, setType] = useState<TeamType>(
    (team?.type as TeamType) ?? TeamType.LAW_FIRM
  );
  const [status, setStatus] = useState<TeamStatus>(
    (team?.status as TeamStatus) ?? TeamStatus.ACTIVE
  );
  const [description, setDescription] = useState(team?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const inputData = {
      name,
      type,
      status,
      description,
    };

    // 验证输入
    const validation = validateCreateTeamInput(inputData);
    if (!validation.isValid) {
      setError(validation.errors[0]?.message ?? '表单验证失败');
      return;
    }

    try {
      setLoading(true);

      const url = isEditing ? `/api/teams/${team!.id}` : '/api/teams';
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inputData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message ?? '保存失败');
      }

      // 成功后返回列表页或刷新
      if (isEditing) {
        router.back();
      } else {
        router.push('/teams');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && (
        <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100'>
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor='name'
          className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
        >
          团队名称 <span className='text-red-500'>*</span>
        </label>
        <Input
          id='name'
          type='text'
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='请输入团队名称'
        />
      </div>

      <div>
        <label
          htmlFor='type'
          className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
        >
          团队类型 <span className='text-red-500'>*</span>
        </label>
        <select
          id='type'
          value={type}
          onChange={e => setType(e.target.value as TeamType)}
          className='block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        >
          {Object.values(TeamType).map(t => (
            <option key={t} value={t}>
              {TEAM_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor='status'
          className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
        >
          状态 <span className='text-red-500'>*</span>
        </label>
        <select
          id='status'
          value={status}
          onChange={e => setStatus(e.target.value as TeamStatus)}
          className='block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        >
          {Object.values(TeamStatus).map(s => (
            <option key={s} value={s}>
              {TEAM_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor='description'
          className='mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300'
        >
          团队描述
        </label>
        <textarea
          id='description'
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder='请输入团队描述（可选）'
          rows={4}
          className='block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
        />
      </div>

      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.back()}
          disabled={loading}
        >
          取消
        </Button>
        <Button type='submit' disabled={loading}>
          {loading ? '保存中...' : isEditing ? '保存' : '创建'}
        </Button>
      </div>
    </form>
  );
}
