import { DetailSkeleton } from '@/components/ui/Skeleton';

export default function OrderDetailLoading() {
  return (
    <div className='container mx-auto min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8'>
      <DetailSkeleton />
    </div>
  );
}
