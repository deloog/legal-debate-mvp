'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

/**
 * 登录页面
 */
export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(
          '邮箱或密码错误，如果你还没有注册，请点击下方"注册账户"进行注册'
        );
        setLoading(false);
        return;
      }

      // 保留 sessionStorage，供客户端状态管理使用
      if (data.data?.user) {
        sessionStorage.setItem('user', JSON.stringify(data.data.user));
      }

      // 同步建立 NextAuth session，使 getServerSession() 能正常返回用户信息
      // （不影响自定义 JWT cookie，两套机制并行工作）
      await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      // 触发自定义事件，通知 AuthProvider 更新状态
      window.dispatchEvent(new CustomEvent('login-success'));

      // 跳转目标页
      router.push(redirect);
      router.refresh();
    } catch (err) {
      console.error('登录错误:', err);
      setError('登录失败，请稍后重试');
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
          <p className='text-sm text-slate-600'>登录您的账户</p>
        </div>

        {/* Login Card */}
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
                placeholder='••••••••'
              />
            </div>

            {/* Submit Button */}
            <button
              type='submit'
              disabled={loading}
              className='w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60'
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* Test Accounts Info */}
          <div className='mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4'>
            <h3 className='mb-2 text-sm font-semibold text-blue-900'>
              测试账户信息
            </h3>
            <div className='space-y-2 text-xs text-blue-800'>
              <div>
                <p className='font-medium'>测试用户:</p>
                <p>邮箱: test@example.com</p>
                <p>密码: test123</p>
              </div>
              <div className='border-t border-blue-200 pt-2'>
                <p className='font-medium'>管理员:</p>
                <p>邮箱: admin@example.com</p>
                <p>密码: admin123</p>
              </div>
            </div>
          </div>

          {/* Footer Links */}
          <div className='mt-6 flex flex-col items-center gap-3 text-center'>
            <Link
              href='/register'
              className='text-sm font-medium text-violet-600 transition-colors hover:text-violet-700 hover:underline'
            >
              还没有账户？点击注册
            </Link>
            <Link
              href='/'
              className='text-sm text-slate-500 transition-colors hover:text-slate-600 hover:underline'
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
