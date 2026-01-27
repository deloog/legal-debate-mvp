import { ListSkeleton } from '@/components/ui/Skeleton';

export default function OrdersLoading() {
  return (
    <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
      {/* 页面标题 */}
      <div className='mb-6'>
        <div className='h-9 w-40 animate-pulse rounded bg-slate-200' />
        <div className='mt-2 h-4 w-64 animate-pulse rounded bg-slate-200' />
      </div>

      {/* 订单列表 */}
      <ListSkeleton />
    </div>
  );
}
