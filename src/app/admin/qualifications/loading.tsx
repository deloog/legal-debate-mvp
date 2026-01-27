import { ListSkeleton } from '@/components/ui/Skeleton';

export default function AdminQualificationsLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页面标题 */}
        <div className='mb-6'>
          <div className='h-8 w-40 animate-pulse rounded bg-slate-200' />
          <div className='mt-2 h-4 w-56 animate-pulse rounded bg-slate-200' />
        </div>

        {/* 资质审核列表 */}
        <ListSkeleton />
      </div>
    </div>
  );
}
