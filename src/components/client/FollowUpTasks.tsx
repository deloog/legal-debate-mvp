'use client';

import { useState } from 'react';
import { FollowUpTask } from '@/types/client';
import { FollowUpTaskCard } from './FollowUpTaskCard';
import { Button } from '../ui/button';

export interface FollowUpTasksProps {
  tasks: FollowUpTask[];
  loading?: boolean;
  onCompleteTask: (id: string, notes?: string) => Promise<void>;
  onCancelTask: (id: string) => Promise<void>;
  onRefresh?: () => void;
  pendingCount?: number;
}

export function FollowUpTasks({
  tasks,
  loading = false,
  onCompleteTask,
  onCancelTask,
  onRefresh,
  pendingCount = 0,
}: FollowUpTasksProps) {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [notesDialog, setNotesDialog] = useState<{
    taskId: string;
    notes: string;
  } | null>(null);

  const handleComplete = async (id: string, notes?: string) => {
    setCompletingId(id);
    try {
      await onCompleteTask(id, notes);
    } finally {
      setCompletingId(null);
      setNotesDialog(null);
    }
  };

  const handleCancel = async (id: string) => {
    if (confirm('确定要取消此跟进任务吗？此操作不可恢复。')) {
      setCancelingId(id);
      try {
        await onCancelTask(id);
      } finally {
        setCancelingId(null);
      }
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (tasks.length === 0) {
    return <EmptyState onRefresh={onRefresh} pendingCount={pendingCount} />;
  }

  return (
    <div className='space-y-4'>
      {/* 顶部栏 */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-semibold text-gray-900'>跟进任务</h2>
          <p className='text-sm text-gray-500'>
            {pendingCount > 0 ? `待处理任务: ${pendingCount}` : '所有任务'}
          </p>
        </div>
        {onRefresh && (
          <Button variant='outline' onClick={onRefresh} disabled={loading}>
            刷新
          </Button>
        )}
      </div>

      {/* 任务列表 */}
      <div className='space-y-4'>
        {tasks.map(task => (
          <FollowUpTaskCard
            key={task.id}
            task={task}
            onComplete={handleComplete}
            onCancel={handleCancel}
            isCompleting={completingId === task.id}
            isCanceling={cancelingId === task.id}
            isCompletingWithNotes={notesDialog?.taskId === task.id}
            onOpenNotesDialog={() =>
              setNotesDialog({ taskId: task.id, notes: '' })
            }
            onCloseNotesDialog={() => setNotesDialog(null)}
            onUpdateNotesDialog={setNotesDialog}
            notesDialog={notesDialog}
          />
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='space-y-2'>
          <div className='h-6 w-32 animate-pulse rounded bg-gray-200' />
          <div className='h-4 w-48 animate-pulse rounded bg-gray-200' />
        </div>
        <div className='h-8 w-24 animate-pulse rounded bg-gray-200' />
      </div>
      {[...Array(5)].map((_, index) => (
        <div
          key={index}
          className='animate-pulse rounded-md border border-gray-200 p-6'
        >
          <div className='mb-4 flex items-start justify-between'>
            <div className='flex-1 space-y-2'>
              <div className='h-5 w-2/3 rounded bg-gray-200' />
              <div className='flex space-x-2'>
                <div className='h-6 w-16 rounded-full bg-gray-200' />
                <div className='h-6 w-20 rounded-full bg-gray-200' />
              </div>
              <div className='h-4 w-full rounded bg-gray-200' />
            </div>
          </div>
          <div className='mb-4 space-y-1'>
            <div className='h-4 w-1/2 rounded bg-gray-200' />
            <div className='h-4 w-3/4 rounded bg-gray-200' />
          </div>
          <div className='flex justify-between border-t border-gray-200 pt-4'>
            <div className='h-4 w-32 rounded bg-gray-200' />
            <div className='h-4 w-24 rounded bg-gray-200' />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onRefresh,
  pendingCount,
}: {
  onRefresh?: () => void;
  pendingCount: number;
}) {
  return (
    <div className='rounded-md border border-gray-200 p-16 text-center'>
      <div className='mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100'>
        <svg
          className='h-12 w-12 text-gray-400'
          fill='none'
          viewBox='0 0 24 24'
          stroke='currentColor'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
          />
        </svg>
      </div>
      <h3 className='mb-2 text-lg font-semibold text-gray-900'>
        {pendingCount === 0 ? '暂无跟进任务' : '无待处理任务'}
      </h3>
      <p className='mb-6 text-gray-500'>
        {pendingCount === 0
          ? '跟进任务将从沟通记录自动生成'
          : '恭喜！所有待处理任务已完成'}
      </p>
      {onRefresh && (
        <Button variant='outline' onClick={onRefresh}>
          刷新任务列表
        </Button>
      )}
    </div>
  );
}
