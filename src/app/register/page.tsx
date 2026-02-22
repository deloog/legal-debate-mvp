'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/**
 * 注册页面
 */
export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.message || data.error?.message || '注册失败');
        setLoading(false);
        return;
      }

      // 注册成功后跳转到登录页
      router.push('/login?registered=1');
    } catch {
      setError('注册失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50 px-4'>
      <div className='w-full max-w-md'>
        {/* Logo and Title */}
        <div className='mb-8 text-center'>
          <div className='mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-lg shadow-violet-500/30'>
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
                d='M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3'
              />
            </svg>
          </div>
          <h1 className='mb-2 text-3xl font-bold text-slate-900'>
            法律助手系统
          </h1>
          <p className='text-sm text-slate-600'>创建您的账户</p>
        </div>

        {/* Register Card */}
        <div className='rounded-2xl border border-slate-200 bg-white p-8 shadow-xl'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* Error Message */}
            {error && (
              <div className='rounded-lg border border-red-200 bg-red-50 p-4'>
                <div className='flex gap-3'>
                  <svg
                    className='h-5 w-5 shrink-0 text-red-600'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                    />
                  </svg>
                  <p className='text-sm text-red-800'>{error}</p>
                </div>
              </div>
            )}

            {/* Name Input */}
            <div>
              <label
                htmlFor='name'
                className='mb-2 block text-sm font-medium text-slate-700'
              >
                姓名
              </label>
              <input
                id='name'
                type='text'
                value={name}
                onChange={e => setName(e.target.value)}
                className='w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
                placeholder='您的姓名（可选）'
              />
            </div>

            {/* Email Input */}
            <div>
              <label
                htmlFor='email'
                className='mb-2 block text-sm font-medium text-slate-700'
              >
                邮箱地址
              </label>
              <input
                id='email'
                type='email'
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className='w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
                placeholder='your@email.com'
              />
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor='password'
                className='mb-2 block text-sm font-medium text-slate-700'
              >
                密码
              </label>
              <input
                id='password'
                type='password'
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className='w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20'
                placeholder='至少6位，需包含字母和数字'
              />
              <p className='mt-1 text-xs text-slate-500'>
                至少 6 位，需包含字母和数字
              </p>
            </div>

            {/* Submit Button */}
            <button
              type='submit'
              disabled={loading}
              className='w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60'
            >
              {loading ? '注册中...' : '立即注册'}
            </button>
          </form>

          {/* Login Link */}
          <div className='mt-6 text-center text-sm text-slate-600'>
            已有账号？{' '}
            <Link
              href='/login'
              className='font-medium text-violet-600 transition-colors hover:text-violet-700 hover:underline'
            >
              立即登录
            </Link>
          </div>

          {/* Back to Home */}
          <div className='mt-3 text-center'>
            <Link
              href='/'
              className='text-sm text-slate-500 transition-colors hover:text-slate-700 hover:underline'
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
