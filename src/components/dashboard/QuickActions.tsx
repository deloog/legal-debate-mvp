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
  blue: 'bg-blue-500 hover:bg-blue-600',
  green: 'bg-green-500 hover:bg-green-600',
  yellow: 'bg-yellow-500 hover:bg-yellow-600',
  purple: 'bg-purple-500 hover:bg-purple-600',
  red: 'bg-red-500 hover:bg-red-600',
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
    <div className='rounded-lg border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      <h3 className='mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50'>
        快速操作
      </h3>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
        {actions.map(action => (
          <Link
            key={action.id}
            href={action.href}
            className={`flex flex-col items-center rounded-lg p-4 text-center transition-all duration-200 hover:shadow-md ${colorClasses[action.color]} text-white`}
          >
            <svg
              className='mb-2 h-6 w-6'
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
            <span className='text-sm font-medium'>{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
