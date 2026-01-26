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
import type {
  DashboardData,
  QuickAction as QuickActionType,
  FeatureModule as FeatureModuleType,
} from '@/types/dashboard';

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [quickActions, setQuickActions] = useState<QuickActionType[]>([]);
  const [featureModules, setFeatureModules] = useState<FeatureModuleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
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
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 临时注释掉loading状态以诊断问题
  // 添加调试日志
  console.log('当前状态:', { loading, error, hasData: !!data });
  /*
  if (loading) {
    return (
      <div className='fixed inset-0 flex items-center justify-center bg-zinc-50 font-sans dark:bg-black'>
        <div className='flex flex-col items-center gap-4 p-8'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-zinc-800 dark:border-t-blue-400' />
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            加载中...
          </p>
        </div>
      </div>
    );
  }
  */

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

  return (
    <div className='min-h-screen bg-zinc-50 font-sans dark:bg-black'>
      <header className='sticky top-0 z-50 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between py-4'>
          <Link href='/' className='flex items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-blue-600 to-blue-700 text-white shadow-md'>
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
                  d='M3 6l3 1m0 0l-3-1M3 6l18 5M12 6v9m0 0l-3-1m3 1l3-1M6 6l18 5M12 6v9'
                />
              </svg>
            </div>
            <div className='hidden sm:block'>
              <h1 className='text-lg font-bold text-gray-900 dark:text-gray-50'>
                律伴助手
              </h1>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                AI驱动的法律助手系统
              </p>
            </div>
          </Link>

          <nav className='hidden items-center gap-6 md:flex'>
            <Link
              href='/dashboard'
              className='text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
            >
              Dashboard
            </Link>
            <Link
              href='/cases'
              className='text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
            >
              案件管理
            </Link>
            <Link
              href='/clients'
              className='text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
            >
              客户管理
            </Link>
            <Link
              href='/debates'
              className='text-sm font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400'
            >
              AI辩论
            </Link>
          </nav>

          <button className='rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden dark:text-gray-400 dark:hover:bg-zinc-800'>
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

      <main className='mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
        <div className='mb-6'>
          <h2 className='text-2xl font-bold text-gray-900 dark:text-gray-50'>
            欢迎回来
          </h2>
          <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
            这里是您的工作台，快速了解系统概况
          </p>
        </div>

        {data && data.stats && (
          <div className='mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            {data.stats.map(stat => (
              <StatCard key={stat.id} card={stat} />
            ))}
          </div>
        )}

        {quickActions && quickActions.length > 0 && (
          <div className='mb-6'>
            <QuickActions actions={quickActions} />
          </div>
        )}

        <div className='grid gap-6 lg:grid-cols-3'>
          <div className='lg:col-span-2'>
            {featureModules && featureModules.length > 0 && (
              <FeatureModules modules={featureModules} />
            )}
          </div>

          <div className='lg:col-span-1'>
            {data &&
            data.recentActivities &&
            data.recentActivities.length > 0 ? (
              <RecentActivities activities={data.recentActivities} />
            ) : (
              <div className='rounded-lg border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
                <h3 className='mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50'>
                  近期活动
                </h3>
                <p className='py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
                  暂无近期活动
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='mt-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
          <h3 className='mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50'>
            系统信息
          </h3>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                当前版本
              </p>
              <p className='mt-1 text-sm text-gray-900 dark:text-gray-50'>
                v1.0.0
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                最后更新
              </p>
              <p className='mt-1 text-sm text-gray-900 dark:text-gray-50'>
                2026年1月26日
              </p>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                系统状态
              </p>
              <div className='mt-1 flex items-center gap-2'>
                <span className='flex h-2 w-2 shrink-0 rounded-full bg-green-500' />
                <p className='text-sm text-gray-900 dark:text-gray-50'>
                  运行正常
                </p>
              </div>
            </div>
            <div>
              <p className='text-xs font-medium text-gray-500 dark:text-gray-400'>
                技术支持
              </p>
              <p className='mt-1 text-sm text-gray-900 dark:text-gray-50'>
                7×24小时在线
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className='mt-12 border-t border-gray-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8'>
          <p className='text-sm text-gray-500 dark:text-gray-400'>
            © 2026 律伴助手. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
