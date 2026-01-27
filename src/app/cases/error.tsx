'use client';

import { useEffect } from 'react';

export default function CasesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Cases Error] 页面错误:', error);
  }, [error]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50'>
      <div className='max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
          <svg
            className='h-8 w-8 text-red-600'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
            />
          </svg>
        </div>

        <h2 className='mb-2 text-2xl font-bold text-slate-900'>
          案件页面出错了
        </h2>
        <p className='mb-6 text-sm text-slate-600'>
          {error.message || '加载案件信息失败，请重试'}
        </p>

        <div className='flex gap-3'>
          <button
            onClick={reset}
            className='flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:shadow-xl'
          >
            重试
          </button>
          <button
            onClick={() => (window.location.href = '/cases')}
            className='flex-1 rounded-xl border-2 border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-50'
          >
            返回列表
          </button>
        </div>
      </div>
    </div>
  );
}
