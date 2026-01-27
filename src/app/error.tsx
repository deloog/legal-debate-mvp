'use client';

import { useEffect } from 'react';

/**
 * 全局错误边界
 * 捕获应用中的未处理错误，防止白屏
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 记录错误到监控系统（可以集成Sentry等）
    console.error('全局错误捕获:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4'>
      <div className='w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl'>
        {/* 错误图标 */}
        <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100'>
          <svg
            className='h-10 w-10 text-red-600'
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

        {/* 错误标题 */}
        <h2 className='mb-2 text-2xl font-bold text-slate-900'>出错了</h2>

        {/* 错误描述 */}
        <p className='mb-6 text-sm text-slate-600'>
          {error.message || '页面加载失败，请重试'}
        </p>

        {/* 错误详情（开发环境） */}
        {process.env.NODE_ENV === 'development' && error.stack && (
          <details className='mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left'>
            <summary className='cursor-pointer text-sm font-semibold text-slate-700'>
              查看错误详情
            </summary>
            <pre className='mt-2 max-h-40 overflow-auto text-xs text-slate-600'>
              {error.stack}
            </pre>
          </details>
        )}

        {/* 操作按钮 */}
        <div className='flex gap-3'>
          <button
            onClick={reset}
            className='flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl'
          >
            重试
          </button>
          <button
            onClick={() => (window.location.href = '/')}
            className='flex-1 rounded-xl border-2 border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-50'
          >
            返回首页
          </button>
        </div>

        {/* 帮助信息 */}
        <p className='mt-6 text-xs text-slate-500'>
          如果问题持续出现，请联系技术支持
        </p>
      </div>
    </div>
  );
}
