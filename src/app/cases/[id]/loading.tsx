import { Skeleton } from '@/components/ui/Skeleton';

export default function CaseDetailLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 返回按钮 */}
        <div className='mb-6'>
          <Skeleton className='h-10 w-24' />
        </div>

        {/* 案件详情 */}
        <div className='mb-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm'>
          {/* 标题和状态 */}
          <div className='mb-6 flex items-start justify-between'>
            <div className='flex-1'>
              <Skeleton className='mb-3 h-8 w-2/3' />
              <Skeleton className='h-5 w-1/2' />
            </div>
            <Skeleton className='h-8 w-24 rounded-full' />
          </div>

          {/* 案件信息 */}
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Skeleton className='mb-2 h-5 w-24' />
                <Skeleton className='h-6 w-full' />
              </div>
            ))}
          </div>
        </div>

        {/* 标签页导航 */}
        <div className='mb-6 flex gap-2 border-b border-slate-200'>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className='h-10 w-24' />
          ))}
        </div>

        {/* 内容区域 */}
        <div className='space-y-6'>
          {/* 团队成员 / 时间线 / 证据 等内容 */}
          <div className='rounded-xl border border-slate-200 bg-white p-6'>
            <Skeleton className='mb-4 h-6 w-32' />
            <div className='space-y-4'>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className='flex items-center gap-4 rounded-lg border border-slate-100 p-4'
                >
                  <Skeleton className='h-12 w-12 rounded-full' />
                  <div className='flex-1'>
                    <Skeleton className='mb-2 h-5 w-1/3' />
                    <Skeleton className='h-4 w-1/2' />
                  </div>
                  <Skeleton className='h-9 w-20' />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
