import { ListSkeleton } from '@/components/ui/Skeleton';

export default function CasesLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        <div className='mb-6'>
          <div className='h-8 w-48 animate-pulse rounded bg-slate-200' />
          <div className='mt-2 h-4 w-96 animate-pulse rounded bg-slate-200' />
        </div>
        <ListSkeleton />
      </div>
    </div>
  );
}
