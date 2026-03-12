import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 标题 */}
        <div className='mb-6'>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='mt-2 h-4 w-64' />
        </div>

        {/* 统计卡片 */}
        <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className='rounded-lg border border-slate-200 bg-white p-6'
            >
              <Skeleton className='mb-2 h-4 w-20' />
              <Skeleton className='mb-2 h-8 w-16' />
              <Skeleton className='h-3 w-24' />
            </div>
          ))}
        </div>

        {/* 图表区域 */}
        <div className='mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <div className='rounded-lg border border-slate-200 bg-white p-6'>
            <Skeleton className='mb-4 h-6 w-32' />
            <Skeleton className='h-64 w-full' />
          </div>
          <div className='rounded-lg border border-slate-200 bg-white p-6'>
            <Skeleton className='mb-4 h-6 w-32' />
            <Skeleton className='h-64 w-full' />
          </div>
        </div>

        {/* 最近活动 */}
        <div className='rounded-lg border border-slate-200 bg-white p-6'>
          <Skeleton className='mb-4 h-6 w-32' />
          <div className='space-y-3'>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='flex items-center gap-4'>
                <Skeleton className='h-10 w-10 rounded-full' />
                <div className='flex-1'>
                  <Skeleton className='mb-2 h-4 w-1/3' />
                  <Skeleton className='h-3 w-1/2' />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
