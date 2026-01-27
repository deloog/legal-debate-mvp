import { Skeleton } from '@/components/ui/Skeleton';

export default function DebateDetailLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 返回按钮 */}
        <div className='mb-6'>
          <Skeleton className='h-10 w-24' />
        </div>

        {/* 辩论标题 */}
        <div className='mb-6'>
          <Skeleton className='mb-3 h-9 w-2/3' />
          <Skeleton className='h-5 w-1/2' />
        </div>

        {/* 轮次选择器 */}
        <div className='mb-6 flex gap-2'>
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className='h-10 w-24' />
          ))}
        </div>

        {/* 辩论区域 - 双列布局 */}
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          {/* 原告方 */}
          <div className='space-y-4'>
            <Skeleton className='h-10 w-32' />
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='rounded-lg border border-slate-200 bg-white p-6'
              >
                <Skeleton className='mb-3 h-6 w-24' />
                <Skeleton className='mb-2 h-5 w-full' />
                <Skeleton className='mb-2 h-5 w-full' />
                <Skeleton className='h-5 w-5/6' />
                <div className='mt-4'>
                  <Skeleton className='h-4 w-20' />
                </div>
              </div>
            ))}
          </div>

          {/* 被告方 */}
          <div className='space-y-4'>
            <Skeleton className='h-10 w-32' />
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className='rounded-lg border border-slate-200 bg-white p-6'
              >
                <Skeleton className='mb-3 h-6 w-24' />
                <Skeleton className='mb-2 h-5 w-full' />
                <Skeleton className='mb-2 h-5 w-full' />
                <Skeleton className='h-5 w-5/6' />
                <div className='mt-4'>
                  <Skeleton className='h-4 w-20' />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className='mt-8 flex justify-center gap-4'>
          <Skeleton className='h-12 w-40' />
          <Skeleton className='h-12 w-40' />
        </div>
      </div>
    </div>
  );
}
