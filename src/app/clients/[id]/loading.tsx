import { DetailSkeleton } from '@/components/ui/Skeleton';

export default function ClientDetailLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 p-6 dark:bg-black'>
      <div className='mx-auto max-w-4xl'>
        <DetailSkeleton />
      </div>
    </div>
  );
}
