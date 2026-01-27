import { DetailSkeleton } from '@/components/ui/Skeleton';

export default function TeamDetailLoading() {
  return (
    <div className='min-h-screen bg-zinc-50 p-6 dark:bg-black'>
      <div className='mx-auto max-w-5xl'>
        <DetailSkeleton />
      </div>
    </div>
  );
}
