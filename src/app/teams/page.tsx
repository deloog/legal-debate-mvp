'use client';

import { Suspense } from 'react';
import { TeamList } from './components/team-list';
import { CreateTeamButton } from './components/create-team-button';

/**
 * 团队管理页面主入口
 * 功能：展示团队列表、搜索、筛选和快速操作
 */
export default function TeamsPage() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              团队管理
            </h1>
            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
              管理您的团队和团队成员
            </p>
          </div>
          <CreateTeamButton />
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-4'>
          {/* 团队列表区（包含搜索和筛选） */}
          <div className='lg:col-span-4'>
            <Suspense fallback={<LoadingSkeleton />}>
              <TeamList />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className='h-40 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
        >
          <div className='mb-4 flex items-center gap-4'>
            <div className='h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800' />
          </div>
          <div className='space-y-2'>
            <div className='h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
          </div>
        </div>
      ))}
    </div>
  );
}
