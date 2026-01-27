/**
 * Skeleton骨架屏组件
 * 用于在数据加载时显示占位符，提升用户体验
 */

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 ${className}`}
      aria-hidden='true'
    />
  );
}

/**
 * 表格骨架屏
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className='space-y-4'>
      {[...Array(rows)].map((_, i) => (
        <div
          key={i}
          className='flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4'
        >
          <Skeleton className='h-12 w-12 rounded-full' />
          <div className='flex-1 space-y-2'>
            <Skeleton className='h-4 w-1/3' />
            <Skeleton className='h-3 w-1/2' />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 卡片骨架屏
 */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className='rounded-lg border border-slate-200 bg-white p-6'
        >
          <Skeleton className='mb-4 h-6 w-2/3' />
          <Skeleton className='mb-2 h-4 w-full' />
          <Skeleton className='mb-2 h-4 w-5/6' />
          <Skeleton className='h-4 w-4/6' />
          <div className='mt-4 flex gap-2'>
            <Skeleton className='h-8 w-20' />
            <Skeleton className='h-8 w-20' />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 详情页骨架屏
 */
export function DetailSkeleton() {
  return (
    <div className='space-y-6'>
      {/* 标题 */}
      <div>
        <Skeleton className='mb-2 h-8 w-1/2' />
        <Skeleton className='h-4 w-1/3' />
      </div>

      {/* 内容区域 */}
      <div className='rounded-lg border border-slate-200 bg-white p-6'>
        <div className='space-y-4'>
          <div>
            <Skeleton className='mb-2 h-5 w-24' />
            <Skeleton className='h-4 w-full' />
          </div>
          <div>
            <Skeleton className='mb-2 h-5 w-24' />
            <Skeleton className='h-4 w-full' />
          </div>
          <div>
            <Skeleton className='mb-2 h-5 w-24' />
            <Skeleton className='h-32 w-full' />
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className='flex gap-3'>
        <Skeleton className='h-10 w-24' />
        <Skeleton className='h-10 w-24' />
      </div>
    </div>
  );
}

/**
 * 列表页骨架屏
 */
export function ListSkeleton() {
  return (
    <div className='space-y-6'>
      {/* 搜索栏 */}
      <div className='flex gap-4'>
        <Skeleton className='h-10 flex-1' />
        <Skeleton className='h-10 w-32' />
      </div>

      {/* 表格 */}
      <TableSkeleton rows={8} />

      {/* 分页 */}
      <div className='flex justify-between'>
        <Skeleton className='h-10 w-32' />
        <div className='flex gap-2'>
          <Skeleton className='h-10 w-10' />
          <Skeleton className='h-10 w-10' />
          <Skeleton className='h-10 w-10' />
        </div>
        <Skeleton className='h-10 w-32' />
      </div>
    </div>
  );
}
