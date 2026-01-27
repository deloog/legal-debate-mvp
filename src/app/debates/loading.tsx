export default function DebatesLoading() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50'>
      {/* Header Skeleton */}
      <div className='border-b border-slate-200 bg-white/80 backdrop-blur-xl'>
        <div className='mx-auto max-w-7xl px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <div className='h-7 w-48 animate-pulse rounded bg-slate-200' />
              <div className='mt-1 h-4 w-64 animate-pulse rounded bg-slate-200' />
            </div>
            <div className='h-9 w-24 animate-pulse rounded-xl bg-slate-200' />
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className='mx-auto max-w-7xl px-6 py-12'>
        {/* Hero Section Skeleton */}
        <div className='mb-12 flex flex-col items-center text-center'>
          <div className='mb-6 h-20 w-20 animate-pulse rounded-2xl bg-slate-200' />
          <div className='mb-4 h-10 w-80 animate-pulse rounded bg-slate-200' />
          <div className='mx-auto h-6 w-2/3 animate-pulse rounded bg-slate-200' />
        </div>

        {/* Feature Cards Skeleton */}
        <div className='mb-12 grid gap-6 md:grid-cols-3'>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className='rounded-2xl border border-slate-200 bg-white p-6'
            >
              <div className='mb-4 h-12 w-12 animate-pulse rounded-xl bg-slate-200' />
              <div className='mb-2 h-5 w-2/3 animate-pulse rounded bg-slate-200' />
              <div className='h-4 w-full animate-pulse rounded bg-slate-200' />
            </div>
          ))}
        </div>

        {/* Getting Started Skeleton */}
        <div className='rounded-2xl border border-slate-200 bg-white p-8'>
          <div className='mb-6 h-6 w-48 animate-pulse rounded bg-slate-200' />
          <div className='space-y-4'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='flex gap-4'>
                <div className='h-8 w-8 shrink-0 animate-pulse rounded-full bg-slate-200' />
                <div className='flex-1'>
                  <div className='mb-1 h-5 w-48 animate-pulse rounded bg-slate-200' />
                  <div className='h-4 w-3/4 animate-pulse rounded bg-slate-200' />
                </div>
              </div>
            ))}
          </div>
          <div className='mt-8 flex gap-4'>
            <div className='h-10 w-36 animate-pulse rounded-xl bg-slate-200' />
            <div className='h-10 w-28 animate-pulse rounded-xl bg-slate-200' />
          </div>
        </div>
      </div>
    </div>
  );
}
