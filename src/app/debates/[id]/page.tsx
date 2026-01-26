'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDebate } from '@/lib/hooks/use-debate';
import { DebateArena } from './components/debate-arena';

/**
 * 辩论页面主入口
 * 功能：展示辩论界面，包括轮次选择和正反方论点展示
 */
export default function DebatesPage() {
  const params = useParams();
  const router = useRouter();
  const debateId = params.id as string;

  const {
    debate,
    rounds,
    currentRound,
    arguments: argumentsList,
    isLoading,
    error,
  } = useDebate({ debateId, refreshInterval: 5000 });

  // 处理轮次切换（空函数，DebateArena内部管理状态）
  const handleRoundChange = () => {
    // 状态由DebateArena组件内部管理
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black'>
        <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
          <div className='mx-auto max-w-7xl'>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              加载中...
            </h1>
          </div>
        </header>
        <LoadingSkeleton />
      </div>
    );
  }

  // 错误状态
  if (error || !debate) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black'>
        <div className='rounded-lg border border-red-200 bg-white p-8 text-center dark:border-red-800 dark:bg-zinc-950'>
          <div className='mb-4 text-red-500'>
            <svg
              className='mx-auto h-16 w-16'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
              />
            </svg>
          </div>
          <h2 className='mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            {error || '未找到辩论'}
          </h2>
          <p className='mb-4 text-sm text-zinc-600 dark:text-zinc-400'>
            请检查辩论ID是否正确，或返回案件列表重试
          </p>
          <button
            onClick={() => router.push('/cases')}
            className='rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600'
          >
            返回案件列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
                {debate.title || '辩论'}
              </h1>
              <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                案件辩论展示
              </p>
            </div>
            <button
              onClick={() => router.push('/cases')}
              className='rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            >
              返回
            </button>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        <Suspense fallback={<LoadingSkeleton />}>
          <DebateArena
            debateId={debateId}
            rounds={rounds}
            currentRound={currentRound}
            arguments={argumentsList}
            onRoundChange={handleRoundChange}
          />
        </Suspense>
      </main>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className='space-y-6'>
      {/* 轮次选择器骨架 */}
      <div className='space-y-2'>
        <div className='h-5 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
        <div className='flex gap-2'>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className='h-24 w-40 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
            />
          ))}
        </div>
      </div>

      {/* 论点列骨架 */}
      <div className='grid gap-6 md:grid-cols-2'>
        {[...Array(2)].map((_, i) => (
          <div key={i} className='space-y-3'>
            <div className='h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800' />
            <div className='space-y-3'>
              {[...Array(2)].map((_, j) => (
                <div
                  key={j}
                  className='h-32 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900'
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
