import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function ClientsLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <div className='mb-1 h-8 w-32 animate-pulse rounded bg-slate-200' />
            <div className='h-4 w-48 animate-pulse rounded bg-slate-200' />
          </div>
          <Skeleton className='h-10 w-32' />
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        {/* 搜索和筛选 */}
        <div className='mb-6 flex flex-wrap gap-4'>
          <Skeleton className='h-10 flex-1 min-w-[200px]' />
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-10 w-32' />
        </div>

        {/* 客户卡片网格 */}
        <CardSkeleton count={6} />

        {/* 分页 */}
        <div className='mt-6 flex justify-center gap-2'>
          <Skeleton className='h-10 w-10' />
          <Skeleton className='h-10 w-10' />
          <Skeleton className='h-10 w-10' />
        </div>
      </main>
    </div>
  );
}
