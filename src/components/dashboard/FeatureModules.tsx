/**
 * 功能模块导航组件
 */

'use client';

import Link from 'next/link';
import type { FeatureModule as FeatureModuleType } from '@/types/dashboard';

interface FeatureModulesProps {
  modules: FeatureModuleType[];
}

const icons: Record<string, string> = {
  users:
    'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  briefcase:
    'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M4 9h16',
  team: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  calendar:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  'message-square': 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  tool: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 4.17 2.936a1.724 1.724 0 001.066 2.573c.94 1.543-.826 3.31-2.936 4.17a1.724 1.724 0 00-2.573 1.066c-1.543.94-3.31-.826-4.17-2.936a1.724 1.724 0 00-1.066-2.573c-.94-1.543.826-3.31 2.936-4.17a1.724 1.724 0 00-2.573-1.066zM17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314l-4.244 4.243a8 8 0 01-11.314 0z',
  'bar-chart': 'M18 20V10M12 20V4M6 20v-6',
  settings:
    'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 4.17 2.936a1.724 1.724 0 001.066 2.573c.94 1.543-.826 3.31-2.936 4.17a1.724 1.724 0 00-2.573 1.066c-1.543.94-3.31-.826-4.17-2.936a1.724 1.724 0 00-1.066-2.573c-.94-1.543.826-3.31 2.936-4.17a1.724 1.724 0 00-2.573-1.066zM17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314-11.314l-4.244 4.243a8 8 0 01-11.314 0z M9 12l2 2 4-4',
};

/**
 * 功能模块组件
 */
export function FeatureModules({ modules }: FeatureModulesProps) {
  return (
    <div className='rounded-lg border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      <h3 className='mb-6 text-lg font-semibold text-gray-900 dark:text-gray-50'>
        功能导航
      </h3>
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {modules.map(module => (
          <FeatureCard key={module.id} module={module} />
        ))}
      </div>
    </div>
  );
}

/**
 * 功能卡片组件
 */
function FeatureCard({ module }: { module: FeatureModuleType }) {
  const iconPath = icons[module.icon] || icons.briefcase;

  return (
    <Link
      href={module.href}
      className='group flex flex-col rounded-lg border border-gray-200 bg-white p-5 transition-all duration-200 hover:border-blue-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-blue-600'
    >
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'>
          <svg
            className='h-5 w-5'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d={iconPath}
            />
          </svg>
        </div>
        {module.badge && (
          <span className='rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-900 dark:text-blue-400'>
            {module.badge}
          </span>
        )}
      </div>
      <h4 className='mb-2 text-base font-semibold text-gray-900 dark:text-gray-50 group-hover:text-blue-600 dark:group-hover:text-blue-400'>
        {module.title}
      </h4>
      <p className='line-clamp-2 text-sm text-gray-600 dark:text-gray-400'>
        {module.description}
      </p>
    </Link>
  );
}
