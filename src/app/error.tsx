'use client';

import { useEffect } from 'react';
import { UserFriendlyError } from '@/components/error/UserFriendlyError';

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
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900'>
      <div className='w-full max-w-md'>
        <UserFriendlyError
          error={error}
          variant='lg'
          onRetry={reset}
          onBack={() => (window.location.href = '/')}
        />

        {/* 帮助信息 */}
        <p className='mt-4 text-center text-xs text-slate-500 dark:text-zinc-500'>
          如果问题持续出现，请联系技术支持
        </p>
      </div>
    </div>
  );
}
