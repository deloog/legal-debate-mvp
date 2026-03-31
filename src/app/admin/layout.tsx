import type { ReactNode } from 'react';
import Link from 'next/link';
import { AdminNavigation } from '@/components/admin/AdminNavigation';
import { NotificationBell } from '@/components/notification/NotificationBell';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton';

export const metadata = {
  title: '管理员后台',
  description: '系统管理后台',
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): React.ReactElement {
  return (
    <AdminAuthGuard>
      <div className='min-h-screen bg-gray-50'>
        {/* 顶部导航栏 */}
        <header className='bg-white border-b border-gray-200 shadow-sm'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='flex h-16 items-center justify-between'>
              <div className='flex items-center'>
                <h1 className='text-xl font-bold text-gray-900'>管理员后台</h1>
              </div>
              <div className='flex items-center gap-4'>
                <NotificationBell />
                <Link
                  href='/'
                  className='text-sm text-gray-600 hover:text-gray-900'
                >
                  返回前台
                </Link>
                <AdminLogoutButton />
              </div>
            </div>
          </div>
        </header>

        {/* 主内容区 */}
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6'>
          <div className='lg:grid lg:grid-cols-12 lg:gap-6'>
            {/* 左侧导航 */}
            <aside className='hidden lg:block lg:col-span-3'>
              <div className='sticky top-6'>
                <AdminNavigation />
              </div>
            </aside>

            {/* 主内容 */}
            <main className='lg:col-span-9'>
              <div className='min-h-[calc(100vh-8rem)] bg-white rounded-lg shadow p-6'>
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
