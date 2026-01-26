/**
 * AI 辩论列表页面
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DebatesListPage() {
  const router = useRouter();

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50'>
      {/* Header */}
      <header className='border-b border-slate-200 bg-white/80 backdrop-blur-xl'>
        <div className='mx-auto max-w-7xl px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-slate-900'>AI 辩论系统</h1>
              <p className='mt-1 text-sm text-slate-600'>
                智能法律辩论分析和论点生成
              </p>
            </div>
            <button
              onClick={() => router.push('/')}
              className='rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:shadow-md'
            >
              返回首页
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='mx-auto max-w-7xl px-6 py-12'>
        {/* Hero Section */}
        <div className='mb-12 text-center'>
          <div className='mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-violet-500/30'>
            <svg
              className='h-10 w-10 text-white'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z'
              />
            </svg>
          </div>
          <h2 className='mb-4 text-4xl font-bold text-slate-900'>
            AI 驱动的法律辩论分析
          </h2>
          <p className='mx-auto max-w-2xl text-lg text-slate-600'>
            使用人工智能技术，自动生成正反方论点，分析法律依据，辅助律师进行案件准备
          </p>
        </div>

        {/* Feature Cards */}
        <div className='mb-12 grid gap-6 md:grid-cols-3'>
          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
            <div className='mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100'>
              <svg
                className='h-6 w-6 text-blue-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
                />
              </svg>
            </div>
            <h3 className='mb-2 text-lg font-semibold text-slate-900'>
              智能论点生成
            </h3>
            <p className='text-sm text-slate-600'>
              基于案件事实和法律依据，自动生成正反双方的核心论点
            </p>
          </div>

          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
            <div className='mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100'>
              <svg
                className='h-6 w-6 text-violet-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253'
                />
              </svg>
            </div>
            <h3 className='mb-2 text-lg font-semibold text-slate-900'>
              法条智能检索
            </h3>
            <p className='text-sm text-slate-600'>
              自动检索相关法律条文，为每个论点提供法律支撑
            </p>
          </div>

          <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
            <div className='mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100'>
              <svg
                className='h-6 w-6 text-purple-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z'
                />
              </svg>
            </div>
            <h3 className='mb-2 text-lg font-semibold text-slate-900'>
              多轮次辩论
            </h3>
            <p className='text-sm text-slate-600'>
              支持多轮辩论推演，逐步深化论证，完善辩护策略
            </p>
          </div>
        </div>

        {/* Getting Started */}
        <div className='rounded-2xl border border-slate-200 bg-white p-8 shadow-sm'>
          <h3 className='mb-6 text-xl font-bold text-slate-900'>
            如何开始使用 AI 辩论？
          </h3>
          <div className='space-y-4'>
            <div className='flex gap-4'>
              <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600'>
                1
              </div>
              <div>
                <h4 className='mb-1 font-semibold text-slate-900'>
                  创建或选择案件
                </h4>
                <p className='text-sm text-slate-600'>
                  前往{' '}
                  <Link
                    href='/cases'
                    className='font-medium text-violet-600 hover:underline'
                  >
                    案件管理
                  </Link>{' '}
                  页面，创建新案件或选择现有案件
                </p>
              </div>
            </div>

            <div className='flex gap-4'>
              <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-600'>
                2
              </div>
              <div>
                <h4 className='mb-1 font-semibold text-slate-900'>
                  输入案件信息
                </h4>
                <p className='text-sm text-slate-600'>
                  填写案件的基本信息、事实描述和争议焦点
                </p>
              </div>
            </div>

            <div className='flex gap-4'>
              <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-600'>
                3
              </div>
              <div>
                <h4 className='mb-1 font-semibold text-slate-900'>
                  启动 AI 辩论分析
                </h4>
                <p className='text-sm text-slate-600'>
                  在案件详情页点击&ldquo;开始辩论&rdquo;，AI
                  将自动生成正反方论点和法律依据
                </p>
              </div>
            </div>
          </div>

          <div className='mt-8 flex gap-4'>
            <Link
              href='/cases'
              className='rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl'
            >
              前往案件管理
            </Link>
            <Link
              href='/'
              className='rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:shadow-md'
            >
              返回首页
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
