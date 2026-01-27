import { DetailSkeleton } from '@/components/ui/Skeleton';

export default function AdminOrderDetailLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-4xl'>
        <DetailSkeleton />
      </div>
    </div>
  );
}
