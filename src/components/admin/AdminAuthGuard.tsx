'use client';

/**
 * AdminAuthGuard — 管理后台客户端守卫（第二道防线）
 *
 * 第一道防线：middleware.ts（路由级，Edge Runtime）
 * 第二道防线：此组件（客户端渲染后二次验证）
 *
 * 当 middleware 因 cookie 未携带、CDN 缓存等原因漏过时，
 * 此守卫在客户端渲染完成后再次验证角色，非管理员立即跳走。
 */

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

export function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        '/login?redirect=' + encodeURIComponent(window.location.pathname)
      );
      return;
    }
    if (!isAdmin) {
      router.replace('/');
    }
  }, [loading, user, isAdmin, router]);

  // 加载中或非管理员时显示空白遮罩，避免内容闪烁
  if (loading || !user || !isAdmin) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-gray-50'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600' />
      </div>
    );
  }

  return <>{children}</>;
}
