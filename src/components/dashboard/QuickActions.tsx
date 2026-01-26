/**
 * 快速操作按钮组件
 */

'use client';

import Link from 'next/link';
import type { QuickAction as QuickActionType } from '@/types/dashboard';

interface QuickActionsProps {
  actions: QuickActionType[];
}

const colorClasses: Record<string, string> = {
  blue: 'bg-gradient-to-br from-blue-500 to-cyan-500',
  green: 'bg-gradient-to-br from-green-500 to-emerald-500',
  yellow: 'bg-gradient-to-br from-yellow-500 to-orange-500',
  purple: 'bg-gradient-to-br from-purple-500 to-violet-500',
  red: 'bg-gradient-to-br from-red-500 to-rose-500',
};

const icons: Record<string, string> = {
  plus: 'M12 4v16m8-8H4',
  'user-plus':
    'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
  calendar:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'check-square':
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
};

/**
 * 快速操作组件
 */
export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
      <h3 className='mb-6 text-lg font-semibold text-slate-900'>快速操作</h3>
      <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
        {actions.map(action => (
          <Link
            key={action.id}
            href={action.href}
            className='group flex flex-col items-center gap-3 rounded-xl border-2 border-slate-100 bg-slate-50 p-5 transition-all duration-200 hover:scale-105 hover:border-violet-300 hover:bg-gradient-to-br hover:from-blue-50 hover:to-violet-50 hover:shadow-lg'
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[action.color]} shadow-md transition-all duration-200 group-hover:scale-110 group-hover:shadow-lg`}
            >
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
                  d={icons[action.icon] || icons.plus}
                />
              </svg>
            </div>
            <span className='text-sm font-semibold text-slate-700 transition-colors group-hover:text-violet-600'>
              {action.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
