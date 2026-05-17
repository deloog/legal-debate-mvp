'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Scale, Building2 } from 'lucide-react';
import { getDefaultAuthDestination } from '@/lib/auth/role-onboarding';

/**
 * 注册页面
 * 新增：角色选择（认证律师 / 企业法务）和用户协议勾选
 */
export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  // 角色选择：LAWYER（认证律师）或 ENTERPRISE（企业法务），初始为空
  const [role, setRole] = useState<'LAWYER' | 'ENTERPRISE' | ''>('');
  // 用户协议勾选状态，初始为未勾选
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function readErrorMessage(response: Response): Promise<string> {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return data.message || data.error?.message || data.error || '注册失败';
    }

    if (response.status >= 500) {
      return `服务器异常（HTTP ${response.status}），请联系管理员查看部署日志`;
    }

    return `请求失败（HTTP ${response.status}）`;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 将角色字段加入注册请求体
        body: JSON.stringify({ email, password, name, role }),
      });

      if (!response.ok) {
        setError(await readErrorMessage(response));
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        setError(data.message || data.error?.message || '注册失败');
        setLoading(false);
        return;
      }

      sessionStorage.setItem('user', JSON.stringify(data.data.user));
      window.dispatchEvent(new CustomEvent('login-success'));

      router.push(getDefaultAuthDestination(data.data.user.role));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : '注册失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50 px-4 py-10'>
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
          <h1 className='mb-2 text-3xl font-bold text-slate-900'>律伴AI助手</h1>
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

            {/* 角色选择（必选） */}
            <div>
              <label className='mb-2 block text-sm font-medium text-slate-700'>
                身份类型 <span className='text-red-500'>*</span>
              </label>
              <div className='grid grid-cols-2 gap-3'>
                {/* 认证律师 */}
                <button
                  type='button'
                  onClick={() => setRole('LAWYER')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                    role === 'LAWYER'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Scale
                    className={`h-6 w-6 ${role === 'LAWYER' ? 'text-violet-600' : 'text-slate-400'}`}
                  />
                  <div className='text-center'>
                    <p
                      className={`text-sm font-semibold ${role === 'LAWYER' ? 'text-violet-700' : 'text-slate-700'}`}
                    >
                      认证律师
                    </p>
                    <p className='mt-0.5 text-xs text-slate-500'>
                      具有执业资格的专业律师
                    </p>
                  </div>
                </button>

                {/* 企业法务 */}
                <button
                  type='button'
                  onClick={() => setRole('ENTERPRISE')}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-left transition-all ${
                    role === 'ENTERPRISE'
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Building2
                    className={`h-6 w-6 ${role === 'ENTERPRISE' ? 'text-violet-600' : 'text-slate-400'}`}
                  />
                  <div className='text-center'>
                    <p
                      className={`text-sm font-semibold ${role === 'ENTERPRISE' ? 'text-violet-700' : 'text-slate-700'}`}
                    >
                      企业法务
                    </p>
                    <p className='mt-0.5 text-xs text-slate-500'>
                      企业内部法务人员
                    </p>
                  </div>
                </button>
              </div>
              {/* 未选择角色时的提示 */}
              {!role && (
                <p className='mt-1.5 text-xs text-slate-400'>
                  请选择您的身份类型
                </p>
              )}
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

            {/* 用户协议勾选（放在提交按钮上方） */}
            <div className='flex items-start gap-2.5'>
              <input
                id='agreed'
                type='checkbox'
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className='mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-violet-600 cursor-pointer'
              />
              <label
                htmlFor='agreed'
                className='text-sm text-slate-600 cursor-pointer leading-relaxed'
              >
                我已阅读并同意{' '}
                <Link
                  href='/terms'
                  target='_blank'
                  className='font-medium text-violet-600 hover:text-violet-700 hover:underline transition-colors'
                >
                  服务条款
                </Link>{' '}
                和{' '}
                <Link
                  href='/privacy'
                  target='_blank'
                  className='font-medium text-violet-600 hover:text-violet-700 hover:underline transition-colors'
                >
                  隐私政策
                </Link>
              </label>
            </div>

            {/* Submit Button：没选角色或未勾选协议时禁用 */}
            <button
              type='submit'
              disabled={loading || !agreed || !role}
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
