import { CardSkeleton, Skeleton } from '@/components/ui/Skeleton';

export default function DocumentTemplatesLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页面标题 */}
        <div className='mb-8'>
          <Skeleton className='mb-2 h-9 w-48' />
          <Skeleton className='h-5 w-96' />
        </div>

        {/* 搜索和筛选栏 */}
        <div className='mb-6 flex flex-wrap gap-4'>
          <Skeleton className='h-10 flex-1 min-w-[200px]' />
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-10 w-32' />
        </div>

        {/* 模板卡片网格 */}
        <CardSkeleton count={9} />

        {/* 分页 */}
        <div className='mt-8 flex items-center justify-between'>
          <Skeleton className='h-4 w-32' />
          <div className='flex gap-2'>
            <Skeleton className='h-10 w-10' />
            <Skeleton className='h-10 w-10' />
            <Skeleton className='h-10 w-10' />
            <Skeleton className='h-10 w-10' />
          </div>
          <Skeleton className='h-10 w-24' />
        </div>
      </div>
    </div>
  );
}
