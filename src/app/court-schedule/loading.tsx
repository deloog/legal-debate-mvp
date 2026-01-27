import { Skeleton } from '@/components/ui/Skeleton';

export default function CourtScheduleLoading() {
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
        {/* 视图切换和日期导航 */}
        <div className='mb-6 flex items-center justify-between'>
          <div className='flex gap-2'>
            <Skeleton className='h-10 w-20' />
            <Skeleton className='h-10 w-20' />
            <Skeleton className='h-10 w-20' />
          </div>
          <div className='flex items-center gap-4'>
            <Skeleton className='h-10 w-10' />
            <Skeleton className='h-10 w-40' />
            <Skeleton className='h-10 w-10' />
          </div>
        </div>

        {/* 日历网格 */}
        <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
          {/* 星期标题 */}
          <div className='mb-4 grid grid-cols-7 gap-2'>
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className='h-8 w-full' />
            ))}
          </div>

          {/* 日期网格 */}
          <div className='grid grid-cols-7 gap-2'>
            {[...Array(35)].map((_, i) => (
              <div
                key={i}
                className='aspect-square rounded-lg border border-zinc-100 p-2'
              >
                <Skeleton className='mb-2 h-6 w-8' />
                <div className='space-y-1'>
                  <Skeleton className='h-4 w-full' />
                  <Skeleton className='h-4 w-3/4' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
