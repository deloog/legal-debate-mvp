/**
 * 管理后台首页
 */

'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 自动重定向到用户管理页面
    router.push('/admin/users');
  }, [router]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50'>
      <div className='text-center'>
        <div className='mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg'>
          <svg
            className='h-8 w-8 text-white'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 4.17 2.936a1.724 1.724 0 001.066 2.573c.94 1.543-.826 3.31-2.936 4.17a1.724 1.724 0 00-2.573 1.066c-1.543.94-3.31-.826-4.17-2.936a1.724 1.724 0 00-1.066-2.573c-.94-1.543.826-3.31 2.936-4.17a1.724 1.724 0 00-2.573-1.066zM17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314l-4.244 4.243a8 8 0 01-11.314 0z M9 12l2 2 4-4'
            />
          </svg>
        </div>
        <h1 className='mb-4 text-2xl font-bold text-slate-900'>系统管理后台</h1>
        <p className='mb-8 text-slate-600'>正在跳转到管理页面...</p>

        <div className='grid gap-3'>
          <Link
            href='/admin/users'
            className='rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl'
          >
            用户管理
          </Link>
          <Link
            href='/admin/cases'
            className='rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:shadow-md'
          >
            案件管理
          </Link>
          <Link
            href='/'
            className='rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:shadow-md'
          >
            返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}
