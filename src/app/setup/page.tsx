/**
 * 系统配置指南页面
 */

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SetupPage() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>('database');

  const steps = [
    {
      id: 'database',
      title: '配置数据库',
      icon: (
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4'
        />
      ),
      content: (
        <div className='space-y-4'>
          <p className='text-sm text-slate-600'>
            系统使用 PostgreSQL 数据库存储数据。请按以下步骤配置：
          </p>
          <div className='space-y-3'>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                1. 安装 PostgreSQL
              </p>
              <p className='text-sm text-slate-600'>
                从{' '}
                <a
                  href='https://www.postgresql.org/download/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-medium text-violet-600 hover:underline'
                >
                  &ldquo;官网&rdquo;
                </a>{' '}
                下载并安装 PostgreSQL
              </p>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                2. 创建数据库
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>createdb legal_debate_mvp</code>
              </pre>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                3. 配置环境变量
              </p>
              <p className='mb-2 text-sm text-slate-600'>
                在项目根目录创建{' '}
                <code className='rounded bg-slate-100 px-2 py-1'>.env</code>{' '}
                文件：
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>DATABASE_URL="postgresql://username:password@localhost:5432/legal_debate_mvp"</code>
              </pre>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                4. 初始化数据表
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>npm run db:push</code>
              </pre>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'auth',
      title: '配置认证系统',
      icon: (
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
        />
      ),
      content: (
        <div className='space-y-4'>
          <p className='text-sm text-slate-600'>
            系统使用 NextAuth.js 进行用户认证。配置步骤：
          </p>
          <div className='space-y-3'>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                1. 配置 NextAuth 密钥
              </p>
              <p className='mb-2 text-sm text-slate-600'>
                在
                <code className='rounded bg-slate-100 px-2 py-1'>.env</code>
                文件中添加：
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>
                  NEXTAUTH_SECRET="your-secret-key-here"{'\n'}
                  NEXTAUTH_URL="http://localhost:3000"
                </code>
              </pre>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                2. 生成密钥
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>openssl rand -base64 32</code>
              </pre>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                3. 创建初始用户
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>npm run db:seed</code>
              </pre>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai',
      title: '配置 AI 服务',
      icon: (
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z'
        />
      ),
      content: (
        <div className='space-y-4'>
          <p className='text-sm text-slate-600'>
            AI 辩论功能使用 Anthropic Claude API。配置步骤：
          </p>
          <div className='space-y-3'>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                1. 获取 API 密钥
              </p>
              <p className='text-sm text-slate-600'>
                从{' '}
                <a
                  href='https://console.anthropic.com/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-medium text-violet-600 hover:underline'
                >
                  Anthropic Console
                </a>{' '}
                获取 API 密钥
              </p>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                2. 配置环境变量
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>ANTHROPIC_API_KEY="your-api-key-here"</code>
              </pre>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'start',
      title: '启动应用',
      icon: (
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        />
      ),
      content: (
        <div className='space-y-4'>
          <p className='text-sm text-slate-600'>
            完成以上配置后，重启开发服务器：
          </p>
          <div className='space-y-3'>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                1. 停止当前服务器
              </p>
              <p className='text-sm text-slate-600'>
                在终端按 <kbd className='rounded bg-slate-100 px-2 py-1'>Ctrl+C</kbd>
              </p>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                2. 重新启动
              </p>
              <pre className='rounded-lg bg-slate-900 p-3 text-sm text-slate-100'>
                <code>npm run dev</code>
              </pre>
            </div>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-700'>
                3. 访问应用
              </p>
              <p className='text-sm text-slate-600'>
                打开浏览器访问{' '}
                <a
                  href='http://localhost:3000'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='font-medium text-violet-600 hover:underline'
                >
                  http://localhost:3000
                </a>
              </p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50'>
      {/* Header */}
      <header className='border-b border-slate-200 bg-white/80 backdrop-blur-xl'>
        <div className='mx-auto max-w-7xl px-6 py-4'>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-slate-900'>
                系统配置指南
              </h1>
              <p className='mt-1 text-sm text-slate-600'>
                按照以下步骤完成系统配置
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
      <main className='mx-auto max-w-4xl px-6 py-12'>
        {/* Notice */}
        <div className='mb-8 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6'>
          <div className='flex gap-4'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-200'>
              <svg
                className='h-5 w-5 text-blue-600'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
            <div>
              <h3 className='mb-1 font-semibold text-blue-900'>
                首次使用需要配置
              </h3>
              <p className='text-sm text-blue-700'>
                系统的案件管理、客户管理、AI辩论等功能需要完成以下配置后才能使用。配置过程预计需要 10-15 分钟。
              </p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className='space-y-4'>
          {steps.map((step, index) => (
            <div
              key={step.id}
              className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all'
            >
              <button
                onClick={() =>
                  setExpanded(expanded === step.id ? null : step.id)
                }
                className='flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-slate-50'
              >
                <div className='flex items-center gap-4'>
                  <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600'>
                    <svg
                      className='h-6 w-6 text-white'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      {step.icon}
                    </svg>
                  </div>
                  <div>
                    <div className='mb-1 flex items-center gap-2'>
                      <span className='flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700'>
                        {index + 1}
                      </span>
                      <h3 className='text-lg font-semibold text-slate-900'>
                        {step.title}
                      </h3>
                    </div>
                  </div>
                </div>
                <svg
                  className={`h-5 w-5 text-slate-400 transition-transform ${
                    expanded === step.id ? 'rotate-180' : ''
                  }`}
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M19 9l-7 7-7-7'
                  />
                </svg>
              </button>
              {expanded === step.id && (
                <div className='border-t border-slate-200 bg-slate-50 p-6'>
                  {step.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className='mt-8 flex gap-4'>
          <Link
            href='/'
            className='rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl'
          >
            返回首页
          </Link>
          <a
            href='https://github.com/anthropics/claude-code'
            target='_blank'
            rel='noopener noreferrer'
            className='rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-violet-300 hover:shadow-md'
          >
            查看文档
          </a>
        </div>
      </main>
    </div>
  );
}
