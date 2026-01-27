import { ListSkeleton } from '@/components/ui/Skeleton';

export default function TasksLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <div className='mb-1 h-8 w-32 animate-pulse rounded bg-slate-200' />
            <div className='h-4 w-48 animate-pulse rounded bg-slate-200' />
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        <ListSkeleton />
      </main>
    </div>
  );
}
