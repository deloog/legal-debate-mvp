/**
 * 首页 - Dashboard
 * 功能：展示数据概览、快速操作、功能导航、近期活动
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/dashboard/StatCard';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { FeatureModules } from '@/components/dashboard/FeatureModules';
import { RecentActivities } from '@/components/dashboard/RecentActivities';
import { getQuickActions, getFeatureModules } from '@/app/api/dashboard/route';
import { useAuth } from '@/app/providers/AuthProvider';
import type {
  DashboardData,
  QuickAction as QuickActionType,
  FeatureModule as FeatureModuleType,
} from '@/types/dashboard';

export default function Home() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [quickActions, setQuickActions] = useState<QuickActionType[]>([]);
  const [featureModules, setFeatureModules] = useState<FeatureModuleType[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setError(null);

        const [dashboardResponse, actions, modules] = await Promise.all([
          fetch('/api/dashboard'),
          getQuickActions(),
          getFeatureModules(),
        ]);

        const dashboardResult = await dashboardResponse.json();
        if (dashboardResult.success) {
          setData(dashboardResult.data);
        }

        setQuickActions(actions);
        setFeatureModules(modules);
      } catch (err) {
        console.error('加载Dashboard数据失败:', err);
        setError('加载数据失败，请刷新页面重试');
      }
    }

    loadData();
  }, []);

  // 移除调试日志，避免不断重新渲染导致性能问题
  // console.log('当前状态:', { loading, error, hasData: !!data });

  if (error) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black'>
        <div className='max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/20'>
          <p className='text-sm font-medium text-red-800 dark:text-red-300'>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className='mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  // 用户下拉菜单组件
  function UserMenu() {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className='relative'>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className='flex items-center gap-3 rounded-lg p-2 hover:bg-slate-100 transition-colors'
        >
          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 text-white font-semibold'>
            {user?.name?.charAt(0).toUpperCase() ||
              user?.email.charAt(0).toUpperCase()}
          </div>
          <div className='hidden md:block text-left'>
            <p className='text-sm font-medium text-slate-900'>
              {user?.name || user?.username || '用户'}
            </p>
            <p className='text-xs text-slate-500'>{user?.email}</p>
          </div>
          <svg
            className={`h-5 w-5 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
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

        {isOpen && (
          <div className='absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-2'>
            <div className='px-4 py-2 border-b border-slate-100'>
              <p className='text-xs font-medium text-slate-500'>角色</p>
              <p className='text-sm font-semibold text-slate-900'>
                {user?.role === 'ADMIN' ? '管理员' : '用户'}
              </p>
            </div>
            <Link
              href='/dashboard'
              className='block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'
              onClick={() => setIsOpen(false)}
            >
              工作台
            </Link>
            <Link
              href='/profile'
              className='block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'
              onClick={() => setIsOpen(false)}
            >
              个人设置
            </Link>
            <div className='border-t border-slate-100 mt-2 pt-2'>
              <button
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className='w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50'
              >
                退出登录
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50'>
      {/* 专业导航栏 */}
      <header className='sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8'>
          <Link href='/' className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-violet-600 to-purple-600 shadow-lg shadow-violet-500/30'>
              <svg
                className='h-6 w-6 text-white'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M3 6l3 1m0 0l-3 1m0-1l18 5M6 8l0 13M6 8l18 5m-18 5l6-2m6 0l6 2M6 13l6 3m6-3l6 3'
                />
              </svg>
            </div>
            <div>
              <h1 className='text-xl font-bold tracking-tight text-slate-900'>
                律伴助手
              </h1>
              <p className='text-xs font-medium text-slate-500'>
                AI Legal Intelligence Platform
              </p>
            </div>
          </Link>

          <div className='flex items-center gap-4'>
            <nav className='hidden items-center gap-8 md:flex'>
              <Link
                href='/dashboard'
                className='text-sm font-semibold text-slate-700 transition-colors hover:text-violet-600'
              >
                工作台
              </Link>
              <Link
                href='/cases'
                className='text-sm font-semibold text-slate-700 transition-colors hover:text-violet-600'
              >
                案件管理
              </Link>
              <Link
                href='/clients'
                className='text-sm font-semibold text-slate-700 transition-colors hover:text-violet-600'
              >
                客户管理
              </Link>
              <Link
                href='/debates'
                className='text-sm font-semibold text-slate-700 transition-colors hover:text-violet-600'
              >
                AI 辩论
              </Link>
            </nav>

            {user ? (
              <UserMenu />
            ) : (
              <Link
                href='/login'
                className='hidden rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/30 transition-all hover:shadow-lg md:block'
              >
                登录
              </Link>
            )}
          </div>

          <button className='rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 md:hidden'>
            <svg
              className='h-6 w-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 6h16M4 12h16M4 18h16'
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Hero 区域 - 价值主张 */}
      <section className='relative overflow-hidden bg-gradient-to-br from-slate-900 via-violet-900 to-purple-900 px-6 py-20 lg:px-8 lg:py-28'>
        <div className='absolute inset-0 bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=")] opacity-40' />
        <div className='relative mx-auto max-w-6xl text-center'>
          <div className='mb-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm'>
            <span className='relative flex h-2 w-2'>
              <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75'></span>
              <span className='relative inline-flex h-2 w-2 rounded-full bg-violet-500'></span>
            </span>
            AI 驱动的法律智能平台
          </div>
          <h2 className='mb-6 text-5xl font-bold tracking-tight text-white lg:text-6xl'>
            让法律工作
            <br />
            <span className='bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent'>
              更高效、更智能
            </span>
          </h2>
          <p className='mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-300'>
            整合案件管理、客户关系、AI
            辩论分析于一体，为法律专业人士提供全方位的智能化解决方案，助力您专注于核心法律服务
          </p>
          <div className='flex flex-col items-center justify-center gap-4 sm:flex-row'>
            <Link
              href='/cases'
              className='rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/50 transition-all hover:shadow-xl hover:shadow-violet-500/60'
            >
              开始使用
            </Link>
            <Link
              href='/dashboard'
              className='rounded-xl border-2 border-white/20 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20'
            >
              查看仪表盘
            </Link>
          </div>
        </div>
      </section>

      <main className='mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16'>
        {/* 配置提示横幅 */}
        <div
          data-banner='setup'
          className='mb-8 rounded-2xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-6'
        >
          <div className='flex items-start gap-4'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200'>
              <svg
                className='h-5 w-5 text-amber-700'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                />
              </svg>
            </div>
            <div className='flex-1'>
              <h3 className='mb-2 font-semibold text-amber-900'>
                ⚠️ 首次使用请先完成系统配置
              </h3>
              <p className='mb-3 text-sm text-amber-800'>
                案件管理、客户管理、AI辩论等核心功能需要配置数据库和认证系统后才能正常使用。配置过程约需
                10-15 分钟。
              </p>
              <Link
                href='/setup'
                className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg'
              >
                <svg
                  className='h-4 w-4'
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
                查看配置指南
              </Link>
            </div>
          </div>
        </div>

        {/* 数据统计仪表盘 */}
        {data && data.stats && (
          <section className='mb-16'>
            <div className='mb-8'>
              <h3 className='text-2xl font-bold text-slate-900'>数据概览</h3>
              <p className='mt-2 text-sm text-slate-600'>
                实时追踪关键业务指标和工作进展
              </p>
            </div>
            <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
              {data.stats.map(stat => (
                <StatCard key={stat.id} card={stat} />
              ))}
            </div>
          </section>
        )}

        {/* 核心功能模块 */}
        <section className='mb-16'>
          <div className='mb-8'>
            <h3 className='text-2xl font-bold text-slate-900'>核心功能</h3>
            <p className='mt-2 text-sm text-slate-600'>
              快速访问常用功能，提升工作效率
            </p>
          </div>
          {featureModules && featureModules.length > 0 && (
            <FeatureModules modules={featureModules} />
          )}
        </section>

        {/* 快速操作和近期活动 */}
        <div className='grid gap-6 lg:grid-cols-3'>
          {/* 快速操作 */}
          {quickActions && quickActions.length > 0 && (
            <div className='lg:col-span-2'>
              <QuickActions actions={quickActions} />
            </div>
          )}

          {/* 近期活动 */}
          <div className='lg:col-span-1'>
            {data &&
            data.recentActivities &&
            data.recentActivities.length > 0 ? (
              <RecentActivities activities={data.recentActivities} />
            ) : (
              <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
                <h3 className='mb-4 text-lg font-semibold text-slate-900'>
                  近期活动
                </h3>
                <div className='flex flex-col items-center justify-center py-12'>
                  <div className='mb-4 rounded-full bg-slate-100 p-4'>
                    <svg
                      className='h-8 w-8 text-slate-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                      />
                    </svg>
                  </div>
                  <p className='text-sm text-slate-500'>暂无近期活动</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 专业页脚 */}
      <footer className='mt-20 border-t border-slate-200 bg-slate-50 py-12'>
        <div className='mx-auto max-w-7xl px-6 lg:px-8'>
          <div className='grid gap-8 lg:grid-cols-4'>
            <div className='lg:col-span-2'>
              <div className='mb-4 flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-violet-600 to-purple-600'>
                  <svg
                    className='h-5 w-5 text-white'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M3 6l3 1m0 0l-3 1m0-1l18 5M6 8l0 13M6 8l18 5m-18 5l6-2m6 0l6 2M6 13l6 3m6-3l6 3'
                    />
                  </svg>
                </div>
                <span className='text-lg font-bold text-slate-900'>
                  律伴助手
                </span>
              </div>
              <p className='mb-4 text-sm leading-relaxed text-slate-600'>
                专为法律专业人士打造的 AI
                智能工作平台，整合案件管理、客户关系、智能分析等核心功能，让法律工作更高效。
              </p>
              <p className='text-xs text-slate-500'>
                © 2026 律伴助手. All rights reserved.
              </p>
            </div>
            <div>
              <h4 className='mb-4 text-sm font-semibold text-slate-900'>
                产品
              </h4>
              <ul className='space-y-2 text-sm text-slate-600'>
                <li>
                  <Link href='/cases' className='hover:text-violet-600'>
                    案件管理
                  </Link>
                </li>
                <li>
                  <Link href='/clients' className='hover:text-violet-600'>
                    客户管理
                  </Link>
                </li>
                <li>
                  <Link href='/debates' className='hover:text-violet-600'>
                    AI 辩论
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className='mb-4 text-sm font-semibold text-slate-900'>
                支持
              </h4>
              <ul className='space-y-2 text-sm text-slate-600'>
                <li>
                  <a href='#' className='hover:text-violet-600'>
                    帮助中心
                  </a>
                </li>
                <li>
                  <a href='#' className='hover:text-violet-600'>
                    联系我们
                  </a>
                </li>
                <li>
                  <span className='inline-flex items-center gap-1.5'>
                    <span className='h-1.5 w-1.5 rounded-full bg-green-500'></span>
                    <span className='text-slate-900'>系统正常运行</span>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
