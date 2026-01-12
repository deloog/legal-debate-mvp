'use client';

import Link from 'next/link';

/**
 * 主页面
 * 功能：提供系统导航入口
 */
export default function Home() {
  return (
    <div className='flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black'>
      <main className='w-full max-w-4xl px-8 py-16'>
        {/* 标题区域 */}
        <div className='mb-12 text-center'>
          <h1 className='mb-4 text-4xl font-bold text-zinc-900 dark:text-zinc-50'>
            Legal Debate MVP
          </h1>
          <p className='text-lg text-zinc-600 dark:text-zinc-400'>
            AI驱动的法律辩论系统
          </p>
        </div>

        {/* 功能卡片区域 */}
        <div className='grid gap-6 sm:grid-cols-1 md:grid-cols-2'>
          {/* 案件管理卡片 */}
          <Link
            href='/cases'
            className='group flex flex-col items-center rounded-lg border border-zinc-200 bg-white p-8 transition-all hover:border-blue-500 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-500'
          >
            <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors group-hover:bg-blue-500 group-hover:text-white dark:bg-zinc-900 dark:text-blue-400'>
              <svg
                className='h-8 w-8'
                width='32'
                height='32'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
                />
              </svg>
            </div>
            <h2 className='mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
              案件管理
            </h2>
            <p className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
              管理和查看您的所有法律案件，创建新案件并追踪辩论进展
            </p>
          </Link>

          {/* 文档分析卡片 */}
          <Link
            href='/cases'
            className='group flex flex-col items-center rounded-lg border border-zinc-200 bg-white p-8 transition-all hover:border-green-500 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-green-500'
          >
            <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 transition-colors group-hover:bg-green-500 group-hover:text-white dark:bg-zinc-900 dark:text-green-400'>
              <svg
                className='h-8 w-8'
                width='32'
                height='32'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                />
              </svg>
            </div>
            <h2 className='mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
              文档分析
            </h2>
            <p className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
              上传并分析法律文档，AI助手自动提取关键信息
            </p>
          </Link>
        </div>

        {/* 功能说明 */}
        <div className='mt-12 rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900'>
          <h3 className='mb-4 font-semibold text-zinc-900 dark:text-zinc-50'>
            系统功能
          </h3>
          <ul className='space-y-2 text-sm text-zinc-600 dark:text-zinc-400'>
            <li className='flex items-start'>
              <svg
                className='mr-2 h-5 w-5 shrink-0 text-green-500'
                width='20'
                height='20'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
              案件管理与追踪
            </li>
            <li className='flex items-start'>
              <svg
                className='mr-2 h-5 w-5 shrink-0 text-green-500'
                width='20'
                height='20'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
              AI驱动的智能辩论
            </li>
            <li className='flex items-start'>
              <svg
                className='mr-2 h-5 w-5 shrink-0 text-green-500'
                width='20'
                height='20'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
              法律条款智能检索
            </li>
            <li className='flex items-start'>
              <svg
                className='mr-2 h-5 w-5 shrink-0 text-green-500'
                width='20'
                height='20'
                fill='currentColor'
                viewBox='0 0 20 20'
              >
                <path
                  fillRule='evenodd'
                  d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                  clipRule='evenodd'
                />
              </svg>
              文档分析与提取
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
