import { Skeleton } from '@/components/ui/Skeleton';

export default function MembershipLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <Skeleton className='h-10 w-48' />
          <Skeleton className='mt-2 h-5 w-96' />
        </div>

        {/* 当前会员信息卡片 */}
        <div className='mb-8 rounded-xl border border-slate-200 bg-white p-8 shadow-sm'>
          <div className='mb-6 flex items-center gap-4'>
            <Skeleton className='h-16 w-16 rounded-full' />
            <div className='flex-1'>
              <Skeleton className='mb-2 h-6 w-32' />
              <Skeleton className='h-4 w-48' />
            </div>
          </div>

          {/* 使用情况统计 */}
          <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <div key={i} className='rounded-lg bg-slate-50 p-4'>
                <Skeleton className='mb-2 h-4 w-20' />
                <Skeleton className='h-8 w-16' />
              </div>
            ))}
          </div>
        </div>

        {/* 升级选项 */}
        <div className='mb-8'>
          <Skeleton className='mb-4 h-7 w-40' />
          <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='rounded-xl border border-slate-200 bg-white p-6'
              >
                <Skeleton className='mb-3 h-6 w-24' />
                <Skeleton className='mb-4 h-10 w-32' />
                <div className='mb-4 space-y-2'>
                  {[...Array(4)].map((_, j) => (
                    <Skeleton key={j} className='h-4 w-full' />
                  ))}
                </div>
                <Skeleton className='h-12 w-full' />
              </div>
            ))}
          </div>
        </div>

        {/* 使用历史 */}
        <div className='rounded-xl border border-slate-200 bg-white p-6'>
          <Skeleton className='mb-4 h-6 w-32' />
          <div className='space-y-3'>
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className='flex items-center justify-between rounded-lg border border-slate-100 p-4'
              >
                <div className='flex-1'>
                  <Skeleton className='mb-2 h-4 w-1/3' />
                  <Skeleton className='h-3 w-1/2' />
                </div>
                <Skeleton className='h-8 w-20' />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
